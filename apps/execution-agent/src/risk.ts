import type { RiskCheck, RiskConfig } from "@elitr/shared";

export interface SignalView {
  score: number; // 1-100 - the reputation-weighted effective score when rawScore is set
  stance: "bullish" | "neutral" | "bearish";
  generatedAt: number; // unix ms
  rawScore?: number; // analyst's own score before weighting
  weight?: number; // analyst reputation weight 0..1
}

/** Everything the checks look at. `null` = not observed this cycle (fails closed, with the reason). */
export interface RiskInput {
  now: number;
  killSwitch: boolean;
  signal: SignalView | null;
  referencePrice: number | null; // TradFi (Yahoo)
  onchainPrice: number | null; // Binance Market API
  tradeUsd: number; // intended USDT notional
  positionUsd: number | null; // current asset holdings at on-chain price
  portfolioUsd?: number | null; // all traded assets combined at on-chain prices (undefined = not checked)
  dailySpendUsd: number;
  liquidityUsd: number | null; // USDT in the primary pool
  priceImpactPct: number | null; // chosen route's priceImpactPercent
  route: { ok: boolean; detail: string } | null; // simulatable (SWAP) route availability
  usdtBalance: number | null;
  bnbBalance: number | null;
  minBnbForGas: number;
  missing?: Partial<Record<string, string>>; // why a null value is unavailable, keyed by rule
}

const usd = (n: number) => `$${n.toFixed(2)}`;
const round1 = (n: number) => Math.round(n * 10) / 10;
const na = (input: RiskInput, rule: string) => `unavailable${input.missing?.[rule] ? `: ${input.missing[rule]}` : ""}`;

/** Gap in bps by which on-chain trades BELOW the reference (positive = discount). */
export function gapBps(reference: number, onchain: number): number {
  return ((reference - onchain) / reference) * 10_000;
}

export function evaluateRisk(input: RiskInput, cfg: RiskConfig): RiskCheck[] {
  const c: RiskCheck[] = [];
  const add = (rule: string, ok: boolean, value: string, limit: string) => c.push({ rule, ok, value, limit });
  const s = input.signal;

  add("killSwitch", !input.killSwitch, input.killSwitch ? "engaged" : "off", "off");

  if (s) {
    const scoreTxt =
      s.rawScore != null ? `${round1(s.score)} effective (raw ${s.rawScore}, weight ${(s.weight ?? 1).toFixed(2)})` : String(s.score);
    add("minConfidence", s.score >= cfg.minConfidence, scoreTxt, `>= ${cfg.minConfidence}`);
    add("stance", s.stance === "bullish", s.stance, "bullish");
    const age = Math.max(0, Math.round((input.now - s.generatedAt) / 1000));
    add("maxSignalAge", age <= cfg.maxSignalAgeSec, `${age}s`, `<= ${cfg.maxSignalAgeSec}s`);
  } else {
    add("minConfidence", false, na(input, "signal"), `>= ${cfg.minConfidence}`);
    add("stance", false, na(input, "signal"), "bullish");
    add("maxSignalAge", false, na(input, "signal"), `<= ${cfg.maxSignalAgeSec}s`);
  }

  if (input.referencePrice != null && input.onchainPrice != null && input.referencePrice > 0) {
    const g = gapBps(input.referencePrice, input.onchainPrice);
    add(
      "minGapBps",
      g >= cfg.minGapBps,
      `${g.toFixed(1)} bps (ref ${input.referencePrice.toFixed(2)} vs on-chain ${input.onchainPrice.toFixed(2)})`,
      `on-chain >= ${cfg.minGapBps} bps below reference`,
    );
  } else {
    add("minGapBps", false, na(input, "minGapBps"), `on-chain >= ${cfg.minGapBps} bps below reference`);
  }

  add("maxTradeUsd", input.tradeUsd > 0 && input.tradeUsd <= cfg.maxTradeUsd, usd(input.tradeUsd), `<= ${usd(cfg.maxTradeUsd)}`);

  if (input.positionUsd != null) {
    const after = input.positionUsd + input.tradeUsd;
    add("maxPositionUsd", after <= cfg.maxPositionUsd, `${usd(input.positionUsd)} + ${usd(input.tradeUsd)} = ${usd(after)}`, `<= ${usd(cfg.maxPositionUsd)}`);
  } else {
    add("maxPositionUsd", false, na(input, "maxPositionUsd"), `<= ${usd(cfg.maxPositionUsd)}`);
  }

  if (input.portfolioUsd !== undefined) {
    if (input.portfolioUsd != null) {
      const after = input.portfolioUsd + input.tradeUsd;
      add("maxPortfolioUsd", after <= cfg.maxPortfolioUsd, `${usd(input.portfolioUsd)} + ${usd(input.tradeUsd)} = ${usd(after)}`, `<= ${usd(cfg.maxPortfolioUsd)}`);
    } else {
      add("maxPortfolioUsd", false, na(input, "maxPortfolioUsd"), `<= ${usd(cfg.maxPortfolioUsd)}`);
    }
  }

  const spendAfter = input.dailySpendUsd + input.tradeUsd;
  add("maxDailySpendUsd", spendAfter <= cfg.maxDailySpendUsd, `${usd(input.dailySpendUsd)} + ${usd(input.tradeUsd)} = ${usd(spendAfter)}`, `<= ${usd(cfg.maxDailySpendUsd)}`);

  if (input.liquidityUsd != null) {
    add("minLiquidityUsd", input.liquidityUsd >= cfg.minLiquidityUsd, `${usd(input.liquidityUsd)} USDT in pool`, `>= ${usd(cfg.minLiquidityUsd)}`);
  } else {
    add("minLiquidityUsd", false, na(input, "minLiquidityUsd"), `>= ${usd(cfg.minLiquidityUsd)}`);
  }

  if (input.priceImpactPct != null && Number.isFinite(input.priceImpactPct)) {
    const bps = Math.abs(input.priceImpactPct) * 100;
    add("maxSlippageBps", bps <= cfg.maxSlippageBps, `${bps.toFixed(1)} bps price impact`, `<= ${cfg.maxSlippageBps} bps`);
  } else {
    add("maxSlippageBps", false, na(input, "maxSlippageBps"), `<= ${cfg.maxSlippageBps} bps`);
  }

  if (input.route) add("simulatableRoute", input.route.ok, input.route.detail, "SWAP route (Transaction API can simulate)");
  else add("simulatableRoute", false, na(input, "simulatableRoute"), "SWAP route (Transaction API can simulate)");

  if (input.usdtBalance != null) {
    add("sufficientUsdt", input.usdtBalance >= input.tradeUsd, `${input.usdtBalance.toFixed(4)} USDT`, `>= ${input.tradeUsd.toFixed(2)} USDT`);
  } else {
    add("sufficientUsdt", false, na(input, "balances"), `>= ${input.tradeUsd.toFixed(2)} USDT`);
  }
  if (input.bnbBalance != null) {
    add("sufficientGas", input.bnbBalance >= input.minBnbForGas, `${input.bnbBalance.toFixed(6)} BNB`, `>= ${input.minBnbForGas} BNB`);
  } else {
    add("sufficientGas", false, na(input, "balances"), `>= ${input.minBnbForGas} BNB`);
  }

  return c;
}

// ---- Sell side ---------------------------------------------------------------

export interface SellRiskInput {
  killSwitch: boolean;
  qty: number; // whole tokens to sell (0 = no position)
  liquidityUsd: number | null;
  priceImpactPct: number | null;
  route: { ok: boolean; detail: string } | null;
  bnbBalance: number | null;
  minBnbForGas: number;
  missing?: Partial<Record<string, string>>;
}

/** Exits skip the entry-only rules (confidence, gap, caps); they still need a safe, simulatable route. */
export function evaluateSellRisk(input: SellRiskInput, cfg: RiskConfig): RiskCheck[] {
  const c: RiskCheck[] = [];
  const add = (rule: string, ok: boolean, value: string, limit: string) => c.push({ rule, ok, value, limit });
  const na = (rule: string) => `unavailable${input.missing?.[rule] ? `: ${input.missing[rule]}` : ""}`;
  add("killSwitch", !input.killSwitch, input.killSwitch ? "engaged" : "off", "off");
  add("positionExists", input.qty > 0, `${input.qty} tokens`, "> 0");
  if (input.priceImpactPct != null && Number.isFinite(input.priceImpactPct)) {
    const bps = Math.abs(input.priceImpactPct) * 100;
    add("maxSlippageBps", bps <= cfg.maxSlippageBps, `${bps.toFixed(1)} bps price impact`, `<= ${cfg.maxSlippageBps} bps`);
  } else add("maxSlippageBps", false, na("maxSlippageBps"), `<= ${cfg.maxSlippageBps} bps`);
  if (input.liquidityUsd != null) {
    add("minLiquidityUsd", input.liquidityUsd >= cfg.minLiquidityUsd, `${usd(input.liquidityUsd)} USDT in pool`, `>= ${usd(cfg.minLiquidityUsd)}`);
  } else add("minLiquidityUsd", false, na("minLiquidityUsd"), `>= ${usd(cfg.minLiquidityUsd)}`);
  if (input.route) add("simulatableRoute", input.route.ok, input.route.detail, "SWAP route (Transaction API can simulate)");
  else add("simulatableRoute", false, na("simulatableRoute"), "SWAP route (Transaction API can simulate)");
  if (input.bnbBalance != null) {
    add("sufficientGas", input.bnbBalance >= input.minBnbForGas, `${input.bnbBalance.toFixed(6)} BNB`, `>= ${input.minBnbForGas} BNB`);
  } else add("sufficientGas", false, na("balances"), `>= ${input.minBnbForGas} BNB`);
  return c;
}

export type ExitReason = "takeProfit" | "stopLoss" | "bearish";

export interface ExitInput {
  now: number;
  qty: number;
  avgCostUsd: number;
  markUsd: number | null;
  // Latest signal from the analyst chosen for this asset (effectiveScore = reputation-weighted).
  signal: { stance: SignalView["stance"]; effectiveScore: number; generatedAt: number } | null;
}

/** First exit rule that fires for an open position, in priority order stop-loss → take-profit → bearish. */
export function exitTrigger(input: ExitInput, cfg: RiskConfig): { reason: ExitReason; detail: string } | null {
  if (!(input.qty > 0) || !(input.avgCostUsd > 0)) return null;
  const m = input.markUsd;
  if (m != null) {
    const moveBps = ((m - input.avgCostUsd) / input.avgCostUsd) * 10_000;
    const sl = input.avgCostUsd * (1 - cfg.stopLossBps / 10_000);
    const tp = input.avgCostUsd * (1 + cfg.takeProfitBps / 10_000);
    if (m <= sl) return { reason: "stopLoss", detail: `mark ${m.toFixed(4)} <= ${sl.toFixed(4)} (avg cost ${input.avgCostUsd.toFixed(4)} − ${cfg.stopLossBps} bps; move ${moveBps.toFixed(1)} bps)` };
    if (m >= tp) return { reason: "takeProfit", detail: `mark ${m.toFixed(4)} >= ${tp.toFixed(4)} (avg cost ${input.avgCostUsd.toFixed(4)} + ${cfg.takeProfitBps} bps; move +${moveBps.toFixed(1)} bps)` };
  }
  const s = input.signal;
  if (cfg.exitOnBearish && s && s.stance === "bearish") {
    const age = (input.now - s.generatedAt) / 1000;
    const limit = 100 - cfg.minConfidence;
    if (age <= cfg.maxSignalAgeSec && s.effectiveScore <= limit) {
      return { reason: "bearish", detail: `bearish signal, effective score ${round1(s.effectiveScore)} <= ${limit} (100 − minConfidence)` };
    }
  }
  return null;
}
