import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAnalysts } from "./analysts.js";
import { parseSignal } from "./pay.js";
import { bearerOk, isLoopback } from "./server.js";

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
