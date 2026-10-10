import React from "react";
import { useCurrentFrame } from "remotion";
import { C, mono, sans } from "../theme";
import { pop, ramp } from "../ui/motion";
import { K } from "../timing";
import { Browser } from "../ui/Footage";
import { Count } from "../ui/Count";
import { Fill, Label, useCue } from "./common";

const Stamp: React.FC<{ at: number; text: string; sub: string; color: string; top: number }> = ({ at, text, sub, color, top }) => {
  const f = useCurrentFrame() / K;
  const p = pop(f, at);
  return (
    <div style={{ position: "absolute", left: 1270, top, width: 600, padding: "18px 24px", border: `4px solid ${color}`, color, opacity: Math.min(1, p * 1.4), transform: `rotate(-3deg) scale(${1.25 - 0.25 * p})`, boxSizing: "border-box" }}>
      <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 500, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{text}</div>
      <div style={{ fontFamily: mono, fontSize: 16, letterSpacing: "0.04em", marginTop: 6, opacity: 0.85, whiteSpace: "nowrap" }}>{sub}</div>
    </div>
  );
};

/** Dark: the live risk-check panel scrolls by; fourteen checks, a Transaction API dry run, fail closed. */
export const Risk: React.FC = () => {
  const { f, rel } = useCue("risk");
  const t14 = rel("Fourteen");
  const tDry = rel("dry-runs");
  const tNothing = rel("nothing");
  return (
    <Fill bg={C.night}>
      <Browser name="markets" url="elitr.xyz/dashboard/markets" width={1120} left={90} top={150} startFrom={40}
        cams={[{ f: 0, z: 1 }, { f: 100, rect: { x: 944, y: 60, w: 624, h: 640 }, z: 1.45 }, { f: 360, rect: { x: 944, y: 60, w: 624, h: 640 }, z: 1.45 }]} />
      <div style={{ position: "absolute", left: 1290, top: 170, opacity: ramp(f, t14 - 4, t14 + 8) }}>
        <div style={{ fontSize: 190, fontWeight: 600, letterSpacing: "-0.06em", lineHeight: 0.9, color: C.gold }}><Count to={14} at={t14 - 2} dur={24} /></div>
        <div style={{ fontFamily: sans, fontSize: 40, fontWeight: 500, letterSpacing: "-0.03em", color: C.text, marginTop: 8 }}>hard checks before a buy</div>
        <div style={{ fontFamily: mono, fontSize: 17, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>confidence ≥ 65 · gap ≥ 50 bps · liquidity ≥ $50k<br />trade ≤ $5 · position ≤ $25 · daily ≤ $25 · data ≤ $1</div>
      </div>
      <Stamp at={tDry + 2} text="DRY RUN · OK" sub="Binance Transaction API /simulate · every tx" color={C.gold} top={600} />
      <Stamp at={tNothing} text="ANY FAIL → NO SIGNATURE" sub="the trader fails closed" color="#ff6b81" top={770} />
      <Label color={C.muted} style={{ position: "absolute", left: 92, top: 96, opacity: ramp(f, 0, 12) }}>risk engine · live buy-side checks</Label>
    </Fill>
  );
};
