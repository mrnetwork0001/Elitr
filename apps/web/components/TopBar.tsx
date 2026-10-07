"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { LogoMark } from "./LogoMark";
import type { AgentId } from "@elitr/shared";
import type { AgentConn } from "@/lib/useAgentStream";
import type { ActionResult, ExecState, StateStatus } from "@/lib/useExecutionState";
import { AGENTS, BSCSCAN_ADDRESS } from "@/lib/config";
import { ago, shortAddr, until } from "@/lib/format";
import { IconBolt, IconKey, IconPlay, IconShield } from "./ui";

const PILL_NAME: Record<string, string> = { analyst: "News", "analyst-flow": "Flow", execution: "Execution" };

function ConnPill({ id, conn }: { id: AgentId; conn: AgentConn }) {
  const s = conn.status;
  const meta = AGENTS.find((a) => a.id === id);
  const color = s === "live" ? "bg-pos" : s === "offline" ? "bg-neg" : "bg-warn";
  const label = s === "live" ? "live" : s === "offline" ? "offline" : "connecting";
  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-panel px-2 text-xs"
      title={`${meta?.name ?? id} agent ${label} — ${conn.url}/events${s === "offline" && conn.retries ? ` (retry #${conn.retries})` : ""}`}
    >
      <span className={`size-1.5 rounded-full ${color} ${s === "live" ? "live-dot" : ""}`} />
      <span className="text-fg">{PILL_NAME[id] ?? id}</span>
      <span className={`hidden xl:inline ${s === "live" ? "text-pos" : s === "offline" ? "text-neg" : "text-warn"}`}>{label}</span>
    </span>
  );
}

function ModeBadge({ state, status }: { state: ExecState | null; status: StateStatus }) {
  const mode = status === "ok" ? state?.mode : null;
  if (!mode)
    return (
      <span className="inline-flex h-7 items-center rounded-md border border-line-strong px-2.5 text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">
        Mode unknown
      </span>
    );
  if (mode === "live")
    return (
      <span
        className="inline-flex h-7 items-center gap-2 rounded-md bg-neg px-3 text-[11px] font-bold tracking-[0.16em] text-white uppercase shadow-[0_0_0_3px_rgb(246_70_93/0.25)]"
        title="LIVE — the execution agent broadcasts real transactions on BSC mainnet"
      >
        <span className="live-dot size-1.5 rounded-full bg-white" />
        Live trading
      </span>
    );
  return (
    <span
      className="inline-flex h-7 items-center gap-2 rounded-md border border-dashed border-info/70 bg-info/10 px-3 text-[11px] font-bold tracking-[0.16em] text-info uppercase"
      title="PAPER — quotes, prices and Transaction API simulations are real; fills are booked at the quoted amounts and nothing is broadcast. No real money moves."
    >
      Paper trading
    </span>
  );
}

export function TopBar({
  conn,
  state,
  stateStatus,
  now,
  runCycle,
  engageKill,
  token,
  setToken,
}: {
  conn: Record<AgentId, AgentConn>;
  state: ExecState | null;
  stateStatus: StateStatus;
  now: number;
  runCycle: () => Promise<ActionResult>;
  engageKill: () => Promise<ActionResult>;
  token: string | null;
  setToken: (t: string | null) => void;
}) {
  const killRef = useRef<HTMLDialogElement>(null);
  const opRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState<null | "cycle" | "kill">(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [rejected, setRejected] = useState(false);
  const [draft, setDraft] = useState("");
  const execUp = stateStatus === "ok";
  const killed = state?.killSwitch === true;
  const authRequired = state?.controlAuth === true;
  const canControl = !authRequired || !!token;

  const act = async (kind: "cycle" | "kill") => {
    setBusy(kind);
    setNotice(null);
    const r = await (kind === "cycle" ? runCycle() : engageKill());
    setBusy(null);
    const what = kind === "cycle" ? "Cycle" : "Kill";
    let message: string;
    if (r.status === 401 || r.status === 403) {
      setRejected(true);
      message = `${r.status} Unauthorized — operator token ${token ? "rejected" : "required"}`;
    } else {
      if (r.ok) setRejected(false);
      message = r.ok ? (kind === "cycle" ? "Cycle started" : "Kill switch engaged") : `${what} failed: ${r.message}`;
    }
    setNotice({ ok: r.ok, message });
    setTimeout(() => setNotice(null), 8000);
  };

  const openOperator = () => {
    setDraft("");
    opRef.current?.showModal();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-2.5 gap-y-2 px-4 py-2.5 lg:px-6">
        <div className="mr-1 flex items-baseline gap-2">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-fg hover:text-accent" title="About Elitr">
            <LogoMark className="h-[18px] w-auto text-accent" />
            Elitr<span className="text-accent">.</span>
          </Link>
          <span className="hidden text-xs text-faint 2xl:inline">agent-to-agent trading desk</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {AGENTS.map((a) => (conn[a.id] ? <ConnPill key={a.id} id={a.id} conn={conn[a.id]} /> : null))}
        </div>

        <ModeBadge state={state} status={stateStatus} />

        {execUp && state?.killSwitch !== null && state?.killSwitch !== undefined ? (
          killed ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-neg bg-neg/15 px-2.5 text-[11px] font-bold tracking-[0.14em] text-neg uppercase">
              <IconShield /> Kill switch engaged
            </span>
          ) : (
            <span className="hidden h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-[11px] tracking-[0.1em] text-dim uppercase sm:inline-flex">
              <IconShield /> Kill switch armed
            </span>
          )
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {notice ? (
            <span role="status" className={`text-xs ${notice.ok ? "text-pos" : "font-medium text-neg"}`}>
              {notice.message}
            </span>
          ) : execUp && state?.nextCycleAt ? (
            <span className="num hidden text-xs text-faint lg:inline" title={state.lastCycleAt ? `Last cycle ${ago(state.lastCycleAt, now)}` : undefined}>
              next cycle {until(state.nextCycleAt, now)}
            </span>
          ) : null}

          {state?.wallet ? (
            <a
              href={BSCSCAN_ADDRESS(state.wallet)}
              target="_blank"
              rel="noopener noreferrer"
              className="num hidden h-7 items-center rounded-md border border-line px-2.5 font-mono text-xs text-dim hover:border-line-strong hover:text-fg md:inline-flex"
              title={`Execution wallet ${state.wallet} on BscScan`}
            >
              {shortAddr(state.wallet)}
            </a>
          ) : null}

          {authRequired ? (
            <button
              type="button"
              onClick={openOperator}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs ${
                rejected ? "border-neg/60 text-neg" : token ? "border-pos/40 text-pos" : "border-line text-dim hover:text-fg"
              }`}
              title={token ? (rejected ? "Operator token was rejected (401)" : "Operator token set — controls enabled") : "Read-only. Paste the operator token to run cycles or engage the kill switch."}
            >
              <IconKey /> {token ? (rejected ? "Token rejected" : "Operator") : "Read-only · Operator"}
            </button>
          ) : null}

          {canControl ? (
            <>
              <button
                type="button"
                onClick={() => act("cycle")}
                disabled={!execUp || busy !== null || killed}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong bg-panel-2 px-3 text-xs font-medium text-fg hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-40"
                title={!execUp ? "Execution agent offline" : killed ? "Kill switch engaged" : "POST /cycle — run one trading cycle now"}
              >
                <IconPlay /> {busy === "cycle" ? "Running…" : "Run cycle"}
              </button>

              <button
                type="button"
                onClick={() => killRef.current?.showModal()}
                disabled={!execUp || busy !== null || killed}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-neg/60 px-3 text-xs font-medium text-neg hover:bg-neg/10 disabled:cursor-not-allowed disabled:opacity-40"
                title={!execUp ? "Execution agent offline" : killed ? "Already engaged" : "Halt all trading"}
              >
                <IconBolt /> {busy === "kill" ? "Engaging…" : "Kill switch"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <dialog
        ref={killRef}
        className="m-auto w-[min(92vw,420px)] rounded-lg border border-line-strong bg-panel p-0 text-fg"
        onClick={(e) => {
          if (e.target === killRef.current) killRef.current?.close();
        }}
      >
        <form
          method="dialog"
          className="p-5"
          onSubmit={(e) => {
            const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
            if (submitter?.value === "confirm") void act("kill");
          }}
        >
          <div className="flex items-center gap-2 text-neg">
            <IconBolt />
            <h3 className="text-sm font-semibold tracking-wide uppercase">Engage kill switch?</h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-dim">
            The execution agent will stop opening trades immediately. Every subsequent cycle is blocked by the{" "}
            <span className="font-mono text-fg">killSwitch</span> risk rule until it is reset on the agent host.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button value="cancel" className="h-8 rounded-md border border-line-strong px-3 text-sm text-fg hover:bg-panel-2" autoFocus>
              Cancel
            </button>
            <button value="confirm" className="h-8 rounded-md bg-neg px-3 text-sm font-semibold text-white hover:bg-neg/90">
              Engage kill switch
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={opRef}
        className="m-auto w-[min(92vw,440px)] rounded-lg border border-line-strong bg-panel p-0 text-fg"
        onClick={(e) => {
          if (e.target === opRef.current) opRef.current?.close();
        }}
      >
        <form
          method="dialog"
          className="p-5"
          onSubmit={(e) => {
            const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
            if (submitter?.value === "save" && draft.trim()) {
              setToken(draft);
              setRejected(false);
            } else if (submitter?.value === "clear") {
              setToken(null);
              setRejected(false);
            }
          }}
        >
          <div className="flex items-center gap-2 text-fg">
            <IconKey />
            <h3 className="text-sm font-semibold tracking-wide uppercase">Operator access</h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-dim">
            This agent requires a bearer token for <span className="font-mono text-fg">POST /cycle</span> and{" "}
            <span className="font-mono text-fg">POST /kill</span>. Visitors without it get a read-only dashboard. The token is stored only in this browser.
          </p>
          {token ? (
            <p className={`mt-3 text-xs ${rejected ? "text-neg" : "text-pos"}`}>
              {rejected ? "The saved token was rejected by the agent (401). Paste a new one or clear it." : `A token is saved (…${token.slice(-4)}).`}
            </p>
          ) : null}
          <label className="mt-4 block text-[11px] tracking-wide text-faint uppercase" htmlFor="op-token">
            Operator token
          </label>
          <input
            id="op-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="paste token"
            className="mt-1 h-9 w-full rounded-md border border-line-strong bg-bg px-3 font-mono text-sm text-fg outline-none placeholder:text-faint focus:border-accent/60"
          />
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {token ? (
              <button value="clear" className="mr-auto h-8 rounded-md px-2 text-sm text-neg hover:bg-neg/10">
                Clear token
              </button>
            ) : null}
            <button value="cancel" className="h-8 rounded-md border border-line-strong px-3 text-sm text-fg hover:bg-panel-2">
              Cancel
            </button>
            <button value="save" disabled={!draft.trim()} className="h-8 rounded-md bg-accent px-3 text-sm font-semibold text-bg hover:bg-accent/90 disabled:opacity-40">
              Save token
            </button>
          </div>
        </form>
      </dialog>
    </header>
  );
}
