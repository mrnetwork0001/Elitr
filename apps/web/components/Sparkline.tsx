import type { PricePoint } from "@/lib/derive";

export interface Line {
  points: PricePoint[];
  color: string;
  dashed?: boolean;
  label: string;
}

/** Hand-rolled multi-series SVG sparkline on a shared time and value scale. */
export function Sparkline({ lines, height = 96, zeroLine = false, ariaLabel }: { lines: Line[]; height?: number; zeroLine?: boolean; ariaLabel: string }) {
  const W = 600;
  const H = height;
  const pad = 4;
  const all = lines.flatMap((l) => l.points);
  if (all.length < 2) return null;
  let t0 = Infinity, t1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of all) {
    t0 = Math.min(t0, p.ts); t1 = Math.max(t1, p.ts);
    v0 = Math.min(v0, p.price); v1 = Math.max(v1, p.price);
  }
  if (zeroLine) { v0 = Math.min(v0, 0); v1 = Math.max(v1, 0); }
  if (v1 === v0) { v1 += Math.abs(v1) * 0.001 || 1; v0 -= Math.abs(v0) * 0.001 || 1; }
  const span = v1 - v0;
  v0 -= span * 0.08; v1 += span * 0.08;
  const x = (t: number) => (t1 === t0 ? W : pad + ((t - t0) / (t1 - t0)) * (W - pad * 2));
  const y = (v: number) => pad + (1 - (v - v0) / (v1 - v0)) * (H - pad * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel} className="block h-full w-full overflow-visible">
      {zeroLine ? <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--color-line-strong)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" /> : null}
      {lines.map((l) => {
        if (l.points.length === 0) return null;
        const d = l.points.map((p, i) => `${i ? "L" : "M"}${x(p.ts).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
        return (
          <g key={l.label}>
            <path d={d} fill="none" stroke={l.color} strokeWidth={1.5} strokeDasharray={l.dashed ? "4 3" : undefined} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </g>
        );
      })}
    </svg>
  );
}
