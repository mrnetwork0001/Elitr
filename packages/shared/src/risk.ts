import { z } from "zod";

// Hard limits the execution agent checks before every trade.
// Defaults are deliberately small; override via env.
export const RiskConfigSchema = z.object({
  maxTradeUsd: z.coerce.number().positive().default(5),
  maxPositionUsd: z.coerce.number().positive().default(25),
  maxDailySpendUsd: z.coerce.number().positive().default(25),
  maxSlippageBps: z.coerce.number().int().positive().max(500).default(100),
  minLiquidityUsd: z.coerce.number().nonnegative().default(50_000),
  minConfidence: z.coerce.number().min(1).max(100).default(65),
  minGapBps: z.coerce.number().nonnegative().default(50), // on-chain must lag reference by at least this
  maxSignalAgeSec: z.coerce.number().int().positive().default(300),
  maxDailyDataUsd: z.coerce.number().nonnegative().default(1), // cap on b402 spend for signals
  maxPortfolioUsd: z.coerce.number().positive().default(50), // all positions combined
  takeProfitBps: z.coerce.number().int().positive().default(300),
  stopLossBps: z.coerce.number().int().positive().default(200),
  exitOnBearish: z
    .string()
    .optional()
    .transform((v) => v === undefined || v === "1" || v === "true"),
  minAnalystTrust: z.coerce.number().min(0).max(1).default(0.45), // pause an analyst below this…
  minAnalystSamples: z.coerce.number().int().nonnegative().default(10), // …once it has this many scored signals
  killSwitch: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export type RiskConfig = z.infer<typeof RiskConfigSchema>;

// Empty env values ("FOO=") mean unset - otherwise z.coerce turns "" into 0.
const v = (x: string | undefined) => (x === undefined || x.trim() === "" ? undefined : x);

export function loadRiskConfig(env: NodeJS.ProcessEnv = process.env): RiskConfig {
  return RiskConfigSchema.parse({
    maxTradeUsd: v(env.RISK_MAX_TRADE_USD),
    maxPositionUsd: v(env.RISK_MAX_POSITION_USD),
    maxDailySpendUsd: v(env.RISK_MAX_DAILY_SPEND_USD),
    maxSlippageBps: v(env.RISK_MAX_SLIPPAGE_BPS),
    minLiquidityUsd: v(env.RISK_MIN_LIQUIDITY_USD),
    minConfidence: v(env.RISK_MIN_CONFIDENCE),
    minGapBps: v(env.RISK_MIN_GAP_BPS),
    maxSignalAgeSec: v(env.RISK_MAX_SIGNAL_AGE_SEC),
    maxDailyDataUsd: v(env.RISK_MAX_DAILY_DATA_USD),
    maxPortfolioUsd: v(env.RISK_MAX_PORTFOLIO_USD),
    takeProfitBps: v(env.RISK_TAKE_PROFIT_BPS),
    stopLossBps: v(env.RISK_STOP_LOSS_BPS),
    exitOnBearish: v(env.RISK_EXIT_ON_BEARISH),
    minAnalystTrust: v(env.RISK_MIN_ANALYST_TRUST),
    minAnalystSamples: v(env.RISK_MIN_ANALYST_SAMPLES),
    killSwitch: v(env.KILL_SWITCH),
  });
}
