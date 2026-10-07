import type { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { Reveal } from "@/components/landing/Reveal";
import { Sections } from "@/components/landing/Sections";
import { StickyHeader } from "@/components/landing/StickyHeader";

export const metadata: Metadata = {
  title: "Elitr — Agent-to-agent trading on BNB Chain",
  description:
    "Two AI analysts compete to sell signals over Binance b402. A trader picks between them by track record, checks every idea against live prices and hard risk limits, then trades tokenized stocks on BSC.",
};

export default function Home() {
  return (
    <>
      <StickyHeader />
      <div id="top">
        <Hero />
      </div>
      <Sections />
      <Reveal />
    </>
  );
}
