import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRiskConfig } from "@elitr/shared";
import { evaluateRisk, evaluateSellRisk, exitTrigger, gapBps, type ExitInput, type RiskInput, type SellRiskInput } from "./risk.js";

const cfg = loadRiskConfig({}); // documented defaults
const now = 1_790_000_000_000;

const good = (): RiskInput => ({
  now,
  killSwitch: false,
  signal: { score: 80, stance: "bullish", generatedAt: now - 30_000 },
  referencePrice: 100,
  onchainPrice: 99, // 100 bps below
  tradeUsd: 5,
  positionUsd: 0,
  portfolioUsd: 0,
  dailySpendUsd: 0,
  liquidityUsd: 2_000_000,
  priceImpactPct: -0.05,
  route: { ok: true, detail: "LiquidMesh SWAP" },
  usdtBalance: 10,
  bnbBalance: 0.01,
  minBnbForGas: 0.001,
});

const byRule = (input: RiskInput) => Object.fromEntries(evaluateRisk(input, cfg).map((c) => [c.rule, c]));

test("all checks pass on a clean setup", () => {
  const checks = evaluateRisk(good(), cfg);
  assert.equal(checks.length, 14);
  assert.deepEqual(checks.filter((c) => !c.ok), []);
});

test("gapBps sign: positive when on-chain is below reference", () => {
  assert.equal(gapBps(100, 99), 100);
  assert.ok(gapBps(233.95, 235.32) < 0);
});

test("on-chain premium fails minGapBps", () => {
  const r = byRule({ ...good(), referencePrice: 233.95, onchainPrice: 235.32 });
  assert.equal(r.minGapBps.ok, false);
  assert.match(r.minGapBps.value, /^-58\.6 bps/);
});

test("gap just under the minimum fails, at the minimum passes", () => {
  assert.equal(byRule({ ...good(), referencePrice: 100, onchainPrice: 99.51 }).minGapBps.ok, false);
  assert.equal(byRule({ ...good(), referencePrice: 100, onchainPrice: 99.5 }).minGapBps.ok, true);
});

test("kill switch fails its check", () => {
  assert.equal(byRule({ ...good(), killSwitch: true }).killSwitch.ok, false);
});

test("signal: low score, non-bullish stance, stale", () => {
  const r = byRule({ ...good(), signal: { score: 64, stance: "neutral", generatedAt: now - 301_000 } });
  assert.equal(r.minConfidence.ok, false);
  assert.equal(r.stance.ok, false);
  assert.equal(r.maxSignalAge.ok, false);
  assert.equal(r.maxSignalAge.value, "301s");
});

test("missing signal fails closed with the reason", () => {
  const r = byRule({ ...good(), signal: null, missing: { signal: "EXECUTION_PRIVATE_KEY is not set" } });
  assert.equal(r.minConfidence.ok, false);
  assert.equal(r.minConfidence.value, "unavailable: EXECUTION_PRIVATE_KEY is not set");
});

test("position, daily spend and trade size limits", () => {
  const r = byRule({ ...good(), tradeUsd: 6, positionUsd: 20, dailySpendUsd: 20 });
  assert.equal(r.maxTradeUsd.ok, false);
  assert.equal(r.maxPositionUsd.ok, false);
  assert.equal(r.maxDailySpendUsd.ok, false);
  const ok = byRule({ ...good(), tradeUsd: 5, positionUsd: 20, dailySpendUsd: 20 });
  assert.equal(ok.maxPositionUsd.ok, true); // exactly at the limit
  assert.equal(ok.maxDailySpendUsd.ok, true);
});

test("liquidity and price impact", () => {
  const r = byRule({ ...good(), liquidityUsd: 49_999, priceImpactPct: -1.01 });
  assert.equal(r.minLiquidityUsd.ok, false);
  assert.equal(r.maxSlippageBps.ok, false);
  assert.equal(byRule({ ...good(), priceImpactPct: 1 }).maxSlippageBps.ok, true); // 100 bps == limit
  assert.equal(byRule({ ...good(), priceImpactPct: null }).maxSlippageBps.ok, false);
});

test("RFQ-only route is blocked", () => {
  const r = byRule({ ...good(), route: { ok: false, detail: "only RFQ routes (PcsXRfq)" } });
  assert.equal(r.simulatableRoute.ok, false);
});

test("balances: insufficient USDT or gas", () => {
  const r = byRule({ ...good(), usdtBalance: 4.99, bnbBalance: 0.0009 });
  assert.equal(r.sufficientUsdt.ok, false);
  assert.equal(r.sufficientGas.ok, false);
  const n = byRule({ ...good(), usdtBalance: null, bnbBalance: null });
  assert.equal(n.sufficientUsdt.ok, false);
});

test("unknown position fails closed", () => {
  assert.equal(byRule({ ...good(), positionUsd: null }).maxPositionUsd.ok, false);
});

test("portfolio cap: combined positions + trade", () => {
  assert.equal(byRule({ ...good(), portfolioUsd: 45 }).maxPortfolioUsd.ok, true); // 45 + 5 == 50 limit
  const r = byRule({ ...good(), portfolioUsd: 45.01 });
  assert.equal(r.maxPortfolioUsd.ok, false);
  assert.equal(byRule({ ...good(), portfolioUsd: null, missing: { maxPortfolioUsd: "TSLAB price unavailable" } }).maxPortfolioUsd.value, "unavailable: TSLAB price unavailable");
  // Callers that don't track a portfolio get no check (old behaviour, 13 checks).
  const { portfolioUsd: _, ...legacy } = good();
  assert.equal(evaluateRisk(legacy, cfg).length, 13);
});

test("confidence uses the reputation-weighted effective score", () => {
  const r = byRule({ ...good(), signal: { score: 57.5, rawScore: 80, weight: 0.25, stance: "bullish", generatedAt: now } });
  assert.equal(r.minConfidence.ok, false);
  assert.match(r.minConfidence.value, /57\.5 effective \(raw 80, weight 0\.25\)/);
});

// ---- sell side ----

const sellGood = (): SellRiskInput => ({
  killSwitch: false,
  qty: 0.02,
  liquidityUsd: 2_000_000,
  priceImpactPct: -0.1,
  route: { ok: true, detail: "LiquidMesh SWAP" },
  bnbBalance: 0.01,
  minBnbForGas: 0.001,
});
const sellByRule = (i: SellRiskInput) => Object.fromEntries(evaluateSellRisk(i, cfg).map((c) => [c.rule, c]));

test("sell checks pass on a clean exit, fail closed otherwise", () => {
  const ok = evaluateSellRisk(sellGood(), cfg);
  assert.deepEqual(ok.map((c) => c.rule), ["killSwitch", "positionExists", "maxSlippageBps", "minLiquidityUsd", "simulatableRoute", "sufficientGas"]);
  assert.ok(ok.every((c) => c.ok));
  const r = sellByRule({ ...sellGood(), killSwitch: true, qty: 0, priceImpactPct: 2, liquidityUsd: null, route: null, bnbBalance: 0 });
  for (const rule of Object.keys(r)) assert.equal(r[rule].ok, false, rule);
});

// ---- exit triggers (defaults: TP 300 bps, SL 200 bps, exitOnBearish, minConfidence 65) ----

const pos = (over: Partial<ExitInput> = {}): ExitInput => ({ now, qty: 1, avgCostUsd: 100, markUsd: 100, signal: null, ...over });

test("take profit at +300 bps, not below", () => {
  assert.equal(exitTrigger(pos({ markUsd: 102.99 }), cfg), null);
  assert.equal(exitTrigger(pos({ markUsd: 103 }), cfg)?.reason, "takeProfit");
});

test("stop loss at −200 bps, not above", () => {
  assert.equal(exitTrigger(pos({ markUsd: 98.01 }), cfg), null);
  assert.equal(exitTrigger(pos({ markUsd: 98 }), cfg)?.reason, "stopLoss");
});

test("bearish exit needs effective score <= 100 − minConfidence and a fresh signal", () => {
  const sig = (effectiveScore: number, ageSec = 10) => ({ stance: "bearish" as const, effectiveScore, generatedAt: now - ageSec * 1000 });
  assert.equal(exitTrigger(pos({ signal: sig(35) }), cfg)?.reason, "bearish");
  assert.equal(exitTrigger(pos({ signal: sig(35.1) }), cfg), null); // weak analyst pulled toward 50
  assert.equal(exitTrigger(pos({ signal: sig(20, 301) }), cfg), null); // stale
  assert.equal(exitTrigger(pos({ signal: { ...sig(20), stance: "neutral" } }), cfg), null);
  const noBear = loadRiskConfig({ RISK_EXIT_ON_BEARISH: "0" });
  assert.equal(exitTrigger(pos({ signal: sig(10) }), noBear), null);
});

test("no position or no mark: price exits don't fire", () => {
  assert.equal(exitTrigger(pos({ qty: 0, markUsd: 50 }), cfg), null);
  assert.equal(exitTrigger(pos({ markUsd: null }), cfg), null);
});
