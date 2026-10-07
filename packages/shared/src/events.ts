// Events the agents stream to the dashboard over SSE (GET /events).
// Every event is a real occurrence — nothing here is ever synthesized for display.

// "analyst" = news/sentiment analyst, "analyst-flow" = on-chain flow analyst.
export type AgentId = "analyst" | "analyst-flow" | "execution";
export type AnalystId = Exclude<AgentId, "execution">;

export type Side = "buy" | "sell";
export type Stance = "bullish" | "neutral" | "bearish";
export type FillMode = "paper" | "live";

interface Base {
  id: string;
  ts: number; // unix ms
  agent: AgentId;
}

export interface RiskCheck {
  rule: string; // e.g. "minConfidence"
  ok: boolean;
  value: string; // observed, human-readable
  limit: string; // configured limit, human-readable
}

export interface AnalystCandidate {
  analystId: AnalystId;
  name: string;
  priceUsd: number | null;
  samples: number;
  hitRate: number | null; // 0..1, null until scored
  trust: number; // posterior mean 0..1
  paused: boolean;
  draw?: number; // Thompson sample used for this selection
}

export interface AnalystStats {
  analystId: AnalystId;
  samples: number;
  hits: number;
  hitRate: number | null;
  trust: number;
  weight: number; // 0..1 multiplier applied to the analyst's confidence
  paused: boolean;
  avgReturnBps: number | null; // average signed return in the signal's direction
}

export interface PositionView {
  symbol: string;
  qty: number; // whole tokens
  avgCostUsd: number; // per token
  markUsd: number | null; // per token
  unrealizedUsd: number | null;
  realizedUsd: number;
}

// Payment amounts are smallest-unit integer strings; `asset` is the token contract address.
export type AgentEvent = Base &
  (
    | { type: "payment.required"; resource: string; amount: string; asset: string }
    | { type: "payment.sent"; amount: string; asset: string; payTo: string; txHash?: string; analystId?: AnalystId }
    | { type: "payment.verified"; amount: string; asset: string; payer: string; txHash?: string }
    | {
        type: "signal.produced";
        symbol: string;
        score: number;
        rationale: string;
        sources: string[];
        stance?: Stance;
        horizonSec?: number;
        signalId?: string;
      }
    // Execution side: a paid signal arrived and was recorded for later scoring.
    | {
        type: "signal.received";
        analystId: AnalystId;
        signalId: string;
        symbol: string;
        score: number;
        stance: Stance;
        weight: number;
        effectiveScore: number;
        entryPrice: number;
        horizonSec: number;
      }
    | { type: "analyst.selected"; symbol: string; analystId: AnalystId | null; reasons: string[]; candidates: AnalystCandidate[] }
    | {
        type: "signal.scored";
        analystId: AnalystId;
        signalId: string;
        symbol: string;
        stance: Stance;
        entryPrice: number;
        exitPrice: number;
        returnBps: number;
        correct: boolean;
      }
    | { type: "reputation.updated"; stats: AnalystStats }
    | { type: "reputation.posted"; analystId: AnalystId; erc8004AgentId: string; value: number; tag: string; txHash?: string; error?: string }
    | { type: "identity.registered"; subject: AgentId; erc8004AgentId: string; registry: string; txHash?: string }
    | { type: "price.reference"; symbol: string; price: number; source: string }
    | { type: "price.onchain"; symbol: string; token: string; price: number; source: string }
    | { type: "decision"; symbol: string; action: "buy" | "sell" | "hold"; reasons: string[]; exitReason?: "takeProfit" | "stopLoss" | "bearish" }
    | { type: "risk.evaluated"; symbol: string; passed: boolean; checks: RiskCheck[]; side?: Side }
    | { type: "risk.blocked"; symbol: string; rule: string; detail: string }
    | { type: "tx.simulated"; symbol: string; ok: boolean; gasUsed?: string; error?: string; side?: Side }
    | { type: "tx.broadcast"; symbol: string; txHash: string; side?: Side }
    | { type: "tx.confirmed"; symbol: string; txHash: string; amountIn: string; amountOut: string; side?: Side }
    // A completed fill. mode "paper" = simulation passed and the fill is booked at the real quoted amounts, nothing broadcast.
    | {
        type: "trade.filled";
        symbol: string;
        side: Side;
        mode: FillMode;
        qty: number; // whole tokens
        usd: number; // USDT spent (buy) or received (sell)
        priceUsd: number; // usd / qty
        txHash?: string;
        realizedUsd?: number; // on sells
      }
    | { type: "position.updated"; position: PositionView; mode: FillMode }
    | {
        type: "pnl.snapshot";
        mode: FillMode;
        realizedUsd: number;
        unrealizedUsd: number;
        signalSpendUsd: number;
        gasSpendUsd: number;
        netUsd: number; // realized + unrealized - signal spend - gas
        positions: PositionView[];
      }
    | { type: "error"; where: string; message: string }
  );

export type AgentEventType = AgentEvent["type"];
