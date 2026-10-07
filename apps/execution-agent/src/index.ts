import "./env.js"; // must stay first: normalizes process.env before other modules read it
import { identityFromEnv, readAgent, type Identity } from "@elitr/identity";
import { ReputationBook } from "@elitr/reputation";
import { EventHub, loadRiskConfig } from "@elitr/shared";
import { parseAnalysts } from "./analysts.js";
import { ExecutionAgent, makeBinance } from "./cycle.js";
import { isLoopback, startServer } from "./server.js";
import { EVENTS_FILE, REPUTATION_FILE, StateStore } from "./state.js";
import { loadAccount, makePublicClient } from "./wallet.js";

const env = process.env;
const host = env.EXECUTION_HOST ?? "127.0.0.1";
const controlToken = env.CONTROL_TOKEN?.trim() || undefined;
if (!isLoopback(host) && !controlToken) {
  console.error(
    `[execution] refusing to start: EXECUTION_HOST=${host} is not loopback and CONTROL_TOKEN is not set — ` +
      `POST /cycle and /kill would be open to the network. Set CONTROL_TOKEN or bind 127.0.0.1.`,
  );
  process.exit(1);
}

const risk = loadRiskConfig(env);
const hub = new EventHub("execution", EVENTS_FILE);
const acct = loadAccount(env);
const bin = makeBinance();
const live = env.LIVE_TRADING === "1";
const tradeUsd = Number(env.EXECUTION_TRADE_USD ?? risk.maxTradeUsd);
const minBnbForGas = Number(env.EXECUTION_MIN_BNB_GAS ?? 0.001);
if (!Number.isFinite(tradeUsd) || tradeUsd <= 0) throw new Error(`EXECUTION_TRADE_USD invalid: ${env.EXECUTION_TRADE_USD}`);

const { endpoints: analysts, errors: analystErrors } = parseAnalysts(env);
for (const e of analystErrors) hub.emit({ type: "error", where: "config", message: e });

// ERC-8004 feedback costs gas, so it is strictly opt-in (@elitr/identity applies the same gate).
const postFeedback = env.ERC8004_POST_FEEDBACK === "1";
let identity: Identity | null = null;
let identityError: string | undefined;
try {
  identity = identityFromEnv(env);
} catch (e) {
  identityError = (e as Error).message;
}

const book = new ReputationBook(REPUTATION_FILE, { minSamples: risk.minAnalystSamples, pauseBelow: risk.minAnalystTrust });

const agent = new ExecutionAgent({
  hub,
  store: new StateStore(),
  risk,
  pc: makePublicClient(env.BSC_RPC_URL),
  account: "account" in acct ? acct.account : null,
  accountError: "error" in acct ? acct.error : undefined,
  binance: bin.client,
  binanceError: bin.error,
  book,
  identity,
  identityError,
  configErrors: identityError ? [...analystErrors, `identity: ${identityError}`] : analystErrors,
  cfg: {
    analysts,
    live,
    mevProtection: env.EXECUTION_MEV_PROTECTION !== "0",
    tradeUsd,
    minBnbForGas,
    postFeedback,
    controlAuth: !!controlToken,
  },
});

console.log(
  `[execution] wallet=${agent.d.account?.address ?? `none (${agent.d.accountError})`} mode=${agent.mode} ` +
    `binance=${bin.client ? "configured" : "missing"} trade=$${tradeUsd} assets=${agent.assets.map((a) => a.symbol).join(",")} ` +
    `analysts=${analysts.map((a) => `${a.id}@${a.url}`).join(",")} erc8004Feedback=${postFeedback ? (identity ? "on" : "on (no identity)") : "off"} ` +
    `controlAuth=${controlToken ? "bearer" : "none (loopback)"}`,
);

const server = startServer(agent, Number(env.EXECUTION_PORT ?? 4002), host, controlToken);

// Announce configured ERC-8004 identities — only those that actually exist on-chain.
if (identity) {
  for (const subject of ["analyst", "analyst-flow", "execution"] as const) {
    const id = identity.agentIdOf(subject);
    if (!id) continue;
    readAgent(identity.config, id)
      .then(() => hub.emit({ type: "identity.registered", subject, erc8004AgentId: id, registry: identity.config.identityRegistry }))
      .catch((e) => hub.emit({ type: "error", where: "erc8004", message: `agent id ${id} for ${subject} not found on-chain: ${(e as Error).message.split("\n")[0]}` }));
  }
}

// Self-scheduling loop: next cycle is planned only after the previous one finishes.
// Default 900 s: 2 assets × $0.01 per signal × 96 cycles/day = $1.92 ≤ the $2 data budget.
const intervalSec = Number(env.LOOP_INTERVAL_SEC ?? 900);
let timer: NodeJS.Timeout | undefined;
const schedule = (ms: number) => {
  if (!(intervalSec > 0)) return; // LOOP_INTERVAL_SEC=0 → on-demand only (POST /cycle)
  agent.nextCycleAt = Date.now() + ms;
  timer = setTimeout(async () => {
    if (!agent.running) await agent.runCycle("timer").catch(() => {});
    schedule(intervalSec * 1000);
  }, ms);
};
schedule(5_000);

const shutdown = () => {
  clearTimeout(timer);
  server.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("unhandledRejection", (e) => hub.emit({ type: "error", where: "unhandledRejection", message: String((e as Error)?.message ?? e) }));
