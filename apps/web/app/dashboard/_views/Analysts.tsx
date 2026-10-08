"use client";
import { useDashboard } from "@/lib/dashboard";
import { AnalystMarket } from "@/components/AnalystMarket";
import { OnchainIdentities } from "@/components/OnchainIdentities";

export function AnalystsView() {
  const d = useDashboard();
  return (
    <div className="flex flex-col gap-5">
      <AnalystMarket events={d.events} state={d.state} stateStatus={d.stateStatus} info={d.info} conn={d.conn} assets={d.assets} now={d.now} />
      <OnchainIdentities />
    </div>
  );
}
