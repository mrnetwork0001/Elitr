import type { Server } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ASSETS, EventHub, type AnalystInfo, type TokenizedStock } from "@elitr/shared";
import { b402ConfigFromEnv, priceUsd, DEFAULT_PRICE_WEI } from "./b402.js";
import { FLOW_MODEL, FlowReader, flowConfigFromEnv } from "./flow.js";
import { NEWS_FEEDS } from "./news.js";
import { startAnalystServer } from "./paywall.js";
import { DEFAULT_MODEL, Scorer } from "./scorer.js";
import { flowProducer, newsProducer, SignalService } from "./signal.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const posInt = (v: string | undefined, def: number, name: string) => {
  const n = Number(v ?? def);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer`);
  return n;
};

function info(
  base: Omit<AnalystInfo, "priceAmount" | "priceAsset" | "priceUsd" | "erc8004AgentId">,
  b402: ReturnType<typeof b402ConfigFromEnv>,
  env: NodeJS.ProcessEnv,
  priceVar: string,
  agentIdVar: string,
): AnalystInfo {
  // Same amount/asset the 402 requirements are built from; reported even before b402 is configured.
  const priceAmount = b402.config?.amount ?? env[priceVar] ?? env.ANALYST_PRICE_WEI ?? DEFAULT_PRICE_WEI;
  const priceAsset = b402.config?.asset ?? env.ANALYST_PAYMENT_ASSET ?? "";
  return {
    ...base,
    priceAmount,
    priceAsset,
    priceUsd: priceAsset ? priceUsd(priceAsset, priceAmount) : null,
    ...(env[agentIdVar] ? { erc8004AgentId: env[agentIdVar] } : {}),
  };
}

/** News analyst on ANALYST_PORT, plus the on-chain flow analyst on FLOW_ANALYST_PORT (set it to 0 to disable). */
export function startServers(env: NodeJS.ProcessEnv = process.env): Server[] {
  const origin = env.DASHBOARD_ORIGIN || "*";
  const cacheSec = Number(env.SIGNAL_CACHE_SEC || 120);
  const servers: Server[] = [];

  // --- news-sentiment analyst ("analyst")
  {
    const b402 = b402ConfigFromEnv(env);
    const llmConfigured = Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);
    const scorer = new Scorer(env.ANALYST_MODEL || DEFAULT_MODEL);
    const horizonSec = posInt(env.ANALYST_HORIZON_SEC, 3600, "ANALYST_HORIZON_SEC");
    const assets = Object.values(ASSETS);
    servers.push(
      startAnalystServer({
        label: "analyst",
        port: Number(env.ANALYST_PORT || 4001),
        hub: new EventHub("analyst", resolve(REPO, "data/analyst-events.jsonl")),
        assets,
        b402,
        notReady: () =>
          llmConfigured ? [] : ["No LLM credentials: set ANTHROPIC_AUTH_TOKEN (0G Router) or ANTHROPIC_API_KEY"],
        signals: new SignalService(newsProducer(scorer, horizonSec), cacheSec),
        publicUrl: env.ANALYST_PUBLIC_URL,
        dashboardOrigin: origin,
        resourceDescription: (a: TokenizedStock) => `News-sentiment signal (score 1-100) for ${a.symbol} / ${a.underlying}`,
        health: () => ({ llmConfigured, model: scorer.model, newsSources: NEWS_FEEDS.map((f) => f.name) }),
        info: info(
          {
            analystId: "analyst",
            name: "Elitr News Analyst",
            kind: "news-sentiment",
            description: `LLM (${scorer.model}) reads the last 48h of Yahoo Finance + Google News headlines on the underlying stock and scores short-term sentiment 1-100, citing the headlines it used.`,
            symbols: assets.map((a) => a.symbol),
            horizonSec,
          },
          b402,
          env,
          "ANALYST_PRICE_WEI",
          "ERC8004_AGENT_ID_ANALYST",
        ),
      }),
    );
  }

  // --- on-chain flow analyst ("analyst-flow")
  const flowPort = Number(env.FLOW_ANALYST_PORT ?? 4003);
  if (flowPort > 0) {
    const b402 = b402ConfigFromEnv(env, "FLOW_ANALYST");
    const reader = new FlowReader(flowConfigFromEnv(env));
    const horizonSec = posInt(env.FLOW_HORIZON_SEC, 1800, "FLOW_HORIZON_SEC");
    const minSwaps = posInt(env.FLOW_MIN_SWAPS, 5, "FLOW_MIN_SWAPS");
    const assets = Object.values(ASSETS).filter((a) => a.primaryPool);
    const { lookbackSec, largeTradeUsd, rpcUrls } = reader.config;
    servers.push(
      startAnalystServer({
        label: "analyst-flow",
        port: flowPort,
        hub: new EventHub("analyst-flow", resolve(REPO, "data/analyst-flow-events.jsonl")),
        assets,
        b402,
        notReady: () => [],
        signals: new SignalService(flowProducer(reader, horizonSec, minSwaps), cacheSec),
        publicUrl: env.FLOW_ANALYST_PUBLIC_URL,
        dashboardOrigin: origin,
        resourceDescription: (a: TokenizedStock) => `On-chain order-flow signal (score 1-100) for ${a.symbol} from its PancakeSwap v3 pool`,
        // RPC hosts only — full URLs can embed API keys.
        health: () => ({ model: FLOW_MODEL, lookbackSec, minSwaps, rpcHosts: rpcUrls.map((u) => new URL(u).host) }),
        info: info(
          {
            analystId: "analyst-flow",
            name: "Elitr Flow Analyst",
            kind: "onchain-flow",
            description:
              `Reads every PancakeSwap v3 Swap on the token's USDT pool over the last ${Math.round(lookbackSec / 60)} min and scores ` +
              `order flow deterministically (${FLOW_MODEL}): net buy volume, large-trade (>= $${largeTradeUsd}) imbalance, ` +
              `buyer vs seller breadth and price momentum. No LLM; sources link the largest swaps on BscScan.`,
            symbols: assets.map((a) => a.symbol),
            horizonSec,
          },
          b402,
          env,
          "FLOW_ANALYST_PRICE_WEI",
          "ERC8004_AGENT_ID_ANALYST_FLOW",
        ),
      }),
    );
  }
  return servers;
}
