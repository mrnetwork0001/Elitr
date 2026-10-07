import { randomUUID } from "node:crypto";
import type { Signal, TokenizedStock } from "@elitr/shared";
import { FLOW_MODEL, flowRationale, scoreFlow, usdShort, type FlowReader } from "./flow.js";
import { fetchHeadlines } from "./news.js";
import type { Scorer } from "./scorer.js";

// Wire contract (`Signal`) lives in @elitr/shared and is consumed by apps/execution-agent.

export type Producer = (asset: TokenizedStock) => Promise<Signal>;

/** Caches each symbol's signal for `cacheSec` and coalesces concurrent requests, so paying buyers never wait on duplicate work. */
export class SignalService {
  private readonly cache = new Map<string, { signal: Signal; expires: number }>();
  private readonly inflight = new Map<string, Promise<Signal>>();

  constructor(
    private readonly produce: Producer,
    private readonly cacheSec = 120,
  ) {}

  /** Returns a cached signal if still fresh, otherwise produces a new one. Throws on any real failure. */
  get(asset: TokenizedStock): Promise<Signal> {
    const hit = this.cache.get(asset.symbol);
    if (hit && Date.now() < hit.expires) return Promise.resolve(hit.signal);
    const running = this.inflight.get(asset.symbol);
    if (running) return running;
    const p = this.produce(asset)
      .then((signal) => {
        this.cache.set(asset.symbol, { signal, expires: Date.now() + this.cacheSec * 1000 });
        return signal;
      })
      .finally(() => this.inflight.delete(asset.symbol));
    this.inflight.set(asset.symbol, p);
    return p;
  }
}

/** News-sentiment analyst ("analyst"): recent headlines scored by an LLM. */
export function newsProducer(scorer: Scorer, horizonSec: number): Producer {
  return async (asset) => {
    const { headlines, errors } = await fetchHeadlines(asset.underlying);
    if (errors.length) console.warn(`[analyst] news feed errors: ${errors.join("; ")}`);
    if (!headlines.length) throw new Error(`no ${asset.underlying} headlines in the last 48h`);
    const s = await scorer.score(asset, headlines);
    return {
      signalId: randomUUID(),
      analystId: "analyst",
      symbol: asset.symbol,
      underlying: asset.underlying,
      score: s.score,
      stance: s.stance,
      horizonSec,
      rationale: s.rationale,
      sources: s.cited.map(({ title, url, publishedAt }) => ({ title, url, publishedAt })),
      generatedAt: new Date().toISOString(),
      model: scorer.model,
      headlineCount: headlines.length,
    };
  };
}

export class InsufficientFlowError extends Error {}

/** On-chain flow analyst ("analyst-flow"): PancakeSwap v3 swaps scored deterministically. */
export function flowProducer(reader: FlowReader, horizonSec: number, minSwaps: number): Producer {
  return async (asset) => {
    const f = await reader.features(asset);
    if (f.swaps < minSwaps) {
      const mins = Math.round((f.toTime - f.fromTime) / 60);
      throw new InsufficientFlowError(
        `insufficient flow: ${f.swaps} ${asset.symbol} swaps in the last ${mins} min (need at least ${minSwaps} to say anything)`,
      );
    }
    const s = scoreFlow(f);
    return {
      signalId: randomUUID(),
      analystId: "analyst-flow",
      symbol: asset.symbol,
      underlying: asset.underlying,
      score: s.score,
      stance: s.stance,
      horizonSec,
      rationale: flowRationale(f, s),
      sources: f.largest.map((x) => ({
        title: `${x.side === "buy" ? "Buy" : "Sell"} ${usdShort(x.usd)} ${asset.symbol} @ $${x.priceUsd.toFixed(2)}`,
        url: `https://bscscan.com/tx/${x.txHash}`,
        publishedAt: new Date(x.timestamp * 1000).toISOString(),
      })),
      generatedAt: new Date().toISOString(),
      model: FLOW_MODEL,
      headlineCount: f.swaps,
    };
  };
}
