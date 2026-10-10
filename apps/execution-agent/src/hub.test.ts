import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, request, type IncomingMessage } from "node:http";
import { EventHub, MAX_SSE_CLIENTS } from "@elitr/shared";

/** Open one SSE stream; resolves with the response once headers arrive (the body stays open). */
function open(port: number): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path: "/events", agent: false }, resolve);
    req.on("error", reject);
    req.end();
  });
}

test("SSE: 200 concurrent streams per hub, the next one gets 503; one shared ping timer", async () => {
  const hub = new EventHub("execution");
  const server = createServer((req, res) => hub.sse(req, res));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const open1 = [];
  for (let i = 0; i < MAX_SSE_CLIENTS; i++) open1.push(open(port));
  const streams = await Promise.all(open1);
  assert.ok(streams.every((s) => s.statusCode === 200));
  assert.equal(hub.clientCount, 200);
  assert.equal(typeof (hub as any).ping, "object"); // exactly one timer, not one per client

  const extra = await open(port);
  assert.equal(extra.statusCode, 503);
  const body = await new Promise<string>((r) => {
    let s = "";
    extra.on("data", (d) => (s += d)).on("end", () => r(s));
  });
  assert.deepEqual(JSON.parse(body), { error: "too many event streams" });
  assert.equal(hub.clientCount, 200);

  // Closing one frees a slot.
  streams[0].destroy();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(hub.clientCount, 199);
  const again = await open(port);
  assert.equal(again.statusCode, 200);

  for (const s of [...streams.slice(1), again]) s.destroy();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(hub.clientCount, 0);
  assert.equal((hub as any).ping, undefined); // timer released once nobody listens
  await new Promise<void>((r) => server.close(() => r()));
});

test("replay keeps trades and ratings that fell out of the recent tail, from the log and from memory", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "hub-"));
  const file = join(dir, "events.jsonl");
  const old = [
    { id: "f1", ts: 1, agent: "execution", type: "trade.filled", symbol: "NVDAB", side: "buy", txHash: "0x1", mode: "live" },
    { id: "r1", ts: 2, agent: "execution", type: "reputation.posted", analystId: "analyst", value: 13 },
    { id: "h1", ts: 3, agent: "execution", type: "decision", symbol: "NVDAB", action: "hold", reasons: [] },
  ];
  const noise = Array.from({ length: 800 }, (_, i) => ({ id: `n${i}`, ts: 10 + i, agent: "execution", type: "price.onchain", symbol: "NVDAB", price: 1 }));
  writeFileSync(file, [...old, ...noise].map((e) => JSON.stringify(e)).join("\n") + "\n");
  const hub = new EventHub("execution", file, 500);
  let ids = hub.replay().map((e) => e.id);
  assert.ok(ids.includes("f1") && ids.includes("r1"), "milestones from the log are replayed");
  assert.ok(!ids.includes("h1"), "hold decisions are routine, not milestones");
  assert.equal(ids.at(-1), "n799", "the recent tail still ends the replay");
  // A milestone emitted now, then pushed out of history by routine events, is still replayed.
  hub.emit({ type: "trade.filled", symbol: "TSLAB", side: "sell", txHash: "0x2", mode: "live" } as any);
  const fillId = hub.recent(1)[0].id;
  for (let i = 0; i < 600; i++) hub.emit({ type: "price.onchain", symbol: "TSLAB", price: 1 } as any);
  ids = hub.replay().map((e) => e.id);
  assert.ok(ids.includes(fillId) && ids.includes("f1"));
  assert.equal(new Set(ids).size, ids.length, "no duplicates");
});
