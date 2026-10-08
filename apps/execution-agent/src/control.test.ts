import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReputationBook } from "@elitr/reputation";
import { EventHub, loadRiskConfig } from "@elitr/shared";
import { isInternalUrl, parseAnalysts, publicAnalystUrl } from "./analysts.js";
import { ExecutionAgent } from "./cycle.js";
import { parseSignal } from "./pay.js";
import { bearerOk, isLoopback, startServer } from "./server.js";
import { StateStore, writeKillFile } from "./state.js";

const dir = mkdtempSync(join(tmpdir(), "elitr-control-"));
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));

test("bearer token check", () => {
  assert.equal(bearerOk("Bearer s3cret", "s3cret"), true);
  assert.equal(bearerOk("bearer  s3cret ", "s3cret"), true);
  assert.equal(bearerOk("Bearer s3cre", "s3cret"), false);
  assert.equal(bearerOk("s3cret", "s3cret"), false);
  assert.equal(bearerOk(undefined, "s3cret"), false);
});

test("loopback hosts", () => {
  for (const h of ["127.0.0.1", "localhost", "::1", "[::1]", "127.0.1.1"]) assert.equal(isLoopback(h), true, h);
  for (const h of ["0.0.0.0", "192.168.1.5", "::", "example.com"]) assert.equal(isLoopback(h), false, h);
});

test("ANALYSTS parsing, fallback and validation", () => {
  const a = parseAnalysts({ ANALYSTS: "analyst=http://localhost:4001/, analyst-flow=http://localhost:4003" });
  assert.deepEqual(a.endpoints, [
    { id: "analyst", url: "http://localhost:4001" },
    { id: "analyst-flow", url: "http://localhost:4003" },
  ]);
  assert.deepEqual(a.errors, []);
  assert.deepEqual(parseAnalysts({ ANALYST_URL: "http://x:1" }).endpoints, [{ id: "analyst", url: "http://x:1" }]);
  const bad = parseAnalysts({ ANALYSTS: "evil=http://x,analyst=notaurl,analyst-flow=http://ok:4003" });
  assert.equal(bad.errors.length, 2);
  assert.deepEqual(bad.endpoints, [{ id: "analyst-flow", url: "http://ok:4003" }]);
});

test("old signal bodies are completed; mismatched analyst is rejected", () => {
  const old = { symbol: "NVDAB", underlying: "NVDA", score: 70, stance: "bullish", rationale: "", sources: [], generatedAt: new Date().toISOString(), model: "m", headlineCount: 3 };
  const s = parseSignal(old, "NVDAB", "analyst");
  assert.equal(s.analystId, "analyst");
  assert.equal(s.horizonSec, 3600);
  assert.match(s.signalId, /^local-/);
  const n = parseSignal({ ...old, signalId: "abc", analystId: "analyst-flow", horizonSec: 900 }, "NVDAB", "analyst-flow");
  assert.equal(n.signalId, "abc");
  assert.equal(n.horizonSec, 900);
  assert.throws(() => parseSignal({ ...old, analystId: "analyst-flow" }, "NVDAB", "analyst"), /analystId/);
  assert.throws(() => parseSignal({ ...old, symbol: "TSLAB" }, "NVDAB", "analyst"), /symbol/);
});

test("horizonSec is clamped to [60, 86400] and the clamp is reported", () => {
  const old = { symbol: "NVDAB", underlying: "NVDA", score: 70, stance: "bullish", rationale: "", sources: [], generatedAt: new Date().toISOString() };
  const msgs: string[] = [];
  const hub = { emit: (e: any) => msgs.push(`${e.where}: ${e.message}`) } as any;
  assert.equal(parseSignal({ ...old, horizonSec: 5 }, "NVDAB", "analyst", hub).horizonSec, 60);
  assert.equal(parseSignal({ ...old, horizonSec: 10_000_000 }, "NVDAB", "analyst-flow", hub).horizonSec, 86_400);
  assert.equal(parseSignal({ ...old, horizonSec: 1800 }, "NVDAB", "analyst", hub).horizonSec, 1800);
  assert.deepEqual(msgs, ["pay.analyst: horizonSec 5 clamped to 60 (allowed 60-86400)", "pay.analyst-flow: horizonSec 10000000 clamped to 86400 (allowed 60-86400)"]);
  assert.throws(() => parseSignal({ ...old, horizonSec: 0 }, "NVDAB", "analyst", hub), /horizonSec/); // still invalid, not clamped
});

test("control routes: JSON-only /trade, persisted kill switch reset only with the token", async () => {
  const d = join(dir, "srv");
  const killFile = join(d, "kill-switch");
  writeKillFile("POST /kill", killFile); // left behind by a previous run
  const agent = new ExecutionAgent({
    hub: new EventHub("execution"),
    store: new StateStore(join(d, "state.json")),
    risk: loadRiskConfig({}),
    pc: {} as any,
    account: null,
    binance: null,
    book: new ReputationBook(join(d, "rep.json")),
    identity: null,
    // An analyst on a closed port: /info fails fast and its internal URL must not appear in /state.
    cfg: { analysts: [{ id: "analyst", url: "http://127.0.0.1:1" }], live: false, mevProtection: true, tradeUsd: 2, minBnbForGas: 0.001, postFeedback: false, controlAuth: true },
    killFile,
  });
  agent.restorePersistedKill();
  const server = startServer(agent, 0, "127.0.0.1", "t0k3n");
  await new Promise<void>((r) => server.once("listening", () => r()));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const auth = { Authorization: "Bearer t0k3n" };
  try {
    assert.equal((await (await fetch(`${base}/state`)).json()).killSwitch, true);

    let r = await fetch(`${base}/trade`, { method: "POST", headers: auth, body: '{"symbol":"NVDAB","side":"buy"}' });
    assert.equal(r.status, 415);
    r = await fetch(`${base}/trade`, { method: "POST", headers: { ...auth, "Content-Type": "text/plain" }, body: '{"symbol":"NVDAB","side":"buy"}' });
    assert.equal(r.status, 415);
    r = await fetch(`${base}/trade`, { method: "POST", headers: { ...auth, "Content-Type": "application/json; charset=utf-8" }, body: '{"symbol":"NVDAB","side":"buy"}' });
    assert.equal(r.status, 409); // past the content-type gate; refused by the kill switch
    assert.match((await r.json()).detail, /kill switch/);
    r = await fetch(`${base}/trade`, { method: "POST", body: "{}" });
    assert.equal(r.status, 401);

    r = await fetch(`${base}/kill/reset`, { method: "POST" });
    assert.equal(r.status, 401);
    assert.equal(agent.killed, true);
    r = await fetch(`${base}/kill/reset`, { method: "POST", headers: auth });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { killSwitch: false, detail: "kill switch reset" });
    assert.equal(existsSync(killFile), false);
    assert.equal(agent.killed, false);

    r = await fetch(`${base}/kill`, { method: "POST", headers: auth });
    assert.deepEqual(await r.json(), { killSwitch: true });
    assert.equal(existsSync(killFile), true);

    // HEAD mirrors GET without a body; the analysts' internal URLs never leak into /state.
    for (const [p, want] of [["/health", 200], ["/state", 200], ["/events", 200], ["/nope", 404]] as const) {
      const h = await fetch(`${base}${p}`, { method: "HEAD" });
      assert.equal(h.status, want, p);
      assert.equal(await h.text(), "", p);
    }
    assert.equal((await fetch(`${base}/health`, { method: "HEAD" })).headers.get("content-type"), "application/json");
    const st = await (await fetch(`${base}/state`)).json();
    assert.equal(st.controlAuth, true);
    assert.ok(!/localhost|127\.0\.0\.1:1\b/.test(JSON.stringify(st.analysts)), "no internal URL in /state");
    assert.equal(st.analysts.length, 1);
    assert.equal("url" in st.analysts[0], false);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("POST /kill/reset refuses when KILL_SWITCH comes from the environment", async () => {
  const d = join(dir, "env");
  const agent = new ExecutionAgent({
    hub: new EventHub("execution"),
    store: new StateStore(join(d, "state.json")),
    risk: loadRiskConfig({ KILL_SWITCH: "1" }),
    pc: {} as any,
    account: null,
    binance: null,
    book: new ReputationBook(join(d, "rep.json")),
    identity: null,
    cfg: { analysts: [], live: false, mevProtection: true, tradeUsd: 2, minBnbForGas: 0.001, postFeedback: false, controlAuth: true },
    killFile: join(d, "kill-switch"),
  });
  agent.restorePersistedKill();
  const server = startServer(agent, 0, "127.0.0.1", "t0k3n");
  await new Promise<void>((r) => server.once("listening", () => r()));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const r = await fetch(`${base}/kill/reset`, { method: "POST", headers: { Authorization: "Bearer t0k3n" } });
    assert.equal(r.status, 409);
    const body = await r.json();
    assert.equal(body.killSwitch, true);
    assert.match(body.detail, /KILL_SWITCH env/);
    assert.equal(agent.killed, true);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("public analyst URL: registration web endpoint, then env, never localhost", () => {
  assert.equal(isInternalUrl("http://localhost:4001"), true);
  assert.equal(isInternalUrl("http://127.0.0.1:4003/"), true);
  assert.equal(isInternalUrl("http://[::1]:4001"), true);
  assert.equal(isInternalUrl("http://0.0.0.0:4001"), true);
  assert.equal(isInternalUrl("not a url"), true);
  assert.equal(isInternalUrl("https://analyst.elitr.xyz"), false);
  const env = { ANALYST_PUBLIC_URL: "https://analyst.elitr.xyz/", FLOW_ANALYST_PUBLIC_URL: "https://flow.elitr.xyz" };
  assert.equal(publicAnalystUrl("analyst", "https://news.example.com/", env), "https://news.example.com");
  assert.equal(publicAnalystUrl("analyst", "http://localhost:4001", env), "https://analyst.elitr.xyz");
  assert.equal(publicAnalystUrl("analyst-flow", undefined, env), "https://flow.elitr.xyz");
  assert.equal(publicAnalystUrl("analyst-flow", undefined, { ANALYST_FLOW_PUBLIC_URL: "https://old.example.com" }), "https://old.example.com");
  assert.equal(publicAnalystUrl("analyst", "http://127.0.0.1:4001", { ANALYST_PUBLIC_URL: "http://localhost:4001" }), undefined);
  assert.equal(publicAnalystUrl("analyst", "ftp://x.example.com", {}), undefined);
  assert.equal(publicAnalystUrl("analyst", undefined, {}), undefined);
});
