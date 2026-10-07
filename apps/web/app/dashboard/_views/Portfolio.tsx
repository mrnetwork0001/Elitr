"use client";
import { useDashboard } from "@/lib/dashboard";
import { WalletStrip } from "@/components/WalletStrip";
import { Portfolio } from "@/components/Portfolio";
import { WalletApiCard } from "@/components/WalletApiCard";

export function PortfolioView() {
  const d = useDashboard();
  return (
    <>
      <WalletStrip state={d.state} status={d.stateStatus} events={d.events} fetchedAt={d.fetchedAt} now={d.now} assets={d.assets} portfolioUsd={d.portfolio.valueUsd} />
      <Portfolio data={d.portfolio} state={d.state} events={d.events} executionOffline={d.conn.execution?.status === "offline" && d.stateStatus !== "ok"} now={d.now} />
      <WalletApiCard state={d.state} status={d.stateStatus} now={d.now} />
    </>
  );
}
