import React from "react";
import { C, mono } from "../theme";
import { ramp } from "../ui/motion";
import { Browser } from "../ui/Footage";
import { Count } from "../ui/Count";
import { Fill, In, useCue } from "./common";

/** Full-bleed gold: the real weekend gap (CRCLB +1.1% over Friday's close), on the live gap board; then the three needs. */
export const Gap: React.FC = () => {
  const { f, rel } = useCue("gap");
  const tCircle = rel("Circle's");
  const tOne = rel("one");
  const tInfo = rel("information,");
  const tPay = rel("pay");
  const tTrust = rel("trust");
  const needs: [string, string, number][] = [["01", "Information", tInfo], ["02", "A way to pay for it", tPay], ["03", "A reason to trust the seller", tTrust]];
  return (
    <Fill bg={C.gold}>
      <div style={{ position: "absolute", left: 130, top: 150, width: 720, color: C.ink }}>
        <In at={tCircle - 4}><div style={{ fontFamily: mono, fontSize: 22, letterSpacing: "0.12em" }}>CRCLB · CIRCLE ON BSC · SAT 10 OCT</div></In>
        <div style={{ marginTop: 18, fontSize: 210, fontWeight: 600, letterSpacing: "-0.06em", lineHeight: 1, opacity: ramp(f, tOne - 4, tOne + 6) }}>
          +<Count to={1.1} at={tOne - 2} dur={30} decimals={1} />%
        </div>
        <In at={tOne + 14}><div style={{ fontSize: 34, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.3 }}>above Friday's close.<br /><span style={{ fontFamily: mono, fontSize: 22, fontWeight: 400, letterSpacing: "0.04em" }}>on-chain $85.44 · close $84.51 (Yahoo)</span></div></In>
        <In at={tOne + 30}><div style={{ marginTop: 26, fontFamily: mono, fontSize: 18, letterSpacing: "0.1em", color: "rgba(11,14,17,0.7)" }}>1 OF 488 TOKENIZED STOCKS ON BSC · RWA DATA API</div></In>
      </div>
      <Browser name="gaps" url="elitr.xyz/dashboard/gaps" width={940} left={880} top={150} startFrom={60} enter={tCircle - 10} light
        cams={[{ f: 0, z: 1 }, { f: 120, z: 1 }, { f: 200, rect: { x: 304, y: 110, w: 1264, h: 520 }, z: 1.35 }]} />
      {needs.map(([n, label, at], i) => (
        <div key={n} style={{ position: "absolute", left: 130 + i * 566, top: 800, width: 530, height: 150, background: C.ink, color: C.text, padding: "24px 30px", boxSizing: "border-box", opacity: ramp(f, at - 4, at + 8), transform: `translateY(${(1 - ramp(f, at - 4, at + 12)) * 30}px)` }}>
          <div style={{ fontFamily: mono, fontSize: 18, color: C.gold, letterSpacing: "0.14em" }}>{n}</div>
          <div style={{ marginTop: 14, fontSize: 38, fontWeight: 500, letterSpacing: "-0.03em" }}>{label}</div>
        </div>
      ))}
    </Fill>
  );
};
