#!/usr/bin/env node
// ERC-8004 identity CLI for Elitr.
//   register --subject analyst|analyst-flow|execution [--uri <url>] [--yes]   simulate; broadcast only with --yes
//   card     --subject ... [--agent-id N]                                      print the registration file JSON
//   set-uri  --subject ... [--uri <url>] [--yes]                               update agentURI (needs ERC8004_AGENT_ID_*)
//   show     --subject ... | --agent-id N                                      read owner / agentURI / feedback summary
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { privateKeyToAccount } from "viem/accounts";
import type { AgentId } from "@elitr/shared";
import { AGENT_ID_ENV, loadConfig, ownerKeyFor, parseKey } from "./config.js";
import { readAgent, readFeedbackSummary, registerAgent, setAgentUri } from "./identity.js";
import { baseUrlFromEnv, buildRegistrationFile, fromDataUri, toDataUri } from "./registration.js";

const SUBJECTS: AgentId[] = ["analyst", "analyst-flow", "execution"];

function loadRootEnv() {
  // Shared repo-root .env (never committed). Existing process env wins.
  const here = dirname(fileURLToPath(import.meta.url));
  for (const p of [resolve(here, "../../../.env"), resolve(process.cwd(), ".env")]) {
    if (existsSync(p)) {
      try {
        process.loadEnvFile(p);
      } catch {
        /* ignore malformed */
      }
      return;
    }
  }
}

function parseArgs(argv: string[]) {
  const args = argv.filter((a) => a !== "--");
  const cmd = args.shift();
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[k] = next;
      i++;
    } else flags[k] = true;
  }
  return { cmd, flags };
}

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2);

function subjectOf(flags: Record<string, string | true>): AgentId {
  const s = flags.subject;
  if (typeof s !== "string" || !SUBJECTS.includes(s as AgentId)) {
    throw new Error(`--subject must be one of ${SUBJECTS.join(" | ")}`);
  }
  return s as AgentId;
}

function usage(): never {
  console.error(
    [
      "usage:",
      "  register --subject analyst|analyst-flow|execution [--uri <url>] [--yes]",
      "  card     --subject analyst|analyst-flow|execution [--agent-id N]",
      "  set-uri  --subject analyst|analyst-flow|execution [--uri <url>] [--yes]",
      "  show     --subject <s> | --agent-id N",
    ].join("\n"),
  );
  process.exit(2);
}

async function main() {
  loadRootEnv();
  const { cmd, flags } = parseArgs(process.argv.slice(2));
  if (!cmd || cmd === "help" || flags.help) usage();
  const env = process.env;
  const cfg = loadConfig(env);

  if (cmd === "card") {
    const subject = subjectOf(flags);
    const agentId = typeof flags["agent-id"] === "string" ? flags["agent-id"] : cfg.agentIds[subject];
    const file = buildRegistrationFile(subject, {
      baseUrl: baseUrlFromEnv(subject, env),
      ...(agentId ? { agentId, chainId: cfg.chainId, identityRegistry: cfg.identityRegistry } : {}),
    });
    console.log(json(file));
    return;
  }

  if (cmd === "show") {
    const agentId = typeof flags["agent-id"] === "string" ? flags["agent-id"] : cfg.agentIds[subjectOf(flags)];
    if (!agentId) throw new Error("no agent id: pass --agent-id or set ERC8004_AGENT_ID_*");
    const a = await readAgent(cfg, agentId);
    let decoded: unknown;
    try {
      decoded = a.agentURI.startsWith("data:") ? fromDataUri(a.agentURI) : undefined;
    } catch {
      /* not JSON */
    }
    const summary = await readFeedbackSummary(cfg, agentId, []);
    console.log(json({ chainId: cfg.chainId, identityRegistry: cfg.identityRegistry, ...a, registrationFile: decoded, feedback: summary }));
    return;
  }

  if (cmd === "register" || cmd === "set-uri") {
    const subject = subjectOf(flags);
    const { key, envName } = ownerKeyFor(subject, env);
    if (!key) {
      throw new Error(
        subject === "execution"
          ? "EXECUTION_PRIVATE_KEY is not set"
          : `ANALYST_OWNER_PRIVATE_KEY${subject === "analyst-flow" ? " (or ANALYST_FLOW_OWNER_PRIVATE_KEY)" : ""} is not set`,
      );
    }
    const broadcast = flags.yes === true;
    const uri = typeof flags.uri === "string" ? flags.uri : undefined;
    const trader = parseKey(env.EXECUTION_PRIVATE_KEY);
    const forbidOwner = subject !== "execution" && trader ? privateKeyToAccount(trader).address : undefined;
    const baseUrl = baseUrlFromEnv(subject, env);
    console.error(`chain ${cfg.chainId} via ${new URL(cfg.rpcUrl).host} | IdentityRegistry ${cfg.identityRegistry} | owner key from ${envName}`);

    if (cmd === "set-uri") {
      const agentId = cfg.agentIds[subject];
      if (!agentId) throw new Error(`${AGENT_ID_ENV[subject]} is not set`);
      const newUri =
        uri ?? toDataUri(buildRegistrationFile(subject, { baseUrl, agentId, chainId: cfg.chainId, identityRegistry: cfg.identityRegistry }));
      console.log(json({ agentId, agentURI: newUri.length > 200 ? `${newUri.slice(0, 200)}…` : newUri }));
      if (!broadcast) {
        console.error("simulate-only: re-run with --yes to send setAgentURI");
        return;
      }
      const tx = await setAgentUri({ config: cfg, privateKey: key, agentId, uri: newUri });
      console.log(json({ setUriTxHash: tx }));
      return;
    }

    const res = await registerAgent({
      subject,
      privateKey: key,
      config: cfg,
      uri,
      registration: { baseUrl },
      broadcast,
      forbidOwner,
    });
    if (res.registrationFile) {
      console.log("registration file:");
      console.log(json(res.registrationFile));
    }
    console.log(
      json({
        mode: broadcast ? "broadcast" : "simulate",
        subject,
        owner: res.owner,
        agentURI: res.agentURI.length > 120 ? `${res.agentURI.slice(0, 120)}… (${res.agentURI.length} chars)` : res.agentURI,
        simulatedAgentId: res.simulatedAgentId,
        estimatedGas: res.estimatedGas,
        agentId: res.agentId,
        txHash: res.txHash,
        setUriTxHash: res.setUriTxHash,
      }),
    );
    if (broadcast && res.agentId) {
      console.log(`\nadd to .env:\n${AGENT_ID_ENV[subject]}=${res.agentId}`);
      // Same shape as the shared `identity.registered` event.
      console.log(
        json({ type: "identity.registered", subject, erc8004AgentId: res.agentId, registry: `eip155:${cfg.chainId}:${cfg.identityRegistry}`, txHash: res.txHash }),
      );
    } else if (!broadcast) {
      console.error("simulate-only: nothing was sent. Re-run with --yes to mint.");
    }
    return;
  }
  usage();
}

main().catch((e: unknown) => {
  const err = e as { shortMessage?: string; message?: string };
  console.error(`error: ${err.shortMessage ?? err.message ?? String(e)}`);
  process.exit(1);
});
