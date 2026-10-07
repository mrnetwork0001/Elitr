import type { Metadata } from "next";
import { DashboardShell } from "@/components/DashboardShell";

export const metadata: Metadata = {
  title: { default: "Dashboard · Elitr", template: "%s · Elitr" },
  description: "Live view of the Elitr analyst and execution agents: b402 pay-per-signal, risk checks and tokenized-stock execution on BSC.",
};

// The shell owns the live data (three SSE streams + the /state poll) so it persists across views.
export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>;
}
