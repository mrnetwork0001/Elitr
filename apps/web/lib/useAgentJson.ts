"use client";
// Polls a read-only JSON route on the execution agent. Distinguishes the agent being offline from
// the route not existing (an agent built before the route was added answers 404).
import { useCallback, useEffect, useRef, useState } from "react";
import { EXECUTION_URL } from "./config";

export type JsonStatus = "loading" | "ok" | "unsupported" | "offline" | "error";

export interface AgentJson<T> {
  data: T | null;
  status: JsonStatus;
  error: string | null;
  fetchedAt: number | null;
  refresh: () => void;
}

export function useAgentJson<T>(path: string, intervalMs: number, timeoutMs = 30_000): AgentJson<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<JsonStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${EXECUTION_URL}${path}`, { cache: "no-store", signal: ctrl.signal });
      if (res.status === 404) {
        setStatus("unsupported");
        setError(null);
        return;
      }
      const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!res.ok) {
        setStatus("error");
        setError(json?.error ?? `HTTP ${res.status}`);
        return;
      }
      setData(json);
      setStatus("ok");
      setError(null);
      setFetchedAt(Date.now());
    } catch (e) {
      // Keep the last good data on screen; the status tells the user it is stale.
      setStatus("offline");
      setError(ctrl.signal.aborted ? `no answer within ${Math.round(timeoutMs / 1000)}s` : e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(t);
      busy.current = false;
    }
  }, [path, timeoutMs]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  return { data, status, error, fetchedAt, refresh: () => void load() };
}
