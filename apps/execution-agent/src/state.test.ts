import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readKillFile, removeKillFile, StateStore, writeKillFile, type PendingTx } from "./state.js";

const dir = mkdtempSync(join(tmpdir(), "elitr-state-"));
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));

const pending = (txHash: string, over: Partial<PendingTx> = {}): PendingTx => ({
  txHash,
  side: "buy",
  symbol: "NVDAB",
  label: "NVDAB",
  amountIn: "2000000000000000000",
  at: 1_700_000_000_000,
  ...over,
});

test("pending records persist atomically and survive a reload", () => {
  const file = join(dir, "a", "state.json");
  const s = new StateStore(file);
  s.setPending(pending("0xAA"));
  s.setPending(pending("0xbb", { side: "sell" }));
  s.setPending(pending("0xaa", { at: 5 })); // same hash, case-insensitive: replaced, not duplicated
  assert.equal(s.get().pending.length, 2);
  assert.equal(s.get().pending.find((p) => p.txHash === "0xaa")?.at, 5);
  assert.deepEqual(readdirSync(join(dir, "a")), ["state.json"]); // no .tmp left behind
  assert.ok(Array.isArray(JSON.parse(readFileSync(file, "utf8")).pending));

  const again = new StateStore(file);
  assert.equal(again.get().pending.length, 2);
  again.clearPending("0xAA");
  again.clearPending("0xnope");
  assert.deepEqual(
    again.get().pending.map((p) => p.txHash),
    ["0xbb"],
  );
  assert.deepEqual(new StateStore(file).get().pending.map((p) => p.txHash), ["0xbb"]);
});

test("older state files without pending[] load with an empty list", () => {
  const file = join(dir, "b", "state.json");
  new StateStore(file).recordPayment({ ts: 1, amount: "0.01", asset: "USDT", usd: 0.01 });
  const raw = JSON.parse(readFileSync(file, "utf8"));
  delete raw.pending;
  writeFileSync(file, JSON.stringify(raw));
  assert.deepEqual(new StateStore(file).get().pending, []);
});

test("kill-switch file: written atomically, read back, removed", () => {
  const file = join(dir, "c", "kill-switch");
  assert.equal(readKillFile(file), null);
  const rec = writeKillFile("POST /kill", file);
  assert.equal(rec.source, "POST /kill");
  assert.ok(!Number.isNaN(Date.parse(rec.at)));
  assert.deepEqual(readdirSync(join(dir, "c")), ["kill-switch"]);
  assert.deepEqual(readKillFile(file), rec);
  removeKillFile(file);
  removeKillFile(file); // idempotent
  assert.equal(existsSync(file), false);
  assert.equal(readKillFile(file), null);
});
