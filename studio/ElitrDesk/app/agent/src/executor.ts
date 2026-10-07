/**
 * A2A executor — the seller agent's outward A2A surface (two fixed-code
 * skills).
 *
 * The agent serves A2A directly (an `@a2a-js/sdk` express app on the
 * AgentCore A2A runtime contract). This module is ONLY the a2a wire:
 * {@link SellerAgentExecutor} inherits all of the seller logic +
 * background-delivery machinery from `sellerCore.ts` `SellerCore` (which
 * imports nothing from `@a2a-js/sdk`) and adds the a2a-specific
 * {@link SellerAgentExecutor.execute} / {@link SellerAgentExecutor.cancelTask}
 * entrypoints plus the request/response wire helpers. `execute` reads the
 * inbound message's data part and dispatches on its `skill`:
 *
 *     negotiate     → `SellerCore.negotiate` (rule-based price clamp + EIP-191 sign)
 *     notify_funded → `SellerCore.notifyFunded` (fast on-chain gate) → ACK at
 *                     once, then in the BACKGROUND: LLM work → `signing.submitResult`
 *
 * `notify_funded` is the buyer's "I funded job X — please deliver"
 * notification. Because the work takes time, the executor does NOT block the
 * caller: the core verifies the funded job synchronously (a couple of
 * eth_calls) to ACK accepted/rejected, then runs the slow LLM work + on-chain
 * `submit` in a background task and replies immediately. The buyer reads the
 * deliverable back from the CHAIN (SUBMITTED / `getDeliverableUrl`) — the
 * chain is the source of truth. While any background delivery is in flight
 * `isBusy` (from `SellerCore`) reports busy, which `main.ts` feeds to
 * AgentCore's `/ping` as `HEALTHY_BUSY` so the scale-to-zero runtime stays
 * warm until the work lands (within the session max-lifetime).
 *
 * ALL signing is FIXED code in `signing.ts` — NEVER an LLM-callable tool
 * (money is never in the LLM; the LLM only produces the work text, via the
 * `runWork` hook). See `sellerCore.ts` for the negotiate / notifyFunded /
 * sweep logic.
 *
 * You own this file — specialise the work hook / dispatch in `sellerCore.ts`,
 * but keep signing OUT of the LLM tool list.
 */

import { randomUUID } from "node:crypto";
import type { DataPart, Message } from "@a2a-js/sdk";
import {
  A2AError,
  type AgentExecutor,
  type ExecutionEventBus,
  type RequestContext,
} from "@a2a-js/sdk/server";
import { buildPreview, getElitrSnapshot } from "./elitr.js";
import { x402Offer } from "./deskBrief.js";
import { isCommerceRateLimitError } from "./requestLimits.js";
import { SellerCore, type SellerCoreOpts } from "./sellerCore.js";

/** Elitr Desk Brief A2A skills (no signing, no payment, no LLM). */
export const BRIEF_SKILLS = ["brief_preview", "desk_brief"] as const;

const log = {
  error: (msg: string, e?: unknown) =>
    console.error(`[seller-agent.a2a] ERROR ${msg}`, e ?? ""),
};

/**
 * ERC-8183 seller A2A executor: the a2a wire over `SellerCore`.
 *
 * All seller logic (negotiate, notifyFunded, background delivery, `isBusy`,
 * the constructor bookkeeping, the `runWork` hook) lives in
 * `sellerCore.ts` `SellerCore`; this class adds only the A2A entrypoints and
 * request/response wire helpers.
 *
 * The agent exposes ONLY the two paid, structured skills — there is no
 * free-form chat skill. A plain text message (no `{"skill": ...}` DataPart)
 * is rejected: negotiate / notify_funded always need a structured DataPart,
 * so prose never triggers an LLM call or a paid action.
 */
export class SellerAgentExecutor extends SellerCore implements AgentExecutor {
  private readonly briefPort: number;
  private readonly briefSellPath: string;

  constructor(
    opts: SellerCoreOpts & { briefPort?: number; briefSellPath?: string },
  ) {
    super(opts);
    this.briefPort = opts.briefPort ?? 9000;
    this.briefSellPath = opts.briefSellPath ?? "/x402";
  }

  /**
   * Elitr Desk Brief A2A skills.
   *
   *   brief_preview → FREE teaser built from live Elitr data (mode, market
   *                   status, analysts' ERC-8004 ids) + how to buy the brief.
   *   desk_brief    → the full brief is sold over x402; this answers with the
   *                   payment offer (URL, price, network) — never the brief.
   *
   * Returns null when the skill is not one of these.
   */
  private async briefSkill(
    skill: unknown,
  ): Promise<Record<string, unknown> | null> {
    const offer = x402Offer(this.briefPort, this.briefSellPath);
    if (skill === "desk_brief") {
      return { status: "payment_required", pay_via: offer };
    }
    if (skill === "brief_preview") {
      try {
        return buildPreview(await getElitrSnapshot(), offer);
      } catch (e) {
        return {
          status: "unavailable",
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
    return null;
  }

  /** All skills this agent answers over A2A. */
  allSkills(): string[] {
    return [...BRIEF_SKILLS, ...this.skills()];
  }
  /**
   * Text-carrier entrypoint (Foundry invocations / responses SkillRouter).
   *
   * Same skill switch as {@link execute}, but NEVER throws: on a text
   * carrier there is no JSON-RPC error channel, so a fault is returned as an
   * `{"error": ...}` dict and the caller can always reply. The A2A path
   * keeps its own switch below because its fault semantics differ (faults
   * become JSON-RPC -32603 via A2AError).
   */
  async dispatch(
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const skill = data.skill;
    try {
      const brief = await this.briefSkill(skill);
      if (brief !== null) {
        return brief;
      }
      if (skill === "negotiate") {
        return await this.negotiate(data);
      }
      if (skill === "notify_funded") {
        return await this.notifyFunded(data);
      }
      // Includes a plain text message (no skill envelope → skill is
      // undefined): the seller has no free-form skill, so prose is rejected
      // here.
      return {
        error: `unknown skill: ${JSON.stringify(skill)}`,
        skills: this.allSkills(),
      };
    } catch (e) {
      // a skill failure must still ACK the buyer
      log.error(`skill ${JSON.stringify(skill)} failed`, e);
      if (isCommerceRateLimitError(e)) {
        return { status: "retry", error: "seller rate limit exceeded", skill };
      }
      return { error: "seller operation failed; retry later", skill };
    }
  }

  // ── A2A entrypoints ───────────────────────────────────────────────────────
  execute = async (
    context: RequestContext,
    eventBus: ExecutionEventBus,
  ): Promise<void> => {
    const data = inbound(context);
    const skill = data.skill;
    let result: Record<string, unknown>;
    try {
      const brief = await this.briefSkill(skill);
      if (brief !== null) {
        result = brief;
      } else if (skill === "negotiate") {
        result = await this.negotiate(data);
      } else if (skill === "notify_funded") {
        result = await this.notifyFunded(data);
      } else {
        // Includes a plain text message (no DataPart → skill is undefined):
        // the seller has no free-form skill, so prose is rejected here.
        result = {
          error: `unknown skill: ${JSON.stringify(skill)}`,
          skills: this.allSkills(),
        };
        if (skill === undefined) {
          // Most common cause: the caller put the JSON envelope in a
          // "text" part. Structured skill calls must ride in a DataPart.
          result.hint =
            'send the skill envelope as an A2A data part: parts:[{"kind":"data","data":{"skill":"brief_preview"}}]';
        }
      }
    } catch (e) {
      // A genuine internal fault is surfaced as a JSON-RPC error, NOT masked
      // as a successful result. Throwing `A2AError.internalError` is caught
      // by @a2a-js/sdk's request handler and serialized to a proper -32603
      // carrying the request id. CLASSIFIED business outcomes are
      // returned as a result above (peer of the MCP runtime: faults →
      // isError, business outcomes → result).
      log.error(`skill ${JSON.stringify(skill)} failed`, e);
      if (isCommerceRateLimitError(e)) {
        result = {
          status: "retry",
          error: "seller rate limit exceeded",
          skill,
        };
      } else {
        throw A2AError.internalError("seller operation failed; retry later");
      }
    }
    reply(eventBus, context, result);
  };

  cancelTask = async (
    _taskId: string,
    _eventBus: ExecutionEventBus,
  ): Promise<void> => {
    // negotiate is synchronous; notify_funded acks then delivers on-chain in
    // the background — once submitted it is anchored on-chain and cannot be
    // cancelled via A2A. Nothing to cancel here. (@a2a-js/sdk hands cancel
    // only a taskId — no message to reply to — so this surfaces as the
    // standard JSON-RPC unsupported-operation error.)
    throw A2AError.unsupportedOperation("cancel");
  };
}

// ── wire helpers ──────────────────────────────────────────────────────────────

function inbound(context: RequestContext): Record<string, unknown> {
  const parts = context.userMessage?.parts ?? [];
  const dataPart = parts.find((p): p is DataPart => p.kind === "data");
  return dataPart?.data ?? {};
}

function reply(
  eventBus: ExecutionEventBus,
  context: RequestContext,
  data: Record<string, unknown>,
): void {
  const message: Message = {
    kind: "message",
    role: "agent",
    messageId: randomUUID(),
    parts: [{ kind: "data", data }],
    contextId: context.contextId,
    taskId: context.taskId,
  };
  // publish + finished() — without finished() the event stream never closes
  // and the caller hangs.
  eventBus.publish(message);
  eventBus.finished();
}
