import { test } from "node:test";
import assert from "node:assert/strict";
import { consensusMarket, crossIssuerPairs, marketStateOf, SECTORS, spreadBps, traderGapBps, yahooTicker } from "./rwaBoard.js";
import { gapBps } from "./risk.js";

const near = (a: number | null, b: number, tol = 1e-9) => assert.ok(a != null && Math.abs(a - b) < tol, `${a} vs ${b}`);

test("spreadBps: premium positive, discount negative", () => {
  near(spreadBps(240.77, 240.582773), ((240.77 - 240.582773) / 240.582773) * 10_000);
  near(spreadBps(101, 100), 100);
  near(spreadBps(99, 100), -100);
});

test("spreadBps rejects missing / zero / non-finite inputs", () => {
  assert.equal(spreadBps(null, 100), null);
  assert.equal(spreadBps(100, undefined), null);
  assert.equal(spreadBps(0, 100), null);
  assert.equal(spreadBps(100, 0), null);
  assert.equal(spreadBps(NaN, 100), null);
});

test("traderGapBps matches the risk engine's gapBps (on-chain below reference = positive)", () => {
  // 2026-10-07 NVDAB: Yahoo last close 239.24, on-chain 240.07 → -34.5 bps in the decision log
  near(traderGapBps(240.07, 239.24), gapBps(239.24, 240.07));
  assert.equal(Number(traderGapBps(240.07, 239.24)!.toFixed(1)), -34.7);
  assert.ok(traderGapBps(99, 100)! > 0);
});

test("crossIssuerPairs groups by underlying and computes bStocks-over-Ondo spread", () => {
  const pairs = crossIssuerPairs([
    { underlying: "NVDA", underlyingName: "NVIDIA", platformId: "bstock", symbol: "NVDAB", address: "0x1", tokenPrice: 240.5, liquidityUsd: 4_200_000, topPool: null },
    { underlying: "nvda", underlyingName: null, platformId: "ondo", symbol: "NVDAon", address: "0x2", tokenPrice: 239.3, liquidityUsd: 8_000, topPool: null },
    { underlying: "TSLA", underlyingName: "Tesla", platformId: "bstock", symbol: "TSLAB", address: "0x3", tokenPrice: 379, liquidityUsd: null, topPool: null },
    { underlying: "", underlyingName: null, platformId: "ondo", symbol: "X", address: "0x4", tokenPrice: 1, liquidityUsd: null, topPool: null },
  ]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].underlying, "NVDA");
  assert.equal(pairs[0].name, "NVIDIA");
  assert.deepEqual(pairs[0].legs.map((l) => l.issuer), ["bStocks", "Ondo"]);
  near(pairs[0].crossSpreadBps, ((240.5 - 239.3) / 239.3) * 10_000);
});

test("crossIssuerPairs: missing price on one leg → null spread, pair still listed", () => {
  const pairs = crossIssuerPairs([
    { underlying: "AAPL", underlyingName: null, platformId: "bstock", symbol: "AAPLB", address: "0x1", tokenPrice: null, liquidityUsd: null, topPool: null },
    { underlying: "AAPL", underlyingName: null, platformId: "ondo", symbol: "AAPLon", address: "0x2", tokenPrice: 250, liquidityUsd: null, topPool: null },
  ]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].crossSpreadBps, null);
});

test("marketStateOf finds the nested status object structurally", () => {
  const s = marketStateOf({ tokenSymbol: "NVDAB", status: { openState: false, marketStatus: "closed", reasonCode: "MARKET_CLOSED", reasonMsg: "Weekend or Holiday", nextOpenTime: "1791379800000", nextCloseTime: null } });
  assert.deepEqual(s, { openState: false, marketStatus: "closed", reasonCode: "MARKET_CLOSED", reasonMsg: "Weekend or Holiday", nextOpenTime: 1791379800000, nextCloseTime: null });
  assert.equal(marketStateOf({ tokenSymbol: "X" }), null);
});

test("consensusMarket picks the majority status and reports agreement", () => {
  const closed = { openState: false, marketStatus: "closed", reasonCode: "MARKET_CLOSED", reasonMsg: null, nextOpenTime: 1, nextCloseTime: null };
  const paused = { ...closed, reasonCode: "ASSET_PAUSED" };
  const c = consensusMarket([closed, closed, paused, null]);
  assert.equal(c?.reasonCode, "MARKET_CLOSED");
  assert.equal(c?.agree, 2);
  assert.equal(c?.total, 3);
  assert.equal(consensusMarket([null]), null);
});

test("sector labels follow the docs' tabId enum", () => {
  assert.equal(Object.keys(SECTORS).length, 13);
  assert.equal(SECTORS[4], "AI Chips");
  assert.equal(SECTORS[9], "Magnificent 7");
  assert.equal(SECTORS[11], "ETF");
  assert.equal(SECTORS[13], "Buffett Portfolio");
});

test("yahooTicker maps class shares", () => {
  assert.equal(yahooTicker("brk.b"), "BRK-B");
  assert.equal(yahooTicker("NVDA"), "NVDA");
});

import { comparableBps } from "./rwaBoard.js";
test("spreads beyond ±2000 bps are treated as a share-basis mismatch, not a gap", () => {
  assert.equal(comparableBps(992875.2), null); // NFLXon after Netflix's 10-for-1 split
  assert.equal(comparableBps(-9890.7), null); // SOXSon (reverse-split leveraged ETF)
  assert.equal(comparableBps(-193.1), -193.1);
  assert.equal(comparableBps(null), null);
});
