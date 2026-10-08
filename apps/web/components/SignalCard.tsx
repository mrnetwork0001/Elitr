"use client";
import type { AgentEvent, Stance } from "@elitr/shared";
import { forSymbol, latest, ofType } from "@/lib/derive";
import { SIGNAL_CYCLE_MS_FALLBACK, agentMeta } from "@/lib/config";
import { useDashboard } from "@/lib/dashboard";
import { ago, cycleLengthMs, hostOf, isUrl, pathOf, price, signalFreshness } from "@/lib/format";
import { Badge, Empty, ExtLink, Panel } from "./ui";

function stance_(score: number): { label: string; tone: "pos" | "neg" | "neutral" } {
  if (score >= 60) return { label: "Bullish", tone: "pos" };
  if (score <= 40) return { label: "Bearish", tone: "neg" };
  return { label: "Neutral", tone: "neutral" };
}

function Gauge({ score, threshold, stale }: { score: number; threshold: number | null; stale: boolean }) {
  // 240° arc gauge
  const R = 52;
  const C = 2 * Math.PI * R;
  const sweep = 240 / 360;
  const clamped = Math.max(0, Math.min(100, score));
  const color = stale ? "var(--color-faint)" : clamped >= 60 ? "var(--color-pos)" : clamped <= 40 ? "var(--color-neg)" : "var(--color-fg)";
  const thrAngle = threshold !== null ? -210 + (Math.max(1, Math.min(100, threshold)) / 100) * 240 : null;
  return (
    <svg viewBox="0 0 128 112" className="h-32 w-36 shrink-0" role="img" aria-label={`Confidence ${score} of 100`}>
      <g transform="translate(64 64) rotate(150)">
        <circle r={R} fill="none" stroke="var(--color-line)" strokeWidth="8" strokeDasharray={`${C * sweep} ${C}`} strokeLinecap="round" />
        <circle
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${C * sweep * (clamped / 100)} ${C}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
      </g>
      {thrAngle !== null ? (
        <g transform={`translate(64 64) rotate(${thrAngle + 90})`}>
          <line x1="0" y1={-R - 7} x2="0" y2={-R + 7} stroke="var(--color-accent)" strokeWidth="2" />
        </g>
      ) : null}
      <text x="64" y="68" textAnchor="middle" className="num" fill="var(--color-fg)" fontSize="34" fontWeight="600">
        {score}
      </text>
      <text x="64" y="86" textAnchor="middle" fill="var(--color-faint)" fontSize="10" letterSpacing="1.5">
        / 100
      </text>
    </svg>
  );
}

function stanceBadge(stance: Stance | undefined, score: number): { label: string; tone: "pos" | "neg" | "neutral" } {
  if (stance === "bullish") return { label: "Bullish", tone: "pos" };
  if (stance === "bearish") return { label: "Bearish", tone: "neg" };
  if (stance === "neutral") return { label: "Neutral", tone: "neutral" };
  return stance_(score);
}

export function SignalCard({
  events,
  symbol,
  analystsOffline,
  now,
  nameOf,
}: {
  events: AgentEvent[];
  symbol: string;
  analystsOffline: boolean;
  now: number;
  nameOf: (id: string) => string;
}) {
  const dash = useDashboard();
  const scoped = forSymbol(events, symbol);
  const produced = ofType(scoped, "signal.produced");
  const received = ofType(scoped, "signal.received");
  const prod0 = produced[0];
  const recv0 = received[0];
  // The signal the trader acted on (received) is primary; join the analyst's own event for rationale + sources.
  const recv = recv0 && (!prod0 || recv0.ts >= prod0.ts - 60_000) ? recv0 : undefined;
  const prod = recv ? (produced.find((p) => p.signalId && p.signalId === recv.signalId) ?? (prod0 && Math.abs(prod0.ts - recv.ts) < 60_000 && prod0.agent === recv.analystId ? prod0 : undefined)) : prod0;
  const history = [...produced, ...received.filter((r) => !produced.some((p) => p.signalId && p.signalId === r.signalId))]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 16)
    .reverse();
  // Threshold from the latest real risk evaluation for this asset, if the agent reported one.
  const riskEval = latest(scoped, "risk.evaluated");
  const confCheck = riskEval?.checks?.find((c) => c.rule === "minConfidence");
  const threshold = confCheck ? Number.parseFloat(confCheck.limit.replace(/[^\d.]/g, "")) : NaN;

  if (!prod && !recv) {
    return (
      <Panel title="Signal" id="signal" right={<span className="font-mono text-fg">{symbol}</span>}>
        {analystsOffline ? (
          <Empty tone="offline" title="Analysts offline" hint={`No ${symbol} signal yet. The card fills in as soon as an analyst sells its first paid signal.`} />
        ) : (
          <Empty title={`Waiting for a ${symbol} signal…`} hint="Signals are produced only when the execution agent pays an analyst for one over b402." />
        )}
      </Panel>
    );
  }

  const ts = (recv ?? prod)!.ts;
  const score = recv?.score ?? prod!.score;
  const stance = recv?.stance ?? prod?.stance;
  const producer = recv?.analystId ?? prod!.agent;
  const age = now ? now - ts : 0;
  // Freshness is relative to the real cycle length: a signal from the previous cycle is normal, not stale.
  const fresh = signalFreshness(now > 0 ? age : 0, cycleLengthMs(dash.state, SIGNAL_CYCLE_MS_FALLBACK));
  const stale = fresh.stale;
  const st = stanceBadge(stance, score);
  const meta = agentMeta(producer);

  return (
    <Panel
      title="Signal"
      id="signal"
      right={
        <>
          <span className="font-mono text-fg">{symbol}</span>
          <span suppressHydrationWarning className={`num ${stale ? "font-medium text-warn" : "text-dim"}`} title={new Date(ts).toLocaleString()}>
            {now ? ago(ts, now) : ""}
            {fresh.label ? ` · ${fresh.label}` : ""}
          </span>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="text-faint">from</span>
        <span className={`font-semibold ${meta?.tone ?? "text-fg"}`}>{nameOf(producer)}</span>
        {recv ? (
          <span className="num text-dim" title="Weight = the trader's trust multiplier for this analyst; the risk engine sees the weighted score.">
            · weight {recv.weight.toFixed(2)} → effective <span className="text-fg">{Math.round(recv.effectiveScore)}</span>
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-4">
        <Gauge score={score} threshold={Number.isFinite(threshold) ? threshold : null} stale={stale} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] tracking-wide text-faint uppercase">Confidence</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={stale ? "neutral" : st.tone}>{st.label}</Badge>
            {Number.isFinite(threshold) ? (
              <span className="num text-xs text-dim">
                {(recv?.effectiveScore ?? score) >= threshold ? "clears" : "below"} <span className="text-accent">{threshold}</span> min
              </span>
            ) : null}
          </div>
          {recv?.horizonSec ? <div className="num mt-1 text-[11px] text-faint">horizon {Math.round(recv.horizonSec / 60)} min · entry {price(recv.entryPrice)}</div> : null}
          {history.length > 1 ? (
            <div className="mt-3 flex h-6 items-end gap-0.5" aria-label="Recent signal scores">
              {history.map((h) => {
                const by = h.type === "signal.received" ? h.analystId : h.agent;
                return (
                  <span
                    key={h.id}
                    title={`${h.score} · ${nameOf(by)} · ${new Date(h.ts).toLocaleTimeString()}`}
                    className={`w-1.5 rounded-sm ${h.id === recv?.id || h.id === prod?.id ? "bg-fg" : by === "analyst-flow" ? "bg-flow/50" : "bg-info/40"}`}
                    style={{ height: `${Math.max(8, h.score)}%` }}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed break-words text-fg/90">
        {prod?.rationale || <span className="text-faint">{prod ? "No rationale provided." : "Rationale is on the analyst's stream (not connected)."}</span>}
      </p>

      {prod?.sources?.length ? (
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1.5 text-[11px] tracking-wide text-faint uppercase">Sources · {prod.sources.length}</div>
          <ul className="flex flex-col gap-1">
            {prod.sources.slice(0, 8).map((s, i) => (
              <li key={`${s}-${i}`} className="min-w-0 truncate text-xs">
                {isUrl(s) ? (
                  <ExtLink href={s} title={s} className="max-w-full">
                    <span className="truncate">
                      {hostOf(s)}
                      <span className="text-faint">{pathOf(s)}</span>
                    </span>
                  </ExtLink>
                ) : (
                  <span className="text-dim">{s}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
