"use client";
import type { AgentEvent } from "@elitr/shared";
import type { ExecState, StateStatus } from "@/lib/useExecutionState";
import { latest } from "@/lib/derive";
import { BSCSCAN_ADDRESS } from "@/lib/config";
import { ago, num, shortAddr, toNum, usd } from "@/lib/format";


/** A cap from GET /state's risk config, else from the latest risk.evaluated limit string. */
function cap(state: ExecState | null, events: AgentEvent[], rule: string): number | null {
  const fromState = toNum(state?.risk?.[rule]);
  if (fromState !== null) return fromState;
  const check = latest(events, "risk.evaluated")?.checks?.find((c) => c.rule === rule);
  if (!check) return null;
  const n = Number.parseFloat(check.limit.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function Meter({ label, value, limit, className = "" }: { label: string; value: number | null; limit: number | null; className?: string }) {
  const pct = value !== null && limit ? Math.min(100, (value / limit) * 100) : null;
  const tone = pct === null ? "bg-line-strong" : pct >= 90 ? "bg-neg" : pct >= 70 ? "bg-warn" : "bg-fg/70";
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] tracking-wide text-faint uppercase">{label}</span>
        <span className="num truncate text-xs text-dim">
          <span className="text-fg">{usd(value)}</span>
          {limit !== null ? <span> / {usd(limit)}</span> : null}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit ?? undefined}
        aria-valuenow={value ?? undefined}
      >
        {pct !== null ? <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }} /> : null}
      </div>
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-[84px] flex-1">
      <div className="text-[11px] tracking-wide text-faint uppercase">{label}</div>
      <div className="num mt-0.5 truncate text-sm font-medium text-fg">{value}</div>
      {sub ? <div className="num truncate text-[11px] text-faint">{sub}</div> : null}
    </div>
  );
}

export function WalletStrip({
  state,
  status,
  events,
  fetchedAt,
  now,
  assets,
  portfolioUsd,
}: {
  state: ExecState | null;
  status: StateStatus;
  events: AgentEvent[];
  fetchedAt: number | null;
  now: number;
  assets: string[];
  /** Marked value of all open positions (from P&L), null when unknown. */
  portfolioUsd: number | null;
}) {
  if (!state) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-panel px-4 py-3 text-xs">
        <span className="flex items-center gap-2 text-dim">
          <span className={`size-1.5 shrink-0 rounded-full ${status === "offline" ? "bg-neg" : "bg-warn"}`} />
          {status === "offline" ? "Execution agent offline — wallet, balances and spend caps unavailable" : "Loading wallet state…"}
        </span>
        <span className="font-mono text-faint">GET /state</span>
      </div>
    );
  }

  const stale = status === "offline";
  const tokenSyms = [...new Set([...assets, ...Object.keys(state.balances.tokens)])];
  const platform = (sym: string) => state.assets.find((a) => a.symbol === sym)?.platform ?? undefined;
  const portfolio = portfolioUsd ?? state.positionUsd;
  const paper = state.mode === "paper";

  return (
    <div className={`rounded-lg border bg-panel px-4 py-3 ${stale ? "border-neg/40" : "border-line"}`}>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Cell label="BNB" value={num(state.balances.bnb, 5)} sub="gas" />
        <Cell label="USDT" value={num(state.balances.usdt, 4)} sub="buying power" />
        {tokenSyms.map((sym) => (
          <Cell key={sym} label={sym} value={num(state.balances.tokens[sym] ?? null, 6)} sub={platform(sym) ?? "on-chain"} />
        ))}
        <div className="flex min-w-[260px] flex-[3] flex-wrap gap-x-6 gap-y-3">
          <Meter className="min-w-[200px] flex-1" label={paper ? "Portfolio · paper" : "Portfolio"} value={portfolio} limit={cap(state, events, "maxPortfolioUsd")} />
          <Meter className="min-w-[200px] flex-1" label="Daily trade spend" value={state.dailySpendUsd} limit={cap(state, events, "maxDailySpendUsd")} />
          <Meter className="min-w-[200px] flex-1" label="Daily data spend (b402)" value={state.dailyDataUsd} limit={cap(state, events, "maxDailyDataUsd")} />
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-[11px] text-faint">
        <span className="max-w-full min-w-0 truncate">
          {state.wallet ? (
            <a href={BSCSCAN_ADDRESS(state.wallet)} target="_blank" rel="noopener noreferrer" className="font-mono hover:text-fg" title={state.wallet}>
              wallet {shortAddr(state.wallet, 10, 8)}
            </a>
          ) : (
            "wallet not reported"
          )}
          {state.assets
            .filter((a) => a.address)
            .map((a) => (
              <span key={a.symbol}>
                {" · "}
                <a href={BSCSCAN_ADDRESS(a.address!)} target="_blank" rel="noopener noreferrer" className="font-mono hover:text-fg" title={a.address!}>
                  {a.symbol} {shortAddr(a.address)}
                </a>
              </span>
            ))}
          {paper ? <span className="text-info"> · balances are real on-chain; positions are paper</span> : null}
        </span>
        <span suppressHydrationWarning className={`num ${stale ? "text-neg" : ""}`}>
          {stale ? "agent offline · showing last known state" : ""}
          {!stale && state.lastCycleAt && now ? `last cycle ${ago(state.lastCycleAt, now)}` : ""}
          {fetchedAt && now ? ` · updated ${ago(fetchedAt, now)}` : ""}
        </span>
      </div>
      {state.configErrors.length ? (
        <ul className="mt-2 space-y-0.5 text-[11px] text-warn">
          {state.configErrors.slice(0, 3).map((e) => (
            <li key={e} className="break-words">config: {e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
