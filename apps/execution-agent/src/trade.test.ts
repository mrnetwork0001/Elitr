import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEther, parseGwei } from "viem";
import { ASSETS, USDT_BSC } from "@elitr/shared";
import { checkFreshRoute, checkGasBudget, checkSwapDestination, KNOWN_ROUTERS, MAX_GAS, maxFeeWeiFromEnv } from "./trade.js";

const ROUTER = "0xB44446b0c8E56988c34f7Ff73Ae904982b5FdDA5";
const net = parseGwei("0.05"); // BSC network gas price at the time of writing
const cap = parseEther("0.01");

test("gas budget: realistic swap passes, three refusals", () => {
  checkGasBudget({ gas: 1_382_562n, gasPrice: parseGwei("0.064") }, net, cap); // the first live trade
  assert.throws(() => checkGasBudget({ gas: MAX_GAS + 1n, gasPrice: parseGwei("0.05") }, net, cap), /gas limit 3000001 > 3000000/);
  assert.throws(() => checkGasBudget({ gas: 2_500_000n, gasPrice: parseGwei("5") }, parseGwei("5"), cap), /worst-case fee 0\.0125 BNB .* > EXECUTION_MAX_FEE_BNB 0\.01/);
  assert.throws(() => checkGasBudget({ gas: 500_000n, gasPrice: parseGwei("0.2") }, net, cap), /gas price 200000000 wei > 3× network 50000000 wei/);
  checkGasBudget({ gas: 500_000n, gasPrice: net * 3n }, net, cap); // exactly 3× is allowed
  checkGasBudget({ gas: 500_000n, gasPrice: parseGwei("1") }, 0n, cap); // unknown network price: ratio check skipped
});

test("EXECUTION_MAX_FEE_BNB: default 0.01, validated", () => {
  assert.equal(maxFeeWeiFromEnv({}), parseEther("0.01"));
  assert.equal(maxFeeWeiFromEnv({ EXECUTION_MAX_FEE_BNB: " 0.002 " }), parseEther("0.002"));
  assert.throws(() => maxFeeWeiFromEnv({ EXECUTION_MAX_FEE_BNB: "0" }), /invalid/);
  assert.throws(() => maxFeeWeiFromEnv({ EXECUTION_MAX_FEE_BNB: "1e-3" }), /invalid/);
});

test("swap destination is pinned to the quoted spender or a known router, never a token", () => {
  assert.ok(KNOWN_ROUTERS.includes(ROUTER.toLowerCase()));
  checkSwapDestination(ROUTER, ROUTER.toLowerCase());
  checkSwapDestination(ROUTER.toLowerCase(), undefined);
  checkSwapDestination(ROUTER, null);
  const other = "0x1111111111111111111111111111111111111111";
  assert.throws(() => checkSwapDestination(other, ROUTER), /!= route approveTarget/);
  assert.throws(() => checkSwapDestination(other, undefined), /not a known router/);
  checkSwapDestination(other, other); // a quote may name a different spender; then tx.to must match it
  for (const t of [USDT_BSC.address, ASSETS.NVDAB.address, ASSETS.METAB.address.toUpperCase().replace("0X", "0x")]) {
    assert.throws(() => checkSwapDestination(t, t), /token contract/, t);
    assert.throws(() => checkSwapDestination(t, undefined), /token contract/, t);
  }
});

test("re-quote after an approval must keep the spender and the price-impact limit", () => {
  const base = { quoteId: "q", vendorName: "LiquidMesh", toTokenAmount: "1", executionMode: "SWAP" as const };
  checkFreshRoute({ ...base, approveTarget: ROUTER.toLowerCase(), priceImpactPercent: "0.5" }, ROUTER, 100);
  checkFreshRoute({ ...base, approveTarget: ROUTER }, ROUTER, 100); // no impact reported: allowed (risk engine already failed closed on it)
  checkFreshRoute({ ...base, approveTarget: ROUTER, priceImpactPercent: "-1.0" }, ROUTER, 100);
  assert.throws(() => checkFreshRoute({ ...base, approveTarget: ROUTER, priceImpactPercent: "1.01" }, ROUTER, 100), /price impact 1.01% exceeds 100 bps/);
  assert.throws(() => checkFreshRoute({ ...base, approveTarget: ROUTER, priceImpactPercent: "abc" }, ROUTER, 100), /price impact/);
  assert.throws(() => checkFreshRoute({ ...base, approveTarget: "0x2222222222222222222222222222222222222222" }, ROUTER, 100), /!= approved spender/);
  assert.throws(() => checkFreshRoute({ ...base }, ROUTER, 100), /!= approved spender/);
});
