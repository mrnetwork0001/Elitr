// Pure selectors over the merged event stream (newest first). Nothing here invents data:
// every value is computed from events the agents actually emitted.
import type { AgentEvent, AgentEventType, AgentId, AnalystId, AnalystStats, FillMode, PositionView } from "@elitr/shared";
import { fromUnits, isTxHash, startOfLocalDay } from "./format";

export type EventOf<T extends AgentEventType> = Extract<AgentEvent, { type: T }>;

export function latest<T extends AgentEventType>(events: AgentEvent[], type: T): EventOf<T> | undefined {
  return events.find((e) => e.type === type) as EventOf<T> | undefined;
}

export function ofType<T extends AgentEventType>(events: AgentEvent[], type: T): EventOf<T>[] {
  return events.filter((e) => e.type === type) as EventOf<T>[];
}

// ---------- Payments ----------

export interface PaymentSummary {
  /** Most recent payment from either side of the b402 handshake. */
  latest: (EventOf<"payment.sent"> | EventOf<"payment.verified">) | undefined;
  latestUsd: number | null;
  latestAsset: string | undefined;
  /** Best settle tx we know for the latest payment. */
  latestTx: string | undefined;
  todayUsd: number;
  todayCount: number;
  totalCount: number;
  /** Which side the counts come from. */
  basis: "buyer" | "seller" | null;
  lastRequired: EventOf<"payment.required"> | undefined;
}

export function paymentSummary(events: AgentEvent[], now: number): PaymentSummary {
  const sent = ofType(events, "payment.sent");
  const verified = ofType(events, "payment.verified");
  // Buyer-side (execution) is authoritative for spend; fall back to seller-side receipts
  // when the execution stream hasn't reported any. Never sum both (double counting).
  const basis: PaymentSummary["basis"] = sent.length ? "buyer" : verified.length ? "seller" : null;
  const ledger: (EventOf<"payment.sent"> | EventOf<"payment.verified">)[] = basis === "buyer" ? sent : verified;
  const dayStart = startOfLocalDay(now);
  let todayUsd = 0;
  let todayCount = 0;
  for (const p of ledger) {
    if (now && p.ts < dayStart) continue;
    todayCount++;
    todayUsd += fromUnits(p.amount) ?? 0;
  }
  const both = [...sent, ...verified].sort((a, b) => b.ts - a.ts);
  const latestP = both[0];
  let latestTx = latestP?.txHash;
  if (!isTxHash(latestTx) && latestP) {
    // The counterparty's event for the same handshake may carry the hash.
    const near = both.find((p) => isTxHash(p.txHash) && Math.abs(p.ts - latestP.ts) < 120_000);
    latestTx = near?.txHash;
  }
  return {
    latest: latestP,
    latestUsd: latestP ? fromUnits(latestP.amount) : null,
    latestAsset: latestP?.asset,
    latestTx: isTxHash(latestTx) ? latestTx : undefined,
    todayUsd,
    todayCount,
    totalCount: ledger.length,
    basis,
    lastRequired: latest(events, "payment.required"),
  };
}

// ---------- Prices ----------

export type PriceKind = "yahoo" | "rwa" | "reference" | "onchain";

export function classifyReference(source: string): PriceKind {
  if (/yahoo|yfinance/i.test(source)) return "yahoo";
  if (/rwa|binance/i.test(source)) return "rwa";
  return "reference";
}

export interface PricePoint {
  ts: number;
  price: number;
}

export interface PriceSeries {
  kind: PriceKind;
  source: string;
  symbol: string;
  latest: PricePoint;
  /** Oldest → newest. */
  points: PricePoint[];
}

export interface PriceView {
  series: PriceSeries[];
  onchain: PriceSeries | undefined;
  /** The reference used for the gap - Yahoo first, matching the execution agent's gap rule. */
  reference: PriceSeries | undefined;
  gapBps: number | null;
  gapSeries: PricePoint[];
}

const MAX_POINTS = 120;

export function priceView(events: AgentEvent[]): PriceView {
  const groups = new Map<string, PriceSeries>();
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type !== "price.reference" && e.type !== "price.onchain") continue;
    if (typeof e.price !== "number" || !Number.isFinite(e.price) || e.price <= 0) continue;
    const kind: PriceKind = e.type === "price.onchain" ? "onchain" : classifyReference(e.source ?? "");
    const key = kind === "onchain" ? "onchain" : `${kind}:${e.source}`;
    const pt = { ts: e.ts, price: e.price };
    const g = groups.get(key);
    if (g) {
      g.points.push(pt);
      g.latest = pt;
      g.symbol = e.symbol;
      g.source = e.source;
    } else groups.set(key, { kind, source: e.source, symbol: e.symbol, latest: pt, points: [pt] });
  }
  for (const g of groups.values()) if (g.points.length > MAX_POINTS) g.points = g.points.slice(-MAX_POINTS);

  const order: PriceKind[] = ["yahoo", "rwa", "reference", "onchain"];
  const series = [...groups.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const onchain = series.find((s) => s.kind === "onchain");
  const reference =
    series.find((s) => s.kind === "yahoo") ?? series.find((s) => s.kind === "rwa") ?? series.find((s) => s.kind === "reference");

  let gapBps: number | null = null;
  const gapSeries: PricePoint[] = [];
  if (onchain && reference) {
    gapBps = ((onchain.latest.price - reference.latest.price) / reference.latest.price) * 10_000;
    // Pair each on-chain point with the most recent reference point at or before it.
    let j = 0;
    const ref = reference.points;
    for (const p of onchain.points) {
      while (j + 1 < ref.length && ref[j + 1].ts <= p.ts) j++;
      if (ref[j] && ref[j].ts <= p.ts + 60_000) gapSeries.push({ ts: p.ts, price: ((p.price - ref[j].price) / ref[j].price) * 10_000 });
    }
  }
  return { series, onchain, reference, gapBps, gapSeries };
}

// ---------- Assets ----------

/** "NVDAB:swap" → "NVDAB". Execution labels some tx events with a suffix. */
export function baseSymbol(s: string | undefined): string {
  return (s ?? "").split(":")[0];
}

/** Events that belong to one asset (by `symbol`). Events without a symbol are excluded. */
export function forSymbol(events: AgentEvent[], sym: string): AgentEvent[] {
  return events.filter((e) => "symbol" in e && baseSymbol(e.symbol) === sym);
}

/** Every asset symbol seen on the stream (only real traded symbols, not "USDT:approve"). */
export function symbolsSeen(events: AgentEvent[]): string[] {
  const out = new Set<string>();
  for (const e of events) {
    if (e.type === "price.onchain" || e.type === "decision" || e.type === "risk.evaluated" || e.type === "analyst.selected" || e.type === "trade.filled")
      out.add(baseSymbol(e.symbol));
  }
  return [...out];
}

// ---------- Trade attempts ----------

export interface TradeAttempt {
  key: string;
  symbol: string;
  startedAt: number;
  side?: "buy" | "sell";
  decision?: EventOf<"decision">;
  simulated?: EventOf<"tx.simulated">;
  broadcast?: EventOf<"tx.broadcast">;
  confirmed?: EventOf<"tx.confirmed">;
  filled?: EventOf<"trade.filled">;
  errors: EventOf<"error">[];
}

const TX_ERROR_WHERE = /tx|trade|swap|broadcast|simulat|approve|quote|execut|confirm|receipt/i;
const ATTEMPT_WINDOW_MS = 10 * 60_000;

/** Groups tx.* + trade.filled events into simulate → broadcast → confirm → fill pipelines, newest first. */
export function tradeAttempts(events: AgentEvent[]): TradeAttempt[] {
  const attempts: TradeAttempt[] = [];
  const open = new Map<string, TradeAttempt>(); // by base symbol
  let lastOpen: TradeAttempt | undefined;
  const lastDecision = new Map<string, EventOf<"decision">>();
  const start = (e: AgentEvent & { symbol: string }, side?: "buy" | "sell") => {
    const sym = baseSymbol(e.symbol);
    const d = lastDecision.get(sym);
    const a: TradeAttempt = {
      key: e.id,
      symbol: e.symbol,
      startedAt: e.ts,
      side: side ?? (d && d.action !== "hold" && e.ts - d.ts < ATTEMPT_WINDOW_MS ? d.action : undefined),
      decision: d && d.action !== "hold" && e.ts - d.ts < ATTEMPT_WINDOW_MS ? d : undefined,
      errors: [],
    };
    attempts.push(a);
    open.set(sym, a);
    lastOpen = a;
    return a;
  };
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.agent !== "execution") continue;
    if (e.type === "decision") {
      lastDecision.set(baseSymbol(e.symbol), e);
    } else if (e.type === "tx.simulated") {
      start(e, e.side).simulated = e;
    } else if (e.type === "tx.broadcast") {
      let a = open.get(baseSymbol(e.symbol));
      if (!a || a.broadcast || a.filled || e.ts - a.startedAt > ATTEMPT_WINDOW_MS) a = start(e, e.side);
      a.broadcast = e;
      if (e.side) a.side = e.side;
    } else if (e.type === "tx.confirmed") {
      const match = attempts.find((a) => a.broadcast?.txHash === e.txHash && !a.confirmed);
      const o = open.get(baseSymbol(e.symbol));
      if (match) match.confirmed = e;
      else if (o && !o.confirmed && o.broadcast) o.confirmed = e;
      else start(e, e.side).confirmed = e;
    } else if (e.type === "trade.filled") {
      const byHash = e.txHash ? attempts.find((a) => (a.broadcast?.txHash === e.txHash || a.confirmed?.txHash === e.txHash) && !a.filled) : undefined;
      const o = open.get(baseSymbol(e.symbol));
      const a = byHash ?? (o && !o.filled && e.ts - o.startedAt < ATTEMPT_WINDOW_MS ? o : start(e, e.side));
      a.filled = e;
      a.side = e.side;
    } else if (e.type === "error" && lastOpen && !lastOpen.confirmed && !lastOpen.filled && TX_ERROR_WHERE.test(e.where) && e.ts - lastOpen.startedAt < ATTEMPT_WINDOW_MS) {
      lastOpen.errors.push(e);
    }
  }
  return attempts.reverse();
}

// ---------- Analyst market ----------

/** Latest reputation.updated per analyst. */
export function latestReputation(events: AgentEvent[]): Partial<Record<AnalystId, AnalystStats & { ts: number }>> {
  const out: Partial<Record<AnalystId, AnalystStats & { ts: number }>> = {};
  for (const e of events) {
    if (e.type !== "reputation.updated" || !e.stats?.analystId) continue;
    if (!out[e.stats.analystId]) out[e.stats.analystId] = { ...e.stats, ts: e.ts };
  }
  return out;
}

/** Latest identity.registered per subject agent. */
export function identities(events: AgentEvent[]): Partial<Record<AgentId, EventOf<"identity.registered">>> {
  const out: Partial<Record<AgentId, EventOf<"identity.registered">>> = {};
  for (const e of events) if (e.type === "identity.registered" && !out[e.subject]) out[e.subject] = e;
  return out;
}

/** Latest analyst.selected per asset symbol. */
export function latestSelections(events: AgentEvent[]): Map<string, EventOf<"analyst.selected">> {
  const out = new Map<string, EventOf<"analyst.selected">>();
  for (const e of events) if (e.type === "analyst.selected" && !out.has(e.symbol)) out.set(e.symbol, e);
  return out;
}

// ---------- P&L ----------

export function pnlHistory(events: AgentEvent[], mode: FillMode | null): PricePoint[] {
  const pts: PricePoint[] = [];
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type !== "pnl.snapshot" || (mode && e.mode !== mode) || !Number.isFinite(e.netUsd)) continue;
    pts.push({ ts: e.ts, price: e.netUsd });
  }
  return pts.slice(-MAX_POINTS * 2);
}

/** Latest position.updated per symbol (fallback when /state and pnl.snapshot don't report positions). */
export function latestPositions(events: AgentEvent[]): PositionView[] {
  const seen = new Map<string, PositionView>();
  for (const e of events) if (e.type === "position.updated" && e.position && !seen.has(e.position.symbol)) seen.set(e.position.symbol, e.position);
  return [...seen.values()];
}

// ---------- Timeline ----------

export type EventGroup = "payment" | "signal" | "market" | "price" | "risk" | "decision" | "tx" | "portfolio" | "error";

export function groupOf(type: AgentEventType): EventGroup {
  if (type.startsWith("payment.")) return "payment";
  if (type.startsWith("signal.")) return "signal";
  if (type === "analyst.selected" || type.startsWith("reputation.") || type.startsWith("identity.")) return "market";
  if (type.startsWith("price.")) return "price";
  if (type.startsWith("risk.")) return "risk";
  if (type === "decision") return "decision";
  if (type.startsWith("tx.")) return "tx";
  if (type === "trade.filled" || type === "position.updated" || type === "pnl.snapshot") return "portfolio";
  return "error";
}

export const GROUP_LABEL: Record<EventGroup, string> = {
  payment: "Payments",
  signal: "Signals",
  market: "Analyst market",
  price: "Prices",
  risk: "Risk",
  decision: "Decisions",
  tx: "Transactions",
  portfolio: "Fills & P&L",
  error: "Errors",
};
