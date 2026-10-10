import React from "react";
import { C, mono } from "../theme";
import { ramp } from "../ui/motion";
import { Browser, markOf } from "../ui/Footage";
import { Count } from "../ui/Count";
import { AsOf, Card, Fill, useCue } from "./common";

/** Paper: the live Analysts view keeps score; the track records and the ERC-8004 ratings, real. */
export const Trust: React.FC = () => {
  const { f, rel } = useCue("trust");
  const tPool = rel("pool.");
  const t13 = rel("thirteen");
  const t0 = rel("zero");
  const tErc = rel("ERC-8004");
  const tVerdict = rel("verdict");
  // Land the clip's "ratings" mark (scroll arrives at the on-chain ratings) on "verdict".
  const hold = Math.max(0, tVerdict - markOf("analysts", "ratings"));
  return (
    <Fill bg={C.paper}>
      <Browser name="analysts" url="elitr.xyz/dashboard/analysts" width={1180} left={90} top={150} hold={hold} light
        cams={[{ f: 0, z: 1 }, { f: hold + 70, rect: { x: 942, y: 300, w: 610, h: 140 }, z: 1.8 }, { f: t0 - 6, rect: { x: 321, y: 300, w: 600, h: 140 }, z: 1.8 }, { f: tVerdict - 4, z: 1 }, { f: tErc + 6, rect: { x: 305, y: 518, w: 1262, h: 341 }, z: 1.25 }]} />
      <Card at={t13 - 4} left={1320} top={170} width={520}>
        <div style={{ fontFamily: mono, fontSize: 18, color: C.flow, letterSpacing: "0.1em" }}>FLOW ANALYST</div>
        <div style={{ fontSize: 110, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1.05 }}><Count to={13} at={t13} dur={20} /><span style={{ color: C.faint }}> / 21</span></div>
        <div style={{ fontFamily: mono, fontSize: 18, color: C.dim }}>trust 0.61 · picked most</div>
      </Card>
      <Card at={t0 - 4} left={1320} top={430} width={520}>
        <div style={{ fontFamily: mono, fontSize: 18, color: C.info, letterSpacing: "0.1em" }}>NEWS ANALYST</div>
        <div style={{ fontSize: 110, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1.05 }}>0<span style={{ color: C.faint }}> / 6</span></div>
        <div style={{ fontFamily: mono, fontSize: 18, color: C.negDeep }}>trust 0.13 · rarely picked</div>
      </Card>
      <div style={{ position: "absolute", left: 1320, top: 700, width: 520, padding: "22px 28px", background: C.ink, color: C.text, opacity: ramp(f, tErc - 6, tErc + 8), boxSizing: "border-box" }}>
        <div style={{ fontSize: 64, fontWeight: 600, letterSpacing: "-0.04em", color: C.gold }}><Count to={46} at={tErc - 2} dur={26} /> ratings</div>
        <div style={{ fontFamily: mono, fontSize: 17, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>ERC-8004 reputation registry<br />0x8004BAa1…9b63 · BSC mainnet</div>
      </div>
      <div style={{ position: "absolute", left: 92, top: 860, fontFamily: mono, fontSize: 18, color: C.dim, letterSpacing: "0.06em", opacity: ramp(f, tPool - 4, tPool + 10) }}>
        A CALL IS SCORED AGAINST THE POOL PRICE WHEN ITS HORIZON ENDS · THOMPSON SAMPLING PICKS WHO GETS PAID
      </div>
      <AsOf color={C.faint} />
    </Fill>
  );
};
