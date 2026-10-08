"use client";
import type { AgentEvent, FillMode, PositionView } from "@elitr/shared";
import type { ExecState, PnlView, StateStatus } from "@/lib/useExecutionState";
import { latest, latestPositions, pnlHistory } from "@/lib/derive";
import { ago, num, price, signedUsd, toNum, toneOf, usd } from "@/lib/format";
import { Sparkline } from "./Sparkline";
import { Empty, ModeTag, Panel } from "./ui";

export interface PortfolioData {
  mode: FillMode | null;
  pnl: PnlView | null;
  pnlTs: number | null;
  positions: PositionView[];
  /** Σ qty × mark over open positions; null when no marks are known. */
  valueUsd: number | null;
}

/** GET /state is freshest; fall back to the latest pnl.snapshot, then position.updated events. */
export function portfolioData(state: ExecState | null, status: StateStatus, events: AgentEvent[], fetchedAt: number | null): PortfolioData {
  const snap = latest(events, "pnl.snapshot");
  const fromState = status === "ok" && state?.pnl ? state.pnl : null;
  const pnl: PnlView | null =
    fromState ??
    (snap
      ? {
          mode: snap.mode,
          realizedUsd: snap.realizedUsd,
          unrealizedUsd: snap.unrealizedUsd,
          signalSpendUsd: snap.signalSpendUsd,
          gasSpendUsd: snap.gasSpendUsd,
          netUsd: snap.netUsd,
          positions: snap.positions ?? [],
        }
      : null);
  const raw = (state?.positions?.length ? state.positions : null) ?? (pnl?.positions.length ? pnl.positions : null) ?? latestPositions(events);
  // Fill missing marks from GET /state `marks`.
  const positions = raw.map((p) => {
    const m = state?.marks?.[p.symbol];
    if (p.markUsd !== null || m === undefined) return p;
    return { ...p, markUsd: m, unrealizedUsd: p.unrealizedUsd ?? (p.qty > 0 ? (m - p.avgCostUsd) * p.qty : 0) };
  });
  let valueUsd: number | null = null;
  for (const p of positions) {
    if (p.qty > 0 && p.markUsd !== null) valueUsd = (valueUsd ?? 0) + p.qty * p.markUsd;
  }
  if (valueUsd === null && positions.length && positions.every((p) => p.qty === 0)) valueUsd = 0;
  // /state positionUsd = combined holdings of the active mode - authoritative when reported.
  if (status === "ok" && state?.positionUsd !== null && state?.positionUsd !== undefined) valueUsd = state.positionUsd;
  return {
    mode: pnl?.mode ?? state?.mode ?? snap?.mode ?? null,
    pnl,
    pnlTs: fromState ? fetchedAt : (snap?.ts ?? null),
    positions,
    valueUsd,
  };
}

function Figure({ label, value, tone = "text-fg", sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] tracking-wide text-faint uppercase">{label}</div>
      <div className={`num mt-0.5 truncate text-sm font-medium ${tone}`}>{value}</div>
      {sub ? <div className="truncate text-[10px] text-faint">{sub}</div> : null}
    </div>
  );
}

export function Portfolio({ data, state, events, executionOffline, now }: { data: PortfolioData; state: ExecState | null; events: AgentEvent[]; executionOffline: boolean; now: number }) {
  const { pnl, mode, positions } = data;
  const history = pnlHistory(events, mode);
  const tp = toNum(state?.risk?.takeProfitBps);
  const sl = toNum(state?.risk?.stopLossBps);
  const open = positions.filter((p) => p.qty > 0 || p.realizedUsd !== 0);
  const paper = mode === "paper";

  if (!pnl && !positions.length) {
    return (
      <Panel title="Portfolio & P&L" id="portfolio" right={<ModeTag mode={mode} />}>
        {executionOffline ? (
          <Empty tone="offline" title="Execution agent offline" hint="Positions and P&L come from the execution agent's fill ledger (GET /state and pnl.snapshot events)." />
        ) : (
          <Empty title="No fills yet" hint="P&L starts with the first fill. In paper mode a fill is booked at the real quoted amounts after the Transaction API simulation passes - nothing is broadcast." />
        )}
      </Panel>
    );
  }

  return (
    <Panel
      title="Portfolio & P&L"
      id="portfolio"
      right={
        <>
          {data.pnlTs && now ? (
            <span suppressHydrationWarning className="num hidden text-faint sm:inline">
              {ago(data.pnlTs, now)}
            </span>
          ) : null}
          <ModeTag mode={mode} />
        </>
      }
      bodyClassName="flex flex-col gap-4"
    >
      {paper ? (
        <p className="rounded-md border border-dashed border-info/50 bg-info/5 px-3 py-2 text-[11px] leading-relaxed text-info">
          Paper P&amp;L: each fill passed a real Transaction API simulation and is booked at the real quoted amounts, but nothing was broadcast. No real money is
          at stake. Signal spend is real b402 payments.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <div className="text-[11px] tracking-wide text-faint uppercase">Net P&amp;L{paper ? " · paper" : ""}</div>
          <div className={`num mt-0.5 text-3xl font-semibold tracking-tight ${toneOf(pnl?.netUsd)}`}>{signedUsd(pnl?.netUsd)}</div>
          <div className="text-[11px] text-faint">realized + unrealized − signals − gas</div>
        </div>
        <div className="h-14 min-w-[160px] flex-1 rounded border border-line bg-bg/40 p-1">
          {history.length > 1 ? (
            <Sparkline lines={[{ points: history, color: "var(--color-fg)", label: "net" }]} zeroLine height={48} ariaLabel="Net P&L over time" />
          ) : (
            <div className="grid h-full place-items-center text-[11px] text-faint">net P&amp;L line builds with each snapshot</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4">
        <Figure label="Realized" value={signedUsd(pnl?.realizedUsd)} tone={toneOf(pnl?.realizedUsd)} />
        <Figure label="Unrealized" value={signedUsd(pnl?.unrealizedUsd)} tone={toneOf(pnl?.unrealizedUsd)} />
        <Figure label="Signal spend" value={pnl?.signalSpendUsd != null ? usd(-Math.abs(pnl.signalSpendUsd), { max: 4 }) : "-"} sub="b402, real" />
        <Figure label="Gas" value={pnl?.gasSpendUsd != null ? usd(-Math.abs(pnl.gasSpendUsd), { max: 4 }) : "-"} sub={paper ? "none broadcast" : "BNB → USD"} />
      </div>

      {open.length ? (
        <div className="-mx-4 overflow-x-auto border-t border-line px-4 pt-3">
          <table className="w-full min-w-[520px] text-xs">
            <thead className="text-left text-[10px] tracking-wide text-faint uppercase">
              <tr>
                <th className="py-1.5 pr-2 font-medium">Asset</th>
                <th className="py-1.5 pr-2 text-right font-medium">Qty</th>
                <th className="py-1.5 pr-2 text-right font-medium">Avg cost</th>
                <th className="py-1.5 pr-2 text-right font-medium">Mark</th>
                <th className="py-1.5 pr-2 text-right font-medium">Unrealized</th>
                <th className="py-1.5 pr-2 text-right font-medium">Realized</th>
                <th className="py-1.5 text-right font-medium">TP / SL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {open.map((p) => {
                const flat = p.qty <= 0;
                const tpPx = !flat && tp !== null && p.avgCostUsd > 0 ? p.avgCostUsd * (1 + tp / 10_000) : null;
                const slPx = !flat && sl !== null && p.avgCostUsd > 0 ? p.avgCostUsd * (1 - sl / 10_000) : null;
                const moveBps = !flat && p.markUsd !== null && p.avgCostUsd > 0 ? ((p.markUsd - p.avgCostUsd) / p.avgCostUsd) * 10_000 : null;
                return (
                  <tr key={p.symbol}>
                    <td className="py-1.5 pr-2 font-mono text-fg">
                      {p.symbol}
                      {flat ? <span className="ml-1.5 font-sans text-[10px] text-faint uppercase">closed</span> : null}
                    </td>
                    <td className="num py-1.5 pr-2 text-right text-fg">{num(p.qty, 6)}</td>
                    <td className="num py-1.5 pr-2 text-right text-dim">{flat ? "-" : price(p.avgCostUsd)}</td>
                    <td className="num py-1.5 pr-2 text-right text-fg">
                      {price(p.markUsd)}
                      {moveBps !== null ? <div className={`text-[10px] ${toneOf(moveBps)}`}>{moveBps >= 0 ? "+" : ""}{(moveBps / 100).toFixed(2)}%</div> : null}
                    </td>
                    <td className={`num py-1.5 pr-2 text-right ${toneOf(p.unrealizedUsd)}`}>{flat ? "-" : signedUsd(p.unrealizedUsd)}</td>
                    <td className={`num py-1.5 pr-2 text-right ${toneOf(p.realizedUsd)}`}>{signedUsd(p.realizedUsd)}</td>
                    <td className="num py-1.5 text-right whitespace-nowrap">
                      {tpPx !== null || slPx !== null ? (
                        <>
                          <span className="text-pos" title={tp !== null ? `take profit +${tp} bps` : undefined}>
                            {price(tpPx)}
                          </span>
                          <span className="text-faint"> / </span>
                          <span className="text-neg" title={sl !== null ? `stop loss −${sl} bps` : undefined}>
                            {price(slPx)}
                          </span>
                        </>
                      ) : (
                        <span className="text-faint">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {tp !== null || sl !== null ? (
            <p className="mt-2 text-[10px] text-faint">
              Exits: take profit at +{tp ?? "?"} bps, stop loss at −{sl ?? "?"} bps from average cost
              {state?.risk?.exitOnBearish === true ? ", or on a bearish signal" : ""}.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="border-t border-line pt-3 text-xs text-faint">No open positions.</p>
      )}
    </Panel>
  );
}
