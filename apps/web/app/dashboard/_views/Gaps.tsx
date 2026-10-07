"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useDashboard } from "@/lib/dashboard";
import { useAgentJson, type JsonStatus } from "@/lib/useAgentJson";
import { BSCSCAN_ADDRESS } from "@/lib/config";
import { ago, price } from "@/lib/format";
import { bpsTxt, compactUsd, etTime, MARKET_LABEL, span, spreadTone, type BoardToken, type RwaBoard } from "@/lib/gaps";
import { Empty } from "@/components/ui";
import { IconArrowRight } from "@/components/NavIcons";

// ---------------------------------------------------------------- header strip

function MarketStrip({ board, now }: { board: RwaBoard | null; now: number }) {
  const m = board?.market;
  let main: ReactNode = <span className="text-dim">status not reported yet</span>;
  if (m) {
    const label = (MARKET_LABEL[m.marketStatus] ?? m.marketStatus).toUpperCase();
    const parts: string[] = [];
    if (!m.openState && m.lastCloseTime) parts.push(`since ${etTime(m.lastCloseTime)}`);
    if (!m.openState && m.nextOpenTime) parts.push(`reopens ${etTime(m.nextOpenTime)}${now ? ` (in ${span(m.nextOpenTime - now)})` : ""}`);
    if (m.openState && m.nextCloseTime) parts.push(`closes ${etTime(m.nextCloseTime)}${now ? ` (in ${span(m.nextCloseTime - now)})` : ""}`);
    main = (
      <>
        <span className={`font-bold ${m.openState ? "text-pos" : "text-neg"}`}>{label}</span>
        {parts.length ? <span className="text-fg"> {parts[0]}</span> : null}
        {parts.slice(1).map((p) => (
          <span key={p} className="text-fg">
            <span className="px-2 text-faint">·</span>
            {p}
          </span>
        ))}
      </>
    );
  }
  return (
    <section aria-label="US market status" className="border border-line bg-panel">
      <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-[0.16em] text-gold uppercase">Weekend gap · tokenized stocks on BNB Chain</div>
          <p suppressHydrationWarning className="num mt-1.5 text-[17px] leading-snug tracking-[-0.01em] sm:text-[20px]">
            <span className="text-dim">US market: </span>
            {main}
          </p>
        </div>
        <div className="shrink-0 text-[12px] leading-relaxed text-dim sm:text-right">
          {m ? (
            <>
              {m.reasonCode ? <span className="font-mono">{m.reasonCode}</span> : null}
              {m.reasonMsg ? <span>{` · ${m.reasonMsg}`}</span> : null}
              <div>
                status agreed by {m.agree} of {m.total} tokens · RWA Data API
              </div>
              {m.lastCloseSource ? <div className="text-faint">last close from {m.lastCloseSource}</div> : null}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- table

type SortKey = "gap" | "symbol" | "issuer" | "underlying" | "tokenPrice" | "referencePrice" | "refSpreadBps" | "yahooPrice" | "yahooSpreadBps" | "market" | "nextOpen";

const COLS: { key: SortKey; label: string; num?: boolean; title?: string }[] = [
  { key: "symbol", label: "Token" },
  { key: "issuer", label: "Issuer" },
  { key: "underlying", label: "Underlying" },
  { key: "tokenPrice", label: "On-chain", num: true, title: "On-chain token price (RWA Data API tokenPrice)" },
  { key: "referencePrice", label: "Binance ref.", num: true, title: "RWA Data API referencePrice — documented as derived from the on-chain token price" },
  { key: "refSpreadBps", label: "vs ref. bps", num: true, title: "On-chain over Binance reference, basis points (+ = premium)" },
  { key: "yahooPrice", label: "Yahoo", num: true, title: "Independent reference: last regular-session price from Yahoo Finance" },
  { key: "yahooSpreadBps", label: "vs Yahoo bps", num: true, title: "On-chain over Yahoo, basis points (+ = premium, − = discount)" },
  { key: "market", label: "Market" },
  { key: "nextOpen", label: "Next open", num: true },
];

function sortVal(t: BoardToken, k: SortKey): number | string | null {
  switch (k) {
    case "gap":
      return Math.abs(t.yahooSpreadBps ?? t.refSpreadBps ?? NaN);
    case "symbol":
      return t.symbol.toLowerCase();
    case "issuer":
      return t.issuer;
    case "underlying":
      return t.underlying;
    case "market":
      return t.market?.marketStatus ?? null;
    case "nextOpen":
      return t.market?.nextOpenTime ?? null;
    default:
      return t[k] as number | null;
  }
}

function SpreadCell({ v, cand }: { v: number | null; cand?: boolean }) {
  return (
    <span className={`num font-medium ${spreadTone(v)}`}>
      {bpsTxt(v)}
      {cand ? (
        <span title="On-chain is far enough below Yahoo to pass the trader's minGapBps rule" className="ml-1.5 inline-flex h-4 items-center bg-pos px-1 text-[9px] font-bold tracking-[0.1em] text-white uppercase">
          gap
        </span>
      ) : null}
    </span>
  );
}

function BoardTable({ tokens, minGap, now }: { tokens: BoardToken[]; minGap: number | null; now: number }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "gap", dir: -1 });
  const rows = useMemo(() => {
    const r = [...tokens];
    r.sort((a, b) => {
      const x = sortVal(a, sort.key);
      const y = sortVal(b, sort.key);
      const xn = x == null || (typeof x === "number" && Number.isNaN(x));
      const yn = y == null || (typeof y === "number" && Number.isNaN(y));
      if (xn || yn) return xn && yn ? 0 : xn ? 1 : -1; // missing values always last
      return (x! < y! ? -1 : x! > y! ? 1 : 0) * sort.dir;
    });
    return r;
  }, [tokens, sort]);
  const click = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "symbol" || key === "issuer" || key === "underlying" ? 1 : -1 }));

  return (
    <div className="max-h-[70vh] overflow-auto">
      <table className="w-full min-w-[980px] border-collapse text-[13px]">
        <thead className="sticky top-0 z-10 bg-panel-2">
          <tr>
            {COLS.map((c) => {
              const active = sort.key === c.key;
              return (
                <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={`border-b border-line px-3 py-2 font-medium whitespace-nowrap ${c.num ? "text-right" : "text-left"}`}>
                  <button type="button" onClick={() => click(c.key)} title={c.title} className={`inline-flex items-center gap-1 text-[10px] tracking-[0.12em] uppercase hover:text-fg ${active ? "text-fg" : "text-dim"}`}>
                    {c.label}
                    <span aria-hidden="true" className="w-2 text-faint">
                      {active ? (sort.dir === 1 ? "▲" : "▼") : ""}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((t) => {
            const cand = minGap != null && t.traderGapBps != null && t.traderGapBps >= minGap;
            const m = t.market;
            return (
              <tr key={t.address} className="hover:bg-panel-2/60">
                <td className="px-3 py-2 whitespace-nowrap">
                  <a href={BSCSCAN_ADDRESS(t.address)} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold text-fg hover:underline" title={t.name ?? t.address}>
                    {t.symbol}
                  </a>
                  {t.traded ? <span className="ml-2 inline-flex h-4 items-center bg-accent px-1 text-[9px] font-bold tracking-[0.1em] text-ink uppercase">traded</span> : null}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-dim">{t.issuer}</td>
                <td className="max-w-[14rem] truncate px-3 py-2" title={t.underlyingName ?? undefined}>
                  <span className="font-mono">{t.underlying}</span>
                  {t.underlyingName ? <span className="ml-1.5 text-[12px] text-faint">{t.underlyingName}</span> : null}
                </td>
                <td className="num px-3 py-2 text-right">{price(t.tokenPrice)}</td>
                <td className="num px-3 py-2 text-right text-dim">{price(t.referencePrice)}</td>
                <td className="px-3 py-2 text-right">
                  <SpreadCell v={t.refSpreadBps} />
                </td>
                <td className="num px-3 py-2 text-right text-dim">{t.yahooPrice != null ? price(t.yahooPrice) : <span className="text-faint">—</span>}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <SpreadCell v={t.yahooSpreadBps} cand={cand} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {m ? (
                    <span title={[m.reasonCode, m.reasonMsg].filter(Boolean).join(" · ")} className={m.openState ? "text-pos" : m.reasonCode && m.reasonCode !== "MARKET_CLOSED" ? "text-warn" : "text-dim"}>
                      {MARKET_LABEL[m.marketStatus] ?? m.marketStatus}
                      {m.reasonCode && m.reasonCode !== "MARKET_CLOSED" && m.reasonCode !== "TRADING" ? <span className="ml-1 font-mono text-[10px]">{m.reasonCode}</span> : null}
                    </span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
                <td suppressHydrationWarning className="num px-3 py-2 text-right whitespace-nowrap text-dim">
                  {m?.nextOpenTime && !m.openState ? (now ? `in ${span(m.nextOpenTime - now)}` : etTime(m.nextOpenTime)) : <span className="text-faint">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- cross-issuer

function CrossIssuer({ board }: { board: RwaBoard }) {
  return (
    <section aria-labelledby="pairs-title" className="border border-line bg-panel">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 id="pairs-title" className="text-[11px] font-medium tracking-[0.12em] text-dim uppercase">
          Cross-issuer · same stock, two tokens
        </h2>
        <span className="text-[12px] text-faint">{board.pairs.length} underlyings on both bStocks and Ondo</span>
      </header>
      {board.pairs.length ? (
        <ul className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
          {board.pairs.map((p) => (
            <li key={p.underlying} className="min-w-0 bg-panel px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">
                  <span className="font-mono font-semibold">{p.underlying}</span>
                  {p.name ? <span className="ml-2 text-[12px] text-faint">{p.name}</span> : null}
                </span>
                <span className={`num shrink-0 text-[15px] font-semibold ${spreadTone(p.crossSpreadBps)}`} title="bStocks token over Ondo token, basis points">
                  {bpsTxt(p.crossSpreadBps)} <span className="text-[10px] font-medium text-faint">bps</span>
                </span>
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {p.legs.map((l) => (
                  <li key={l.address} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-3 text-[12px]">
                    <span className="truncate">
                      <span className="font-mono text-fg">{l.symbol}</span> <span className="text-faint">{l.issuer}</span>
                    </span>
                    <span className="num text-fg">{price(l.tokenPrice)}</span>
                    <span className="num w-20 text-right text-dim" title={l.topPool ? `DEX liquidity · top pool ${l.topPool}` : "DEX liquidity (token/top-liquidity)"}>
                      {l.liquidityUsd != null ? `${compactUsd(l.liquidityUsd)} liq.` : "liq. —"}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-[13px] text-dim">No underlying is listed by both bStocks and Ondo on BSC in this snapshot.</p>
      )}
      <p className="border-t border-line px-4 py-2.5 text-[12px] leading-relaxed text-faint">
        A cross-issuer spread is only tradable if both tokens have depth. On BSC today the bStocks pools hold millions of dollars while Ondo pools are small, so most of this spread is a liquidity gap, not free money.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- page

function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 border px-2.5 text-[12px] whitespace-nowrap transition-colors ${active ? "border-accent bg-accent font-semibold text-ink" : "border-line-strong bg-panel text-dim hover:text-fg"}`}
    >
      {children}
    </button>
  );
}

function statusEmpty(status: JsonStatus, error: string | null) {
  if (status === "unsupported")
    return <Empty title="Not available on this agent version" hint="This execution agent build has no GET /rwa/board. Rebuild and restart the agent to enable the Gap board." />;
  if (status === "offline") return <Empty tone="offline" title="Execution agent unreachable" hint={error ?? "The board is served by the execution agent's GET /rwa/board."} />;
  if (status === "error") return <Empty tone="offline" title="The board could not be built" hint={error ?? undefined} />;
  return <Empty title="Loading the board from the RWA Data API…" hint="First load fetches two token lists, prices, 13 sector tabs and Yahoo references — about 10 seconds." />;
}

export function GapsView() {
  const d = useDashboard();
  const { data: board, status, error } = useAgentJson<RwaBoard>("/rwa/board", 60_000, 45_000);
  const [sector, setSector] = useState<number | null>(null);
  const [issuer, setIssuer] = useState<"all" | "bstock" | "ondo">("all");

  const tokens = useMemo(() => (board?.tokens ?? []).filter((t) => (sector == null || t.sectors.includes(sector)) && (issuer === "all" || t.platformId === issuer)), [board, sector, issuer]);
  const minGap = board?.minGapBps ?? null;
  const stale = board && status !== "ok";

  return (
    <section aria-label="Weekend gap board" className="flex flex-col gap-4">
      <MarketStrip board={board} now={d.now} />

      <section aria-labelledby="board-title" className="min-w-0 border border-line bg-panel">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 id="board-title" className="text-[11px] font-medium tracking-[0.12em] text-dim uppercase">
            Spread board · {board ? `${tokens.length} of ${board.tokens.length} tokens` : "RWA Data API"}
          </h2>
          <span suppressHydrationWarning className="text-[12px] text-faint">
            {board ? `updated ${d.now ? ago(board.fetchedAt, d.now) : ""}` : ""}
            {stale ? <span className="ml-2 text-neg">{status === "offline" ? "agent unreachable — showing last board" : status}</span> : null}
          </span>
        </header>

        {board && board.tokens.length ? (
          <>
            <div className="flex flex-col gap-2 border-b border-line px-4 py-3">
              <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Sector">
                <Chip active={sector == null} onClick={() => setSector(null)}>
                  All sectors
                </Chip>
                {board.sectors.map((s) => (
                  <Chip key={s.tabId} active={sector === s.tabId} onClick={() => setSector(sector === s.tabId ? null : s.tabId)} title={s.error ? `tabId ${s.tabId}: ${s.error}` : `RWA Data API tabId ${s.tabId}`}>
                    {s.label}
                    <span className="num text-[11px] opacity-70">{s.count ?? "!"}</span>
                  </Chip>
                ))}
                {!board.sectors.length ? <span className="self-center text-[12px] text-faint">sector tabs not loaded</span> : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Issuer">
                {(["all", "bstock", "ondo"] as const).map((i) => (
                  <Chip key={i} active={issuer === i} onClick={() => setIssuer(i)}>
                    {i === "all" ? "All issuers" : i === "bstock" ? "bStocks" : "Ondo"}
                  </Chip>
                ))}
                <span className="ml-1 text-[12px] text-faint">xStocks: not covered by the RWA Data API</span>
              </div>
            </div>
            {tokens.length ? <BoardTable tokens={tokens} minGap={minGap} now={d.now} /> : <p className="px-4 py-6 text-[13px] text-dim">No token matches this filter.</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 text-[12px] text-faint">
              <span>
                <span className="text-neg">red</span> = on-chain premium · <span className="text-pos">green</span> = discount · bps = 0.01%
              </span>
              <span>
                Yahoo priced {board.yahoo.priced} of {board.tokens.length}
                {board.yahoo.error ? ` · Yahoo: ${board.yahoo.error}` : ""}
              </span>
              {minGap != null ? <span>GAP tag = on-chain ≥ {minGap} bps below Yahoo (the trader&apos;s buy rule)</span> : null}
            </div>
          </>
        ) : board ? (
          <Empty tone="offline" title="The RWA Data API returned no tokens" hint={board.errors.length ? board.errors.join(" · ") : "rwa/tokens listed no BSC tokens for bstock or ondo."} />
        ) : (
          statusEmpty(status, error)
        )}
      </section>

      {board && board.tokens.length ? <CrossIssuer board={board} /> : null}

      <section aria-labelledby="why-title" className="grid gap-px border border-line bg-line lg:grid-cols-3">
        <div className="bg-panel px-4 py-4">
          <h2 id="why-title" className="text-[10px] font-semibold tracking-[0.16em] text-gold uppercase">
            Why the gap exists
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-fg">
            Friday 4pm New York, the closing bell rings and the stock price freezes until Monday. On-chain, nothing stops: tokenized shares keep trading around the clock, priced off a reference that has not updated in two days. The difference is the gap on this board.
          </p>
        </div>
        <div className="bg-panel px-4 py-4">
          <h2 className="text-[10px] font-semibold tracking-[0.16em] text-gold uppercase">Two references, on purpose</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-fg">
            Binance&apos;s <span className="font-mono text-[12px]">referencePrice</span> is documented as derived from the on-chain token price, so it cannot tell you whether the token is cheap. Yahoo Finance gives the real exchange price (the last close while the market is shut) — that is the independent reference.
          </p>
        </div>
        <div className="bg-panel px-4 py-4">
          <h2 className="text-[10px] font-semibold tracking-[0.16em] text-gold uppercase">How Elitr&apos;s trader uses it</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-fg">
            The trader only buys when the token trades at least {minGap != null ? `${minGap} bps` : "the configured minimum gap"} below the Yahoo price, a paid analyst signal is bullish and every other risk check passes. While the market is closed Binance&apos;s routes refuse bStocks quotes, so it waits.{" "}
            <Link href="/dashboard/markets" className="inline-flex items-center gap-1 font-medium text-fg underline-offset-2 hover:underline">
              See the trader&apos;s checks <IconArrowRight className="size-3" />
            </Link>
          </p>
        </div>
      </section>

      {board && (board.errors.length || board.notes.length || board.xStocks) ? (
        <section aria-label="Data notes" className="border border-line bg-panel px-4 py-3 text-[12px] leading-relaxed text-dim">
          <div className="text-[10px] font-semibold tracking-[0.16em] text-faint uppercase">Data notes</div>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
            <li>{board.xStocks.note}</li>
            {board.platforms.map((p) => (
              <li key={p.platformId}>
                {p.issuer}: {p.tokens} tokens on BSC from rwa/tokens{p.bscTokens != null ? ` (rwa/platforms reports ${p.bscTokens})` : ""}
                {p.error ? <span className="text-neg"> (request failed, see below)</span> : null}
              </li>
            ))}
            {board.yahoo.note ? <li>{board.yahoo.note}</li> : null}
            {board.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            {board.errors.map((e) => (
              <li key={e} className="text-neg">
                {e}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
