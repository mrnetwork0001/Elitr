/**
 * A2A AgentCard - the seller agent's outward, discoverable identity.
 *
 * Built by `main.ts` and served at `/.well-known/agent-card.json`. When
 * deployed, `main.ts` overwrites `card.url` at boot with the deployed
 * AgentCore runtime URL (`$AGENTCORE_RUNTIME_URL`), so the `url` here is only
 * a local-dev placeholder.
 *
 * The card advertises exactly two skills - `negotiate` and `notify_funded` -
 * and the OAuth2 (Cognito) security scheme buyers must satisfy: AgentCore A2A
 * endpoints require an inbound OAuth2 bearer (there is no anonymous mode).
 * The token URL + scope come from the Cognito user pool
 * `bag deploy provision-cognito` creates (env `OAUTH_TOKEN_URL` /
 * `OAUTH_SCOPE`, injected at deploy); the runtime's inbound JWT authorizer
 * validates the same pool. Locally (no Cognito env) the card omits the scheme
 * so `bag dev` is reachable without a token.
 *
 * You own this file - edit the skill descriptions / card metadata for your
 * seller.
 */

import type { AgentCard, AgentSkill, SecurityScheme } from "@a2a-js/sdk";
import { loadStudioToml } from "@bnbagent/studio-runtime/config";

const NEGOTIATE: AgentSkill = {
  id: "negotiate",
  name: "Negotiate an ERC-8183 job",
  description:
    'Send a data part {"skill": "negotiate", "task_description": "...", ' +
    '"terms": {"deliverables": "...", "quality_standards": "..."}} (both ' +
    "terms keys are REQUIRED) and receive a " +
    "wallet-signed price quote (price, currency, negotiation_hash, provider_sig). " +
    "Anchor the returned envelope on-chain via createJob + fund, then send the " +
    "`notify_funded` skill with the job_id to request delivery.",
  tags: ["erc8183", "negotiation", "bnb-chain"],
  inputModes: ["application/json"],
  outputModes: ["application/json"],
};

const NOTIFY_FUNDED: AgentSkill = {
  id: "notify_funded",
  name: "Notify the seller a job is funded (request delivery)",
  description:
    'After you fund the job on-chain, send {"skill": "notify_funded", ' +
    '"job_id": <int>} to tell the seller "I funded job X - please deliver". ' +
    "The seller verifies the funded job carries its signed quote and replies " +
    'AT ONCE with {"status": "accepted"|"rejected", "job_id"}; delivery then ' +
    "runs in the background (work takes time). Do NOT wait on this call for " +
    "the result - read the deliverable back from the CHAIN once the job " +
    "reaches SUBMITTED (the `submit` tx carries the deliverable_url; " +
    "ERC-8183 `get_deliverable_url`). The agent serves no job-query endpoint.",
  tags: ["erc8183", "delivery", "bnb-chain"],
  inputModes: ["application/json"],
  outputModes: ["application/json"],
};

// ── Elitr Desk Brief skills ─────────────────────────────────────────────────

const BRIEF_PREVIEW: AgentSkill = {
  id: "brief_preview",
  name: "Free preview of the live Elitr desk",
  description:
    'FREE. Send a data part {"skill": "brief_preview"}. Returns live facts from ' +
    "the Elitr agent-to-agent trading desk on BSC mainnet (https://elitr.xyz): " +
    "mode (paper/live), US market status, the analysts' and trader's ERC-8004 " +
    "agent ids, plus the x402 offer for the full brief.",
  tags: ["elitr", "tokenized-stocks", "bstocks", "preview", "free"],
  examples: ['{"skill": "brief_preview"}'],
  inputModes: ["application/json"],
  outputModes: ["application/json"],
};

function deskBriefSkill(sellPath: string): AgentSkill {
  return {
    id: "desk_brief",
    name: "Elitr Desk Brief (paid, x402)",
    description:
      `PAID over x402 at ${sellPath}?prompt=brief (B402, BSC testnet, price from ` +
      "studio.toml). A concise factual brief of the live Elitr desk: mode, " +
      "today's plain-English summary, both analysts' hit rate / trust / ERC-8004 " +
      "ids, open positions + P&L, and the top tokenized-stock weekend-gap spreads " +
      "(on-chain vs reference) with US market status. Every fact is copied from " +
      "Elitr's public endpoints and returned with its sources; if Elitr is " +
      "unreachable the route answers 503 before any payment is requested. " +
      'Over A2A, {"skill": "desk_brief"} returns the payment offer.',
    tags: ["elitr", "x402", "b402", "tokenized-stocks", "erc8004", "brief"],
    examples: ['{"skill": "desk_brief"}'],
    inputModes: ["application/json"],
    outputModes: ["application/json"],
  };
}

export const AGENT_DISPLAY_NAME = "Elitr Desk Brief";
export const AGENT_DESCRIPTION =
  "Autonomous seller agent that resells a concise, factual brief of the live " +
  "Elitr agent-to-agent trading desk (https://elitr.xyz) over x402: news + " +
  "on-chain-flow analysts sell signals over b402 to a trader that trades " +
  "bStocks (NVDAB/TSLAB) on BSC and rates them on ERC-8004 (BSC mainnet " +
  "agents #365554 news analyst, #365555 flow analyst, #365556 trader). " +
  "Free preview over A2A; full brief over x402.";

/** Card name from studio.toml `[project].name` (best-effort). */
function agentName(): string {
  let name = "";
  try {
    const cfg = loadStudioToml();
    name = String(
      ((cfg.project ?? {}) as Record<string, unknown>).name ?? "",
    );
  } catch {
    // a card label must never break boot
  }
  return name || "bnbagent-seller";
}

/**
 * OAuth2 (Cognito client-credentials) scheme from env, or null locally.
 *
 * `bag deploy provision-cognito` emits a Cognito user pool + app client and
 * injects `OAUTH_TOKEN_URL` + `OAUTH_SCOPE`; the AgentCore runtime's inbound
 * JWT authorizer is wired to the same pool. Absent (local `bag dev`) →
 * return null so the card advertises no auth requirement.
 */
function oauth2Scheme(): SecurityScheme | null {
  const tokenUrl = process.env.OAUTH_TOKEN_URL;
  const scope = process.env.OAUTH_SCOPE;
  if (!tokenUrl || !scope) {
    return null;
  }
  return {
    type: "oauth2",
    flows: {
      clientCredentials: {
        tokenUrl,
        scopes: { [scope]: "Invoke the seller agent" },
      },
    },
  };
}

/** Build the A2A AgentCard, gating ERC-8183 skills on the configured rail. */
export function buildAgentCard(
  opts: { commerceSkills?: boolean; sellPath?: string } = {},
): AgentCard {
  // Elitr Desk Brief: fixed display name (studio.toml [project].name stays
  // the deploy slug source, "ElitrDesk-agent").
  void agentName;
  const name = AGENT_DISPLAY_NAME;
  const extra: Partial<AgentCard> = {};
  const scheme = oauth2Scheme();
  if (scheme !== null) {
    const scope = process.env.OAUTH_SCOPE as string;
    extra.securitySchemes = { oauth2: scheme };
    extra.security = [{ oauth2: [scope] }];
  }
  return {
    name,
    description: AGENT_DESCRIPTION,
    provider: { organization: "Elitr", url: "https://elitr.xyz" },
    documentationUrl: "https://elitr.xyz",
    // main.ts overwrites this with $AGENTCORE_RUNTIME_URL at boot.
    // Local-dev fallback: a client-routable localhost URL (not the 0.0.0.0
    // bind address). Host via AGENT_HOST (default localhost); port via the
    // same AGENT_PORT → 9000 resolution main.ts serves on. Do not honor the
    // AgentCore HTTP $PORT=8080 convention for this A2A runtime.
    url:
      // Self-hosted (e.g. behind Caddy on a VPS): advertise the public HTTPS base.
      (process.env.BNBAGENT_PUBLIC_URL ? process.env.BNBAGENT_PUBLIC_URL.replace(/\/?$/, "/") : undefined) ??
      process.env.AGENTCORE_RUNTIME_URL ??
      `http://${process.env.AGENT_HOST ?? "localhost"}:${process.env.AGENT_PORT || "9000"}/`,
    version: "1.0.0",
    protocolVersion: "0.3.0",
    preferredTransport: "JSONRPC",
    // Non-streaming: negotiate / notify_funded are request/response
    // (message/send). Do NOT flip this on to satisfy the AgentCore
    // inspector's chat box - that box can't drive a seller agent (it can
    // only send plain text, never the {"skill": ...} DataPart these skills
    // require, and its streaming view expects Task events). Test locally
    // with curl / an A2A client sending a DataPart (see the operating skill).
    capabilities: { streaming: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: [
      BRIEF_PREVIEW,
      deskBriefSkill(opts.sellPath ?? "/x402"),
      ...(opts.commerceSkills === false ? [] : [NEGOTIATE, NOTIFY_FUNDED]),
    ],
    ...extra,
  };
}
