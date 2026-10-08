import type { AnalystId, Stance } from "./events.js";

// What every analyst returns from its paid GET /signal endpoint.
export interface Signal {
  signalId: string; // unique per produced signal
  analystId: AnalystId;
  symbol: string;
  underlying: string;
  score: number; // 1-100 confidence that price rises over the horizon
  stance: Stance;
  horizonSec: number; // how long the call is meant to hold - used to score it later
  rationale: string;
  sources: { title: string; url: string; publishedAt: string }[];
  generatedAt: string; // ISO
  model: string; // LLM id, or e.g. "deterministic-flow-v1"
  headlineCount: number; // inputs considered (headlines, swaps, …)
}

// Free GET /info on every analyst - how the execution agent discovers and compares sellers.
export interface AnalystInfo {
  analystId: AnalystId;
  name: string;
  kind: "news-sentiment" | "onchain-flow";
  description: string;
  symbols: string[];
  priceAmount: string; // smallest units
  priceAsset: string; // token address
  priceUsd: number | null;
  horizonSec: number;
  erc8004AgentId?: string; // set once registered on-chain
}
