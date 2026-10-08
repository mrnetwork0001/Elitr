"use client";
import { useEffect, useRef, useState } from "react";
import type { AgentEvent, AgentId } from "@elitr/shared";
import { AGENTS, AGENT_IDS } from "./config";

export type ConnStatus = "connecting" | "live" | "offline";

export interface AgentConn {
  status: ConnStatus;
  url: string;
  /** Last time a frame (event) arrived from this agent. */
  lastEventAt: number | null;
  /** Consecutive failed connection attempts. */
  retries: number;
}

export interface AgentStream {
  /** Every event seen, deduped by id, newest first. */
  events: AgentEvent[];
  conn: Record<AgentId, AgentConn>;
  /** ids that arrived live (after the initial history replay) - used for highlight effects. */
  liveIds: ReadonlySet<string>;
}

const MAX_EVENTS = 2000;
const SOURCES = Object.fromEntries(AGENTS.map((a) => [a.id, a.url])) as Record<AgentId, string>;
const perAgent = <T,>(v: () => T) => Object.fromEntries(AGENT_IDS.map((a) => [a, v()])) as Record<AgentId, T>;
/** Frames arriving within this window after (re)connect are treated as history replay. */
const REPLAY_WINDOW_MS = 1500;

function isAgentEvent(v: unknown): v is AgentEvent {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.type === "string" && typeof o.ts === "number";
}

function initialConn(): Record<AgentId, AgentConn> {
  return Object.fromEntries(
    AGENTS.map((a) => [a.id, { status: "connecting", url: a.url, lastEventAt: null, retries: 0 } satisfies AgentConn]),
  ) as Record<AgentId, AgentConn>;
}

/**
 * One hook, every agent: opens an EventSource to each agent's GET /events, merges and
 * dedupes the streams, and reconnects with backoff. Renders nothing until real frames arrive.
 */
export function useAgentStream(): AgentStream {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [conn, setConn] = useState<Record<AgentId, AgentConn>>(initialConn);
  const [liveIds, setLiveIds] = useState<ReadonlySet<string>>(() => new Set());

  const seen = useRef(new Set<string>());
  const pending = useRef<{ e: AgentEvent; live: boolean }[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let disposed = false;
    const sources: Partial<Record<AgentId, EventSource>> = {};
    const timers: Partial<Record<AgentId, ReturnType<typeof setTimeout>>> = {};
    const retries = perAgent(() => 0);
    const openedAt = perAgent(() => 0);

    const flush = () => {
      flushTimer.current = null;
      const batch = pending.current;
      pending.current = [];
      if (!batch.length || disposed) return;
      const lastByAgent: Partial<Record<AgentId, number>> = {};
      for (const { e } of batch) lastByAgent[e.agent] = Math.max(lastByAgent[e.agent] ?? 0, Date.now());
      setEvents((prev) => {
        const merged = prev.concat(batch.map((b) => b.e));
        merged.sort((a, b) => b.ts - a.ts);
        if (merged.length > MAX_EVENTS) {
          for (const dropped of merged.slice(MAX_EVENTS)) seen.current.delete(dropped.id);
          merged.length = MAX_EVENTS;
        }
        return merged;
      });
      const live = batch.filter((b) => b.live).map((b) => b.e.id);
      if (live.length) {
        setLiveIds((prev) => {
          const next = new Set(prev);
          for (const id of live) next.add(id);
          // keep the set bounded
          if (next.size > 200) return new Set([...next].slice(-200));
          return next;
        });
      }
      setConn((c) => {
        const next = { ...c };
        for (const a of AGENT_IDS) {
          if (lastByAgent[a]) next[a] = { ...next[a], lastEventAt: lastByAgent[a]! };
        }
        return next;
      });
    };

    const enqueue = (e: AgentEvent, live: boolean) => {
      if (seen.current.has(e.id)) return;
      seen.current.add(e.id);
      pending.current.push({ e, live });
      if (!flushTimer.current) flushTimer.current = setTimeout(flush, 80);
    };

    const setStatus = (agent: AgentId, status: ConnStatus) => {
      if (disposed) return;
      setConn((c) =>
        c[agent]?.status === status && c[agent].retries === retries[agent]
          ? c
          : { ...c, [agent]: { ...c[agent], status, retries: retries[agent] } },
      );
    };

    const connect = (agent: AgentId) => {
      if (disposed) return;
      const url = `${SOURCES[agent]}/events`;
      let es: EventSource;
      try {
        es = new EventSource(url);
      } catch {
        scheduleReconnect(agent);
        return;
      }
      sources[agent] = es;
      openedAt[agent] = Date.now();

      es.onopen = () => {
        retries[agent] = 0;
        openedAt[agent] = Date.now();
        setStatus(agent, "live");
      };

      es.onmessage = (msg) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(msg.data);
        } catch {
          return;
        }
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const live = Date.now() - openedAt[agent] > REPLAY_WINDOW_MS;
        for (const item of list) {
          if (!isAgentEvent(item)) continue;
          // Trust the stream's agent tag, fall back to the source we read it from.
          const e = (item.agent ? item : { ...item, agent }) as AgentEvent;
          enqueue(e, live);
        }
      };

      es.onerror = () => {
        // Close and manage reconnects ourselves so status is accurate and backoff applies.
        es.close();
        if (sources[agent] === es) delete sources[agent];
        retries[agent] += 1;
        setStatus(agent, "offline");
        scheduleReconnect(agent);
      };
    };

    const scheduleReconnect = (agent: AgentId) => {
      if (disposed) return;
      clearTimeout(timers[agent]);
      const delay = Math.min(15_000, 1000 * 2 ** Math.min(retries[agent], 4));
      timers[agent] = setTimeout(() => connect(agent), delay);
    };

    for (const a of AGENT_IDS) connect(a);

    // Reconnect promptly when the tab becomes visible again.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      for (const a of AGENT_IDS) {
        if (!sources[a]) {
          clearTimeout(timers[a]);
          connect(a);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      for (const a of AGENT_IDS) {
        sources[a]?.close();
        clearTimeout(timers[a]);
      }
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = null;
      // Unflushed frames will be replayed by the agent on the next connect.
      for (const { e } of pending.current) seen.current.delete(e.id);
      pending.current = [];
    };
  }, []);

  return { events, conn, liveIds };
}
