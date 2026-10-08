"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useDashboard } from "@/lib/dashboard";
import { agentMeta } from "@/lib/config";
import { forSymbol, groupOf, GROUP_LABEL, latest, latestSelections, paymentSummary } from "@/lib/derive";
import { ago, clock, ruleLabel, signedUsd, toNum, usd } from "@/lib/format";
import { DeskBanner } from "@/components/DeskBanner";
import { TodayCard } from "@/components/TodayCard";
import { AgentFlow } from "@/components/AgentFlow";
import { summary } from "@/components/Timeline";
import { ModeTag } from "@/components/ui";
import { IconArrowRight } from "@/components/NavIcons";

function Tile({ href, label, aside, value, sub, children }: { href: string; label: string; aside?: ReactNode; value: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <Link href={href} className="group flex min-w-0 flex-col border border-line bg-panel p-4 transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold tracking-[0.16em] text-dim uppercase">{label}</span>
        <span className="flex items-center gap-2">
          {aside}
          <IconArrowRight className="size-3.5 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
        </span>
      </div>
      <div className="num mt-3 truncate text-[26px] leading-none font-semibold tracking-[-0.03em] text-fg">{value}</div>
      {sub ? <div className="num mt-2 line-clamp-2 text-[12px] leading-snug text-dim">{sub}</div> : null}
      {children ? <div className="mt-3 border-t border-line pt-3">{children}</div> : null}
    </Link>
  );
}

function Rows({ rows }: { rows: { k: string; v: ReactNode }[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.k} className="flex items-baseline justify-between gap-2 text-[12px]">
          <span className="font-mono text-dim">{r.k}</span>
          <span className="min-w-0 truncate text-right text-fg">{r.v}</span>
        </li>
      ))}
    </ul>
  );
}

const ACTION_TONE: Record<string, string> = { buy: "bg-pos text-white", sell: "bg-neg text-white", hold: "border border-line-strong text-dim" };

export function OverviewView() {
  const d = useDashboard();
  const execOffline = d.stateStatus === "offline";
  const pnl = d.portfolio.pnl;
  const pay = paymentSummary(d.events, d.now);
  const dataSpend = d.state?.dailyDataUsd ?? (pay.basis ? pay.todayUsd : null);
  const dataCap = toNum(d.state?.risk?.maxDailyDataUsd);
  const dataPct = dataSpend !== null && dataCap ? Math.min(100, (dataSpend / dataCap) * 100) : null;

  const selections = latestSelections(d.events);
  const picks = d.assets.map((a) => ({ a, s: selections.get(a) }));
  const picked = picks.filter((p) => p.s?.analystId).length;

  const perAsset = d.assets.map((a) => {
    const evs = forSymbol(d.events, a);
    return { a, decision: latest(evs, "decision"), risk: latest(evs, "risk.evaluated") };
  });
  const evaluated = perAsset.filter((p) => p.risk);
  const passing = evaluated.filter((p) => p.risk!.passed).length;
  const blocked = evaluated.length - passing;
  const failing = [...new Set(evaluated.flatMap((p) => p.risk!.checks?.filter((c) => !c.ok).map((c) => ruleLabel(c.rule)) ?? []))];
  const lastDecision = perAsset.map((p) => p.decision).filter(Boolean).sort((x, y) => y!.ts - x!.ts)[0];

  const recent = d.events.slice(0, 8);

  return (
    <>
      <DeskBanner mode={d.mode} />

      <TodayCard />

      <section aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Tile
          href="/dashboard/portfolio"
          label="Net P&L"
          aside={<ModeTag mode={d.portfolio.mode} />}
          value={pnl?.netUsd !== null && pnl?.netUsd !== undefined ? <span className={pnl.netUsd > 0 ? "text-pos" : pnl.netUsd < 0 ? "text-neg" : ""}>{signedUsd(pnl.netUsd)}</span> : "-"}
          sub={
            pnl
              ? `realized ${signedUsd(pnl.realizedUsd)} · unrealized ${signedUsd(pnl.unrealizedUsd)}`
              : execOffline
                ? "execution agent offline"
                : "no P&L reported yet"
          }
        />
        <Tile
          href="/dashboard/analysts"
          label="Signals today"
          value={pay.basis ? pay.todayCount : execOffline && d.analystsOffline ? "-" : 0}
          sub={dataSpend !== null ? `data spend ${usd(dataSpend, { max: 4 })}${dataCap !== null ? ` of ${usd(dataCap)} cap` : ""}` : "data spend not reported"}
        >
          <div
            role="meter"
            aria-label="Daily data spend against cap"
            aria-valuemin={0}
            aria-valuemax={dataCap ?? undefined}
            aria-valuenow={dataSpend ?? undefined}
            className="h-1.5 bg-line"
          >
            {dataPct !== null ? <div className={`h-full ${dataPct >= 90 ? "bg-neg" : dataPct >= 70 ? "bg-accent" : "bg-ink"}`} style={{ width: `${Math.max(dataPct, dataPct > 0 ? 2 : 0)}%` }} /> : null}
          </div>
        </Tile>
        <Tile
          href="/dashboard/analysts"
          label="Analyst picks"
          value={
            <>
              {picked}
              <span className="ml-1 text-[14px] font-normal text-dim">/ {d.assets.length} assets</span>
            </>
          }
          sub={picked ? "latest analyst chosen per asset" : "no analyst picked yet"}
        >
          <Rows rows={picks.map((p) => ({ k: p.a, v: p.s ? (p.s.analystId ? d.nameOf(p.s.analystId) : <span className="text-dim">none eligible</span>) : <span className="text-dim">-</span> }))} />
        </Tile>
        <Tile
          href="/dashboard/markets"
          label="Last decision"
          value={lastDecision ? <span className="uppercase">{lastDecision.action}</span> : "-"}
          sub={lastDecision ? <span suppressHydrationWarning>{`${lastDecision.symbol} · ${d.now ? ago(lastDecision.ts, d.now) : ""}`}</span> : "no decision yet"}
        >
          <Rows
            rows={perAsset.map((p) => ({
              k: p.a,
              v: p.decision ? (
                <span className={`inline-flex h-5 items-center px-1.5 text-[10px] font-bold tracking-[0.12em] uppercase ${ACTION_TONE[p.decision.action]}`}>{p.decision.action}</span>
              ) : (
                <span className="text-dim">-</span>
              ),
            }))}
          />
        </Tile>
        <Tile
          href="/dashboard/markets"
          label="Risk status"
          value={
            evaluated.length ? (
              <>
                <span>{passing}</span>
                <span className="ml-1 text-[13px] font-medium tracking-[0.1em] text-dim uppercase">pass</span>
                <span className={`ml-3 ${blocked ? "text-neg" : ""}`}>{blocked}</span>
                <span className="ml-1 text-[13px] font-medium tracking-[0.1em] text-dim uppercase">blocked</span>
              </>
            ) : (
              "-"
            )
          }
          sub={evaluated.length ? (failing.length ? `failing: ${failing.join(", ")}` : "every rule passing") : execOffline ? "execution agent offline" : "no evaluation yet"}
        />
      </section>

      <AgentFlow events={d.events} conn={d.conn} liveIds={d.liveIds} now={d.now} nameOf={d.nameOf} />

      <section aria-labelledby="recent-title" className="border border-line bg-panel">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 id="recent-title" className="text-[11px] font-medium tracking-[0.12em] text-dim uppercase">
            Latest activity
          </h2>
          <Link href="/dashboard/activity" className="inline-flex h-8 items-center gap-1.5 text-[12px] font-medium text-fg hover:underline">
            All activity <IconArrowRight className="size-3.5" />
          </Link>
        </header>
        {recent.length ? (
          <ol className="divide-y divide-line">
            {recent.map((e) => (
              <li key={e.id} className={`grid grid-cols-[auto_auto_minmax(0,1fr)] items-baseline gap-x-3 px-4 py-2 text-[13px] sm:grid-cols-[auto_auto_8rem_minmax(0,1fr)] ${d.liveIds.has(e.id) ? "row-flash" : ""}`}>
                <span className="num font-mono text-[12px] text-faint">{clock(e.ts)}</span>
                <span className={`w-3 text-center font-mono text-[11px] font-bold ${agentMeta(e.agent)?.tone ?? "text-faint"}`} title={agentMeta(e.agent)?.name ?? e.agent}>
                  {agentMeta(e.agent)?.tag ?? "?"}
                </span>
                <span className="hidden truncate text-[11px] tracking-[0.08em] text-dim uppercase sm:block">{GROUP_LABEL[groupOf(e.type)]}</span>
                <span className={`truncate ${e.type === "error" ? "text-neg" : "text-fg"}`}>{summary(e)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-4 py-6 text-[13px] text-dim">
            {Object.values(d.conn).every((c) => c.status === "offline") ? "No agents reachable - events appear as soon as an /events stream connects." : "Waiting for the first agent event…"}
          </p>
        )}
      </section>
    </>
  );
}
