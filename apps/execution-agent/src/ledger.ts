import { formatUnits } from "viem";
import type { FillMode, PositionView, Side } from "@elitr/shared";

// Average-cost ledger. One instance per mode (paper / live), persisted in data/execution-state.json.
// Quantities are kept in smallest units (bigint as decimal strings) so a full exit sells exactly what
// was bought; USD values are plain numbers.

export interface LedgerPosition {
  qtyWei: string;
  decimals: number;
  costUsd: number; // cost basis of the open quantity
  realizedUsd: number; // cumulative realized P&L for this symbol
}

export interface FillRecord {
  ts: number;
  mode: FillMode;
  symbol: string;
  side: Side;
  qtyWei: string;
  qty: number; // whole tokens
  usd: number; // USDT spent (buy) / received (sell)
  priceUsd: number;
  realizedUsd?: number;
  txHash?: string;
}

export interface LedgerState {
  positions: Record<string, LedgerPosition>;
  gasBnb: number;
  gasUsd: number;
  fills: FillRecord[];
}

export const emptyLedger = (): LedgerState => ({ positions: {}, gasBnb: 0, gasUsd: 0, fills: [] });

export interface FillInput {
  ts: number;
  mode: FillMode;
  symbol: string;
  side: Side;
  qtyWei: bigint;
  decimals: number;
  usd: number;
  txHash?: string;
}

/** Apply a fill in place. Sells realize (proceeds − avgCost × qty); selling more than held throws. */
export function applyFill(l: LedgerState, f: FillInput): FillRecord {
  if (f.qtyWei <= 0n) throw new Error(`fill qty must be positive (${f.symbol} ${f.side})`);
  if (!(f.usd >= 0) || !Number.isFinite(f.usd)) throw new Error(`fill usd invalid: ${f.usd}`);
  const pos = (l.positions[f.symbol] ??= { qtyWei: "0", decimals: f.decimals, costUsd: 0, realizedUsd: 0 });
  const held = BigInt(pos.qtyWei);
  const qty = Number(formatUnits(f.qtyWei, f.decimals));
  let realizedUsd: number | undefined;
  if (f.side === "buy") {
    pos.qtyWei = (held + f.qtyWei).toString();
    pos.costUsd += f.usd;
  } else {
    if (f.qtyWei > held) throw new Error(`cannot sell ${qty} ${f.symbol}: ledger holds ${formatUnits(held, f.decimals)}`);
    // Cost removed is proportional to the share of the position sold (exact for a full exit).
    const removed = f.qtyWei === held ? pos.costUsd : (pos.costUsd * Number(f.qtyWei)) / Number(held);
    realizedUsd = f.usd - removed;
    pos.costUsd -= removed;
    pos.realizedUsd += realizedUsd;
    pos.qtyWei = (held - f.qtyWei).toString();
    if (pos.qtyWei === "0") pos.costUsd = 0;
  }
  const rec: FillRecord = {
    ts: f.ts,
    mode: f.mode,
    symbol: f.symbol,
    side: f.side,
    qtyWei: f.qtyWei.toString(),
    qty,
    usd: f.usd,
    priceUsd: f.usd / qty,
    realizedUsd,
    txHash: f.txHash,
  };
  l.fills.push(rec);
  l.fills = l.fills.slice(-500);
  return rec;
}

export function heldWei(l: LedgerState, symbol: string): bigint {
  return BigInt(l.positions[symbol]?.qtyWei ?? "0");
}

export function positionView(l: LedgerState, symbol: string, markUsd: number | null): PositionView {
  const p = l.positions[symbol];
  const qty = p ? Number(formatUnits(BigInt(p.qtyWei), p.decimals)) : 0;
  const avgCostUsd = p && qty > 0 ? p.costUsd / qty : 0;
  return {
    symbol,
    qty,
    avgCostUsd,
    markUsd,
    unrealizedUsd: qty === 0 ? 0 : markUsd == null ? null : qty * markUsd - (p?.costUsd ?? 0),
    realizedUsd: p?.realizedUsd ?? 0,
  };
}

export interface PnlSummary {
  realizedUsd: number;
  unrealizedUsd: number; // positions without a mark contribute nothing (their view shows null)
  signalSpendUsd: number;
  gasSpendUsd: number;
  netUsd: number;
}

export function summarize(l: LedgerState, views: PositionView[], signalSpendUsd: number): PnlSummary {
  const realizedUsd = Object.values(l.positions).reduce((s, p) => s + p.realizedUsd, 0);
  const unrealizedUsd = views.reduce((s, v) => s + (v.unrealizedUsd ?? 0), 0);
  const gasSpendUsd = l.gasUsd;
  return { realizedUsd, unrealizedUsd, signalSpendUsd, gasSpendUsd, netUsd: realizedUsd + unrealizedUsd - signalSpendUsd - gasSpendUsd };
}
