"use client";
import type { AgentEvent } from "@elitr/shared";
import type { ConnStatus } from "@/lib/useAgentStream";
import { forSymbol, latest } from "@/lib/derive";
import { ago, ruleLabel } from "@/lib/format";
import type { Side } from "@elitr/shared";
import { Badge, Empty, IconAlert, IconCheck, IconX, Panel } from "./ui";

const EXIT_LABEL: Record<string, string> = { takeProfit: "Take profit", stopLoss: "Stop loss", bearish: "Bearish signal" };

function SideTag({ side }: { side?: Side }) {
  if (!side) return null;
  return <Badge tone={side === "buy" ? "accent" : "info"}>{side}-side</Badge>;
}

export function RiskPanel({ events, symbol, execution, now }: { events: AgentEvent[]; symbol: string; execution: ConnStatus; now: number }) {
  const scoped = forSymbol(events, symbol);
  const ev = latest(scoped, "risk.evaluated");
  const decision = latest(scoped, "decision");
  // Kill-switch / portfolio blocks may be tagged with another symbol; scope to this asset only.
  const blocked = latest(scoped, "risk.blocked");
  const showBlocked = blocked && (!ev || blocked.ts >= ev.ts - 1000);

  if (!ev && !decision && !blocked) {
    return (
      <Panel title="Risk checks" id="risk" right={<span className="font-mono text-fg">{symbol}</span>}>
        {execution === "offline" ? (
          <Empty tone="offline" title="Execution agent offline" hint="Hard risk limits are evaluated by the execution agent before every trade." />
        ) : (
          <Empty title={`Waiting for a ${symbol} risk evaluation…`} hint="Every buy is gated by confidence, stance, gap, trade/position/portfolio size, slippage, liquidity, spend caps and the kill switch." />
        )}
      </Panel>
    );
  }

  const checks = ev?.checks ?? [];
  const failed = checks.filter((c) => !c.ok).length;

  return (
    <Panel
      title="Risk checks"
      id="risk"
      right={
        ev ? (
          <>
            <span className="font-mono text-fg">{symbol}</span>
            <span suppressHydrationWarning className="num text-faint">{now ? ago(ev.ts, now) : ""}</span>
            <Badge tone={ev.passed ? "pos" : "neg"}>{ev.passed ? "Pass" : "Blocked"}</Badge>
          </>
        ) : (
          <span className="font-mono text-fg">{symbol}</span>
        )
      }
      bodyClassName="flex flex-col gap-4"
    >
      {ev ? (
        <div>
          <div className="mb-2 flex items-baseline justify-between text-xs">
            <span className="flex items-center gap-2 text-dim">
              <SideTag side={ev.side} />
              {checks.length} rules
            </span>
            <span className={`num ${failed ? "text-neg" : "text-pos"}`}>{failed ? `${failed} failing` : "all passing"}</span>
          </div>
          {checks.length ? (
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-6" />
                <col className="w-[42%]" />
                <col />
              </colgroup>
              <thead className="sr-only">
                <tr>
                  <th>Status</th>
                  <th>Rule</th>
                  <th>Observed / limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {checks.map((c) => (
                  <tr key={c.rule} className={c.ok ? "" : "bg-neg/5"}>
                    <td className="w-6 py-1.5 pr-1">
                      <span className={`grid size-4 place-items-center rounded-full text-[10px] ${c.ok ? "bg-pos/15 text-pos" : "bg-neg/20 text-neg"}`} aria-label={c.ok ? "pass" : "fail"}>
                        {c.ok ? <IconCheck /> : <IconX />}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2">
                      <span className={c.ok ? "text-fg" : "font-medium text-neg"} title={c.rule}>
                        {ruleLabel(c.rule)}
                      </span>
                    </td>
                    <td className="num py-1.5 text-right font-mono break-words">
                      <div className={c.ok ? "text-fg" : "text-neg"}>{c.value}</div>
                      <div className="text-[10px] text-faint">{c.limit}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-faint">The evaluation reported no individual checks.</p>
          )}
        </div>
      ) : null}

      {showBlocked && blocked ? (
        <div className="flex gap-2 rounded-md border border-neg/40 bg-neg/10 p-2.5 text-xs">
          <span className="mt-0.5 text-neg">
            <IconAlert />
          </span>
          <div className="min-w-0">
            <div className="font-medium text-neg">
              Blocked by {ruleLabel(blocked.rule)} <span className="font-mono text-[10px] text-neg/70">({blocked.rule})</span>
            </div>
            <div className="mt-0.5 break-words text-fg/80">{blocked.detail}</div>
          </div>
        </div>
      ) : null}

      {decision ? (
        <div className="border-t border-line pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] tracking-wide text-faint uppercase">Latest decision</span>
            <span suppressHydrationWarning className="num text-[11px] text-faint">{now ? ago(decision.ts, now) : ""}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge tone={decision.action === "buy" ? "accent" : decision.action === "sell" ? "info" : "neutral"}>{decision.action}</Badge>
            <span className="font-mono text-xs text-fg">{decision.symbol}</span>
            {decision.exitReason ? <Badge tone={decision.exitReason === "takeProfit" ? "pos" : "neg"}>exit · {EXIT_LABEL[decision.exitReason] ?? decision.exitReason}</Badge> : null}
          </div>
          {decision.reasons?.length ? (
            <ul className="mt-2 space-y-1 text-xs text-dim">
              {decision.reasons.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-faint">–</span>
                  <span className="break-words">{r}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
