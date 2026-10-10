import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AgentEvent, AgentId } from "./events.js";

type Payload = AgentEvent extends infer E ? (E extends AgentEvent ? Omit<E, "id" | "ts" | "agent"> : never) : never;

// In-process event log, persisted as JSONL so the dashboard keeps history across restarts,
// and served to the dashboard as Server-Sent Events.
export const MAX_SSE_CLIENTS = 200;
const PING_MS = 15_000;
const MAX_MILESTONES = 300;

/**
 * Rare events the dashboard must keep showing long after the recent tail has moved on: the trade
 * pipeline (simulate, broadcast, confirm, fill, and its errors), buy/sell decisions, on-chain ratings
 * and identities.
 * A cycle emits ~50 routine events, so without this a trade drops off the dashboard within hours.
 */
// Same pattern the dashboard uses to attach an error to a trade attempt (apps/web/lib/derive.ts).
const TX_ERROR_WHERE = /tx|trade|swap|broadcast|simulat|approve|quote|execut|confirm|receipt/i;

export function isMilestone(e: AgentEvent): boolean {
  switch (e.type) {
    case "tx.simulated":
    case "tx.broadcast":
    case "tx.confirmed":
    case "trade.filled":
    case "reputation.posted":
    case "identity.registered":
      return true;
    case "decision":
      return e.action !== "hold";
    case "error":
      // Failures of a trade attempt (e.g. a revert), so the dashboard can close that attempt.
      return TX_ERROR_WHERE.test(e.where);
    default:
      return false;
  }
}

export class EventHub {
  private readonly history: AgentEvent[] = [];
  private readonly milestones: AgentEvent[] = [];
  private readonly clients = new Set<ServerResponse>();
  private ping?: NodeJS.Timeout; // one keep-alive timer for every client, running only while someone listens

  constructor(
    private readonly agent: AgentId,
    private readonly logFile?: string,
    private readonly maxHistory = 500,
  ) {
    if (logFile && existsSync(logFile)) {
      const lines = readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean);
      const tailFrom = Math.max(0, lines.length - maxHistory);
      lines.forEach((l, i) => {
        // Parse every line only for milestones; the recent tail is kept whole.
        if (i < tailFrom && !l.includes('"type":"tx.') && !l.includes('"trade.filled"') && !l.includes('"reputation.posted"') && !l.includes('"identity.registered"') && !l.includes('"decision"') && !l.includes('"type":"error"')) return;
        let e: AgentEvent;
        try {
          e = JSON.parse(l);
        } catch {
          return; // skip corrupt line
        }
        if (i >= tailFrom) this.history.push(e);
        else if (isMilestone(e)) this.keepMilestone(e);
      });
    }
    if (logFile) mkdirSync(dirname(logFile), { recursive: true });
  }

  emit(payload: Payload): AgentEvent {
    const event = { id: randomUUID(), ts: Date.now(), agent: this.agent, ...payload } as AgentEvent;
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      const old = this.history.shift()!;
      if (isMilestone(old)) this.keepMilestone(old);
    }
    if (this.logFile) appendFileSync(this.logFile, JSON.stringify(event) + "\n");
    const frame = `data: ${JSON.stringify(event)}\n\n`;
    for (const c of this.clients) c.write(frame);
    const brief = JSON.stringify(payload);
    console.log(`[${this.agent}] ${brief.length > 300 ? brief.slice(0, 300) + "…" : brief}`);
    return event;
  }

  private keepMilestone(e: AgentEvent): void {
    this.milestones.push(e);
    if (this.milestones.length > MAX_MILESTONES) this.milestones.shift();
  }

  recent(limit = 200): AgentEvent[] {
    return this.history.slice(-limit);
  }

  /** What a new dashboard stream receives first: older milestones, then the recent tail, oldest first. */
  replay(limit = 200): AgentEvent[] {
    const tail = this.recent(limit);
    const inTail = new Set(tail.map((e) => e.id));
    const olderInHistory = this.history.slice(0, Math.max(0, this.history.length - limit)).filter(isMilestone);
    const older = [...this.milestones, ...olderInHistory].filter((e) => !inTail.has(e.id));
    return [...older.slice(-MAX_MILESTONES), ...tail];
  }

  get clientCount(): number {
    return this.clients.size;
  }

  /** GET /events - replays milestones and recent history, then streams live. At most MAX_SSE_CLIENTS streams per hub. */
  sse(req: IncomingMessage, res: ServerResponse): void {
    if (this.clients.size >= MAX_SSE_CLIENTS) {
      res.writeHead(503, { "Content-Type": "application/json", "Access-Control-Allow-Origin": process.env.DASHBOARD_ORIGIN ?? "*" });
      res.end('{"error":"too many event streams"}');
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": process.env.DASHBOARD_ORIGIN ?? "*",
    });
    res.write(": connected\n\n"); // flush headers now - an empty history would otherwise delay onopen until the first ping
    for (const e of this.replay()) res.write(`data: ${JSON.stringify(e)}\n\n`);
    this.clients.add(res);
    if (!this.ping) {
      this.ping = setInterval(() => {
        for (const c of this.clients) c.write(": ping\n\n");
      }, PING_MS);
      this.ping.unref();
    }
    req.on("close", () => {
      this.clients.delete(res);
      if (!this.clients.size && this.ping) {
        clearInterval(this.ping);
        this.ping = undefined;
      }
    });
  }
}
