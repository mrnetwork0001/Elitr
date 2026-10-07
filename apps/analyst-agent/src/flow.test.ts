import { test } from "node:test";
import assert from "node:assert/strict";
import { flowRationale, scoreFlow, type FlowFeatures } from "./flow.js";
import { b402ConfigFromEnv, priceUsd } from "./b402.js";

const base: FlowFeatures = {
  symbol: "NVDAB",
  pool: "0x8FB4243b553aC29BA088aCf00B9B7dA24bD6690C",
  fromBlock: 1n,
  toBlock: 8000n,
  fromTime: 0,
  toTime: 3600,
  blockTimeSec: 0.45,
  swaps: 100,
  buys: 50,
  sells: 50,
  buyUsd: 10_000,
  sellUsd: 10_000,
  netUsd: 0,
  buySellRatio: 1,
  traders: 40,
  buyers: 20,
  sellers: 20,
  largeBuys: 0,
  largeSells: 0,
  largeBuyUsd: 0,
  largeSellUsd: 0,
  priceStart: 200,
  priceEnd: 200,
  priceChangeBps: 0,
  largest: [],
};

test("balanced flow is neutral 50", () => {
  const s = scoreFlow(base);
  assert.equal(s.score, 50);
  assert.equal(s.stance, "neutral");
});

test("one-sided buying with rising price is bullish, mirror is bearish and symmetric", () => {
  const bull = { ...base, buyUsd: 30_000, sellUsd: 5_000, buyers: 30, sellers: 10, largeBuyUsd: 12_000, largeBuys: 2, priceChangeBps: 80 };
  const bear = { ...base, buyUsd: 5_000, sellUsd: 30_000, buyers: 10, sellers: 30, largeSellUsd: 12_000, largeSells: 2, priceChangeBps: -80 };
  const b = scoreFlow(bull);
  const r = scoreFlow(bear);
  assert.equal(b.stance, "bullish");
  assert.equal(r.stance, "bearish");
  assert.equal(b.score - 50, 50 - r.score);
  assert.ok(b.score <= 99 && r.score >= 1);
});

test("few swaps shrink conviction toward neutral", () => {
  const strong = { ...base, buyUsd: 30_000, sellUsd: 0, buyers: 5, sellers: 0, priceChangeBps: 300 };
  assert.ok(scoreFlow({ ...strong, swaps: 6 }).score < scoreFlow({ ...strong, swaps: 200 }).score);
});

test("rationale is built from the numbers", () => {
  const f = { ...base, buyUsd: 12_400, sellUsd: 8_000, netUsd: 4_400, buySellRatio: 1.55, priceEnd: 201, priceChangeBps: 50 };
  const txt = flowRationale(f, scoreFlow(f));
  assert.match(txt, /100 swaps from 40 wallets/);
  assert.match(txt, /buys \$12\.4k vs sells \$8\.0k \(net \+\$4\.4k, buy\/sell 1\.55x\)/);
  assert.match(txt, /price \+0\.50% \(\$200\.00 → \$201\.00\)/);
});

test("b402 config: flow analyst overrides payee/price, falls back to ANALYST_*", () => {
  const env = {
    BINANCE_WEB3_API_KEY: "k",
    BINANCE_WEB3_API_SECRET: "s",
    ANALYST_PAY_TO: "0x" + "1".repeat(40),
    ANALYST_PAYMENT_ASSET: "0x55d398326f99059fF775485246999027B3197955",
  };
  assert.equal(b402ConfigFromEnv(env, "FLOW_ANALYST").config!.payTo, env.ANALYST_PAY_TO);
  const own = b402ConfigFromEnv({ ...env, FLOW_ANALYST_PAY_TO: "0x" + "2".repeat(40), FLOW_ANALYST_PRICE_WEI: "5000000000000000" }, "FLOW_ANALYST");
  assert.equal(own.config!.payTo, "0x" + "2".repeat(40));
  assert.equal(own.config!.amount, "5000000000000000");
  assert.equal(b402ConfigFromEnv(env).config!.amount, "10000000000000000");
  assert.deepEqual(b402ConfigFromEnv({ ...env, FLOW_ANALYST_PAY_TO: "nope" }, "FLOW_ANALYST").problems, ["FLOW_ANALYST_PAY_TO is not an EVM address"]);
});

test("priceUsd only for known 18-decimal stables", () => {
  assert.equal(priceUsd("0x55d398326f99059fF775485246999027B3197955", "10000000000000000"), 0.01);
  assert.equal(priceUsd("0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d", "1000000000000000000"), 1);
  assert.equal(priceUsd("0x" + "3".repeat(40), "10000000000000000"), null);
});
