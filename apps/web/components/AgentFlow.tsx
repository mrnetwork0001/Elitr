"use client";
import type { AgentEvent, AgentId, AnalystId } from "@elitr/shared";
import type { AgentConn } from "@/lib/useAgentStream";
import { latest, paymentSummary, type EventOf } from "@/lib/derive";
import { ANALYST_IDS, agentMeta } from "@/lib/config";
import { BSCSCAN_TX } from "@/lib/config";
import { ago, assetSymbol, fromUnits, payUsd, shortHash, usd } from "@/lib/format";
import { ExtLink, IconCheck } from "./ui";

function Node({
  role,
  name,
  port,
  conn,
  pulse,
  detail,
  tone,
}: {
  role: string;
  name: string;
  port: string;
  conn: AgentConn;
  pulse: boolean;
  detail: string;
  tone?: string;
}) {
  const offline = conn.status === "offline";
  return (
    <div
      className={`relative z-10 min-w-0 rounded-lg border bg-panel-2 px-3 py-2.5 sm:px-4 ${
        offline ? "border-neg/40" : conn.status === "live" ? "border-line-strong" : "border-line"
      } ${pulse ? "node-pulse" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] tracking-[0.14em] text-faint uppercase">{role}</span>
        <span className={`size-1.5 rounded-full ${offline ? "bg-neg" : conn.status === "live" ? "bg-pos" : "bg-warn"}`} />
      </div>
      <div className={`mt-0.5 truncate text-sm font-semibold sm:text-base ${tone ?? "text-fg"}`}>{name}</div>
      <div className="mt-0.5 hidden truncate font-mono text-[11px] text-faint sm:block">{port}</div>
      <div className={`mt-1.5 truncate text-xs ${offline ? "text-neg" : "text-dim"}`}>{offline ? "offline" : detail}</div>
    </div>
  );
}

type PayEvent = EventOf<"payment.sent"> | EventOf<"payment.verified">;

/** Latest payment touching one analyst: buyer-side (payment.sent.analystId) or seller-side (payment.verified from that agent). */
function latestPaymentTo(events: AgentEvent[], id: AnalystId): PayEvent | undefined {
  return events.find((e): e is PayEvent => (e.type === "payment.sent" && e.analystId === id) || (e.type === "payment.verified" && e.agent === id));
}

function latestSignalFrom(events: AgentEvent[], id: AnalystId): { ts: number; score: number; symbol: string } | undefined {
  const e = events.find((x) => (x.type === "signal.produced" && x.agent === id) || (x.type === "signal.received" && x.analystId === id));
  if (!e || (e.type !== "signal.produced" && e.type !== "signal.received")) return undefined;
  return { ts: e.ts, score: e.score, symbol: e.symbol };
}

function Wire({ pay, signal, animKey, active }: { pay: PayEvent | undefined; signal: { score: number; symbol: string } | undefined; animKey: string | null; active: boolean }) {
  const amount = pay ? fromUnits(pay.amount) : null;
  return (
    <div className="relative min-w-0" aria-hidden>
      <div className="mb-1 truncate text-center text-[10px] tracking-wider text-faint uppercase">
        {amount !== null ? payUsd(amount) : "payment"}
        {amount !== null ? <span className="hidden sm:inline"> {assetSymbol(pay?.asset)}</span> : null} →
      </div>
      <svg className="h-2 w-full" preserveAspectRatio="none" viewBox="0 0 100 2">
        <line x1="0" y1="1" x2="100" y2="1" stroke={active ? "var(--color-accent)" : "var(--color-line-strong)"} strokeWidth="2" vectorEffect="non-scaling-stroke" className={active ? "wire-active" : ""} />
      </svg>
      {animKey ? (
        <>
          <span key={`p-${animKey}`} className="packet absolute top-[18px] -ml-2 grid size-4 place-items-center rounded-full bg-accent text-[9px] font-bold text-black">
            $
          </span>
          <span key={`s-${animKey}`} className="packet-rev absolute top-[18px] -ml-2 grid size-4 place-items-center rounded-full border border-fg bg-bg text-[8px] font-bold text-fg">
            S
          </span>
        </>
      ) : null}
      <div className="mt-1 truncate text-center text-[10px] tracking-wider text-faint uppercase">← {signal ? `${signal.symbol} ${signal.score}` : "signal"}</div>
    </div>
  );
}

export function AgentFlow({
  events,
  conn,
  liveIds,
  now,
  nameOf,
}: {
  events: AgentEvent[];
  conn: Record<AgentId, AgentConn>;
  liveIds: ReadonlySet<string>;
  now: number;
  nameOf: (id: string) => string;
}) {
  const pay = paymentSummary(events, now);
  const required = pay.lastRequired;
  const sent = latest(events, "payment.sent");
  const verified = latest(events, "payment.verified");
  const signal = events.find((e) => e.type === "signal.produced" || e.type === "signal.received") as EventOf<"signal.produced"> | EventOf<"signal.received"> | undefined;
  const priceUsd = required ? fromUnits(required.amount) : null;

  const perAnalyst = ANALYST_IDS.map((id) => {
    const p = latestPaymentTo(events, id);
    const animKey = p && liveIds.has(p.id) && now - p.ts < 6000 ? p.id : null;
    return { id, pay: p, signal: latestSignalFrom(events, id), animKey };
  });

  // The b402 handshake for the latest cycle, anchored at the latest 402 challenge (or payment).
  const anchor = required?.ts ?? pay.latest?.ts ?? null;
  const steps = [
    { label: "402 challenge", sub: required ? `${payUsd(priceUsd)} · ${nameOf(required.agent)}` : "awaiting request", done: !!required },
    { label: "Payment signed", sub: "execution → b402", done: !!(anchor && sent && sent.ts >= anchor - 2000) },
    { label: "Verified & settled", sub: "analyst ← facilitator", done: !!(anchor && verified && verified.ts >= anchor - 2000) },
    { label: "Signal delivered", sub: signal ? `${signal.symbol} · ${signal.score}/100` : "—", done: !!(anchor && signal && signal.ts >= anchor - 2000) },
  ];

  const nothingYet = !pay.latest && !required && !signal;
  const allOffline = Object.values(conn).every((c) => c.status === "offline");
  const anyAnim = perAnalyst.find((a) => a.animKey)?.animKey ?? null;

  return (
    <section aria-labelledby="flow-title" className="rounded-lg border border-line bg-panel">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <h2 id="flow-title" className="text-[11px] font-medium tracking-[0.12em] text-dim uppercase">
          Agent-to-agent flow <span className="hidden text-faint normal-case tracking-normal sm:inline">· b402 pay-per-signal</span>
        </h2>
        {pay.latest ? <span suppressHydrationWarning className="num text-xs text-faint">last payment {ago(pay.latest.ts, now)}</span> : null}
      </header>

      <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:p-5">
        {/* Diagram: one buyer, two competing sellers */}
        <div className="min-w-0">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(40px,0.6fr)_minmax(0,1.15fr)] items-center gap-x-2 gap-y-3 sm:gap-x-4">
            <div className="row-span-2">
              <Node
                key={`exec-${anyAnim ?? "idle"}`}
                role="Buyer"
                name="Execution"
                port="picks an analyst, trades"
                conn={conn.execution}
                pulse={!!anyAnim}
                tone="text-accent"
                detail={sent ? `paid ${payUsd(fromUnits(sent.amount))} ${ago(sent.ts, now)}` : "no payments yet"}
              />
            </div>
            {perAnalyst.map((a, i) => (
              <div key={a.id} className="contents">
                <div style={{ gridColumn: 2, gridRow: i + 1 }}>
                  <Wire pay={a.pay} signal={a.signal} animKey={a.animKey} active={!!a.animKey} />
                </div>
                <div style={{ gridColumn: 3, gridRow: i + 1 }}>
                  <Node
                    key={`${a.id}-${a.animKey ?? "idle"}`}
                    role="Seller"
                    name={nameOf(a.id)}
                    port={a.id === "analyst" ? "LLM news sentiment" : "PancakeSwap flow"}
                    conn={conn[a.id]}
                    pulse={!!a.animKey}
                    tone={agentMeta(a.id)?.tone}
                    detail={a.signal ? `last signal ${ago(a.signal.ts, now)}` : "no signals yet"}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Handshake steps */}
          <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.label} className={`min-w-0 rounded-md border px-2.5 py-2 ${s.done ? "border-line-strong bg-panel-2" : "border-line border-dashed"}`}>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className={`grid size-4 shrink-0 place-items-center rounded-full text-[10px] ${s.done ? "bg-pos/15 text-pos" : "border border-line-strong text-faint"}`}>
                    {s.done ? <IconCheck /> : i + 1}
                  </span>
                  <span className={`truncate ${s.done ? "text-fg" : "text-faint"}`}>{s.label}</span>
                </div>
                <div className="num mt-1 truncate pl-5.5 text-[11px] text-faint">{s.sub}</div>
              </li>
            ))}
          </ol>
        </div>

        {/* Metrics */}
        <div className="flex min-w-0 flex-col justify-between gap-4 border-line lg:border-l lg:pl-5">
          {nothingYet ? (
            <div className="flex h-full flex-col justify-center gap-1 py-4">
              <p className="text-sm text-dim">{allOffline ? "All agents offline" : "Waiting for the first paid signal…"}</p>
              <p className="text-xs leading-relaxed text-faint">
                {allOffline
                  ? "Start the analysts (:4001 news, :4003 flow) and the execution agent (:4002) — this panel lights up when the first b402 payment settles."
                  : "Each cycle the execution agent picks an analyst, receives an HTTP 402 challenge, pays it over b402 and gets a signal back."}
              </p>
            </div>
          ) : (
            <>
              <div>
                <div className="text-[11px] tracking-wide text-faint uppercase">Latest payment</div>
                <div className="num mt-1 text-3xl font-semibold tracking-tight text-fg">
                  {payUsd(pay.latestUsd)}
                  {pay.latestAsset ? <span className="ml-2 text-sm font-normal text-dim">{assetSymbol(pay.latestAsset)}</span> : null}
                </div>
                <div className="mt-1 text-xs text-dim">
                  {pay.latestTx ? (
                    <ExtLink href={BSCSCAN_TX(pay.latestTx)} className="font-mono">
                      settle {shortHash(pay.latestTx)}
                    </ExtLink>
                  ) : pay.latest ? (
                    <span className="text-faint">settlement tx not reported</span>
                  ) : (
                    <span className="text-faint">challenge issued, not yet paid</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 border-t border-line pt-3">
                <div className="min-w-0">
                  <div className="text-[11px] tracking-wide text-faint uppercase">Paid today</div>
                  <div className="num mt-0.5 truncate text-base font-medium">{usd(pay.todayUsd, { max: 4 })}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] tracking-wide text-faint uppercase">Signals</div>
                  <div className="num mt-0.5 truncate text-base font-medium">
                    {pay.todayCount}
                    <span className="ml-1 text-xs text-faint">/ {pay.totalCount} all</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] tracking-wide text-faint uppercase">Last quote</div>
                  <div className="num mt-0.5 truncate text-base font-medium">{payUsd(priceUsd)}</div>
                </div>
              </div>
              {pay.basis === "seller" ? <p className="text-[11px] text-faint">Totals from analyst receipts (execution stream has no payments).</p> : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
