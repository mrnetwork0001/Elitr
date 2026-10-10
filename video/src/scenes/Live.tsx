import React from "react";
import { C, mono } from "../theme";
import { ramp } from "../ui/motion";
import { Browser } from "../ui/Footage";
import { Card, Fill, Hash, Label, useCue } from "./common";

/** Paper: the live trades page; a real buy, then the stop-loss sell the trader made on its own. */
export const Live: React.FC = () => {
  const { f, rel } = useCue("live");
  const tBought = rel("bought");
  const tStop = rel("stop-loss");
  const tSold = rel("sold");
  const tSmall = rel("Small");
  const line = (k: string, v: React.ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 20, fontFamily: mono, fontSize: 19, color: C.dim, marginTop: 8 }}><span>{k}</span><span style={{ color: C.ink, textAlign: "right" }}>{v}</span></div>
  );
  return (
    <Fill bg={C.paper}>
      <Browser name="trades" url="elitr.xyz/dashboard/trades" width={1080} left={90} top={150} light
        cams={[{ f: 0, z: 1 }, { f: tBought - 6, rect: { x: 321, y: 334, w: 1230, h: 94 }, z: 1.45 }, { f: tStop - 6, rect: { x: 321, y: 216, w: 1230, h: 119 }, z: 1.45 }, { f: tSmall + 10, z: 1 }]} />
      <Card at={tBought - 4} left={1220} top={160} width={620}>
        <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: "0.12em", color: C.goldDeep }}>BUY · 7 OCT 13:00 UTC</div>
        {line("paid", "2.00 USDT")}
        {line("got", "0.008433 NVDAB @ $237.15")}
        {line("tx", <Hash h="0x0ce91120…3807" />)}
      </Card>
      <Card at={tStop - 4} left={1220} top={410} width={620} style={{ borderTop: `3px solid ${C.neg}` }}>
        <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: "0.12em", color: C.negDeep }}>STOP-LOSS FIRED · 8 OCT 17:16 UTC</div>
        {line("mark", "231.90 ≤ 232.41 (cost − 200 bps)")}
        {line("sold", "0.008433 NVDAB → 1.96 USDT")}
        {line("tx", <Hash h="0x37ff1c71…3b11" />)}
      </Card>
      <div style={{ position: "absolute", left: 1220, top: 670, width: 620, padding: "18px 26px", background: C.ink, color: C.gold, fontFamily: mono, fontSize: 24, letterSpacing: "0.08em", boxSizing: "border-box", opacity: ramp(f, tSold - 2, tSold + 10) }}>
        NO HUMAN IN THE LOOP
      </div>
      <div style={{ position: "absolute", left: 1220, top: 770, width: 620, display: "flex", gap: 12, flexWrap: "wrap", opacity: ramp(f, tSmall - 4, tSmall + 10) }}>
        {["max trade $5", "max position $25", "data ≤ $1 / day"].map((t) => (
          <span key={t} style={{ fontFamily: mono, fontSize: 20, padding: "8px 14px", border: `1px solid ${C.lineLight}`, background: C.white, color: C.ink }}>{t}</span>
        ))}
      </div>
      <Label color={C.dim} dot={C.goldDeep} style={{ position: "absolute", left: 92, top: 96, opacity: ramp(f, 0, 12) }}>bsc mainnet · real fills · quote → simulate → broadcast</Label>
    </Fill>
  );
};
