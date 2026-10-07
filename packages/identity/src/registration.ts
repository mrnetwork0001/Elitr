import type { AgentId } from "@elitr/shared";
import { AGENT_ID_ENV, loadConfig } from "./config.js";

// ERC-8004 agent registration file ("registration-v1"), per
// https://eips.ethereum.org/EIPS/eip-8004#agent-uri-and-agent-registration-file
export const REGISTRATION_TYPE = "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";
export const DATA_URI_PREFIX = "data:application/json;base64,";
// Path where each agent should serve its registration file (ERC-8004 "Endpoint Domain Verification").
export const REGISTRATION_WELL_KNOWN_PATH = "/.well-known/agent-registration.json";

export interface RegistrationService {
  name: string;
  endpoint: string;
  version?: string;
  [k: string]: unknown;
}

export interface RegistrationFile {
  type: typeof REGISTRATION_TYPE;
  name: string;
  description: string;
  image: string;
  services: RegistrationService[];
  x402Support: boolean;
  active: boolean;
  registrations: { agentId: number | string; agentRegistry: string }[];
  supportedTrust: string[];
}

export interface RegistrationOpts {
  /** Public base URL of the agent, e.g. https://analyst.elitr.xyz (no trailing slash needed). */
  baseUrl: string;
  name?: string;
  description?: string;
  image?: string;
  /** Set once minted; fills `registrations` (needs chainId + identityRegistry too). */
  agentId?: string | number | bigint;
  chainId?: number;
  identityRegistry?: string;
  active?: boolean;
  /** Extra services appended verbatim. */
  extraServices?: RegistrationService[];
}

const DEFAULTS: Record<AgentId, { name: string; description: string; paid: boolean }> = {
  analyst: {
    name: "Elitr News Analyst",
    description:
      "Elitr news-sentiment analyst. Sells a 1-100 confidence signal for tokenized stocks on BSC (bStocks / Ondo / xStocks) " +
      "via pay-per-call b402 (x402 V2) at GET /signal?symbol=<SYMBOL>. Free discovery at GET /info. " +
      "Accuracy is scored by the Elitr execution agent and posted to the ERC-8004 Reputation Registry.",
    paid: true,
  },
  "analyst-flow": {
    name: "Elitr On-chain Flow Analyst",
    description:
      "Elitr on-chain flow analyst. Sells a deterministic 1-100 confidence signal derived from BSC swap flow for tokenized stocks " +
      "(bStocks / Ondo / xStocks) via pay-per-call b402 (x402 V2) at GET /signal?symbol=<SYMBOL>. Free discovery at GET /info. " +
      "Accuracy is scored by the Elitr execution agent and posted to the ERC-8004 Reputation Registry.",
    paid: true,
  },
  execution: {
    name: "Elitr Execution Agent",
    description:
      "Elitr trader. Buys analyst signals over b402, selects sellers by Thompson sampling over a Beta trust model, " +
      "trades tokenized stocks on BSC after Transaction API dry-runs, and rates each analyst's accuracy on-chain " +
      "via ERC-8004 giveFeedback (agents rating agents). Live event stream at GET /events.",
    paid: false,
  },
};

const trimSlash = (u: string) => u.replace(/\/+$/, "");

export function buildRegistrationFile(subject: AgentId, opts: RegistrationOpts): RegistrationFile {
  const d = DEFAULTS[subject];
  if (!d) throw new Error(`unknown subject "${subject}"`);
  if (!opts.baseUrl || !/^https?:\/\//.test(opts.baseUrl)) throw new Error("baseUrl must start with http:// or https://");
  const base = trimSlash(opts.baseUrl);
  const services: RegistrationService[] = [{ name: "web", endpoint: base }];
  if (d.paid) {
    // Non-standard service names are allowed by the spec ("fully customizable").
    services.push({ name: "x402", endpoint: `${base}/signal`, version: "2", payment: "b402", network: "eip155:56" });
    services.push({ name: "info", endpoint: `${base}/info` });
  } else {
    services.push({ name: "events", endpoint: `${base}/events` });
  }
  services.push({ name: "registration", endpoint: `${base}${REGISTRATION_WELL_KNOWN_PATH}` });
  if (opts.extraServices) services.push(...opts.extraServices);

  const registrations: RegistrationFile["registrations"] = [];
  if (opts.agentId !== undefined && opts.agentId !== null && opts.chainId && opts.identityRegistry) {
    const id = BigInt(opts.agentId);
    registrations.push({
      agentId: id <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(id) : id.toString(),
      agentRegistry: `eip155:${opts.chainId}:${opts.identityRegistry}`,
    });
  }
  return {
    type: REGISTRATION_TYPE,
    name: opts.name ?? d.name,
    description: opts.description ?? d.description,
    image: opts.image ?? "",
    services,
    x402Support: d.paid,
    active: opts.active ?? true,
    registrations,
    supportedTrust: ["reputation"],
  };
}

export function toDataUri(file: object): string {
  return DATA_URI_PREFIX + Buffer.from(JSON.stringify(file), "utf8").toString("base64");
}

export function fromDataUri(uri: string): unknown {
  if (!uri.startsWith(DATA_URI_PREFIX)) throw new Error("not a base64 JSON data URI");
  return JSON.parse(Buffer.from(uri.slice(DATA_URI_PREFIX.length), "base64").toString("utf8"));
}

/** Public base URL per subject from env (falls back to the local dev ports). */
export function baseUrlFromEnv(subject: AgentId, env: NodeJS.ProcessEnv = process.env): string {
  const pick: Record<AgentId, [string | undefined, string]> = {
    analyst: [env.ANALYST_PUBLIC_URL, `http://localhost:${env.ANALYST_PORT || 4001}`],
    "analyst-flow": [
      env.FLOW_ANALYST_PUBLIC_URL || env.ANALYST_FLOW_PUBLIC_URL,
      `http://localhost:${env.FLOW_ANALYST_PORT || env.ANALYST_FLOW_PORT || 4003}`,
    ],
    execution: [env.EXECUTION_PUBLIC_URL, `http://localhost:${env.EXECUTION_PORT || 4002}`],
  };
  const [pub, local] = pick[subject];
  return trimSlash(pub?.trim() || local);
}

/** The registration file an agent serves at REGISTRATION_WELL_KNOWN_PATH, filled from env. */
export function registrationFromEnv(subject: AgentId, env: NodeJS.ProcessEnv = process.env): RegistrationFile {
  let chainId: number | undefined;
  let identityRegistry: string | undefined;
  try {
    ({ chainId, identityRegistry } = loadConfig(env));
  } catch {
    /* unconfigured chain: serve the file without `registrations` */
  }
  return buildRegistrationFile(subject, {
    baseUrl: baseUrlFromEnv(subject, env),
    agentId: loadAgentId(subject, env),
    chainId,
    identityRegistry,
  });
}

function loadAgentId(subject: AgentId, env: NodeJS.ProcessEnv): string | undefined {
  const v = env[AGENT_ID_ENV[subject]]?.trim();
  return v && /^\d+$/.test(v) ? v : undefined;
}
