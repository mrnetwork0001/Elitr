/**
 * Desk-brief work hook for the x402 face + the request-scoped snapshot that
 * makes "fail without charging" possible.
 *
 * The B402 seller in @bnbagent/studio-runtime settles payment BEFORE it calls
 * the work hook, and a post-settlement failure retains the payment. So the
 * HTTP route (unifiedMain.ts) fetches the Elitr snapshot FIRST, returns 503
 * if Elitr is unreachable (nothing is settled), and only then hands the
 * request to the seller inside `snapshotContext.run(snapshot, …)`. The work
 * hook below reads that exact snapshot, so the paid work itself does no
 * network I/O to Elitr and is pure formatting (plus an optional LLM headline
 * that can never fail the job).
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { generateText } from "ai";
import { loadStudioToml } from "@bnbagent/studio-runtime/config";
import { buildBrief, getElitrSnapshot, type ElitrSnapshot, type X402Offer } from "./elitr.js";
import { buildModel } from "./model.js";

export const snapshotContext = new AsyncLocalStorage<ElitrSnapshot>();

function llmEnabled(): boolean {
  if ((process.env.ELITR_BRIEF_LLM ?? "auto").toLowerCase() === "off") return false;
  try {
    const cfg = loadStudioToml();
    const llm = (cfg.llm ?? {}) as Record<string, unknown>;
    if (String(llm.provider ?? "") === "none") return false;
    if (String(llm.provider ?? "") === "pieverse-llm") {
      const pv = (llm.pieverse ?? {}) as Record<string, unknown>;
      return Boolean(process.env.PIEVERSE_LLM_API_KEY) && Boolean(pv.key_hash);
    }
    return true;
  } catch {
    return false;
  }
}

/** Every number the LLM writes must already appear in the facts it was given. */
function numbersGrounded(out: string, facts: string): boolean {
  const nums = out.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return nums.every((n) => facts.includes(n));
}

let model: ReturnType<typeof buildModel> | undefined;

/**
 * Optional wording pass: rewrite the deterministic headline into ≤ 2 crisp
 * sentences. Returns null (→ keep the deterministic headline) on any error,
 * timeout, or if the LLM introduces a number not present in the facts.
 */
async function tightenHeadline(facts: string): Promise<string | null> {
  if (!llmEnabled()) return null;
  try {
    model ??= buildModel();
    const res = await generateText({
      model,
      system:
        "You rewrite trading-desk facts into a crisp headline of at most two sentences. " +
        "Use ONLY the facts given. Do not add numbers, predictions, advice, or adjectives " +
        "that are not supported by the facts. Plain text, no markdown.",
      prompt: facts,
      abortSignal: AbortSignal.timeout(15_000),
    });
    const text = res.text.trim().replace(/\s+/g, " ");
    if (!text || text.length > 400 || !numbersGrounded(text, facts)) return null;
    return text;
  } catch (e) {
    console.warn(
      `[desk-brief] LLM wording pass skipped: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}

/** x402 work hook: returns the brief as a JSON string (the seller wraps it as {result}). */
export async function deskBriefWork(): Promise<string> {
  // The route pre-fetched this snapshot before any payment was settled. The
  // fallback fetch only runs if the work hook is reached some other way.
  const snap = snapshotContext.getStore() ?? (await getElitrSnapshot());
  const brief = buildBrief(snap);
  const facts = [brief.headline, brief.summary.text ?? ""].join("\n");
  const tightened = await tightenHeadline(facts);
  if (tightened) {
    brief.headline = tightened;
    brief.headlineSource = `llm:${modelId()} (numbers verified against facts)`;
  }
  return JSON.stringify(brief);
}

function modelId(): string {
  try {
    const llm = (loadStudioToml().llm ?? {}) as Record<string, unknown>;
    return `${llm.provider ?? "?"}/${llm.model ?? "?"}`;
  } catch {
    return "?";
  }
}

/** The buyer-facing x402 offer for this agent (price from studio.toml). */
export function x402Offer(fallbackPort: number, sellPath = "/x402"): X402Offer {
  let price = "?";
  let network = "bsc-testnet";
  try {
    const cfg = loadStudioToml();
    const payments = (cfg.payments ?? {}) as Record<string, unknown>;
    const seller = (payments.seller ?? {}) as Record<string, unknown>;
    price = String(seller.price_usd ?? "?");
    network = String(((cfg.network ?? {}) as Record<string, unknown>).default ?? network);
  } catch {
    // informational only
  }
  const base =
    process.env.BNBAGENT_PUBLIC_URL ??
    process.env.AGENT_PUBLIC_URL ??
    process.env.AGENTCORE_RUNTIME_URL ??
    `http://localhost:${fallbackPort}`;
  return {
    protocol: "x402",
    url: `${base.replace(/\/+$/, "")}${sellPath}?prompt=brief`,
    method: "GET or POST",
    prompt: "any non-empty prompt, e.g. \"brief\"",
    priceUsd: price,
    network,
    note:
      price === "0"
        ? "FREE mode: no payment required."
        : "Pay with an x402 client (e.g. `bag x402 buy <url> --max-usd 0.01`). " +
          "If Elitr is unreachable the route answers 503 before any payment is requested.",
  };
}
