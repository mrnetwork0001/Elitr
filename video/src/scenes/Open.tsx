import React from "react";
import { interpolate } from "remotion";
import { C, mono, sans } from "../theme";
import { clamp, expo, ramp } from "../ui/motion";
import { Tape, TAPE } from "../ui/Tape";
import { BnbChainLogo } from "../ui/Logos";
import { Fill, useCue } from "./common";

const LINE = "HTTP/1.1 402 Payment Required";

/** Black terminal: the 1997 status code nobody could answer, typed out; then the first gold tape runs. */
export const Open: React.FC = () => {
  const { f, rel } = useCue("open");
  const tIn = rel("nineteen");
  const tRes = rel("reserved");
  const tFour = rel("Four");
  const t29 = rel("Twenty-nine");
  const tBnb = rel("BNB");
  const tStatus = rel("status");
  const typed = Math.floor(interpolate(f, [tStatus - 4, tStatus + 40], [0, LINE.length], clamp));
  const cursorOn = Math.floor(f / 8) % 2 === 0;
  const now = ramp(f, t29 - 4, t29 + 16);
  const tape = ramp(f, t29 + 6, t29 + 30);
  return (
    <Fill bg={C.night}>
      <div style={{ position: "absolute", left: 200, top: 250, width: 1520 }}>
        <div style={{ fontFamily: mono, fontSize: 22, letterSpacing: "0.12em", color: C.muted, opacity: ramp(f, tIn - 6, tIn + 10), display: "flex", gap: 28 }}>
          <span>RFC 2068</span><span>HTTP/1.1</span>
          <span>{now < 0.02 ? "JANUARY 1997" : `${Math.round(interpolate(f, [t29, t29 + 26], [1997, 2026], { ...clamp, easing: expo }))} · BSC MAINNET`}</span>
        </div>
        <div style={{ marginTop: 46, fontFamily: mono, fontSize: 92, fontWeight: 500, letterSpacing: "-0.02em", color: C.text, whiteSpace: "pre" }}>
          {LINE.slice(0, typed).split(/(402)/).map((part, i) => (
            <span key={i} style={part === "402" ? { color: now > 0.5 ? C.gold : C.text } : undefined}>{part}</span>
          ))}
          <span style={{ display: "inline-block", width: 46, height: 84, marginLeft: 6, verticalAlign: "-10px", background: C.gold, opacity: cursorOn && typed < LINE.length + 1 ? 1 : 0 }} />
        </div>
        <div style={{ marginTop: 40, fontFamily: sans, fontSize: 40, fontWeight: 300, color: "rgba(246,246,244,0.7)", opacity: ramp(f, tRes, tRes + 14) * (1 - now * 0.65), fontStyle: "italic" }}>
          "This code is reserved for future use."
        </div>
      </div>
      <div style={{ position: "absolute", left: 200, top: 700, display: "flex", alignItems: "center", gap: 26, opacity: ramp(f, tBnb - 4, tBnb + 12) }}>
        <span style={{ fontFamily: mono, fontSize: 18, letterSpacing: "0.14em", color: C.muted }}>BUILT ON</span>
        <BnbChainLogo height={44} variant="white" />
      </div>
      <div style={{ opacity: tape }}>
        <Tape items={TAPE.pay} top={880} height={58} bg={C.gold} color={C.ink} speed={4} />
      </div>
    </Fill>
  );
};
