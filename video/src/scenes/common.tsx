import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { K, scene, wordAt } from "../timing";
import { C, mono, sans } from "../theme";
import { clamp, expo, pop } from "../ui/motion";

/** Scene-local frame and word cues (30 fps units): rel("word", n) is when the nth "word" is spoken. */
export function useCue(id: string) {
  const s = scene(id);
  const f = useCurrentFrame() / K;
  const rel = (w: string, n = 0) => (wordAt(id, w, n) - s.from) / K;
  return { s, f, rel, dur: s.durationInFrames / K };
}

/** Small mono label with the app's square bullet (section heads on the dashboard). */
export const Label: React.FC<{ children: React.ReactNode; color?: string; dot?: string; size?: number; style?: React.CSSProperties }> = ({ children, color = C.muted, dot = C.gold, size = 17, style }) => (
  <div style={{ fontFamily: mono, fontSize: size, letterSpacing: "0.14em", textTransform: "uppercase", color, display: "flex", alignItems: "center", gap: 12, ...style }}>
    <span style={{ width: 9, height: 9, border: `2px solid ${dot}`, display: "inline-block", boxSizing: "border-box" }} />{children}
  </div>
);

/** A card that pops in at `at` (30 fps units, scene-local). Square corners, like the dashboard. */
export const Card: React.FC<{ at: number; left: number; top: number; width: number; dark?: boolean; gold?: boolean; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, left, top, width, dark, gold, children, style }) => {
  const f = useCurrentFrame() / K;
  const p = pop(f, at);
  const o = interpolate(f, [at, at + 8], [0, 1], clamp);
  return (
    <div style={{
      position: "absolute", left, top, width, opacity: o, transform: `translateY(${(1 - p) * 26}px) scale(${0.94 + 0.06 * p})`, transformOrigin: "50% 100%",
      background: gold ? C.gold : dark ? C.panel : C.white, color: gold || !dark ? C.ink : C.text, padding: "26px 30px",
      boxShadow: dark ? `0 0 0 1px ${C.lineDark}, 0 30px 70px rgba(0,0,0,0.45)` : `0 0 0 1px ${C.lineLight}, 0 26px 60px rgba(11,14,17,0.14)`,
      borderTop: `3px solid ${gold ? C.ink : C.gold}`, fontFamily: sans, ...style,
    }}>{children}</div>
  );
};

/** A short tx hash chip, as on BscScan. */
export const Hash: React.FC<{ h: string; dark?: boolean; style?: React.CSSProperties }> = ({ h, dark, style }) => (
  <span style={{ fontFamily: mono, fontSize: 19, color: dark ? C.goldHi : C.info, letterSpacing: "0.02em", ...style }}>{h}</span>
);

/** Fade + rise helper for any block. */
export const In: React.FC<{ at: number; dur?: number; y?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, dur = 14, y = 24, children, style }) => {
  const f = useCurrentFrame() / K;
  const p = interpolate(f, [at, at + dur], [0, 1], { ...clamp, easing: expo });
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, filter: p < 1 ? `blur(${(1 - p) * 6}px)` : undefined, ...style }}>{children}</div>;
};

export const Fill: React.FC<{ bg: string; children: React.ReactNode }> = ({ bg, children }) => (
  <AbsoluteFill style={{ background: bg, fontFamily: sans, overflow: "hidden" }}>{children}</AbsoluteFill>
);

/** "Live data as of" footnote for scenes quoting counts. */
export const AsOf: React.FC<{ color: string; text?: string }> = ({ color, text = "live data · bsc mainnet · as of 10 oct 2026" }) => (
  <div style={{ position: "absolute", right: 48, top: 66, fontFamily: mono, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color }}>{text}</div>
);
