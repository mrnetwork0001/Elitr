import { test } from "node:test";
import assert from "node:assert/strict";
import type { AgentEvent, RiskCheck } from "@elitr/shared";
import { buildSummary, holdReason, parseGap, plainCause, RULE_PLAIN, stockName, utcDayStart } from "./summary.js";
import { findRows, parseBalances, parseTxs, resolveAddress } from "./walletApi.js";

const NOW = Date.UTC(2026, 9, 7, 9, 0); // Wed 7 Oct 2026 09:00 UTC
let n = 0;
const ev = (p: Record<string, unknown>, ts = NOW - 60_000): AgentEvent => ({ id: `e${n++}`, ts, agent: "execution", ...p }) as AgentEvent;
const chk = (rule: string, ok: boolean, value: string, limit = ""): RiskCheck => ({ rule, ok, value, limit });

test("every risk rule the engine can emit has a plain-English translation", () => {
  for (const r of ["killSwitch", "minConfidence", "stance", "maxSignalAge", "minGapBps", "maxTradeUsd", "maxPositionUsd", "maxPortfolioUsd", "maxDailySpendUsd", "minLiquidityUsd", "maxSlippageBps", "simulatableRoute", "sufficientUsdt", "sufficientGas", "positionExists"])
    assert.ok(RULE_PLAIN[r], `missing ${r}`);
});

test("plainCause hides env-var jargon", () => {
  assert.equal(plainCause("unavailable: EXECUTION_PRIVATE_KEY is not set"), "the agent has no wallet key configured");
  assert.equal(plainCause("unavailable: quote failed: fetch failed"), "Binance's data service could not be reached");
  assert.equal(plainCause("bStocks market closed until 2026-10-07T13:30:00Z - quote skipped (would return 40369)"), "the US stock market is closed");
});

test("parseGap reads the minGapBps check value", () => {
  assert.deepEqual(parseGap(chk("minGapBps", false, "-34.5 bps (ref 239.24 vs on-chain 240.07)")), { gapBps: -34.5, ref: 239.24, onchain: 240.07 });
  assert.equal(parseGap(chk("minGapBps", false, "unavailable: Yahoo reference price unavailable")), null);
});

test("hold reason: market closed + premium over Friday's close", () => {
  const decision = ev({
    type: "decision",
    symbol: "NVDAB",
    action: "hold",
    reasons: [
      "signal from analyst: 70/100 bullish → effective 70 (weight 1.00)",
      "bStocks market closed (not tradable, MARKET_CLOSED: Weekend or Holiday), next open 2026-10-05T13:30:00Z",
      "NVDA regular session closed; Yahoo reference 233.95 is the last close (2026-10-02T20:00:00Z)",
    ],
  }) as Extract<AgentEvent, { type: "decision" }>;
  const risk = ev({
    type: "risk.evaluated",
    symbol: "NVDAB",
    passed: false,
    checks: [chk("minConfidence", true, "70"), chk("minGapBps", false, "-60.0 bps (ref 233.95 vs on-chain 235.35)", "on-chain >= 50 bps below reference"), chk("simulatableRoute", false, "bStocks market closed until 2026-10-05T13:30:00Z - quote skipped (would return 40369)")],
  }) as Extract<AgentEvent, { type: "risk.evaluated" }>;
  assert.equal(holdReason(decision, risk), "the US stock market is closed and the token is trading 0.60% above Friday's closing price");
});

test("hold reason: no signal because no key, gap below threshold", () => {
  const decision = ev({ type: "decision", symbol: "TSLAB", action: "hold", reasons: ["no signal: EXECUTION_PRIVATE_KEY is not set", "TSLA regular session closed; Yahoo reference 380.68 is the last close (2026-10-06T20:00:00Z)"] }) as Extract<AgentEvent, { type: "decision" }>;
  const risk = ev({
    type: "risk.evaluated",
    symbol: "TSLAB",
    passed: false,
    checks: [chk("minConfidence", false, "unavailable: EXECUTION_PRIVATE_KEY is not set", ">= 65"), chk("minGapBps", false, "42.1 bps (ref 380.68 vs on-chain 379.08)")],
  }) as Extract<AgentEvent, { type: "risk.evaluated" }>;
  assert.equal(
    holdReason(decision, risk),
    "there was no usable analyst tip (the agent has no wallet key configured) and the token is trading 0.42% below Tuesday's closing price, not far enough below to buy",
  );
});

test("buildSummary: counts, wording, links - all from events", () => {
  const events: AgentEvent[] = [
    ev({ type: "payment.sent", amount: "10000000000000000", asset: "0x55d3", payTo: "0xabc", txHash: "0x" + "1".repeat(64), analystId: "analyst-flow" }),
    ev({ type: "payment.sent", amount: "10000000000000000", asset: "0x55d3", payTo: "0xabc", txHash: "0x" + "2".repeat(64), analystId: "analyst" }),
    ev({ type: "risk.evaluated", symbol: "NVDAB", passed: false, checks: [chk("stance", false, "neutral", "bullish"), chk("minGapBps", true, "60.0 bps (ref 240 vs on-chain 238.56)")] }),
    ev({ type: "decision", symbol: "NVDAB", action: "hold", reasons: ["NVDA regular session open; Yahoo reference 240 is live (2026-10-07T08:59:00Z)"] }),
    ev({ type: "trade.filled", symbol: "TSLAB", side: "buy", mode: "live", qty: 0.0131, usd: 5, priceUsd: 381.6, txHash: "0x" + "3".repeat(64) }),
    ev({ type: "signal.scored", analystId: "analyst-flow", signalId: "s", symbol: "TSLAB", stance: "neutral", entryPrice: 1, exitPrice: 1, returnBps: 0, correct: true }),
    ev({ type: "reputation.updated", stats: { analystId: "analyst-flow", samples: 3, hits: 2, hitRate: 0.67, trust: 0.6, weight: 0.6, paused: false, avgReturnBps: 1 } }),
    ev({ type: "error", where: "rwa:NVDAB", message: "fetch failed" }),
  ];
  const s = buildSummary({
    now: NOW,
    events,
    mode: "live",
    killSwitch: false,
    pnl: { realizedUsd: 0, unrealizedUsd: 0.12, signalSpendUsd: 0.02, gasSpendUsd: 0.01, netUsd: 0.09 },
    positions: [{ symbol: "TSLAB", qty: 0.0131, avgCostUsd: 381.6, markUsd: 390, unrealizedUsd: 0.12, realizedUsd: 0 }],
    analystName: (id) => (id === "analyst" ? "News analyst" : "Flow analyst"),
    underlyingOf: (sym) => (sym === "NVDAB" ? "NVDA" : "TSLA"),
  });
  assert.equal(s.day, "2026-10-07");
  assert.equal(s.source, "deterministic");
  assert.deepEqual(s.counts, { signals: 2, signalUsd: 0.02, decisions: 1, trades: 1, scored: 1, ratingsPosted: 0, errors: 1 });
  assert.match(s.paragraph, /LIVE mode/);
  assert.match(s.paragraph, /bought 2 trading tips from AI analysts for \$0\.02 in total \(1 from the Flow analyst and 1 from the News analyst\)/);
  assert.match(s.paragraph, /held Nvidia \(NVDAB\) because the analyst did not expect the price to rise \(neutral\) and the token is trading 0\.60% below the live stock price/);
  assert.match(s.paragraph, /bought 0\.0131 TSLAB for \$5\.00/);
  assert.match(s.paragraph, /Flow analyst was right on 1 of 1 \(trust now 60%\)/);
  assert.match(s.paragraph, /\+\$0\.09/);
  const trades = s.facts.find((f) => f.id === "trades")!;
  assert.equal(trades.links?.[0].href, "https://bscscan.com/tx/0x" + "3".repeat(64));
  assert.equal(s.facts.find((f) => f.id === "signals")!.links?.length, 2);
});

test("buildSummary: quiet day says so instead of inventing activity", () => {
  const s = buildSummary({ now: NOW, events: [], mode: "paper", killSwitch: true, pnl: null, positions: [], analystName: (x) => x, underlyingOf: () => null });
  assert.match(s.paragraph, /PAPER mode/);
  assert.match(s.paragraph, /emergency stop is on/);
  assert.match(s.paragraph, /not bought any analyst tips yet/);
  assert.match(s.paragraph, /not evaluated any trade yet/);
  assert.equal(s.counts.trades, 0);
});

test("utcDayStart and stockName", () => {
  assert.equal(utcDayStart(NOW), Date.UTC(2026, 9, 7));
  assert.equal(stockName("NVDAB", "NVDA"), "Nvidia");
  assert.equal(stockName("TSLAon"), "Tesla");
  assert.equal(stockName("XYZB", "XYZ"), "XYZ");
});

// ---- Wallet API parsing ----

test("parseBalances finds balance rows in nested shapes and values them", () => {
  const data = [{ tokenAssets: [
    { symbol: "USDT", tokenContractAddress: "0x55d3", balance: "12.5", tokenPrice: "1.0001" },
    { symbol: "BNB", tokenContractAddress: "", balance: "0.02", tokenPrice: "600" },
    { symbol: "DUST", tokenContractAddress: "0xdead", balance: "0", tokenPrice: "1" },
  ] }];
  const t = parseBalances(data);
  assert.deepEqual(t.map((x) => x.symbol), ["USDT", "BNB"]);
  assert.ok(Math.abs(t[0].usd! - 12.50125) < 1e-9);
  assert.equal(t[1].address, null);
  assert.equal(findRows({ a: { b: [{ x: 1 }] } }, (r) => "x" in r)?.length, 1);
});

test("parseTxs classifies agent swaps and b402 payments from the agent's own records", () => {
  const me = "0xc742AdA2872a042dD36D2E706907b4036968960C";
  const txs = parseTxs(
    { transactions: [
      { txHash: "0xaa", txTime: "1791350169", from: [{ address: me }], to: [{ address: "0x66a4" }], symbol: "USDT", amount: "0.01", txStatus: "success" },
      { txHash: "0xbb", txTime: "1791350000000", from: me, to: "0x55d3", methodId: "0x095ea7b3" },
      { txHash: "0xcc", txTime: "1791340000000", from: "0x1111", to: me },
    ] },
    me,
    { trades: [], payments: [{ txHash: "0xAA", analystId: "analyst-flow", symbol: "TSLAB" }] },
  );
  assert.deepEqual(txs.map((t) => t.kind), ["b402 payment", "approval", "transfer"]);
  assert.equal(txs[0].time, 1791350169000);
  assert.equal(txs[0].direction, "out");
  assert.equal(txs[2].direction, "in");
});

test("resolveAddress prefers the signing account, falls back to EXECUTION_WALLET_ADDRESS", () => {
  assert.equal(resolveAddress("0xabc", {}).source, "account");
  const fb = resolveAddress(undefined, { EXECUTION_WALLET_ADDRESS: "0xc742AdA2872a042dD36D2E706907b4036968960C" });
  assert.equal(fb.source, "EXECUTION_WALLET_ADDRESS");
  assert.match(resolveAddress(undefined, {}).error!, /both unset/);
  assert.match(resolveAddress(undefined, { EXECUTION_WALLET_ADDRESS: "nope" }).error!, /not an address/);
});
