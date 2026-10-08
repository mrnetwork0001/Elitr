"use client";
import { useRef, useState, type ReactNode } from "react";
import type { AgentId, AnalystId } from "@elitr/shared";
import { useDashboard } from "@/lib/dashboard";
import { AGENTS, BSCSCAN_NFT, ERC8004_REGISTRY, STUDIO_AGENT } from "@/lib/config";
import { useStudioAgent } from "@/lib/useStudioAgent";
import { ago, ruleLabel, until, usd } from "@/lib/format";
import { ModeBadge, StatusDot } from "@/components/DashboardShell";
import { Panel, IconBolt, IconKey } from "@/components/ui";
import { IconRun } from "@/components/NavIcons";

function fmtLimit(key: string, v: unknown): string {
  if (typeof v === "boolean") return v ? "on" : "off";
  if (typeof v === "number") {
    if (/Usd$/.test(key)) return usd(v);
    if (/Bps$/.test(key)) return `${v.toLocaleString("en-US")} bps`;
    if (/Sec$/.test(key)) return `${v.toLocaleString("en-US")} s`;
    if (/Trust$/.test(key)) return v.toFixed(2);
    if (key === "minConfidence") return `${v} / 100`;
    return v.toLocaleString("en-US");
  }
  if (v === null || v === undefined) return "-";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

const RULE_EXTRA: Record<string, string> = { minAnalystSamples: "Analyst min. samples" };

function ActionRow({ title, endpoint, body, meta, children }: { title: string; endpoint: string; body: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
          <span className="font-mono text-[11px] text-dim">{endpoint}</span>
        </div>
        <p className="mt-1 max-w-md text-[13px] leading-relaxed text-dim">{body}</p>
        {meta ? <div className="num mt-1.5 text-[12px] text-dim">{meta}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function ControlsView() {
  const d = useDashboard();
  const studio = useStudioAgent();
  const killRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState("");
  const s = d.state;
  const execUp = d.stateStatus === "ok";
  const disabled = !execUp || d.busy !== null || d.killed || !d.canControl;
  const why = !execUp ? "Execution agent offline" : d.killed ? "Kill switch engaged" : !d.canControl ? "Operator token required" : undefined;
  const limits = Object.entries(s?.risk ?? {});

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel title="Trading actions" id="actions" right={d.canControl ? <span className="text-dim">operator</span> : <span className="font-medium text-fg">read-only</span>}>
          <div className="divide-y divide-line">
            <ActionRow
              title="Run cycle"
              endpoint="POST /cycle"
              body="Run one trading cycle now: pick an analyst, buy a signal over b402, price, evaluate risk, dry-run on the Transaction API and fill."
              meta={
                execUp ? (
                  <span suppressHydrationWarning>
                    {s?.running ? "cycle running now" : s?.lastCycleAt && d.now ? `last cycle ${ago(s.lastCycleAt, d.now)}` : "no cycle yet"}
                    {s?.nextCycleAt && d.now && !s.running ? ` · next ${until(s.nextCycleAt, d.now)}` : ""}
                  </span>
                ) : (
                  "execution agent offline"
                )
              }
            >
              <button
                type="button"
                onClick={() => void d.act("cycle")}
                disabled={disabled}
                title={why}
                className="inline-flex h-11 w-full items-center justify-center gap-2 bg-accent px-5 text-[14px] font-semibold text-ink hover:bg-[#ffc81a] disabled:cursor-not-allowed disabled:bg-line disabled:text-dim sm:w-auto"
              >
                <IconRun className="size-3.5" /> {d.busy === "cycle" ? "Running…" : "Run cycle"}
              </button>
            </ActionRow>
            <ActionRow
              title="Kill switch"
              endpoint="POST /kill"
              body="Stop opening trades immediately. Every later cycle is blocked by the killSwitch rule until it is reset on the agent host."
              meta={execUp ? (d.killed ? <span className="font-semibold text-neg">engaged</span> : "armed - not engaged") : undefined}
            >
              <button
                type="button"
                onClick={() => killRef.current?.showModal()}
                disabled={disabled}
                title={why}
                className="inline-flex h-11 w-full items-center justify-center gap-2 border border-neg px-5 text-[14px] font-semibold text-neg hover:bg-neg hover:text-white disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-transparent disabled:text-dim sm:w-auto"
              >
                <IconBolt /> {d.busy === "kill" ? "Engaging…" : d.killed ? "Engaged" : "Kill switch"}
              </button>
            </ActionRow>
          </div>
          <p role="status" aria-live="polite" className={`text-[13px] empty:hidden ${d.notice?.ok ? "mt-4 text-fg" : "mt-4 font-medium text-neg"}`}>
            {d.notice?.message ?? ""}
          </p>
          {!d.canControl ? (
            <p className="mt-4 border-l-2 border-accent bg-panel-2 px-3 py-2 text-[13px] text-dim">Read-only: this agent requires an operator token for these actions. Paste it under Operator access.</p>
          ) : null}
        </Panel>

        <Panel title="Risk limits" id="limits" right={<span className="font-mono text-[11px] text-dim">GET /state · risk</span>} bodyClassName="p-0">
          {limits.length ? (
            <table className="w-full text-[13px]">
              <caption className="sr-only">Hard risk limits enforced by the execution agent</caption>
              <thead>
                <tr className="border-b border-line text-left text-[10px] tracking-[0.14em] text-dim uppercase">
                  <th scope="col" className="px-4 py-2 font-semibold">Rule</th>
                  <th scope="col" className="hidden px-4 py-2 font-semibold sm:table-cell">Key</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {limits.map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row" className="px-4 py-2 text-left font-normal text-fg">{RULE_EXTRA[k] ?? ruleLabel(k)}</th>
                    <td className="hidden px-4 py-2 font-mono text-[12px] text-dim sm:table-cell">{k}</td>
                    <td className={`num px-4 py-2 text-right font-mono ${k === "killSwitch" && v === true ? "font-semibold text-neg" : "text-fg"}`}>{fmtLimit(k, v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-6 text-[13px] text-dim">{execUp ? "The execution agent did not report its risk configuration." : "Execution agent offline - risk limits unavailable."}</p>
          )}
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Panel title="Operator access" id="operator" right={<IconKey />}>
          <p className="text-[13px] leading-relaxed text-dim">
            {s?.controlAuth === true
              ? "This agent requires a bearer token for POST /cycle and POST /kill. Visitors without it see the desk read-only."
              : s?.controlAuth === false
                ? "This agent does not require an operator token (controlAuth off): anyone who can reach it can run cycles or engage the kill switch."
                : "Whether this agent requires an operator token is unknown until it reports its state."}{" "}
            The token is kept for this tab's session only.
          </p>
          {d.token ? (
            <p className={`mt-3 text-[13px] font-medium ${d.tokenRejected ? "text-neg" : "text-fg"}`}>
              {d.tokenRejected ? "The saved token was rejected by the agent (401). Paste a new one or clear it." : `Token saved (…${d.token.slice(-4)}).`}
            </p>
          ) : null}
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              d.setToken(draft);
              d.setTokenRejected(false);
              setDraft("");
            }}
          >
            <label htmlFor="op-token" className="block text-[10px] font-semibold tracking-[0.16em] text-dim uppercase">
              Operator token
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="op-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={d.token ? "replace token" : "paste token"}
                className="h-11 min-w-0 flex-1 border border-line-strong bg-bg px-3 font-mono text-[14px] text-fg outline-none placeholder:text-faint focus:border-ink"
              />
              <button type="submit" disabled={!draft.trim()} className="h-11 shrink-0 bg-ink px-4 text-[13px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40">
                Save
              </button>
            </div>
            {d.token ? (
              <button
                type="button"
                onClick={() => {
                  d.setToken(null);
                  d.setTokenRejected(false);
                }}
                className="mt-2 h-9 text-[13px] font-medium text-neg hover:underline"
              >
                Clear saved token
              </button>
            ) : null}
          </form>
        </Panel>

        <Panel title="Trading mode" id="mode" right={<ModeBadge size="sm" />}>
          <p className="text-[13px] leading-relaxed text-dim">
            {d.mode === "live"
              ? "LIVE: the execution agent signs and broadcasts real swaps on BSC mainnet, within its risk limits. Real funds move."
              : d.mode === "paper"
                ? "PAPER: signals, prices, quotes and Transaction API dry-runs are real. Fills are booked at the quoted amounts; nothing is broadcast and no real money moves."
                : "Unknown until the execution agent reports its state."}
          </p>
          <p className="mt-2 text-[12px] text-dim">The mode is set on the agent host (LIVE_TRADING); it cannot be changed from the dashboard.</p>
        </Panel>

        <Panel title="Configuration" id="config" right={<span className="font-mono text-[11px] text-dim">configErrors</span>}>
          {!execUp ? (
            <p className="text-[13px] text-dim">Execution agent offline.</p>
          ) : s?.configErrors.length ? (
            <ul className="flex flex-col gap-2">
              {s.configErrors.map((e) => (
                <li key={e} className="flex gap-2 border-l-2 border-neg bg-neg/[0.05] px-3 py-2 text-[13px] break-words text-fg">
                  {e}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-fg">No configuration errors reported.</p>
          )}
        </Panel>

        <Panel title="Agents & endpoints" id="agents" bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {AGENTS.map((a) => {
              const c = d.conn[a.id as AgentId];
              const inf = a.id !== "execution" ? d.info[a.id as AnalystId] : undefined;
              const st = c?.status ?? "connecting";
              return (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <StatusDot status={st} />
                      <span className="truncate text-[14px] font-medium text-fg">{inf?.name ?? a.name}</span>
                    </span>
                    <span className={`text-[11px] tracking-[0.08em] uppercase ${st === "offline" ? "font-semibold text-neg" : "text-dim"}`}>{st}</span>
                  </div>
                  <div className="mt-1 font-mono text-[12px] break-all text-dim">{a.url}/events</div>
                  <div suppressHydrationWarning className="num mt-1 text-[12px] text-dim">
                    {c?.lastEventAt && d.now ? `last frame ${ago(c.lastEventAt, d.now)}` : "no frames this session"}
                    {st === "offline" && c?.retries ? ` · retry #${c.retries}` : ""}
                    {inf ? ` · ${usd(inf.priceUsd ?? null)} per signal` : ""}
                    {inf && typeof (inf as { b402Configured?: unknown }).b402Configured === "boolean"
                      ? ` · b402 ${(inf as { b402Configured?: boolean }).b402Configured ? "configured" : "not configured"}`
                      : ""}
                  </div>
                </li>
              );
            })}
            <li className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <StatusDot status={studio.status} />
                  <span className="truncate text-[14px] font-medium text-fg">{STUDIO_AGENT.name}</span>
                  <span className="border border-accent/50 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] text-ink uppercase">Agent Studio</span>
                </span>
                <span className={`text-[11px] tracking-[0.08em] uppercase ${studio.status === "offline" ? "font-semibold text-neg" : "text-dim"}`}>{studio.status}</span>
              </div>
              <div className="mt-1 font-mono text-[12px] break-all text-dim">{STUDIO_AGENT.card}</div>
              <div className="mt-1 text-[12px] text-dim">
                A2A{studio.skills.length ? ` (${studio.skills.join(", ")})` : ""} · x402 brief (free) ·{" "}
                <a className="font-mono text-fg underline decoration-line-strong underline-offset-2 hover:decoration-fg" href={BSCSCAN_NFT(ERC8004_REGISTRY, STUDIO_AGENT.erc8004AgentId)} target="_blank" rel="noreferrer">
                  ERC-8004 #{STUDIO_AGENT.erc8004AgentId}
                </a>
              </div>
            </li>
          </ul>
        </Panel>
      </div>

      <dialog
        ref={killRef}
        aria-labelledby="kill-title"
        className="m-auto w-[min(92vw,440px)] border border-line-strong bg-panel p-0 text-fg"
        onClick={(e) => {
          if (e.target === killRef.current) killRef.current?.close();
        }}
      >
        <form
          method="dialog"
          className="p-5"
          onSubmit={(e) => {
            const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
            if (submitter?.value === "confirm") void d.act("kill");
          }}
        >
          <div className="flex items-center gap-2 text-neg">
            <IconBolt />
            <h2 id="kill-title" className="text-[13px] font-semibold tracking-[0.12em] uppercase">
              Engage kill switch?
            </h2>
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-dim">
            The execution agent will stop opening trades immediately. Every subsequent cycle is blocked by the <span className="font-mono text-fg">killSwitch</span> risk rule until it is reset on the agent host.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button value="cancel" className="h-11 border border-line-strong px-4 text-[14px] text-fg hover:bg-panel-2" autoFocus>
              Cancel
            </button>
            <button value="confirm" className="h-11 bg-neg px-4 text-[14px] font-semibold text-white hover:bg-neg/90">
              Engage kill switch
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
