import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUnits } from "viem";
import { applyFill, emptyLedger, heldWei, positionView, summarize } from "./ledger.js";

const w = (n: string) => parseUnits(n, 18);
const fill = (side: "buy" | "sell", qty: string, usd: number) => ({ ts: 1, mode: "paper" as const, symbol: "NVDAB", side, qtyWei: w(qty), decimals: 18, usd });
const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("avg cost across buys, realized P&L on partial and full sells", () => {
  const l = emptyLedger();
  applyFill(l, fill("buy", "0.02", 4.7)); // 235.00
  applyFill(l, fill("buy", "0.02", 4.9)); // 245.00
  let v = positionView(l, "NVDAB", 250);
  close(v.qty, 0.04);
  close(v.avgCostUsd, 240);
  close(v.unrealizedUsd!, 0.4); // 0.04 × 250 − 9.6

  const s1 = applyFill(l, fill("sell", "0.01", 2.5)); // sell at 250
  close(s1.realizedUsd!, 0.1); // 2.5 − 0.01 × 240
  v = positionView(l, "NVDAB", 250);
  close(v.avgCostUsd, 240); // avg cost unchanged by a sell
  close(v.qty, 0.03);

  const s2 = applyFill(l, fill("sell", "0.03", 6.9)); // sell at 230
  close(s2.realizedUsd!, -0.3); // 6.9 − 7.2
  assert.equal(heldWei(l, "NVDAB"), 0n);
  v = positionView(l, "NVDAB", 230);
  assert.equal(v.qty, 0);
  assert.equal(v.unrealizedUsd, 0);
  close(v.realizedUsd, -0.2);
  assert.equal(l.positions.NVDAB.costUsd, 0);
});

test("selling more than held throws and leaves the ledger untouched", () => {
  const l = emptyLedger();
  applyFill(l, fill("buy", "1", 235));
  assert.throws(() => applyFill(l, fill("sell", "1.000000000000000001", 240)), /cannot sell/);
  assert.equal(heldWei(l, "NVDAB"), w("1"));
  assert.equal(l.fills.length, 1);
});

test("rejects zero/negative quantities and bad USD", () => {
  const l = emptyLedger();
  assert.throws(() => applyFill(l, fill("buy", "0", 1)));
  assert.throws(() => applyFill(l, { ...fill("buy", "1", 1), usd: Number.NaN }));
});

test("P&L summary nets signal spend and gas; unmarked positions show null unrealized", () => {
  const l = emptyLedger();
  applyFill(l, fill("buy", "0.02", 4.7));
  applyFill(l, fill("sell", "0.01", 2.5)); // realized 0.15
  applyFill(l, { ...fill("buy", "0.01", 3.7), symbol: "TSLAB" });
  l.gasUsd = 0.05;
  const views = [positionView(l, "NVDAB", 240), positionView(l, "TSLAB", null)];
  assert.equal(views[1].unrealizedUsd, null);
  const p = summarize(l, views, 0.04);
  close(p.realizedUsd, 0.15);
  close(p.unrealizedUsd, 0.01 * 240 - 2.35);
  close(p.netUsd, 0.15 + 0.05 - 0.04 - 0.05);
});
