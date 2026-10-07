import type { AgentId, AnalystId } from "@elitr/shared";

// Agent endpoints. NEXT_PUBLIC_* values are inlined at build time.
const clean = (v: string | undefined, fallback: string) => (v || fallback).replace(/\/+$/, "");

export const ANALYST_URL = clean(process.env.NEXT_PUBLIC_ANALYST_URL, "http://localhost:4001");
export const FLOW_ANALYST_URL = clean(process.env.NEXT_PUBLIC_FLOW_ANALYST_URL, "http://localhost:4003");
export const EXECUTION_URL = clean(process.env.NEXT_PUBLIC_EXECUTION_URL, "http://localhost:4002");

export interface AgentMeta {
  id: AgentId;
  /** Short display name. */
  name: string;
  /** One-letter tag for dense lists. */
  tag: string;
  url: string;
  /** Text colour class used for this agent across the dashboard. */
  tone: string;
}

/** Every agent the dashboard streams from, in display order. */
export const AGENTS: AgentMeta[] = [
  { id: "analyst", name: "News analyst", tag: "N", url: ANALYST_URL, tone: "text-info" },
  { id: "analyst-flow", name: "Flow analyst", tag: "F", url: FLOW_ANALYST_URL, tone: "text-flow" },
  { id: "execution", name: "Execution", tag: "E", url: EXECUTION_URL, tone: "text-accent" },
];

export const AGENT_IDS: AgentId[] = AGENTS.map((a) => a.id);
export const ANALYST_IDS: AnalystId[] = ["analyst", "analyst-flow"];

export function agentMeta(id: string): AgentMeta | undefined {
  return AGENTS.find((a) => a.id === id);
}

/** Fallback analyst labels when GET /info hasn't answered (these describe the contract, not data). */
export const ANALYST_KIND_FALLBACK: Record<AnalystId, "news-sentiment" | "onchain-flow"> = {
  analyst: "news-sentiment",
  "analyst-flow": "onchain-flow",
};

export const KIND_LABEL: Record<string, string> = {
  "news-sentiment": "News sentiment",
  "onchain-flow": "On-chain flow",
};

/** Assets the dashboard offers as tabs; extended at runtime by GET /state `assets`. */
export const DEFAULT_ASSETS = ["NVDAB", "TSLAB"];

export const BSCSCAN_TX = (hash: string) => `https://bscscan.com/tx/${hash}`;
export const BSCSCAN_ADDRESS = (addr: string) => `https://bscscan.com/address/${addr}`;
/** ERC-721 instance page (ERC-8004 identities are NFTs in the identity registry). */
export const BSCSCAN_NFT = (registry: string, tokenId: string) => `https://bscscan.com/nft/${registry}/${tokenId}`;

/** A signal older than this is shown as stale. */
export const SIGNAL_STALE_MS = 5 * 60_000;
