import React from "react";
import { useCurrentFrame } from "remotion";
import { mono } from "../theme";
import { K } from "../timing";

/**
 * The film's motif: a stock-ticker tape. Each tape is one slanted bar of the Elitr mark stretched
 * out, scrolling real desk events ("402 PAYMENT REQUIRED · PAID 0.01 USDT · ...") instead of quotes.
 * `speed` is px per 30 fps unit; negative scrolls right.
 */
export const Tape: React.FC<{
  items: string[]; top: number; height?: number; bg: string; color: string; speed?: number;
  width?: number; left?: number; skew?: number; opacity?: number; offset?: number; dot?: string; fontSize?: number;
}> = ({ items, top, height = 46, bg, color, speed = 3, width = 2600, left = -340, skew = -45, opacity = 1, offset = 0, dot, fontSize }) => {
  const f = useCurrentFrame() / K;
  const row = items.join("   ·   ") + "   ·   ";
  const fs = fontSize ?? Math.round(height * 0.42);
  const chars = row.length * fs * 0.6;
  const x = -(((f * speed + offset) % chars) + chars) % chars;
  return (
    <div style={{ position: "absolute", left, top, width, height, background: bg, opacity, overflow: "hidden", transform: `skewX(${skew}deg)` }}>
      <div style={{ position: "absolute", top: 0, left: x, height, display: "flex", alignItems: "center", whiteSpace: "pre", transform: `skewX(${-skew}deg)`, fontFamily: mono, fontSize: fs, letterSpacing: "0.06em", color, textTransform: "uppercase" }}>
        {[0, 1, 2, 3].map((k) => (
          <span key={k}>{dot ? row.split("·").map((s, i, a) => <React.Fragment key={i}>{s}{i < a.length - 1 ? <span style={{ color: dot }}>·</span> : null}</React.Fragment>) : row}</span>
        ))}
      </div>
    </div>
  );
};

/** Real desk events for the tapes (execution-events.jsonl, BSC mainnet, 7 to 10 Oct 2026). */
export const TAPE = {
  pay: ["402 payment required", "paid 0.01 usdt", "settled on bsc 0x7ccdd0c0", "signal metab 48 neutral", "hold"],
  flow: ["flow analyst 13 / 21", "trust 0.61", "news analyst 0 / 6", "trust 0.13", "erc-8004 rating posted"],
  risk: ["14 checks", "transaction api simulate", "dry run ok", "kill switch armed", "max trade $5"],
  live: ["buy nvdab 0.008433 @ 237.15", "0x0ce91120", "stop-loss -221 bps", "sell nvdab @ 232.12", "0x37ff1c71"],
  quotes: ["nvdab 230.44", "tslab 382.90", "babab 110.85", "crclb 85.44", "sndkb 1590.42", "metab 719.05"],
};
