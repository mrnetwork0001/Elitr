import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { C, mono, sans, serif } from "../theme";
import { clamp, ramp } from "../ui/motion";
import { Mark, Wordmark } from "../ui/Mark";
import { Tape, TAPE } from "../ui/Tape";
import { BnbChainLogo } from "../ui/Logos";
import { Fill, useCue } from "./common";

/** Dark over Elitr's golden-river art: the mark, the line, the URL, and "Built on BNB Chain". */
export const Close: React.FC = () => {
  const { f, rel, dur } = useCue("close");
  const tName = rel("Elitr.");
  const tAg = rel("Agents");
  const tLive = rel("Live");
  const mark = interpolate(f, [0, tName + 14], [0, 1], clamp);
  return (
    <Fill bg={C.night}>
      <AbsoluteFill style={{ opacity: 0.32 * ramp(f, 0, 30) }}>
        <Img src={staticFile("brand/elitr-hero.jpg")} style={{ width: 1920, height: 1080, objectFit: "cover", transform: `scale(${1.08 - 0.06 * (f / dur)})` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(11,14,17,0.55) 0%, rgba(11,14,17,0.2) 45%, rgba(11,14,17,0.85) 100%)" }} />
      <div style={{ opacity: 0.18 }}>
        {TAPE.quotes.map((q, i) => (
          <Tape key={q} items={[q, ...TAPE.quotes.filter((x) => x !== q)]} top={60 + i * 175} height={30} bg="transparent" color={C.gold} speed={1.6 + i * 0.2} offset={i * 400} />
        ))}
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: "translateY(-90px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
          <Mark size={210} p={mark} color={C.gold} />
          <div style={{ opacity: ramp(f, tName - 2, tName + 14) }}><Wordmark size={170} color={C.text} font={sans} /></div>
        </div>
        <div style={{ marginTop: 40, fontSize: 60, fontWeight: 500, letterSpacing: "-0.04em", color: C.text, opacity: ramp(f, tAg - 4, tAg + 12) }}>
          Agents that pay for <span style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 400, color: C.gold, fontSize: "1.14em" }}>being right.</span>
        </div>
        <div style={{ marginTop: 34, fontFamily: mono, fontSize: 40, color: C.gold, letterSpacing: "0.04em", opacity: ramp(f, tLive - 4, tLive + 10) }}>elitr.xyz</div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 860, display: "flex", justifyContent: "center", alignItems: "center", gap: 26, opacity: ramp(f, tLive + 10, tLive + 26) }}>
        <span style={{ fontFamily: mono, fontSize: 18, letterSpacing: "0.16em", color: C.muted }}>BUILT ON</span>
        <BnbChainLogo height={46} variant="white" />
        <span style={{ width: 1, height: 40, background: C.lineDark, margin: "0 14px" }} />
        <span style={{ fontFamily: mono, fontSize: 18, letterSpacing: "0.16em", color: C.muted }}>BNB HACK · TOKENIZED STOCKS EDITION</span>
      </div>
    </Fill>
  );
};
