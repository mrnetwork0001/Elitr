import { getAddress, isAddress, type Address, type Hex } from "viem";
import type { AgentId } from "@elitr/shared";

// Canonical ERC-8004 deployments (vanity CREATE2 proxies, implementation getVersion() == "2.0.0").
// Source: https://github.com/erc-8004/erc-8004-contracts#readme (BSC Mainnet / BSC Testnet sections);
// the identity addresses also match bnbagent-sdk typescript/src/config.ts NETWORKS.registryContract.
// Verified on-chain 2026-10-04: eth_getCode non-empty, getVersion() == "2.0.0",
// ReputationRegistry.getIdentityRegistry() == the IdentityRegistry below.
export const KNOWN_REGISTRIES: Record<number, { identity: Address; reputation: Address; rpcUrl: string; name: string }> = {
  56: {
    name: "bsc-mainnet",
    identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
    rpcUrl: "https://bsc-dataseed.bnbchain.org",
  },
  97: {
    name: "bsc-testnet",
    identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    rpcUrl: "https://bsc-testnet-rpc.publicnode.com",
  },
};

export const AGENT_ID_ENV: Record<AgentId, string> = {
  analyst: "ERC8004_AGENT_ID_ANALYST",
  "analyst-flow": "ERC8004_AGENT_ID_ANALYST_FLOW",
  execution: "ERC8004_AGENT_ID_EXECUTION",
};

// Which key owns (mints) each identity. The trader key must NOT own an analyst identity:
// ReputationRegistry.giveFeedback reverts "Self-feedback not allowed" for the owner/operator.
export const OWNER_KEY_ENV: Record<AgentId, string[]> = {
  analyst: ["ANALYST_OWNER_PRIVATE_KEY"],
  "analyst-flow": ["ANALYST_FLOW_OWNER_PRIVATE_KEY", "ANALYST_OWNER_PRIVATE_KEY"],
  execution: ["EXECUTION_PRIVATE_KEY"],
};

export interface IdentityConfig {
  chainId: number;
  rpcUrl: string;
  identityRegistry: Address;
  reputationRegistry: Address;
  agentIds: Partial<Record<AgentId, string>>;
  postFeedback: boolean; // ERC8004_POST_FEEDBACK=1
  executionKey?: Hex; // signs giveFeedback (the trader is the client)
  inlineFeedbackFile: boolean; // ERC8004_FEEDBACK_INLINE (default on): feedbackURI = data: URI of the off-chain feedback file
  waitForReceipt: boolean; // ERC8004_WAIT_RECEIPT (default on)
}

const truthy = (v: string | undefined) => v === "1" || v?.toLowerCase() === "true" || v?.toLowerCase() === "yes";
const falsy = (v: string | undefined) => v === "0" || v?.toLowerCase() === "false" || v?.toLowerCase() === "no";

export function parseKey(v: string | undefined): Hex | undefined {
  const s = v?.trim();
  if (!s) return undefined;
  const k = (s.startsWith("0x") ? s : `0x${s}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(k)) throw new Error("invalid private key format (expected 32-byte hex)");
  return k;
}

function parseAddr(name: string, v: string | undefined, fallback: Address | undefined): Address {
  const s = v?.trim();
  if (s) {
    if (!isAddress(s)) throw new Error(`${name} is not a valid address: ${s}`);
    return getAddress(s);
  }
  if (!fallback) throw new Error(`${name} is required for this chain (no known ERC-8004 deployment)`);
  return fallback;
}

export function parseAgentId(name: string, v: string | undefined): string | undefined {
  const s = v?.trim();
  if (!s) return undefined;
  if (!/^\d+$/.test(s)) throw new Error(`${name} must be a non-negative integer token id, got "${s}"`);
  return BigInt(s).toString();
}

/** Parse ERC-8004 config. Throws on malformed values; never returns secrets in errors. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): IdentityConfig {
  const chainId = Number(env.ERC8004_CHAIN_ID?.trim() || 56);
  if (!Number.isInteger(chainId) || chainId <= 0) throw new Error(`ERC8004_CHAIN_ID invalid: ${env.ERC8004_CHAIN_ID}`);
  const known = KNOWN_REGISTRIES[chainId];
  const rpcUrl =
    env.ERC8004_RPC_URL?.trim() || (chainId === 56 ? env.BSC_RPC_URL?.trim() : undefined) || known?.rpcUrl;
  if (!rpcUrl) throw new Error("ERC8004_RPC_URL is required for this chain");
  const agentIds: Partial<Record<AgentId, string>> = {};
  for (const [subject, name] of Object.entries(AGENT_ID_ENV) as [AgentId, string][]) {
    const id = parseAgentId(name, env[name]);
    if (id !== undefined) agentIds[subject] = id;
  }
  return {
    chainId,
    rpcUrl,
    identityRegistry: parseAddr("ERC8004_IDENTITY_REGISTRY", env.ERC8004_IDENTITY_REGISTRY, known?.identity),
    reputationRegistry: parseAddr("ERC8004_REPUTATION_REGISTRY", env.ERC8004_REPUTATION_REGISTRY, known?.reputation),
    agentIds,
    postFeedback: truthy(env.ERC8004_POST_FEEDBACK),
    executionKey: parseKey(env.EXECUTION_PRIVATE_KEY),
    inlineFeedbackFile: !falsy(env.ERC8004_FEEDBACK_INLINE),
    waitForReceipt: !falsy(env.ERC8004_WAIT_RECEIPT),
  };
}

/** True when any ERC-8004 setting is present - otherwise identityFromEnv() returns null. */
export function isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    truthy(env.ERC8004_POST_FEEDBACK) ||
    Object.values(AGENT_ID_ENV).some((k) => !!env[k]?.trim()) ||
    !!env.ERC8004_CHAIN_ID?.trim()
  );
}

export function ownerKeyFor(subject: AgentId, env: NodeJS.ProcessEnv = process.env): { key?: Hex; envName?: string } {
  for (const name of OWNER_KEY_ENV[subject]) {
    const key = parseKey(env[name]);
    if (key) return { key, envName: name };
  }
  return {};
}
