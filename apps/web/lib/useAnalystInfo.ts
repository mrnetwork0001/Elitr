"use client";
import { useEffect, useState } from "react";
import type { AnalystId, AnalystInfo } from "@elitr/shared";
import { AGENTS, ANALYST_IDS } from "./config";

/** Polls each analyst's free GET /info (name, kind, price, ERC-8004 id). Missing entries = not reachable. */
export function useAnalystInfo(intervalMs = 60_000): Partial<Record<AnalystId, AnalystInfo>> {
  const [info, setInfo] = useState<Partial<Record<AnalystId, AnalystInfo>>>({});
  useEffect(() => {
    let disposed = false;
    const load = async () => {
      await Promise.all(
        ANALYST_IDS.map(async (id) => {
          const url = AGENTS.find((a) => a.id === id)?.url;
          if (!url) return;
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 4000);
          try {
            const res = await fetch(`${url}/info`, { cache: "no-store", signal: ctrl.signal });
            if (!res.ok) return;
            const j = (await res.json()) as AnalystInfo;
            if (!disposed && j && typeof j === "object") setInfo((p) => ({ ...p, [id]: j }));
          } catch {
            /* offline - keep the last answer */
          } finally {
            clearTimeout(t);
          }
        }),
      );
    };
    void load();
    const t = setInterval(load, intervalMs);
    return () => {
      disposed = true;
      clearInterval(t);
    };
  }, [intervalMs]);
  return info;
}
