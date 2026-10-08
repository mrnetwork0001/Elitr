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
