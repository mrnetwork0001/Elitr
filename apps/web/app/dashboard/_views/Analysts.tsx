"use client";
import { useDashboard } from "@/lib/dashboard";
import { AnalystMarket } from "@/components/AnalystMarket";

export function AnalystsView() {
  const d = useDashboard();
  return <AnalystMarket events={d.events} state={d.state} stateStatus={d.stateStatus} info={d.info} conn={d.conn} assets={d.assets} now={d.now} />;
}
