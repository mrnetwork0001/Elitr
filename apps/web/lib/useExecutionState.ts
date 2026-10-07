"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalystId, FillMode, PositionView } from "@elitr/shared";
import { EXECUTION_URL } from "./config";
import { fromUnits, isAddress, toMs, toNum } from "./format";

export interface PnlView {
  mode: FillMode | null;
  realizedUsd: number | null;
  unrealizedUsd: number | null;
  signalSpendUsd: number | null;
  gasSpendUsd: number | null;
  netUsd: number | null;
  positions: PositionView[];
}

export interface AnalystRow {
  analystId: AnalystId;
  name: string | null;
  url: string | null;
  online: boolean | null;
  priceUsd: number | null;
  erc8004AgentId: string | null;
  samples: number | null;
  hits: number | null;
  hitRate: number | null;
  trust: number | null;
  weight: number | null;
  paused: boolean | null;
  avgReturnBps: number | null;
}

export interface AssetRow {
  symbol: string;
  underlying: string | null;
  platform: string | null;
  address: string | null;
}

/** Normalised view of GET /state. Every field is optional: the agent may not report it yet. */
export interface ExecState {
  wallet: string | null;
  balances: { bnb: number | null; usdt: number | null; tokens: Record<string, number | null> };
  positionUsd: number | null;
  dailySpendUsd: number | null;
  dailyDataUsd: number | null;
  liveTrading: boolean | null;
  /** "paper" | "live" when reported; derived from liveTrading otherwise. */
  mode: FillMode | null;
  killSwitch: boolean | null;
  risk: Record<string, unknown> | null;
  lastCycleAt: number | null;
  nextCycleAt: number | null;
  running: boolean | null;
  /** Traded assets (new multi-asset contract), else the single legacy `asset`. */
  assets: AssetRow[];
  positions: PositionView[] | null;
  /** Per-symbol mark prices (USD) the agent values positions at. */
  marks: Record<string, number>;
  pnl: PnlView | null;
  analysts: AnalystRow[];
  /** true → POST /cycle and /kill need an operator bearer token. */
  controlAuth: boolean | null;
  configErrors: string[];
  raw: unknown;
}

export type StateStatus = "loading" | "ok" | "offline";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);

export function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "1" || v === "true") return true;
  if (v === 0 || v === "0" || v === "false") return false;
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function balance(v: unknown): number | null {
  // Raw smallest-unit integers (18 decimals) are converted; human numbers pass through.
  if (typeof v === "string" && /^\d{13,}$/.test(v.trim())) return fromUnits(v, 18);
  const o = obj(v);
  if (o) return toNum(o.formatted ?? o.amount ?? o.value ?? o.balance ?? o.qty);
  return toNum(v);
}

function parseAsset(v: unknown): AssetRow | null {
  if (typeof v === "string" && v) return { symbol: v, underlying: null, platform: null, address: null };
  const a = obj(v);
  const symbol = a && str(a.symbol);
  if (!a || !symbol) return null;
  return { symbol, underlying: str(a.underlying), platform: str(a.platform), address: str(a.address) };
}

export function parsePosition(v: unknown): PositionView | null {
  const p = obj(v);
  const symbol = p && str(p.symbol);
  const qty = p && toNum(p.qty);
  if (!p || !symbol || qty === null) return null;
  return {
    symbol,
    qty,
    avgCostUsd: toNum(p.avgCostUsd) ?? 0,
    markUsd: toNum(p.markUsd),
    unrealizedUsd: toNum(p.unrealizedUsd),
    realizedUsd: toNum(p.realizedUsd) ?? 0,
  };
}

const mode = (v: unknown): FillMode | null => (v === "paper" || v === "live" ? v : null);

function parsePnl(v: unknown): PnlView | null {
  const p = obj(v);
  if (!p) return null;
  return {
    mode: mode(p.mode),
    realizedUsd: toNum(p.realizedUsd),
    unrealizedUsd: toNum(p.unrealizedUsd),
    signalSpendUsd: toNum(p.signalSpendUsd),
    gasSpendUsd: toNum(p.gasSpendUsd),
    netUsd: toNum(p.netUsd),
    positions: Array.isArray(p.positions) ? (p.positions.map(parsePosition).filter(Boolean) as PositionView[]) : [],
  };
}

function parseAnalyst(v: unknown): AnalystRow | null {
  const a = obj(v);
  const id = a && str(a.analystId ?? a.id);
  if (!a || !id) return null;
  return {
    analystId: id as AnalystId,
    name: str(a.name),
    url: str(a.url),
    online: bool(a.online),
    priceUsd: toNum(a.priceUsd),
    erc8004AgentId: a.erc8004AgentId !== undefined && a.erc8004AgentId !== null ? String(a.erc8004AgentId) : null,
    samples: toNum(a.samples),
    hits: toNum(a.hits),
    hitRate: toNum(a.hitRate),
    trust: toNum(a.trust),
    weight: toNum(a.weight),
    paused: bool(a.paused),
    avgReturnBps: toNum(a.avgReturnBps),
  };
}

export function parseState(raw: unknown): ExecState {
  const o = obj(raw) ?? {};
  const b = obj(o.balances) ?? {};
  const tokensRaw = obj(b.tokens) ?? {};

  const assets: AssetRow[] = [];
  if (Array.isArray(o.assets)) for (const a of o.assets) {
    const r = parseAsset(a);
    if (r && !assets.some((x) => x.symbol === r.symbol)) assets.push(r);
  }
  const legacy = parseAsset(o.asset);
  if (legacy) {
    // The legacy `asset` object may carry details the plain `assets` symbol list lacks.
    const i = assets.findIndex((x) => x.symbol === legacy.symbol);
    if (i < 0) assets.push(legacy);
    else
      assets[i] = {
        symbol: legacy.symbol,
        underlying: assets[i].underlying ?? legacy.underlying,
        platform: assets[i].platform ?? legacy.platform,
        address: assets[i].address ?? legacy.address,
      };
  }

  const tokens: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(tokensRaw)) tokens[k] = balance(v);
  // Legacy single-asset balances: { nvdab } or { [symbol] }.
  for (const a of assets) {
    if (tokens[a.symbol] !== undefined) continue;
    const v = b[a.symbol] ?? b[a.symbol.toLowerCase()];
    if (v !== undefined) tokens[a.symbol] = balance(v);
  }

  const wallet = str(o.wallet) ?? str(obj(o.wallet)?.address);
  const liveTrading = bool(o.liveTrading);
  const positions = Array.isArray(o.positions) ? (o.positions.map(parsePosition).filter(Boolean) as PositionView[]) : null;
  return {
    wallet: isAddress(wallet) ? wallet : null,
    balances: { bnb: balance(b.bnb ?? b.BNB), usdt: balance(b.usdt ?? b.USDT), tokens },
    positionUsd: toNum(o.positionUsd),
    dailySpendUsd: toNum(o.dailySpendUsd),
    dailyDataUsd: toNum(o.dailyDataUsd),
    liveTrading,
    mode: mode(o.mode) ?? (liveTrading === null ? null : liveTrading ? "live" : "paper"),
    killSwitch: bool(o.killSwitch),
    risk: obj(o.risk),
    lastCycleAt: toMs(o.lastCycleAt),
    nextCycleAt: toMs(o.nextCycleAt),
    running: bool(o.running),
    assets,
    positions,
    marks: Object.fromEntries(
      Object.entries(obj(o.marks) ?? {})
        // Marks arrive as numbers or { price, source }.
        .map(([k, v]) => [k, toNum(obj(v)?.price ?? v)] as const)
        .filter((x): x is readonly [string, number] => x[1] !== null),
    ),
    pnl: parsePnl(o.pnl),
    analysts: Array.isArray(o.analysts) ? (o.analysts.map(parseAnalyst).filter(Boolean) as AnalystRow[]) : [],
    controlAuth: bool(o.controlAuth),
    configErrors: Array.isArray(o.configErrors) ? o.configErrors.filter((x): x is string => typeof x === "string") : [],
    raw,
  };
}

export interface ActionResult {
  ok: boolean;
  status: number | null;
  message: string;
}

/** Polls the execution agent's GET /state and exposes its two control actions. */
export function useExecutionState(intervalMs = 5000, token: string | null = null) {
  const [state, setState] = useState<ExecState | null>(null);
  const [status, setStatus] = useState<StateStatus>("loading");
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    const timeout = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(`${EXECUTION_URL}/state`, { cache: "no-store", signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setState(parseState(json));
      setStatus("ok");
      setFetchedAt(Date.now());
    } catch {
      if (!ctrl.signal.aborted || inflight.current === ctrl) setStatus("offline");
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), intervalMs);
    return () => {
      clearInterval(t);
      inflight.current?.abort();
    };
  }, [refresh, intervalMs]);

  const post = useCallback(
    async (path: "/cycle" | "/kill"): Promise<ActionResult> => {
      try {
        // Without a token: no custom headers keeps it a CORS "simple request" (no preflight).
        const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch(`${EXECUTION_URL}${path}`, { method: "POST", cache: "no-store", headers });
        let message = `HTTP ${res.status}`;
        try {
          const text = await res.text();
          if (text) {
            try {
              const j = JSON.parse(text) as Record<string, unknown>;
              message = String(j.message ?? j.error ?? j.status ?? (res.ok ? "ok" : message));
            } catch {
              message = text.slice(0, 200);
            }
          }
        } catch {
          /* ignore body errors */
        }
        void refresh();
        return { ok: res.ok, status: res.status, message };
      } catch (err) {
        return { ok: false, status: null, message: err instanceof Error ? `Execution agent unreachable (${err.message})` : "Execution agent unreachable" };
      }
    },
    [refresh, token],
  );

  const runCycle = useCallback(() => post("/cycle"), [post]);
  const engageKill = useCallback(() => post("/kill"), [post]);

  return { state, status, fetchedAt, refresh, runCycle, engageKill };
}
