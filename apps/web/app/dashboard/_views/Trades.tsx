"use client";
import { useDashboard } from "@/lib/dashboard";
import { TradeLog } from "@/components/TradeLog";

export function TradesView() {
  const d = useDashboard();
  return <TradeLog events={d.events} assets={d.assets} execution={d.conn.execution?.status ?? "offline"} liveTrading={d.state?.liveTrading ?? null} now={d.now} />;
}
