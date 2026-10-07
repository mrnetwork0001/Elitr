import { test } from "node:test";
import assert from "node:assert/strict";
import { priceFromSqrtX96 } from "./prices.js";

const Q96 = 2n ** 96n;
const rel = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a / b - 1) < tol, `${a} vs ${b}`);

test("token0 priced in token1, 18/18 decimals", () => {
  // sqrt(235) * 2^96 → 235 token1 per token0
  const sqrtP = BigInt(Math.round(Math.sqrt(235) * 1e12)) * Q96 / 10n ** 12n;
  rel(priceFromSqrtX96(sqrtP, 18, 18, true), 235, 1e-9);
});

test("base is token1 → inverted", () => {
  // pool USDT(token0)/TSLAB(token1) where 1 TSLAB = 372 USDT → token1/token0 = 1/372
  const sqrtP = BigInt(Math.round(Math.sqrt(1 / 372) * 1e15)) * Q96 / 10n ** 15n;
  rel(priceFromSqrtX96(sqrtP, 18, 18, false), 372, 1e-9);
});

test("real slot0 readings from 2026-10-04 (NVDAB pool token0=NVDAB, TSLAB pool token0=USDT)", () => {
  const nvdab = priceFromSqrtX96(1213813310559976824904028478284n, 18, 18, true);
  const tslab = priceFromSqrtX96(4112572508202990202047837908n, 18, 18, false);
  assert.ok(nvdab > 230 && nvdab < 240, `NVDAB ${nvdab}`);
  assert.ok(tslab > 365 && tslab < 380, `TSLAB ${tslab}`);
});

test("decimal adjustment: 18-dec token0 vs 6-dec token1", () => {
  // 1 token0 = 2 token1 (human) → raw ratio 2e6/1e18
  const sqrtP = BigInt(Math.round(Math.sqrt(2e-12) * 1e18)) * Q96 / 10n ** 18n;
  rel(priceFromSqrtX96(sqrtP, 18, 6, true), 2, 1e-6);
});

test("rejects a zero price", () => {
  assert.throws(() => priceFromSqrtX96(0n, 18, 18, true));
});

import { safeGasLimit } from "./trade.js";
test("safeGasLimit takes the larger of suggested and simulated gas, plus 25%", () => {
  assert.equal(safeGasLimit("450000", "457414", "t"), 571767n);
  assert.equal(safeGasLimit("500000", "457414", "t"), 625000n);
  assert.equal(safeGasLimit("450000", undefined, "t"), 562500n);
});
