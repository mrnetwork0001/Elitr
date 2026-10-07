import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard · Elitr",
  description: "Live view of the Elitr analyst and execution agents: b402 pay-per-signal, risk checks and tokenized-stock execution on BSC.",
};

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
