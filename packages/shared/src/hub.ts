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

export class EventHub {
  private readonly history: AgentEvent[] = [];
  private readonly clients = new Set<ServerResponse>();
  private ping?: NodeJS.Timeout; // one keep-alive timer for every client, running only while someone listens

  constructor(
    private readonly agent: AgentId,
    private readonly logFile?: string,
    private readonly maxHistory = 500,
  ) {
    if (logFile && existsSync(logFile)) {
      const lines = readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean);
      for (const l of lines.slice(-maxHistory)) {
        try {
          this.history.push(JSON.parse(l));
        } catch {
          /* skip corrupt line */
        }
      }
    }
    if (logFile) mkdirSync(dirname(logFile), { recursive: true });
  }

  emit(payload: Payload): AgentEvent {
    const event = { id: randomUUID(), ts: Date.now(), agent: this.agent, ...payload } as AgentEvent;
    this.history.push(event);
    if (this.history.length > this.maxHistory) this.history.shift();
    if (this.logFile) appendFileSync(this.logFile, JSON.stringify(event) + "\n");
    const frame = `data: ${JSON.stringify(event)}\n\n`;
    for (const c of this.clients) c.write(frame);
    const brief = JSON.stringify(payload);
    console.log(`[${this.agent}] ${brief.length > 300 ? brief.slice(0, 300) + "…" : brief}`);
    return event;
  }

  recent(limit = 200): AgentEvent[] {
    return this.history.slice(-limit);
  }

  get clientCount(): number {
    return this.clients.size;
  }

  /** GET /events - replays recent history, then streams live. At most MAX_SSE_CLIENTS streams per hub. */
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
    for (const e of this.recent()) res.write(`data: ${JSON.stringify(e)}\n\n`);
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
