import React from "react";
import { interpolate } from "remotion";
import { C, mono, sans } from "../theme";
import { clamp, ramp, pop } from "../ui/motion";
import { Tape, TAPE } from "../ui/Tape";
import { Words } from "../ui/Words";
import { Fill, Label, useCue } from "./common";

/** Paper: Wall Street rings the bell and freezes; on BNB Chain six bStock tapes keep running. */
export const Clock: React.FC = () => {
  const { f, rel } = useCue("clock");
  const tTok = rel("Tokenized");
  const tWall = rel("Wall");
  const tFri = rel("Friday.");
  const tKeep = rel("keep");
  const ang = interpolate(f, [0, tFri], [-80, 0], { ...clamp });
  const stamp = pop(f, tFri + 2);
  return (
    <Fill bg={C.paper}>
      <div style={{ position: "absolute", left: 140, top: 150, width: 1640, fontSize: 84, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 1.04, color: C.ink, opacity: 1 - ramp(f, tWall - 8, tWall - 2) }}>
        <Words text="Tokenized stocks trade around the clock." at={tTok} every={4} accent={{ "clock.": C.goldDeep }} />
      </div>
      <div style={{ position: "absolute", left: 140, top: 150, width: 1640, fontSize: 84, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 1.04, color: C.ink }}>
        <Words text="Wall Street closes at 4 pm Friday." at={tWall} every={4} accent={{ "Friday.": C.goldDeep }} />
      </div>
      {/* New York: frozen */}
      <div style={{ position: "absolute", left: 140, top: 420, width: 760, height: 430, background: C.white, boxShadow: `0 0 0 1px ${C.lineLight}`, opacity: ramp(f, tWall, tWall + 12) }}>
        <Label color={C.dim} style={{ position: "absolute", left: 34, top: 30 }}>new york stock exchange</Label>
        <svg width={220} height={220} viewBox="-110 -110 220 220" style={{ position: "absolute", left: 44, top: 110 }}>
          <circle r={100} fill="none" stroke={C.ink} strokeWidth={5} />
          {Array.from({ length: 12 }, (_, i) => <line key={i} x1={0} y1={-86} x2={0} y2={-76} stroke={C.ink} strokeWidth={4} transform={`rotate(${i * 30})`} />)}
          <line x1={0} y1={0} x2={0} y2={-52} stroke={C.ink} strokeWidth={8} transform={`rotate(${120 + ang * 0.08})`} strokeLinecap="square" />
          <line x1={0} y1={0} x2={0} y2={-78} stroke={C.ink} strokeWidth={5} transform={`rotate(${ang})`} strokeLinecap="square" />
        </svg>
        <div style={{ position: "absolute", left: 320, top: 140, fontFamily: mono, fontSize: 64, color: C.ink, letterSpacing: "-0.02em" }}>16:00 ET</div>
        <div style={{ position: "absolute", left: 322, top: 230, fontFamily: mono, fontSize: 20, color: C.dim, letterSpacing: "0.1em" }}>FRI 9 OCT 2026 · CLOSING BELL</div>
        <div style={{ position: "absolute", left: 318, top: 290, padding: "10px 20px", border: `4px solid ${C.negDeep}`, color: C.negDeep, fontFamily: mono, fontSize: 34, fontWeight: 500, letterSpacing: "0.14em", opacity: stamp, transform: `rotate(-6deg) scale(${1.6 - 0.6 * stamp})` }}>CLOSED</div>
      </div>
      {/* BNB Chain: still trading */}
      <div style={{ position: "absolute", left: 940, top: 420, width: 840, height: 430, background: C.ink, overflow: "hidden", opacity: ramp(f, tTok, tTok + 14) }}>
        <Label color={C.muted} style={{ position: "absolute", left: 34, top: 30, zIndex: 2 }}>bnb smart chain · bstocks · live</Label>
        {TAPE.quotes.map((q, i) => (
          <Tape key={q} items={[q, ...TAPE.quotes.filter((x) => x !== q)]} top={92 + i * 54} height={40} bg={i % 2 ? C.panel2 : C.gold} color={i % 2 ? C.text : C.ink} speed={2.4 + (i % 3) * 0.6} width={1400} left={-120} offset={i * 260} />
        ))}
        <div style={{ position: "absolute", right: 30, bottom: 18, fontFamily: mono, fontSize: 18, color: C.gold, letterSpacing: "0.12em", opacity: ramp(f, tKeep, tKeep + 10) }}>24 / 7 · SAT 10 OCT PRICES</div>
      </div>
      <div style={{ position: "absolute", left: 140, top: 880, fontFamily: sans, fontSize: 34, fontWeight: 500, letterSpacing: "-0.02em", color: C.ink, opacity: ramp(f, tKeep - 2, tKeep + 12) }}>The tokens keep trading.</div>
    </Fill>
  );
};
