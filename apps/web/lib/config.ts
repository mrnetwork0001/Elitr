import type { AgentId, AnalystId } from "@elitr/shared";

// Agent endpoints. NEXT_PUBLIC_* values are inlined at build time.
const clean = (v: string | undefined, fallback: string) => (v || fallback).replace(/\/+$/, "");

export const ANALYST_URL = clean(process.env.NEXT_PUBLIC_ANALYST_URL, "http://localhost:4001");
export const FLOW_ANALYST_URL = clean(process.env.NEXT_PUBLIC_FLOW_ANALYST_URL, "http://localhost:4003");
export const EXECUTION_URL = clean(process.env.NEXT_PUBLIC_EXECUTION_URL, "http://localhost:4002");
export const STUDIO_URL = clean(process.env.NEXT_PUBLIC_STUDIO_URL, "https://desk.elitr.xyz");

/** ERC-8004 IdentityRegistry on BSC mainnet. */
export const ERC8004_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

/** The BNB Agent Studio seller agent (studio/ElitrDesk), self-hosted next to the desk. Not an SSE agent. */
export const STUDIO_AGENT = {
  name: "Elitr Desk Brief",
  url: STUDIO_URL,
  card: `${STUDIO_URL}/.well-known/agent-card.json`,
  x402: `${STUDIO_URL}/x402?prompt=brief`,
  erc8004AgentId: "367734",
  registrationTx: "0xd95b1b475f44dd6537b3df63c380d7d0d4f948d001434cd8ed3856b96a5ae22b",
};

/** Every Elitr agent registered on ERC-8004 (BSC mainnet), with its registration transaction. */
export const ONCHAIN_AGENTS = [
  { id: "analyst", name: "News analyst", role: "Sells news-sentiment signals over b402", agentId: "365554", tx: "0x81f46ff719e2a7c244ccb39622ae05fd9960883bd19000e0c731c60a8c168237" },
  { id: "analyst-flow", name: "Flow analyst", role: "Sells on-chain flow signals over b402", agentId: "365555", tx: "0x902e8d14dd118d069151834019f09fc92ceadc0f094fa78ffeb7d35cfcd9db16" },
  { id: "execution", name: "Execution agent", role: "Buys signals, trades, rates analysts on-chain", agentId: "365556", tx: "0xeb36036e4d62fad5a6919205de0cecbeb402a03afc6f282d1d0a8432fe5fcd03" },
  { id: "studio", name: STUDIO_AGENT.name, role: "BNB Agent Studio agent: sells a desk brief over x402 + A2A", agentId: STUDIO_AGENT.erc8004AgentId, tx: STUDIO_AGENT.registrationTx },
] as const;

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
export const DEFAULT_ASSETS = ["NVDAB", "TSLAB", "BABAB", "CRCLB", "SNDKB", "METAB"];

export const BSCSCAN_TX = (hash: string) => `https://bscscan.com/tx/${hash}`;
export const BSCSCAN_ADDRESS = (addr: string) => `https://bscscan.com/address/${addr}`;
/** ERC-721 instance page (ERC-8004 identities are NFTs in the identity registry). */
export const BSCSCAN_NFT = (registry: string, tokenId: string) => `https://bscscan.com/nft/${registry}/${tokenId}`;

/** A signal older than this is shown as stale. */
export const SIGNAL_STALE_MS = 5 * 60_000;
