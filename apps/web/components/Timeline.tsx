"use client";
import { useMemo, useState } from "react";
import type { AgentEvent, AgentId } from "@elitr/shared";
import type { AgentConn } from "@/lib/useAgentStream";
import { GROUP_LABEL, groupOf, type EventGroup } from "@/lib/derive";
import { BSCSCAN_TX } from "@/lib/config";
import { assetSymbol, clock, isTxHash, price, shortAddr, shortHash, usd, usdFromUnits } from "@/lib/format";
import { AGENTS, agentMeta } from "@/lib/config";
import { Empty, ExtLink, IconChevron, Panel } from "./ui";

function summary(e: AgentEvent): string {
  switch (e.type) {
    case "payment.required":
      return `402 challenge ${usdFromUnits(e.amount)} ${assetSymbol(e.asset)} for ${e.resource}`;
    case "payment.sent":
      return `Paid ${usdFromUnits(e.amount)} ${assetSymbol(e.asset)} → ${shortAddr(e.payTo)}`;
    case "payment.verified":
      return `Verified ${usdFromUnits(e.amount)} ${assetSymbol(e.asset)} from ${shortAddr(e.payer)}`;
    case "signal.produced":
      return `${e.symbol} confidence ${e.score}/100`;
    case "price.reference":
      return `${e.symbol} reference ${price(e.price)} (${e.source})`;
    case "price.onchain":
      return `${e.symbol} on-chain ${price(e.price)} (${e.source})`;
    case "decision":
      return `${e.action.toUpperCase()} ${e.symbol}${e.exitReason ? ` (${e.exitReason})` : ""}${e.reasons?.[0] ? ` — ${e.reasons[0]}` : ""}`;
    case "risk.evaluated": {
      const f = e.checks?.filter((c) => !c.ok).map((c) => c.rule) ?? [];
      return `${e.symbol} ${e.passed ? "PASS" : "BLOCKED"} (${e.checks?.length ?? 0} rules${f.length ? `, failing: ${f.join(", ")}` : ""})`;
    }
    case "risk.blocked":
      return `Blocked by ${e.rule}: ${e.detail}`;
    case "tx.simulated":
      return `${e.side ? e.side + " " : ""}${e.symbol} simulation ${e.ok ? "ok" : "reverted"}${e.error ? ` — ${e.error}` : ""}`;
    case "tx.broadcast":
      return `${e.symbol} broadcast ${shortHash(e.txHash)}`;
    case "tx.confirmed":
      return `${e.symbol} confirmed ${shortHash(e.txHash)}`;
    case "signal.received":
      return `${e.symbol} from ${e.analystId}: ${e.score}/100 ${e.stance} × ${e.weight.toFixed(2)} = ${Math.round(e.effectiveScore)}`;
    case "signal.scored":
      return `${e.analystId} ${e.symbol} ${e.stance} call ${e.correct ? "correct" : "wrong"} (${e.returnBps >= 0 ? "+" : ""}${Math.round(e.returnBps)} bps)`;
    case "analyst.selected":
      return `${e.symbol} → ${e.analystId ?? "none"}${e.reasons?.[0] ? ` — ${e.reasons[0]}` : ""}`;
    case "reputation.updated":
      return `${e.stats.analystId} trust ${e.stats.trust.toFixed(2)}, hit ${e.stats.hitRate !== null ? Math.round(e.stats.hitRate * 100) + "%" : "—"} over ${e.stats.samples}${e.stats.paused ? " · PAUSED" : ""}`;
    case "reputation.posted":
      return e.error ? `ERC-8004 rating for ${e.analystId} failed: ${e.error}` : `Rated ${e.analystId} (#${e.erc8004AgentId}) on-chain: ${e.value} ${e.tag}`;
    case "identity.registered":
      return `${e.subject} registered as ERC-8004 agent #${e.erc8004AgentId}`;
    case "trade.filled":
      return `${e.mode.toUpperCase()} ${e.side.toUpperCase()} ${e.qty} ${e.symbol} @ ${price(e.priceUsd)} (${usd(e.usd)})${typeof e.realizedUsd === "number" ? ` realized ${usd(e.realizedUsd)}` : ""}`;
    case "position.updated":
      return `${e.mode} position ${e.position.symbol}: ${e.position.qty} @ ${price(e.position.avgCostUsd)}`;
    case "pnl.snapshot":
      return `${e.mode} net P&L ${usd(e.netUsd)} (realized ${usd(e.realizedUsd)}, unrealized ${usd(e.unrealizedUsd)})`;
    case "error":
      return `[${e.where}] ${e.message}`;
    default: {
      const unknown = e as { type: string };
      return unknown.type;
    }
  }
}

function txOf(e: AgentEvent): string | undefined {
  const h = (e as { txHash?: unknown }).txHash;
  return isTxHash(h) ? h : undefined;
}

const GROUP_TONE: Record<EventGroup, string> = {
  payment: "text-accent",
  signal: "text-fg",
  market: "text-flow",
  price: "text-info",
  risk: "text-warn",
  decision: "text-fg",
  tx: "text-pos",
  portfolio: "text-info",
  error: "text-neg",
};

const GROUPS = Object.keys(GROUP_LABEL) as EventGroup[];
const PAGE = 100;

export function Timeline({
  events,
  conn,
  liveIds,
}: {
  events: AgentEvent[];
  conn: Record<AgentId, AgentConn>;
  liveIds: ReadonlySet<string>;
}) {
  const [agent, setAgent] = useState<AgentId | "all">("all");
  const [groups, setGroups] = useState<Set<EventGroup>>(() => new Set());
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [limit, setLimit] = useState(PAGE);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events) {
      if (agent !== "all" && e.agent !== agent) continue;
      const g = groupOf(e.type);
      c[g] = (c[g] ?? 0) + 1;
    }
    return c;
  }, [events, agent]);

  const filtered = useMemo(
    () => events.filter((e) => (agent === "all" || e.agent === agent) && (groups.size === 0 || groups.has(groupOf(e.type)))),
    [events, agent, groups],
  );

  const toggleGroup = (g: EventGroup) =>
    setGroups((s) => {
      const n = new Set(s);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });

  const toggleOpen = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const chip = (active: boolean) =>
    `h-6 rounded border px-2 text-[11px] whitespace-nowrap transition-colors ${
      active ? "border-fg/60 bg-panel-2 text-fg" : "border-line text-dim hover:border-line-strong hover:text-fg"
    }`;

  const bothOffline = Object.values(conn).every((c) => c.status === "offline");

  return (
    <Panel title="Event timeline" id="timeline" right={<span className="num">{filtered.length} / {events.length}</span>} bodyClassName="flex flex-col gap-3 p-0">
      <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5" role="toolbar" aria-label="Filter events">
        {(["all", ...AGENTS.map((a) => a.id)] as const).map((a) => (
          <button key={a} type="button" aria-pressed={agent === a} className={chip(agent === a)} onClick={() => setAgent(a)}>
            {a === "all" ? "All agents" : (agentMeta(a)?.name ?? a)}
          </button>
        ))}
        <span className="mx-1 w-px self-stretch bg-line" aria-hidden />
        {GROUPS.map((g) => (
          <button key={g} type="button" aria-pressed={groups.has(g)} className={chip(groups.has(g))} onClick={() => toggleGroup(g)}>
            {GROUP_LABEL[g]}
            <span className="num ml-1 text-faint">{counts[g] ?? 0}</span>
          </button>
        ))}
        {groups.size ? (
          <button type="button" className="h-6 px-1.5 text-[11px] text-faint hover:text-fg" onClick={() => setGroups(new Set())}>
            clear
          </button>
        ) : null}
      </div>

      {events.length === 0 ? (
        bothOffline ? (
          <Empty tone="offline" title="No agents reachable" hint="The timeline replays each agent's recent history as soon as its /events stream connects." />
        ) : (
          <Empty title="Waiting for events…" hint="Every payment, signal, price, risk check and transaction appears here, newest first." />
        )
      ) : filtered.length === 0 ? (
        <Empty title="No events match these filters" />
      ) : (
        <ol className="max-h-[560px] overflow-y-auto pb-2 font-mono text-xs">
          {filtered.slice(0, limit).map((e) => {
            const g = groupOf(e.type);
            const isOpen = open.has(e.id);
            const tx = txOf(e);
            return (
              <li key={e.id} className={`border-b border-line/60 last:border-0 ${liveIds.has(e.id) ? "row-flash" : ""}`}>
                <button
                  type="button"
                  onClick={() => toggleOpen(e.id)}
                  aria-expanded={isOpen}
                  className="grid w-full grid-cols-[auto_auto_minmax(0,1fr)] items-baseline gap-x-3 px-4 py-1.5 text-left hover:bg-panel-2 sm:grid-cols-[auto_auto_8.5rem_minmax(0,1fr)]"
                >
                  <span className="num text-faint">{clock(e.ts)}</span>
                  <span className={`w-3 text-center text-[10px] font-bold ${agentMeta(e.agent)?.tone ?? "text-faint"}`} title={agentMeta(e.agent)?.name ?? e.agent}>
                    {agentMeta(e.agent)?.tag ?? "?"}
                  </span>
                  <span className={`hidden truncate sm:block ${GROUP_TONE[g]}`}>{e.type}</span>
                  <span className="flex min-w-0 items-baseline gap-1.5 font-sans text-fg/90">
                    <span className="text-faint">
                      <IconChevron open={isOpen} />
                    </span>
                    <span className={`truncate ${e.type === "error" ? "text-neg" : ""}`}>
                      <span className={`mr-1.5 font-mono sm:hidden ${GROUP_TONE[g]}`}>{e.type}</span>
                      {summary(e)}
                    </span>
                  </span>
                </button>
                {isOpen ? (
                  <div className="px-4 pb-3">
                    {tx ? (
                      <div className="mb-1.5 font-sans">
                        <ExtLink href={BSCSCAN_TX(tx)}>View on BscScan</ExtLink>
                      </div>
                    ) : null}
                    <pre className="overflow-x-auto rounded border border-line bg-bg px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all text-dim">
                      {JSON.stringify(e, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </li>
            );
          })}
          {filtered.length > limit ? (
            <li className="px-4 pt-2">
              <button type="button" className="text-[11px] text-dim hover:text-fg" onClick={() => setLimit((l) => l + PAGE)}>
                Show {Math.min(PAGE, filtered.length - limit)} more ({filtered.length - limit} older)
              </button>
            </li>
          ) : null}
        </ol>
      )}
    </Panel>
  );
}
