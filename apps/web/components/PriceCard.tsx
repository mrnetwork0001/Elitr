"use client";
import type { AgentEvent } from "@elitr/shared";
import type { ConnStatus } from "@/lib/useAgentStream";
import { forSymbol, priceView, type PriceKind, type PriceSeries } from "@/lib/derive";
import { ago, bps, price } from "@/lib/format";
import { Sparkline } from "./Sparkline";
import { Empty, Panel } from "./ui";

const KIND: Record<PriceKind, { label: string; color: string; dashed?: boolean }> = {
  yahoo: { label: "Yahoo reference", color: "var(--color-dim)", dashed: true },
  rwa: { label: "Binance RWA", color: "var(--color-info)", dashed: true },
  reference: { label: "Reference", color: "var(--color-dim)", dashed: true },
  onchain: { label: "On-chain market", color: "var(--color-accent)" },
};

function Row({ s, now, isRef }: { s: PriceSeries; now: number; isRef: boolean }) {
  const k = KIND[s.kind];
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <svg width="14" height="4" aria-hidden className="shrink-0">
          <line x1="0" y1="2" x2="14" y2="2" stroke={k.color} strokeWidth="2" strokeDasharray={k.dashed ? "3 2" : undefined} />
        </svg>
        <div className="min-w-0">
          <div className="truncate text-xs text-fg">
            {s.kind === "onchain" && /slot0|pcs|pancake/i.test(s.source) ? "PancakeSwap pool price" : k.label}
            {isRef ? <span className="ml-1.5 text-[10px] tracking-wide text-faint uppercase">gap basis</span> : null}
          </div>
          <div className="truncate font-mono text-[10px] text-faint" title={s.source}>
            {s.symbol} · {s.source}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="num text-sm font-medium text-fg">{price(s.latest.price)}</div>
        <div suppressHydrationWarning className="num text-[10px] text-faint">{now ? ago(s.latest.ts, now) : ""}</div>
      </div>
    </div>
  );
}

export function PriceCard({ events, symbol, execution, now }: { events: AgentEvent[]; symbol: string; execution: ConnStatus; now: number }) {
  const v = priceView(forSymbol(events, symbol));

  if (!v.series.length) {
    return (
      <Panel title="Price · reference vs on-chain" id="price" right={<span className="font-mono text-fg">{symbol}</span>}>
        {execution === "offline" ? (
          <Empty tone="offline" title="Execution agent offline" hint="Prices are fetched by the execution agent each cycle (Yahoo + Binance RWA reference, Binance Market on-chain)." />
        ) : (
          <Empty title={`Waiting for ${symbol} prices…`} hint="Reference and on-chain prices appear after the first trading cycle that covers this asset." />
        )}
      </Panel>
    );
  }

  const gap = v.gapBps;
  // Negative gap = on-chain trades at a discount to the reference: the opportunity the agent buys.
  const gapTone = gap === null ? "text-dim" : gap < 0 ? "text-pos" : gap > 0 ? "text-neg" : "text-dim";
  const lines = v.series
    .filter((s) => s.points.length > 0)
    .map((s) => ({ points: s.points, color: KIND[s.kind].color, dashed: KIND[s.kind].dashed, label: `${s.kind}:${s.source}` }));
  const enoughHistory = v.series.some((s) => s.points.length > 1);

  return (
    <Panel title="Price · reference vs on-chain" id="price" right={<span className="font-mono text-fg">{symbol}</span>}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-wide text-faint uppercase">Gap (on-chain vs ref)</div>
          <div className={`num mt-0.5 text-3xl font-semibold tracking-tight ${gapTone}`}>{bps(gap)}</div>
          <div className="text-xs text-dim">
            {gap === null
              ? !v.onchain
                ? "no on-chain price yet"
                : "no reference price yet"
              : gap < 0
                ? "on-chain at a discount"
                : gap > 0
                  ? "on-chain at a premium"
                  : "at parity"}
          </div>
        </div>
      </div>

      <div className="mt-3 h-24 rounded border border-line bg-bg/40 p-1">
        {enoughHistory ? (
          <Sparkline lines={lines} ariaLabel="Price history: reference and on-chain" />
        ) : (
          <div className="grid h-full place-items-center text-[11px] text-faint">sparkline builds as price events arrive</div>
        )}
      </div>

      {v.gapSeries.length > 1 ? (
        <div className="mt-2">
          <div className="mb-0.5 flex justify-between text-[10px] tracking-wide text-faint uppercase">
            <span>Gap history (bps)</span>
            <span className="num normal-case">{v.gapSeries.length} pts</span>
          </div>
          <div className="h-8">
            <Sparkline lines={[{ points: v.gapSeries, color: "var(--color-fg)", label: "gap" }]} zeroLine height={32} ariaLabel="Gap in basis points over time" />
          </div>
        </div>
      ) : null}

      <div className="mt-3 divide-y divide-line border-t border-line">
        {v.series.map((s) => (
          <Row key={`${s.kind}:${s.source}`} s={s} now={now} isRef={s === v.reference} />
        ))}
      </div>
    </Panel>
  );
}
