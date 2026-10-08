// Weekend Gap board: every tokenized stock the Binance RWA Data API lists on BSC (bStocks + Ondo),
// its on-chain price vs the API's reference price and vs an independent Yahoo Finance price,
// per-token market status, sector tabs, cross-issuer pairs and DEX liquidity.
//
// Endpoints (docs/reference/ref-rwa-data.md, ref-general-data.md):
//   GET /api/v1/dex/market/rwa/platforms           which issuers exist (hourly)
//   GET /api/v1/dex/market/rwa/tokens              per platform (bstock, ondo) and per sector tabId 1-13 (hourly)
//   GET /api/v1/dex/market/rwa/price               batch, <= 100 addresses per call
//   GET /api/v1/dex/market/rwa/underlying-market   52w range, P/E - headline tickers only (10 min)
//   GET /api/v1/dex/market/token/top-liquidity     DEX pools - cross-issuer tokens only (10 min)
// Read-only: no signing, no wallet.

import type { BinanceWeb3Client } from "@elitr/binance";
import { ASSETS, TRADED_ASSETS } from "@elitr/shared";
import { Cached, errText, throttled } from "./apiThrottle.js";
import { fetchYahoo } from "./prices.js";
import { dxLog } from "./state.js";

const CHAIN = "56";
const P = {
  platforms: "/api/v1/dex/market/rwa/platforms",
  tokens: "/api/v1/dex/market/rwa/tokens",
  price: "/api/v1/dex/market/rwa/price",
  underlying: "/api/v1/dex/market/rwa/underlying-market",
  liquidity: "/api/v1/dex/market/token/top-liquidity",
} as const;

/** tabId labels exactly as the Get RWA Token List docs enumerate them. */
/**
 * Beyond ±20% the token and the Yahoo quote are almost certainly on a different share basis (a stock split
 * the token hasn't mirrored, a reverse-split ETF, a share multiplier), so the number is not a tradable gap.
 * Observed live: NFLXon +992,875 bps, SOXSon −9,891 bps.
 */
export const MAX_COMPARABLE_BPS = 2000;
export function comparableBps(bps: number | null): number | null {
  return bps === null || !Number.isFinite(bps) || Math.abs(bps) > MAX_COMPARABLE_BPS ? null : bps;
}

/** Sort key for the board: the largest *comparable* gap first; basis-mismatch artefacts sort as 0. */
export function boardSortKey(t: Pick<BoardToken, "yahooSpreadBps" | "refSpreadBps">): number {
  return Math.abs(t.yahooSpreadBps ?? t.refSpreadBps ?? 0);
}

/**
 * `rwa/tokens?tabId=N` was observed (2026-10-08) to return the whole token list for every tab, so each token
 * looked like a member of all 13 sectors. A tab whose members equal the full set carries no information.
 */
export function tabIgnored(tab: Set<string>, all: Set<string>): boolean {
  if (!all.size || tab.size !== all.size) return false;
  for (const a of tab) if (!all.has(a)) return false;
  return true;
}

export const SECTORS: Record<number, string> = {
  1: "Serenity Call",
  2: "SpaceX",
  3: "Upcoming Earnings",
  4: "AI Chips",
  5: "Storage",
  6: "Energy",
  7: "Precious Metals",
  8: "China ADR",
  9: "Magnificent 7",
  10: "Crypto",
  11: "ETF",
  12: "Tech Leaders",
  13: "Buffett Portfolio",
};

export const ISSUER: Record<string, string> = { bstock: "bStocks", ondo: "Ondo" };
const ASSET_TYPE: Record<number, string> = { 1: "stock", 2: "pre-ipo", 3: "etf" };

// ---- pure math (unit-tested) ------------------------------------------------------

/** Premium (+) or discount (-) of `price` over `reference`, in basis points. */
export function spreadBps(price: number | null | undefined, reference: number | null | undefined): number | null {
  if (price == null || reference == null || !Number.isFinite(price) || !Number.isFinite(reference) || price <= 0 || reference <= 0) return null;
  return ((price - reference) / reference) * 10_000;
}

/**
 * The trader's `minGapBps` rule measures the opposite sign: how far on-chain sits BELOW the Yahoo
 * reference (risk.ts gapBps). A token is a buy candidate on price alone when this is >= minGapBps.
 */
export function traderGapBps(onchain: number | null, yahoo: number | null): number | null {
  const s = spreadBps(onchain, yahoo);
  return s == null ? null : -s;
}

export interface MarketState {
  openState: boolean;
  marketStatus: string;
  reasonCode: string | null;
  reasonMsg: string | null;
  nextOpenTime: number | null;
  nextCloseTime: number | null;
}

/** The market-status object is nested under an unnamed key in the docs: find it structurally. */
export function marketStateOf(obj: unknown): MarketState | null {
  if (!obj || typeof obj !== "object") return null;
  const tryOne = (m: Record<string, unknown>): MarketState => ({
    openState: m.openState === true,
    marketStatus: String(m.marketStatus ?? "unknown"),
    reasonCode: m.reasonCode == null ? null : String(m.reasonCode),
    reasonMsg: m.reasonMsg == null ? null : String(m.reasonMsg),
    nextOpenTime: m.nextOpenTime == null || m.nextOpenTime === "" ? null : Number(m.nextOpenTime),
    nextCloseTime: m.nextCloseTime == null || m.nextCloseTime === "" ? null : Number(m.nextCloseTime),
  });
  const o = obj as Record<string, unknown>;
  if ("openState" in o) return tryOne(o);
  for (const v of Object.values(o)) if (v && typeof v === "object" && !Array.isArray(v) && "openState" in v) return tryOne(v as Record<string, unknown>);
  return null;
}

/** The status most tokens report (ties → the first seen). `basis` says how many agree. */
export function consensusMarket(states: (MarketState | null)[]): (MarketState & { agree: number; total: number }) | null {
  const seen = states.filter((s): s is MarketState => !!s);
  if (!seen.length) return null;
  const key = (s: MarketState) => `${s.openState}|${s.marketStatus}|${s.reasonCode}|${s.nextOpenTime}`;
  const counts = new Map<string, { s: MarketState; n: number }>();
  for (const s of seen) {
    const k = key(s);
    const c = counts.get(k);
    if (c) c.n++;
    else counts.set(k, { s, n: 1 });
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  return { ...best.s, agree: best.n, total: seen.length };
}

export interface PairLeg {
  symbol: string;
  issuer: string;
  address: string;
  tokenPrice: number | null;
  liquidityUsd: number | null;
  topPool: string | null;
}

export interface CrossIssuerPair {
  underlying: string;
  name: string | null;
  legs: PairLeg[];
  /** bStocks leg over Ondo leg, bps (+ = bStocks dearer). Null unless both legs have prices. */
  crossSpreadBps: number | null;
}

/** Group tokens by underlying ticker; keep tickers present on two or more issuers. */
export function crossIssuerPairs(tokens: Pick<BoardToken, "underlying" | "underlyingName" | "platformId" | "symbol" | "address" | "tokenPrice" | "liquidityUsd" | "topPool">[]): CrossIssuerPair[] {
  const by = new Map<string, typeof tokens>();
  for (const t of tokens) {
    if (!t.underlying) continue;
    const k = t.underlying.toUpperCase();
    by.set(k, [...(by.get(k) ?? []), t]);
  }
  const out: CrossIssuerPair[] = [];
  for (const [underlying, ts] of by) {
    const issuers = new Set(ts.map((t) => t.platformId));
    if (issuers.size < 2) continue;
    const legs = ts
      .map((t) => ({ symbol: t.symbol, issuer: ISSUER[t.platformId] ?? t.platformId, address: t.address, tokenPrice: t.tokenPrice, liquidityUsd: t.liquidityUsd ?? null, topPool: t.topPool ?? null }))
      .sort((a, b) => a.issuer.localeCompare(b.issuer));
    const b = ts.find((t) => t.platformId === "bstock");
    const o = ts.find((t) => t.platformId === "ondo");
    out.push({ underlying, name: ts.find((t) => t.underlyingName)?.underlyingName ?? null, legs, crossSpreadBps: b && o ? spreadBps(b.tokenPrice, o.tokenPrice) : null });
  }
  return out.sort((a, b) => Math.abs(b.crossSpreadBps ?? 0) - Math.abs(a.crossSpreadBps ?? 0));
}

/** Yahoo ticker for an underlying ("BRK.B" → "BRK-B"). */
export const yahooTicker = (t: string) => t.trim().toUpperCase().replace(/\./g, "-");

// ---- fetching -----------------------------------------------------------------------

export interface BoardToken {
  symbol: string;
  name: string | null;
  address: string;
  platformId: string;
  issuer: string;
  assetType: string | null;
  underlying: string;
  underlyingName: string | null;
  tokenPrice: number | null;
  referencePrice: number | null;
  priceUpdatedAt: number | null;
  refSpreadBps: number | null; // on-chain vs Binance referencePrice (+ = premium); null when the share basis differs
  refBasisMismatch: boolean; // |raw spread| > MAX_COMPARABLE_BPS (e.g. KLACon +90,261 bps): not a gap
  refRawSpreadBps: number | null;
  yahooPrice: number | null;
  yahooTime: number | null;
  yahooSpreadBps: number | null; // on-chain vs Yahoo (+ = premium); null when the share basis differs
  yahooBasisMismatch: boolean; // |raw spread| > MAX_COMPARABLE_BPS: split / share multiplier, not a tradable gap
  yahooRawSpreadBps: number | null; // the uncorrected figure, kept for transparency
  traderGapBps: number | null; // trader's minGapBps convention (+ = on-chain below Yahoo)
  market: MarketState | null;
  volume24hUsd: number | null;
  marketCapUsd: number | null;
  peRatioTTM: number | null;
  sectors: number[];
  traded: boolean;
  liquidityUsd: number | null;
  topPool: string | null;
  underlyingMarket: Record<string, number | string | null> | null;
}

export interface RwaBoardView {
  fetchedAt: number;
  chainId: string;
  platforms: { platformId: string; issuer: string; tokens: number; bscTokens: number | null; error?: string }[];
  xStocks: { covered: false; note: string };
  market: (MarketState & { agree: number; total: number; lastCloseTime: number | null; lastCloseSource: string | null }) | null;
  tokens: BoardToken[];
  pairs: CrossIssuerPair[];
  sectors: { tabId: number; label: string; count: number | null; error?: string }[];
  sectorsFetchedAt: number | null;
  yahoo: { source: string; requested: number; priced: number; error?: string; note: string };
  minGapBps: number | null;
  errors: string[];
  notes: string[];
}

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type Row = Record<string, unknown>;

/** Yahoo v8 spark batch: up to 20 symbols per call, no crumb (v7 /quote answers 401 Unauthorized). */
export async function fetchYahooBatch(tickers: string[]): Promise<{ prices: Map<string, { price: number; time: number }>; errors: string[] }> {
  const prices = new Map<string, { price: number; time: number }>();
  const errors: string[] = [];
  for (let i = 0; i < tickers.length; i += 20) {
    const chunk = tickers.slice(i, i + 20);
    const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(chunk.join(","))}&range=1d&interval=5m`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
      const text = await res.text();
      if (!res.ok) throw new Error(`Yahoo spark HTTP ${res.status}: ${text.slice(0, 100)}`);
      const json = JSON.parse(text) as Record<string, { close?: (number | null)[]; timestamp?: number[] }>;
      for (const [sym, v] of Object.entries(json)) {
        const closes = v?.close ?? [];
        const ts = v?.timestamp ?? [];
        for (let j = closes.length - 1; j >= 0; j--) {
          const c = closes[j];
          if (typeof c === "number" && Number.isFinite(c) && c > 0) {
            prices.set(sym.toUpperCase(), { price: c, time: (ts[j] ?? 0) * 1000 });
            break;
          }
        }
      }
    } catch (e) {
      errors.push(errText(e));
    }
  }
  return { prices, errors };
}

const PRICE_BATCH = 25; // rwa/price addresses per call (100 overflowed the URL: HTTP 414)
const HEADLINE_UNDERLYING = 6; // rwa/underlying-market calls per refresh, at most
const LIQUIDITY_TOKENS = 12; // top-liquidity calls per refresh, at most
const YAHOO_MAX = 100; // tickers priced via Yahoo, at most (5 spark calls)

export class RwaBoard {
  private readonly board: Cached<RwaBoardView>;
  private readonly sectors: Cached<{ at: number; members: Map<number, Set<string>>; rows: RwaBoardView["sectors"]; ignored: number }>;
  private allAddresses = new Set<string>(); // every BSC token on the board, lowercased - what an ignored tabId returns
  private readonly platforms: Cached<{ rows: Row[] | null; error?: string }>;
  private readonly underlying = new Map<string, { at: number; v: Record<string, number | string | null> | null }>();
  private readonly liquidity = new Map<string, { at: number; usd: number | null; pool: string | null }>();
  private readonly yahoo: Cached<{ prices: Map<string, { price: number; time: number }>; errors: string[]; requested: number }>;
  private yahooWanted: string[] = [];

  constructor(
    private readonly client: BinanceWeb3Client | null,
    private readonly opts: { minGapBps?: number; ttlMs?: number } = {},
  ) {
    this.board = new Cached(opts.ttlMs ?? 60_000, () => this.build());
    this.sectors = new Cached(60 * 60_000, () => this.loadSectors());
    this.platforms = new Cached(60 * 60_000, async () => ({ rows: (await this.call<Row[]>(P.platforms, {})) ?? [] }));
    this.yahoo = new Cached(120_000, async () => {
      const wanted = this.yahooWanted.slice(0, YAHOO_MAX);
      const r = await fetchYahooBatch(wanted);
      return { ...r, requested: wanted.length };
    });
  }

  get(force = false): Promise<RwaBoardView> {
    return this.board.get(force);
  }

  private call<T>(path: string, query: Record<string, string | number | undefined>): Promise<T> {
    const c = this.client!;
    return throttled(path, () => c.call<T>("GET", path, { query }));
  }

  private async loadSectors() {
    const members = new Map<number, Set<string>>();
    const rows: RwaBoardView["sectors"] = [];
    let ignored = 0;
    for (const id of Object.keys(SECTORS).map(Number)) {
      try {
        const list = (await this.call<Row[]>(P.tokens, { binanceChainId: CHAIN, tabId: id })) ?? [];
        const set = new Set(list.map((t) => String(t.tokenContractAddress ?? "").toLowerCase()).filter(Boolean));
        if (tabIgnored(set, this.allAddresses)) {
          ignored++;
          rows.push({ tabId: id, label: SECTORS[id], count: null, error: `tabId ignored by the API (returned all ${set.size} tokens)` });
          continue;
        }
        members.set(id, set);
        rows.push({ tabId: id, label: SECTORS[id], count: set.size });
      } catch (e) {
        rows.push({ tabId: id, label: SECTORS[id], count: null, error: errText(e) });
      }
    }
    if (ignored) dxLog("rwa-data", `rwa/tokens?tabId=N ignores tabId: ${ignored} of ${rows.length} sector tabs returned the full token list`, `GET ${P.tokens}?binanceChainId=56&tabId=1..13`);
    return { at: Date.now(), members, rows, ignored };
  }

  private async underlyingFor(addr: string): Promise<Record<string, number | string | null> | null> {
    const hit = this.underlying.get(addr);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.v;
    const data = await this.call<Row>(P.underlying, { binanceChainId: CHAIN, tokenContractAddress: addr });
    // Market data sits in an unnamed nested object (the one carrying high52W / referencePrice).
    let md: Row | null = null;
    for (const v of Object.values(data ?? {})) if (v && typeof v === "object" && !Array.isArray(v) && ("high52W" in v || "peRatioTTM" in v)) md = v as Row;
    const pick = md
      ? {
          high52W: num(md.high52W),
          low52W: num(md.low52W),
          peRatioTTM: num(md.peRatioTTM),
          pbRatio: num(md.pbRatio),
          marketCap: num(md.marketCap),
          dividendYield: num(md.dividendYield),
          avgDailyVolume1Y: num(md.avgDailyVolume1Y),
          amplitude: num(md.amplitude),
        }
      : null;
    this.underlying.set(addr, { at: Date.now(), v: pick });
    return pick;
  }

  private async liquidityFor(addr: string): Promise<{ usd: number | null; pool: string | null }> {
    const hit = this.liquidity.get(addr);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit;
    const pools = (await this.call<Row[]>(P.liquidity, { binanceChainId: CHAIN, tokenContractAddress: addr })) ?? [];
    let usd: number | null = null;
    let pool: string | null = null;
    for (const p of pools) {
      const l = num(p.liquidityUsd);
      if (l == null) continue;
      usd = (usd ?? 0) + l;
      if (pool == null) pool = [p.pool, p.protocolName].filter(Boolean).join(" · ") || null;
    }
    const v = { at: Date.now(), usd, pool };
    this.liquidity.set(addr, v);
    return v;
  }

  private async build(): Promise<RwaBoardView> {
    const errors: string[] = [];
    const notes: string[] = [];
    const view: RwaBoardView = {
      fetchedAt: Date.now(),
      chainId: CHAIN,
      platforms: [],
      xStocks: {
        covered: false,
        note: "The RWA Data API's platformId enum is only ondo | bstock, so xStocks tokens (e.g. TSLAx on BSC) are not on this board.",
      },
      market: null,
      tokens: [],
      pairs: [],
      sectors: [],
      sectorsFetchedAt: null,
      yahoo: { source: "yahoo-finance v8 spark", requested: 0, priced: 0, note: "" },
      minGapBps: this.opts.minGapBps ?? null,
      errors,
      notes,
    };
    const finish = (v: RwaBoardView) => {
      v.errors = [...new Set(errors)];
      v.fetchedAt = Date.now();
      return v;
    };
    if (!this.client) {
      errors.push("Binance Web3 API client not configured (BINANCE_WEB3_API_KEY / BINANCE_WEB3_API_SECRET)");
      return finish(view);
    }

    // 1. Token lists per issuer (sequential on the same path via the throttle).
    const platP: Promise<{ rows: Row[] | null; error?: string }> = this.platforms.get().catch((e) => ({ rows: null, error: errText(e) }));
    const lists = await Promise.all(
      (["bstock", "ondo"] as const).map(async (platformId) => {
        try {
          return { platformId, rows: (await this.call<Row[]>(P.tokens, { binanceChainId: CHAIN, platformId })) ?? [] };
        } catch (e) {
          errors.push(`rwa/tokens platformId=${platformId}: ${errText(e)}`);
          return { platformId, rows: null as Row[] | null, error: errText(e) };
        }
      }),
    );
    const plat = await platP;
    if (plat.error) errors.push(`rwa/platforms: ${plat.error}`);
    for (const l of lists) {
      const p = plat.rows?.find((r) => r.platformId === l.platformId);
      const chains = Array.isArray(p?.chains) ? (p!.chains as Row[]) : Array.isArray(Object.values(p ?? {}).find(Array.isArray)) ? (Object.values(p!).find(Array.isArray) as Row[]) : [];
      const bsc = chains.find((c) => String(c.binanceChainId) === CHAIN);
      view.platforms.push({ platformId: l.platformId, issuer: ISSUER[l.platformId], tokens: l.rows?.length ?? 0, bscTokens: bsc ? num(bsc.tokenCount) : null, ...(l.rows ? {} : { error: (l as { error?: string }).error }) });
    }
    const extra = (plat.rows ?? []).map((r) => String(r.platformId)).filter((id) => id !== "bstock" && id !== "ondo");
    if (extra.length) notes.push(`rwa/platforms also lists: ${extra.join(", ")} (not in the documented platformId enum; not queried).`);

    const traded = new Set(TRADED_ASSETS.map((a) => a.address.toLowerCase()));
    const tokens: BoardToken[] = [];
    for (const l of lists) {
      for (const t of l.rows ?? []) {
        const address = String(t.tokenContractAddress ?? "");
        if (!address) continue;
        if (t.binanceChainId != null && String(t.binanceChainId) !== CHAIN) continue;
        const tokenPrice = num(t.tokenPrice);
        const referencePrice = num(t.referencePrice);
        tokens.push({
          symbol: String(t.tokenSymbol ?? "?"),
          name: t.tokenName ? String(t.tokenName) : null,
          address,
          platformId: l.platformId,
          issuer: ISSUER[l.platformId],
          assetType: ASSET_TYPE[Number(t.assetType)] ?? null,
          underlying: String(t.underlyingTicker ?? ""),
          underlyingName: t.underlyingName ? String(t.underlyingName) : null,
          tokenPrice,
          referencePrice,
          priceUpdatedAt: null,
          refSpreadBps: comparableBps(spreadBps(tokenPrice, referencePrice)),
          refBasisMismatch: spreadBps(tokenPrice, referencePrice) !== null && comparableBps(spreadBps(tokenPrice, referencePrice)) === null,
          refRawSpreadBps: spreadBps(tokenPrice, referencePrice),
          yahooPrice: null,
          yahooTime: null,
          yahooSpreadBps: null,
          yahooBasisMismatch: false,
          yahooRawSpreadBps: null,
          traderGapBps: null,
          market: marketStateOf(t),
          volume24hUsd: num(t.volume24H),
          marketCapUsd: num(t.marketCap),
          peRatioTTM: num(t.peRatioTTM),
          sectors: [],
          traded: traded.has(address.toLowerCase()),
          liquidityUsd: null,
          topPool: null,
          underlyingMarket: null,
        });
      }
    }

    // Nothing listed (typically: API unreachable) → stop here instead of timing out on 20 more calls.
    if (!tokens.length) {
      if (!errors.length) notes.push("rwa/tokens returned no BSC tokens for bstock or ondo.");
      return finish(view);
    }
    this.allAddresses = new Set(tokens.map((t) => t.address.toLowerCase()));

    // 2. Fresh prices in small batches (rwa/tokens prices can lag; rwa/price carries tokenPriceUpdatedAt).
    for (let i = 0; i < tokens.length; i += PRICE_BATCH) {
      const chunk = tokens.slice(i, i + PRICE_BATCH);
      try {
        const rows = (await this.call<Row[]>(P.price, { binanceChainId: CHAIN, tokenContractAddresses: chunk.map((t) => t.address).join(",") })) ?? [];
        const by = new Map(rows.map((r) => [String(r.tokenContractAddress ?? "").toLowerCase(), r]));
        for (const t of chunk) {
          const r = by.get(t.address.toLowerCase());
          if (!r) continue;
          t.tokenPrice = num(r.tokenPrice) ?? t.tokenPrice;
          t.referencePrice = num(r.referencePrice) ?? t.referencePrice;
          t.priceUpdatedAt = num(r.tokenPriceUpdatedAt);
          t.refRawSpreadBps = spreadBps(t.tokenPrice, t.referencePrice);
          t.refSpreadBps = comparableBps(t.refRawSpreadBps);
          t.refBasisMismatch = t.refRawSpreadBps !== null && t.refSpreadBps === null;
        }
      } catch (e) {
        errors.push(`rwa/price batch: ${errText(e)} - showing rwa/tokens prices`);
      }
    }

    // 3. Sectors (hourly), Yahoo (2 min) and the last US close in parallel.
    const tickers = [...new Set(tokens.map((t) => yahooTicker(t.underlying)).filter(Boolean))];
    // Traded assets' underlyings first so they are always inside the YAHOO_MAX cap.
    const first = new Set(TRADED_ASSETS.map((a) => yahooTicker(a.underlying)));
    this.yahooWanted = [...tickers.filter((t) => first.has(t)), ...tickers.filter((t) => !first.has(t))];
    if (tickers.length > YAHOO_MAX) notes.push(`Yahoo prices limited to the first ${YAHOO_MAX} of ${tickers.length} underlyings.`);
    const [sec, yh, lastClose] = await Promise.all([
      this.sectors.get().catch((e) => {
        errors.push(`sector tabs: ${errText(e)}`);
        return null;
      }),
      this.yahooWanted.length
        ? this.yahoo.get(!this.yahoo.fresh || (this.yahoo.peek()?.requested ?? 0) < Math.min(this.yahooWanted.length, YAHOO_MAX)).catch((e) => ({ prices: new Map(), errors: [errText(e)], requested: 0 }))
        : Promise.resolve({ prices: new Map<string, { price: number; time: number }>(), errors: [], requested: 0 }),
      fetchYahoo(ASSETS.NVDAB.underlying).catch(() => null),
    ]);
    if (sec) {
      view.sectors = sec.rows;
      view.sectorsFetchedAt = sec.at;
      for (const t of tokens) for (const [id, set] of sec.members) if (set.has(t.address.toLowerCase())) t.sectors.push(id);
      if (sec.ignored) notes.push(`Sector tabs: the API returned the full token list for ${sec.ignored} of ${sec.rows.length} tabIds, so those sectors are not shown (tokens are not tagged with them).`);
    }
    view.yahoo.requested = yh.requested;
    if (yh.errors.length) view.yahoo.error = yh.errors.join("; ");
    for (const t of tokens) {
      const y = yh.prices.get(yahooTicker(t.underlying));
      if (!y) continue;
      t.yahooPrice = y.price;
      t.yahooTime = y.time;
      const raw = spreadBps(t.tokenPrice, y.price);
      t.yahooRawSpreadBps = raw;
      t.yahooBasisMismatch = comparableBps(raw) === null && raw !== null;
      t.yahooSpreadBps = comparableBps(raw);
      t.traderGapBps = t.yahooBasisMismatch ? null : traderGapBps(t.tokenPrice, y.price);
    }
    view.yahoo.priced = tokens.filter((t) => t.yahooPrice != null).length;
    view.yahoo.note =
      "Yahoo is the independent reference: Binance's referencePrice is documented as derived from the on-chain token price. Yahoo shows the last regular-session trade (the last close while the US market is shut). Tokenized shares can carry a share multiplier, so a large constant offset can be a conversion, not a gap.";

    // 4. Cross-issuer pairs → liquidity for their legs (+ traded tokens), capped.
    const pairsPre = crossIssuerPairs(tokens);
    const liqTargets = [...new Set([...tokens.filter((t) => t.traded).map((t) => t.address), ...pairsPre.flatMap((p) => p.legs.map((l) => l.address))])].slice(0, LIQUIDITY_TOKENS);
    if (pairsPre.flatMap((p) => p.legs).length + tokens.filter((t) => t.traded).length > LIQUIDITY_TOKENS) notes.push(`DEX liquidity fetched for ${LIQUIDITY_TOKENS} tokens per refresh (traded tokens and cross-issuer pairs first).`);
    let liqErr = 0;
    for (const addr of liqTargets) {
      try {
        const l = await this.liquidityFor(addr);
        const t = tokens.find((x) => x.address === addr)!;
        t.liquidityUsd = l.usd;
        t.topPool = l.pool;
      } catch (e) {
        if (liqErr++ === 0) errors.push(`token/top-liquidity: ${errText(e)}`);
      }
    }
    view.pairs = crossIssuerPairs(tokens);

    // 5. Underlying market data for headline tickers: traded assets, then pair underlyings.
    const headline = [
      ...tokens.filter((t) => t.traded),
      ...view.pairs.map((p) => tokens.find((t) => t.underlying.toUpperCase() === p.underlying && t.platformId === "bstock") ?? tokens.find((t) => t.underlying.toUpperCase() === p.underlying)!),
    ].filter((t, i, a) => t && a.findIndex((x) => x.underlying === t.underlying) === i).slice(0, HEADLINE_UNDERLYING);
    let umErr = 0;
    for (const t of headline) {
      try {
        t.underlyingMarket = await this.underlyingFor(t.address);
        for (const o of tokens) if (o !== t && o.underlying === t.underlying) o.underlyingMarket = t.underlyingMarket;
      } catch (e) {
        if (umErr++ === 0) errors.push(`rwa/underlying-market: ${errText(e)}`);
      }
    }

    // 6. One header for the US session: the status most tokens agree on.
    const c = consensusMarket(tokens.map((t) => t.market));
    if (c) {
      const closedNow = !c.openState;
      view.market = {
        ...c,
        lastCloseTime: closedNow && lastClose && !lastClose.marketOpen ? lastClose.marketTime : null,
        lastCloseSource: closedNow && lastClose && !lastClose.marketOpen ? `yahoo ${ASSETS.NVDAB.underlying} regularMarketTime` : null,
      };
    } else if (tokens.length) {
      notes.push("rwa/tokens returned no market-status object for any token.");
    }

    view.tokens = tokens.sort((a, b) => boardSortKey(b) - boardSortKey(a));
    return finish(view);
  }
}
