import React from "react";
import { interpolate } from "remotion";
import { clamp, expo } from "./motion";

// Elitr's mark (apps/web/components/landing/Hero.tsx): six slanted bars in two stacks of three.
// In the film each bar is one of the six traded bStocks' tapes, so the bars can fly in one by one.
export const BARS: [number, number][][] = [
  [[12, 0], [30, 0], [33.2, 3.2], [15.2, 3.2]],
  [[14.6, 5.6], [32.6, 5.6], [35.8, 8.8], [17.8, 8.8]],
  [[17.2, 11.2], [35.2, 11.2], [38.4, 14.4], [20.4, 14.4]],
  [[3.2, 16.8], [21.2, 16.8], [24.4, 20], [6.4, 20]],
  [[5.8, 22.4], [23.8, 22.4], [27, 25.6], [9, 25.6]],
  [[8.4, 28], [26.4, 28], [29.6, 31.2], [11.6, 31.2]],
];

/**
 * The mark at `size` px wide. `p` (0..1) brings the bars in one after another, each sliding in
 * from far left (even) or far right (odd) and sharpening; p = 1 is the finished mark.
 */
export const Mark: React.FC<{ size: number; p?: number; color?: string; style?: React.CSSProperties }> = ({ size, p = 1, color = "#f0b90b", style }) => {
  const h = (size * 34) / 42;
  return (
    <svg width={size} height={h} viewBox="0 0 42 34" style={{ overflow: "visible", ...style }}>
      {BARS.map((pts, i) => {
        const q = interpolate(p, [i * 0.1, i * 0.1 + 0.5], [0, 1], { ...clamp, easing: expo });
        const dx = (i % 2 ? 1 : -1) * 60 * (1 - q);
        return <polygon key={i} points={pts.map(([x, y]) => `${x + dx},${y}`).join(" ")} fill={color} opacity={q} />;
      })}
    </svg>
  );
};

export const Wordmark: React.FC<{ size: number; color: string; font: string }> = ({ size, color, font }) => (
  <span style={{ fontFamily: font, fontSize: size, fontWeight: 600, letterSpacing: "-0.045em", color, lineHeight: 1 }}>Elitr</span>
);
