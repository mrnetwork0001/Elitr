import React from "react";
import { C, mono } from "../theme";
import { ramp } from "../ui/motion";
import { Browser } from "../ui/Footage";
import { Card, Fill, Label, useCue } from "./common";

/** Paper: the two sellers, each its own ERC-8004 agent, over the live Analysts view. */
export const Sellers: React.FC = () => {
  const { f, rel } = useCue("sellers");
  const tTwo = rel("Two");
  const tNews = rel("news");
  const tSwaps = rel("swaps");
  const tCent = rel("cent.");
  const row = (k: string, v: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 18, color: C.dim, marginTop: 10 }}><span>{k}</span><span style={{ color: C.ink }}>{v}</span></div>
  );
  return (
    <Fill bg={C.paper}>
      <Label color={C.dim} dot={C.goldDeep} style={{ position: "absolute", left: 110, top: 150, opacity: ramp(f, tTwo - 4, tTwo + 10) }}>two sellers · one buyer</Label>
      <Card at={tNews - 4} left={110} top={210} width={600}>
        <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em", color: C.info }}>News analyst</div>
        <div style={{ fontSize: 24, color: C.dim, marginTop: 6 }}>Reads the news. Claude scores it 1 to 100.</div>
        {row("sources", "Yahoo Finance · Google News")}
        {row("ERC-8004", "agent #365554")}
      </Card>
      <Card at={tSwaps - 6} left={110} top={500} width={600}>
        <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em", color: C.flow }}>Flow analyst</div>
        <div style={{ fontSize: 24, color: C.dim, marginTop: 6 }}>Reads live PancakeSwap v3 swaps, on-chain.</div>
        {row("window", "last 60 min · min 5 swaps")}
        {row("ERC-8004", "agent #365555")}
      </Card>
      <div style={{ position: "absolute", left: 110, top: 800, display: "flex", alignItems: "baseline", gap: 18, opacity: ramp(f, tCent - 6, tCent + 6) }}>
        <span style={{ fontSize: 96, fontWeight: 600, letterSpacing: "-0.05em", color: C.ink }}>$0.01</span>
        <span style={{ fontFamily: mono, fontSize: 22, color: C.goldDeep, letterSpacing: "0.1em" }}>PER SIGNAL · OVER B402</span>
      </div>
      <Browser name="analysts" url="elitr.xyz/dashboard/analysts" width={1060} left={770} top={180} enter={tTwo - 8} light
        cams={[{ f: 0, z: 1 }, { f: tNews, rect: { x: 321, y: 226, w: 600, h: 240 }, z: 1.7 }, { f: tSwaps - 4, rect: { x: 942, y: 226, w: 610, h: 240 }, z: 1.7 }, { f: tCent + 10, rect: { x: 304, y: 168, w: 1264, h: 560 }, z: 1.15 }]} stopAt={180} />
    </Fill>
  );
};
