/**
 * Elitr Desk Brief — the seller's value layer.
 *
 * Fetches the LIVE Elitr desk's free public JSON endpoints and assembles a
 * structured, factual brief. Every number in the brief is copied (or
 * arithmetically derived, e.g. a spread in bps) from those endpoints — this
 * module never invents data. If a required endpoint is unreachable the fetch
 * throws {@link ElitrUnavailableError}; the HTTP route turns that into a 503
 * BEFORE the B402 seller is invoked, so the buyer is never asked to pay
 * (and never settles) for a brief we cannot build. See `unifiedMain.ts`.
 *
 * No signing, no wallet, no LLM in here. The optional LLM wording pass lives
 * in `unifiedMain.ts` and can only replace the one-line `headline`; the facts
 * are always returned alongside it.
 *
 * Upstreams (all free, read-only):
 *   https://agent.elitr.xyz/summary/today          plain-English daily summary + facts
 *   https://agent.elitr.xyz/state                  mode, positions, P&L, analysts' stats
 *   https://agent.elitr.xyz/rwa/board              weekend-gap board + US market status
 *   https://agent.elitr.xyz/.well-known/agent-registration.json   (optional)
 *   https://analyst.elitr.xyz/info, https://flow.elitr.xyz/info  (optional)
 * The analysts' paid `/signal` endpoints are NEVER called.
 */

import https from "node:https";
import http from "node:http";
import type { LookupFunction } from "node:net";

// ── configuration ────────────────────────────────────────────────────────────

export const ELITR_SITE = "https://elitr.xyz";
/** ERC-8004 Identity Registry on BSC mainnet (from Elitr's registration file). */
export const ERC8004_MAINNET_REGISTRY =
  "eip155:56:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
/** Elitr's three mainnet ERC-8004 agents (static facts, also re-read live). */
export const ELITR_ERC8004_IDS = {
  newsAnalyst: 365554,
  flowAnalyst: 365555,
  executionAgent: 365556,
} as const;

function env(name: string, dflt: string): string {
  const v = process.env[name];
  return v !== undefined && v.trim() !== "" ? v.trim().replace(/\/+$/, "") : dflt;
}

function envNumber(name: string, dflt: number): number {
  const v = Number(process.env[name] ?? "");
  return Number.isFinite(v) && v > 0 ? v : dflt;
}

const agentBase = () => env("ELITR_AGENT_URL", "https://agent.elitr.xyz");
const newsBase = () => env("ELITR_NEWS_ANALYST_URL", "https://analyst.elitr.xyz");
const flowBase = () => env("ELITR_FLOW_ANALYST_URL", "https://flow.elitr.xyz");

const attemptTimeoutMs = () => envNumber("ELITR_FETCH_TIMEOUT_MS", 8000);
const maxAttempts = () => Math.floor(envNumber("ELITR_FETCH_ATTEMPTS", 3));
const cacheTtlMs = () => envNumber("ELITR_CACHE_SECONDS", 20) * 1000;
/** |token vs reference| above this is treated as a share-multiplier artefact. */
const maxPlausibleGapBps = () => envNumber("ELITR_MAX_PLAUSIBLE_GAP_BPS", 2000);
const topGaps = () => Math.floor(envNumber("ELITR_TOP_GAPS", 5));

// ── HTTP fetch with timeout + retries ────────────────────────────────────────

export class ElitrUnavailableError extends Error {
  constructor(
    message: string,
    readonly failures: { url: string; error: string }[],
  ) {
    super(message);
    this.name = "ElitrUnavailableError";
  }
}

class HttpStatusError extends Error {
  constructor(readonly status: number, url: string) {
    super(`HTTP ${status} from ${url}`);
  }
}

/**
 * DEV-ONLY escape hatch: `ELITR_RESOLVE_IP=<ip>` pins every *.elitr.xyz host
 * to that IP (TLS still validates the real hostname via SNI). Useful when a
 * local resolver still caches an old record. Unset in deployment.
 */
function lookupOverride(): LookupFunction | undefined {
  const ip = process.env.ELITR_RESOLVE_IP?.trim();
  if (!ip) return undefined;
  const family = ip.includes(":") ? 6 : 4;
  return ((hostname: string, options: unknown, cb: unknown) => {
    const callback = (typeof options === "function" ? options : cb) as (
      ...args: unknown[]
    ) => void;
    const opts = (typeof options === "object" && options !== null ? options : {}) as {
      all?: boolean;
    };
    if (!/(^|\.)elitr\.xyz$/i.test(hostname)) {
      // Not ours: defer to the system resolver.
      import("node:dns").then((dns) =>
        dns.lookup(hostname, opts as never, callback as never),
      );
      return;
    }
    if (opts.all) callback(null, [{ address: ip, family }]);
    else callback(null, ip, family);
  }) as LookupFunction;
}

function getOnce(url: string, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "http:" ? http : https;
    const lookup = lookupOverride();
    const req = mod.request(
      u,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          "user-agent": "elitr-desk-brief/1.0 (+https://elitr.xyz)",
        },
        timeout: timeoutMs,
        ...(lookup ? { lookup } : {}),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > 8 * 1024 * 1024) {
            req.destroy(new Error(`response from ${url} exceeds 8 MiB`));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => {
          if (status < 200 || status >= 300) {
            reject(new HttpStatusError(status, url));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
          } catch {
            reject(new Error(`invalid JSON from ${url}`));
          }
        });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error(`timeout after ${timeoutMs}ms: ${url}`)));
    req.on("error", reject);
    req.end();
  });
}

async function getJson(url: string): Promise<unknown> {
  const attempts = Math.max(1, maxAttempts());
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await getOnce(url, attemptTimeoutMs());
    } catch (e) {
      last = e;
      // 4xx (except 408/429) will not heal on retry.
      if (
        e instanceof HttpStatusError &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 408 &&
        e.status !== 429
      ) {
        break;
      }
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * 3 ** i));
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

// ── minimal shape guards (never coerce a missing value into a number) ───────

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const iso = (ms: unknown): string | null => {
  const n = num(ms);
  return n === null ? null : new Date(n).toISOString();
};
const round = (v: number | null, dp: number): number | null =>
  v === null ? null : Math.round(v * 10 ** dp) / 10 ** dp;

function requireObj(v: unknown, what: string, keys: string[]): Obj {
  if (!isObj(v)) throw new Error(`${what}: expected a JSON object`);
  const missing = keys.filter((k) => !(k in v));
  if (missing.length > 0) {
    throw new Error(`${what}: missing field(s) ${missing.join(", ")}`);
  }
  return v;
}

// ── snapshot ─────────────────────────────────────────────────────────────────

export interface SourceRecord {
  url: string;
  ok: boolean;
  required: boolean;
  error?: string;
}

export interface ElitrSnapshot {
  fetchedAt: string;
  summary: Obj;
  state: Obj;
  board: Obj;
  registration: Obj | null;
  newsInfo: Obj | null;
  flowInfo: Obj | null;
  sources: SourceRecord[];
}

let cache: { at: number; snap: ElitrSnapshot } | null = null;
let inflight: Promise<ElitrSnapshot> | null = null;

/**
 * Fetch (or reuse a ≤ ELITR_CACHE_SECONDS-old) snapshot of the live desk.
 * Throws {@link ElitrUnavailableError} if any REQUIRED endpoint fails.
 */
export async function getElitrSnapshot(): Promise<ElitrSnapshot> {
  if (cache && Date.now() - cache.at < cacheTtlMs()) return cache.snap;
  inflight ??= fetchSnapshot().finally(() => {
    inflight = null;
  });
  const snap = await inflight;
  cache = { at: Date.now(), snap };
  return snap;
}

async function fetchSnapshot(): Promise<ElitrSnapshot> {
  const a = agentBase();
  const plan = [
    { key: "summary", url: `${a}/summary/today`, required: true, keys: ["paragraph", "mode"] },
    { key: "state", url: `${a}/state`, required: true, keys: ["mode", "positions", "pnl", "analysts"] },
    { key: "board", url: `${a}/rwa/board`, required: true, keys: ["market", "tokens"] },
    { key: "registration", url: `${a}/.well-known/agent-registration.json`, required: false, keys: [] },
    { key: "newsInfo", url: `${newsBase()}/info`, required: false, keys: [] },
    { key: "flowInfo", url: `${flowBase()}/info`, required: false, keys: [] },
  ] as const;

  const results = await Promise.allSettled(
    plan.map(async (p) => requireObj(await getJson(p.url), p.url, [...p.keys])),
  );
  const sources: SourceRecord[] = [];
  const got: Record<string, Obj | null> = {};
  const failures: { url: string; error: string }[] = [];
  results.forEach((r, i) => {
    const p = plan[i]!;
    if (r.status === "fulfilled") {
      got[p.key] = r.value;
      sources.push({ url: p.url, ok: true, required: p.required });
    } else {
      const error = r.reason instanceof Error ? r.reason.message : String(r.reason);
      got[p.key] = null;
      sources.push({ url: p.url, ok: false, required: p.required, error });
      if (p.required) failures.push({ url: p.url, error });
    }
  });
  if (failures.length > 0) {
    throw new ElitrUnavailableError(
      `Elitr desk data unavailable (${failures.map((f) => f.error).join("; ")})`,
      failures,
    );
  }
  return {
    fetchedAt: new Date().toISOString(),
    summary: got.summary!,
    state: got.state!,
    board: got.board!,
    registration: got.registration ?? null,
    newsInfo: got.newsInfo ?? null,
    flowInfo: got.flowInfo ?? null,
    sources,
  };
}

// ── brief ────────────────────────────────────────────────────────────────────

export interface GapRow {
  symbol: string;
  issuer: string | null;
  underlying: string | null;
  tokenPriceUsd: number | null;
  referencePriceUsd: number | null;
  referenceSource: string;
  spreadBps: number | null;
  liquidityUsd: number | null;
  tradedByDesk: boolean;
}

function analystView(a: Obj, info: Obj | null) {
  return {
    name: str(a.name),
    analystId: str(a.analystId),
    kind: str(info?.kind),
    erc8004AgentId: str(a.erc8004AgentId) ?? str(info?.erc8004AgentId),
    erc8004Registry: ERC8004_MAINNET_REGISTRY,
    samples: num(a.samples),
    hits: num(a.hits),
    hitRate: round(num(a.hitRate), 4),
    trust: round(num(a.trust), 4),
    selectionWeight: round(num(a.weight), 4),
    avgReturnBps: round(num(a.avgReturnBps), 2),
    paused: typeof a.paused === "boolean" ? a.paused : null,
    online: typeof a.online === "boolean" ? a.online : null,
    signalPriceUsd: num(a.priceUsd),
  };
}

function weekendGap(board: Obj) {
  const market = isObj(board.market) ? board.market : {};
  const tokens = arr(board.tokens).filter(isObj);
  const limit = maxPlausibleGapBps();
  let excludedNoRef = 0;
  let excludedNoLiquidity = 0;
  let excludedImplausible = 0;
  const rows: GapRow[] = [];
  for (const t of tokens) {
    const tokenPrice = num(t.tokenPrice);
    const yahoo = num(t.yahooPrice);
    const liquidity = num(t.liquidityUsd);
    if (tokenPrice === null || yahoo === null || yahoo <= 0) {
      excludedNoRef++;
      continue;
    }
    if (liquidity === null) {
      excludedNoLiquidity++;
      continue;
    }
    const spread = ((tokenPrice - yahoo) / yahoo) * 10_000;
    if (Math.abs(spread) > limit) {
      excludedImplausible++;
      continue;
    }
    rows.push({
      symbol: String(t.symbol ?? "?"),
      issuer: str(t.issuer),
      underlying: str(t.underlying),
      tokenPriceUsd: round(tokenPrice, 4),
      referencePriceUsd: round(yahoo, 4),
      referenceSource: "Yahoo Finance last regular-session trade (via Elitr /rwa/board)",
      spreadBps: round(spread, 1),
      liquidityUsd: round(liquidity, 0),
      tradedByDesk: t.traded === true,
    });
  }
  rows.sort((x, y) => Math.abs(y.spreadBps ?? 0) - Math.abs(x.spreadBps ?? 0));

  const pairs = arr(board.pairs)
    .filter(isObj)
    .filter((p) => num(p.crossSpreadBps) !== null)
    .sort((x, y) => Math.abs(num(y.crossSpreadBps)!) - Math.abs(num(x.crossSpreadBps)!))
    .slice(0, 3)
    .map((p) => ({
      underlying: str(p.underlying),
      legs: arr(p.legs)
        .filter(isObj)
        .map((l) => ({
          symbol: str(l.symbol),
          issuer: str(l.issuer),
          tokenPriceUsd: round(num(l.tokenPrice), 4),
          liquidityUsd: round(num(l.liquidityUsd), 0),
        })),
      crossIssuerSpreadBps: round(num(p.crossSpreadBps), 1),
    }));

  const notes = [
    ...arr(board.notes).filter((n): n is string => typeof n === "string"),
  ];
  if (isObj(board.xStocks) && typeof board.xStocks.note === "string") {
    notes.push(board.xStocks.note);
  }
  return {
    boardFetchedAt: iso(board.fetchedAt),
    usMarket: {
      status: str(market.marketStatus),
      open: typeof market.openState === "boolean" ? market.openState : null,
      reasonCode: str(market.reasonCode),
      nextOpen: iso(market.nextOpenTime),
      nextClose: iso(market.nextCloseTime),
    },
    method:
      "spreadBps = (on-chain token price − reference price) / reference × 10,000. " +
      "Only tokens with a reference price and measured DEX liquidity are ranked; " +
      `|spread| > ${limit} bps is dropped as a likely share-multiplier artefact.`,
    tokensOnBoard: tokens.length,
    ranked: rows.length,
    excluded: {
      noReferencePrice: excludedNoRef,
      noLiquidityData: excludedNoLiquidity,
      implausibleSpread: excludedImplausible,
    },
    topSpreads: rows.slice(0, topGaps()),
    deskAssets: rows.filter((r) => r.tradedByDesk),
    topCrossIssuerPairs: pairs,
    coverageNotes: notes,
  };
}

export interface DeskBrief {
  brief: "Elitr Desk Brief";
  version: 1;
  generatedAt: string;
  headline: string;
  headlineSource: string;
  desk: Obj;
  mode: string | null;
  summary: Obj;
  analysts: ReturnType<typeof analystView>[];
  positions: Obj[];
  pnl: Obj;
  weekendGap: ReturnType<typeof weekendGap>;
  text: string;
  sources: SourceRecord[];
  disclaimer: string;
}

/** Assemble the structured brief from a snapshot. Pure; no I/O. */
export function buildBrief(snap: ElitrSnapshot): DeskBrief {
  const { summary, state, board } = snap;
  const mode = str(state.mode) ?? str(summary.mode);

  const infoById: Record<string, Obj | null> = {
    analyst: snap.newsInfo,
    "analyst-flow": snap.flowInfo,
  };
  const analysts = arr(state.analysts)
    .filter(isObj)
    .map((a) => analystView(a, infoById[String(a.analystId)] ?? null));

  const positions = arr(state.positions)
    .filter(isObj)
    .filter((p) => (num(p.qty) ?? 0) > 0)
    .map((p) => {
      const qty = num(p.qty);
      const mark = num(p.markUsd);
      return {
        symbol: str(p.symbol),
        qty: round(qty, 8),
        avgCostUsd: round(num(p.avgCostUsd), 4),
        markUsd: round(mark, 4),
        valueUsd: qty !== null && mark !== null ? round(qty * mark, 4) : null,
        unrealizedUsd: round(num(p.unrealizedUsd), 4),
        realizedUsd: round(num(p.realizedUsd), 4),
      };
    });

  const pnlRaw = isObj(state.pnl) ? state.pnl : {};
  const pnl = {
    netUsd: round(num(pnlRaw.netUsd), 4),
    realizedUsd: round(num(pnlRaw.realizedUsd), 4),
    unrealizedUsd: round(num(pnlRaw.unrealizedUsd), 4),
    signalSpendUsd: round(num(pnlRaw.signalSpendUsd), 4),
    gasSpendUsd: round(num(pnlRaw.gasSpendUsd), 4),
    basis: "all-time, as reported by Elitr /state",
  };

  const regs = arr(snap.registration?.registrations).filter(isObj);
  const execId = regs.length > 0 ? num(regs[0]!.agentId) : null;
  const desk = {
    name: "Elitr",
    site: ELITR_SITE,
    executionAgent: {
      erc8004AgentId: execId ?? ELITR_ERC8004_IDS.executionAgent,
      erc8004Registry:
        (regs.length > 0 ? str(regs[0]!.agentRegistry) : null) ?? ERC8004_MAINNET_REGISTRY,
      registration: `${agentBase()}/.well-known/agent-registration.json`,
    },
    killSwitch: typeof state.killSwitch === "boolean" ? state.killSwitch : null,
    liveTrading: typeof state.liveTrading === "boolean" ? state.liveTrading : null,
    tradedAssets: arr(state.assets).filter((s): s is string => typeof s === "string"),
    lastCycleAt: iso(state.lastCycleAt),
    nextCycleAt: iso(state.nextCycleAt),
  };

  const counts = isObj(summary.counts) ? summary.counts : {};
  const summaryOut = {
    day: str(summary.day),
    text: str(summary.paragraph),
    source: str(summary.source),
    generatedAt: iso(summary.generatedAt),
    counts: {
      signalsBought: num(counts.signals),
      signalSpendUsd: num(counts.signalUsd),
      decisions: num(counts.decisions),
      trades: num(counts.trades),
      signalsScored: num(counts.scored),
      erc8004RatingsPosted: num(counts.ratingsPosted),
      errorsLogged: num(counts.errors),
    },
    decisions: arr(summary.decisions)
      .filter(isObj)
      .map((d) => ({
        symbol: str(d.symbol),
        action: str(d.action),
        reason: str(d.reason),
        at: iso(d.at),
      })),
  };

  const gap = weekendGap(board);
  const brief: DeskBrief = {
    brief: "Elitr Desk Brief",
    version: 1,
    generatedAt: new Date().toISOString(),
    headline: deterministicHeadline(mode, summaryOut, analysts, pnl, gap),
    headlineSource: "deterministic",
    desk,
    mode,
    summary: summaryOut,
    analysts,
    positions,
    pnl,
    weekendGap: gap,
    text: "",
    sources: snap.sources,
    disclaimer:
      "Facts are copied from Elitr's public endpoints at fetch time (see sources). " +
      "Informational only; not investment advice.",
  };
  brief.text = renderText(brief);
  return brief;
}

const pct = (v: number | null) => (v === null ? "n/a" : `${Math.round(v * 100)}%`);
const usd = (v: number | null) => {
  if (v === null) return "n/a";
  const a = Math.abs(v);
  const body =
    a >= 10_000
      ? Math.round(a).toLocaleString("en-US")
      : a.toFixed(a < 1 ? 3 : 2);
  return `${v < 0 ? "-" : ""}$${body}`;
};

function deterministicHeadline(
  mode: string | null,
  s: { day: string | null; counts: Record<string, number | null> },
  analysts: ReturnType<typeof analystView>[],
  pnl: { netUsd: number | null },
  gap: ReturnType<typeof weekendGap>,
): string {
  const a = analysts
    .map((x) => `${x.name ?? x.analystId}: ${x.hits ?? "?"}/${x.samples ?? "?"} right, trust ${pct(x.trust)}`)
    .join("; ");
  return (
    `Elitr desk (${(mode ?? "unknown").toUpperCase()} mode) on ${s.day ?? "today"}: ` +
    `${s.counts.signalsBought ?? "?"} paid signals (${usd(s.counts.signalSpendUsd ?? null)}), ` +
    `${s.counts.trades ?? "?"} trade(s), net P&L ${usd(pnl.netUsd)}. ${a}. ` +
    `US market: ${gap.usMarket.status ?? "unknown"}.`
  );
}

function renderText(b: DeskBrief): string {
  const lines: string[] = [];
  lines.push(`ELITR DESK BRIEF — ${b.summary.day ?? ""} (${(b.mode ?? "?").toUpperCase()})`);
  lines.push(b.headline);
  lines.push("");
  if (typeof b.summary.text === "string") lines.push(b.summary.text, "");
  lines.push("Analysts (ERC-8004, BSC mainnet):");
  for (const a of b.analysts) {
    lines.push(
      `- ${a.name} #${a.erc8004AgentId}: ${a.hits}/${a.samples} right (${pct(a.hitRate)}), trust ${pct(a.trust)}${a.paused ? ", PAUSED" : ""}`,
    );
  }
  lines.push("Open positions:");
  if (b.positions.length === 0) lines.push("- none");
  for (const p of b.positions) {
    lines.push(
      `- ${p.symbol}: ${p.qty} @ avg ${usd(p.avgCostUsd as number | null)}, mark ${usd(p.markUsd as number | null)}, uPnL ${usd(p.unrealizedUsd as number | null)}`,
    );
  }
  lines.push(
    `P&L (all-time): net ${usd(b.pnl.netUsd as number | null)} = realized ${usd(b.pnl.realizedUsd as number | null)} + unrealized ${usd(b.pnl.unrealizedUsd as number | null)} − signals ${usd(b.pnl.signalSpendUsd as number | null)} − gas ${usd(b.pnl.gasSpendUsd as number | null)}`,
  );
  const m = b.weekendGap.usMarket;
  lines.push(
    `US market: ${m.status ?? "?"} (next open ${m.nextOpen ?? "?"}, next close ${m.nextClose ?? "?"})`,
  );
  lines.push("Top tokenized-stock gaps vs reference:");
  for (const g of b.weekendGap.topSpreads) {
    lines.push(
      `- ${g.symbol} (${g.issuer}): ${g.spreadBps! > 0 ? "+" : ""}${g.spreadBps} bps, token ${usd(g.tokenPriceUsd)} vs ref ${usd(g.referencePriceUsd)}, liq ${usd(g.liquidityUsd)}${g.tradedByDesk ? " [desk asset]" : ""}`,
    );
  }
  lines.push(`More: ${ELITR_SITE}`);
  return lines.join("\n");
}

/** Free A2A teaser: enough to decide whether to buy, not the brief itself. */
export function buildPreview(snap: ElitrSnapshot, offer: X402Offer): Obj {
  const b = buildBrief(snap);
  return {
    name: "Elitr Desk Brief (preview)",
    mode: b.mode,
    day: b.summary.day,
    usMarket: b.weekendGap.usMarket.status,
    analysts: b.analysts.map((a) => ({
      name: a.name,
      erc8004AgentId: a.erc8004AgentId,
    })),
    executionAgentErc8004Id: (b.desk.executionAgent as Obj).erc8004AgentId,
    fullBrief: offer,
    site: ELITR_SITE,
  };
}

export interface X402Offer {
  protocol: "x402";
  url: string;
  method: "GET or POST";
  prompt: string;
  priceUsd: string;
  network: string;
  note: string;
}
