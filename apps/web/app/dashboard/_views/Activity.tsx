"use client";
import { useDashboard } from "@/lib/dashboard";
import { Timeline } from "@/components/Timeline";

export function ActivityView() {
  const d = useDashboard();
  return <Timeline events={d.events} conn={d.conn} liveIds={d.liveIds} />;
}
