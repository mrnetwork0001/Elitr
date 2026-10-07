"use client";
import { useEffect, useMemo, useState } from "react";
import { useAgentStream } from "@/lib/useAgentStream";
import { useExecutionState } from "@/lib/useExecutionState";
import { useOperatorToken } from "@/lib/useOperatorToken";
import { useAnalystInfo } from "@/lib/useAnalystInfo";
import { useNow } from "@/lib/useNow";
import { symbolsSeen } from "@/lib/derive";
import { ago, ruleLabel } from "@/lib/format";
import { AGENTS, DEFAULT_ASSETS } from "@/lib/config";
import { TopBar } from "@/components/TopBar";
import { WalletStrip } from "@/components/WalletStrip";
import { AgentFlow } from "@/components/AgentFlow";
import { AnalystMarket, analystCards } from "@/components/AnalystMarket";
import { Portfolio, portfolioData } from "@/components/Portfolio";
import { SignalCard } from "@/components/SignalCard";
import { PriceCard } from "@/components/PriceCard";
import { RiskPanel } from "@/components/RiskPanel";
import { TradeLog } from "@/components/TradeLog";
import { Timeline } from "@/components/Timeline";
import { AssetTabs, IconBolt } from "@/components/ui";

const ASSET_KEY = "elitr.asset";

export default function Dashboard() {
  const { events, conn, liveIds } = useAgentStream();
  const { token, setToken } = useOperatorToken();
  const exec = useExecutionState(5000, token);
  const info = useAnalystInfo();
  const now = useNow(1000);
  const killed = exec.status === "ok" && exec.state?.killSwitch === true;

  // Asset tabs: configured traded assets, plus anything the agent reports or streams.
  const assets = useMemo(() => {
    const out = [...DEFAULT_ASSETS];
    for (const a of exec.state?.assets ?? []) if (!out.includes(a.symbol)) out.push(a.symbol);
    for (const s of symbolsSeen(events)) if (s && !out.includes(s)) out.push(s);
    return out;
  }, [exec.state?.assets, events]);
  const [asset, setAssetState] = useState(DEFAULT_ASSETS[0]);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ASSET_KEY);
      if (saved) setAssetState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const setAsset = (a: string) => {
    setAssetState(a);
    try {
      window.localStorage.setItem(ASSET_KEY, a);
    } catch {
      /* ignore */
    }
  };
  const current = assets.includes(asset) ? asset : assets[0];

  const cards = analystCards(events, exec.state, info, conn);
  const nameOf = (id: string) => cards.find((c) => c.id === id)?.name ?? AGENTS.find((a) => a.id === id)?.name ?? id;
  const portfolio = portfolioData(exec.state, exec.status, events, exec.fetchedAt);
  // risk.blocked with symbol "*" applies to every asset (e.g. kill switch) — shown globally, not under a tab.
  const globalBlock = events.find((e) => e.type === "risk.blocked" && e.symbol === "*") as Extract<(typeof events)[number], { type: "risk.blocked" }> | undefined;
  const lastEval = events.find((e) => e.type === "risk.evaluated");
  const showGlobalBlock = !!globalBlock && (!lastEval || globalBlock.ts >= lastEval.ts - 1000) && !(killed && globalBlock.rule === "killSwitch");
  const analystsOffline = conn.analyst?.status === "offline" && conn["analyst-flow"]?.status === "offline";

  return (
    <>
      <TopBar
        conn={conn}
        state={exec.state}
        stateStatus={exec.status}
        now={now}
        runCycle={exec.runCycle}
        engageKill={exec.engageKill}
        token={token}
        setToken={setToken}
      />

      {killed ? (
        <div role="alert" className="border-b border-neg/50 bg-neg/10">
          <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-2 text-xs text-neg lg:px-6">
            <IconBolt />
            <span className="font-semibold tracking-wide uppercase">Kill switch engaged</span>
            <span className="text-fg/80">— the execution agent will not open any trades.</span>
          </div>
        </div>
      ) : null}

      {showGlobalBlock && globalBlock ? (
        <div role="alert" className="border-b border-warn/40 bg-warn/10">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2 text-xs lg:px-6">
            <span className="font-semibold tracking-wide text-warn uppercase">All assets blocked · {ruleLabel(globalBlock.rule)}</span>
            <span className="min-w-0 break-words text-fg/80">{globalBlock.detail}</span>
            <span suppressHydrationWarning className="num ml-auto text-faint">{now ? ago(globalBlock.ts, now) : ""}</span>
          </div>
        </div>
      ) : null}

      <main className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:px-6 lg:py-5">
        <WalletStrip state={exec.state} status={exec.status} events={events} fetchedAt={exec.fetchedAt} now={now} assets={assets} portfolioUsd={portfolio.valueUsd} />

        <AgentFlow events={events} conn={conn} liveIds={liveIds} now={now} nameOf={nameOf} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <AnalystMarket events={events} state={exec.state} stateStatus={exec.status} info={info} conn={conn} assets={assets} now={now} />
          <Portfolio data={portfolio} state={exec.state} events={events} executionOffline={conn.execution?.status === "offline" && exec.status !== "ok"} now={now} />
        </div>

        <section aria-label={`${current} detail`} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[11px] font-medium tracking-[0.12em] text-dim uppercase">
              Per-asset view <span className="text-faint normal-case tracking-normal">· signal, prices and risk for one token</span>
            </h2>
            <AssetTabs assets={assets} value={current} onChange={setAsset} label="Select asset" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <SignalCard events={events} symbol={current} analystsOffline={analystsOffline} now={now} nameOf={nameOf} />
            <PriceCard events={events} symbol={current} execution={conn.execution?.status ?? "offline"} now={now} />
            <RiskPanel events={events} symbol={current} execution={conn.execution?.status ?? "offline"} now={now} />
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <TradeLog events={events} assets={assets} execution={conn.execution?.status ?? "offline"} liveTrading={exec.state?.liveTrading ?? null} now={now} />
          <Timeline events={events} conn={conn} liveIds={liveIds} />
        </div>

        <footer className="flex flex-wrap justify-between gap-2 pt-2 pb-6 font-mono text-[11px] text-faint">
          <span className="min-w-0 break-all">{AGENTS.map((a) => `${a.id} ${a.url}`).join(" · ")}</span>
          <span>every figure on this page comes from agent events — nothing is simulated for display</span>
        </footer>
      </main>
    </>
  );
}
