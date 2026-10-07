"use client";
import { useState } from "react";
import type { AgentEvent } from "@elitr/shared";
import type { ConnStatus } from "@/lib/useAgentStream";
import { baseSymbol, tradeAttempts, type TradeAttempt } from "@/lib/derive";
import { BSCSCAN_TX } from "@/lib/config";
import { ago, clock, isTxHash, num, price, shortHash, signedUsd, toneOf, tokenAmount, usd } from "@/lib/format";
import { AssetTabs, Badge, Empty, ExtLink, IconCheck, IconX, ModeTag, Panel } from "./ui";

type StageState = "ok" | "fail" | "pending" | "skipped";

const EXIT_LABEL: Record<string, string> = { takeProfit: "take profit", stopLoss: "stop loss", bearish: "bearish exit" };

function Stage({ label, state, children }: { label: string; state: StageState; children?: React.ReactNode }) {
  const dot =
    state === "ok"
      ? "bg-pos/15 text-pos border-pos/40"
      : state === "fail"
        ? "bg-neg/15 text-neg border-neg/50"
        : state === "pending"
          ? "border-warn/50 text-warn"
          : "border-line-strong border-dashed text-faint";
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <span className={`grid size-5 shrink-0 place-items-center rounded-full border text-[10px] ${dot}`}>
          {state === "ok" ? <IconCheck /> : state === "fail" ? <IconX /> : state === "pending" ? "…" : ""}
        </span>
        <span className={`truncate text-xs ${state === "skipped" ? "text-faint" : "text-fg"}`}>{label}</span>
      </div>
      <div className="mt-1 min-w-0 pl-6.5 text-[11px] break-words text-dim">{children}</div>
    </div>
  );
}

function Connector({ on }: { on: boolean }) {
  return <div className={`mt-2.5 h-px w-3 shrink-0 sm:w-6 ${on ? "bg-line-strong" : "bg-line"}`} aria-hidden />;
}

function Attempt({ a, now, liveTrading, isLatest }: { a: TradeAttempt; now: number; liveTrading: boolean | null; isLatest: boolean }) {
  const sim = a.simulated;
  const fill = a.filled;
  const paper = fill?.mode === "paper";
  const simState: StageState = sim ? (sim.ok ? "ok" : "fail") : "skipped";
  const bState: StageState = a.broadcast ? "ok" : sim && !sim.ok ? "skipped" : !paper && isLatest && liveTrading && sim?.ok && !fill ? "pending" : "skipped";
  const fState: StageState = fill ? "ok" : a.confirmed ? "ok" : a.broadcast ? (a.errors.length ? "fail" : "pending") : "skipped";
  const outcome = fill
    ? paper
      ? { t: "Paper fill", c: "text-info" }
      : { t: "Filled", c: "text-pos" }
    : a.confirmed
      ? { t: "Confirmed", c: "text-pos" }
      : a.errors.length || (sim && !sim.ok)
        ? { t: "Failed", c: "text-neg" }
        : a.broadcast
          ? { t: "Pending", c: "text-warn" }
          : sim?.ok
            ? { t: liveTrading ? "Not broadcast" : "Simulated only", c: "text-dim" }
            : { t: "—", c: "text-faint" };
  const exit = a.decision?.exitReason;

  return (
    <li className="py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {a.side ? <Badge tone={a.side === "buy" ? "accent" : "info"}>{a.side}</Badge> : null}
          <span className="font-mono text-fg">{a.symbol}</span>
          {exit ? <Badge tone={exit === "takeProfit" ? "pos" : "neg"}>{EXIT_LABEL[exit] ?? exit}</Badge> : null}
          <span className="num text-faint" title={new Date(a.startedAt).toLocaleString()}>
            {clock(a.startedAt)}
          </span>
          <span suppressHydrationWarning className="num text-faint">{now ? `· ${ago(a.startedAt, now)}` : ""}</span>
        </div>
        <span className="flex items-center gap-1.5">
          {fill ? <ModeTag mode={fill.mode} /> : null}
          <span className={`text-[11px] font-semibold tracking-wide uppercase ${outcome.c}`}>{outcome.t}</span>
        </span>
      </div>
      <div className="flex items-start">
        <Stage label="Simulated" state={simState}>
          {sim ? (sim.ok ? (sim.gasUsed ? <span className="num">gas {num(Number(sim.gasUsed), 0)}</span> : "no revert") : "reverted") : "not run"}
        </Stage>
        <Connector on={!!a.broadcast} />
        <Stage label="Broadcast" state={bState}>
          {a.broadcast ? (
            isTxHash(a.broadcast.txHash) ? (
              <ExtLink href={BSCSCAN_TX(a.broadcast.txHash)} className="font-mono">
                {shortHash(a.broadcast.txHash)}
              </ExtLink>
            ) : (
              <span className="font-mono">{a.broadcast.txHash}</span>
            )
          ) : paper ? (
            <span className="text-info">not broadcast · paper</span>
          ) : bState === "pending" ? (
            "awaiting"
          ) : liveTrading === false ? (
            "paper mode"
          ) : (
            "—"
          )}
        </Stage>
        <Connector on={!!(a.confirmed || fill)} />
        <Stage label={paper ? "Booked" : "Filled"} state={fState}>
          {fill ? (
            <span className="num">
              {num(fill.qty, 6)} @ {price(fill.priceUsd)}
              <span className="text-faint"> · {usd(fill.usd)}</span>
            </span>
          ) : a.confirmed ? (
            <span className="num">
              {tokenAmount(a.confirmed.amountIn)} → {tokenAmount(a.confirmed.amountOut)}
            </span>
          ) : fState === "pending" ? (
            "waiting for receipt"
          ) : (
            "—"
          )}
        </Stage>
      </div>
      {fill && fill.side === "sell" && typeof fill.realizedUsd === "number" ? (
        <div className="mt-2 pl-6.5 text-[11px] text-dim">
          realized <span className={`num font-medium ${toneOf(fill.realizedUsd)}`}>{signedUsd(fill.realizedUsd)}</span>
          {paper ? <span className="text-info"> (paper)</span> : null}
        </div>
      ) : null}
      {sim && !sim.ok && sim.error ? (
        <pre className="mt-2 overflow-x-auto rounded border border-neg/30 bg-neg/5 px-2 py-1.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all text-neg">{sim.error}</pre>
      ) : null}
      {a.errors.map((e) => (
        <pre key={e.id} className="mt-2 overflow-x-auto rounded border border-neg/30 bg-neg/5 px-2 py-1.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all text-neg">
          <span className="text-neg/70">[{e.where}] </span>
          {e.message}
        </pre>
      ))}
    </li>
  );
}

export function TradeLog({
  events,
  assets,
  execution,
  liveTrading,
  now,
}: {
  events: AgentEvent[];
  assets: string[];
  execution: ConnStatus;
  liveTrading: boolean | null;
  now: number;
}) {
  const [filter, setFilter] = useState("all");
  const all = tradeAttempts(events);
  const attempts = filter === "all" ? all : all.filter((a) => baseSymbol(a.symbol) === filter);
  const filled = attempts.filter((a) => a.filled || a.confirmed).length;

  return (
    <Panel
      title="Execution log"
      id="trades"
      right={
        <>
          {attempts.length ? <span className="num hidden sm:inline">{attempts.length} · {filled} filled</span> : null}
          <AssetTabs assets={assets} value={filter} onChange={setFilter} allowAll label="Filter trades by asset" />
        </>
      }
      bodyClassName="py-0"
    >
      {attempts.length === 0 ? (
        execution === "offline" && all.length === 0 ? (
          <Empty tone="offline" title="Execution agent offline" hint="Trade attempts (simulate → broadcast → fill) stream from the execution agent." />
        ) : (
          <Empty
            title={filter === "all" ? "No trade attempts yet" : `No ${filter} trade attempts yet`}
            hint="An attempt starts when a buy or exit clears every risk check and the swap is simulated via the Binance Transaction API."
          />
        )
      ) : (
        <ol className="divide-y divide-line">
          {attempts.slice(0, 30).map((a, i) => (
            <Attempt key={a.key} a={a} now={now} liveTrading={liveTrading} isLatest={i === 0} />
          ))}
        </ol>
      )}
    </Panel>
  );
}
