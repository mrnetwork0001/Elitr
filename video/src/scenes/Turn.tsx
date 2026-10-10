import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { C, mono, sans } from "../theme";
import { clamp, expo, ramp } from "../ui/motion";
import { Mark, Wordmark } from "../ui/Mark";
import { Tape, TAPE } from "../ui/Tape";
import { Words } from "../ui/Words";
import { Fill, useCue } from "./common";

const SIX = ["NVDAB", "TSLAB", "BABAB", "CRCLB", "SNDKB", "METAB"];

/** Six tapes, one per traded bStock, run in and collapse into the six bars of the Elitr mark. */
export const Turn: React.FC = () => {
  const { f, rel } = useCue("turn");
  const tName = rel("Elitr.");
  const tAI = rel("AI");
  const collapse = interpolate(f, [tName - 16, tName + 4], [0, 1], { ...clamp, easing: expo });
  const mark = interpolate(f, [tName - 12, tName + 16], [0, 1], clamp);
  const word = ramp(f, tName - 2, tName + 16);
  const lift = interpolate(f, [tAI - 10, tAI + 10], [0, -70], { ...clamp, easing: expo });
  const words = ["AI", "agents", "that", "trade", "stocks,", "and", "pay", "for", "being", "right."];
  return (
    <Fill bg={C.night}>
      {SIX.map((s, i) => (
        <div key={s} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, opacity: 1 - collapse, transform: `scaleX(${1 - collapse * 0.92})`, transformOrigin: "50% 50%" }}>
          <Tape items={[s, ...TAPE.pay]} top={250 + i * 96} height={52} bg={i % 2 ? C.panel2 : C.gold} color={i % 2 ? C.text : C.ink} speed={5 + i * 0.4} offset={i * 300} />
        </div>
      ))}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `translateY(${lift - 40}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <Mark size={250} p={mark} color={C.gold} />
          <div style={{ opacity: word, clipPath: `inset(0 ${(1 - word) * 100}% 0 0)` }}>
            <Wordmark size={190} color={C.text} font={sans} />
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 690, textAlign: "center", fontSize: 72, fontWeight: 500, letterSpacing: "-0.04em", color: C.text }}>
        <Words text={words.join(" ")} at={tAI} at2={words.map((w) => rel(w.replace(/[^A-Za-z]/g, "")) - 3)} accent={{ "right.": C.gold }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 830, textAlign: "center", fontFamily: mono, fontSize: 19, letterSpacing: "0.16em", color: C.muted, opacity: ramp(f, tAI + 34, tAI + 52) }}>
        FOUR ON-CHAIN AGENTS · SIX BSTOCKS · BSC MAINNET
      </div>
    </Fill>
  );
};
