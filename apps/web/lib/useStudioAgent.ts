"use client";
import { useEffect, useState } from "react";
import { STUDIO_AGENT } from "./config";

export type StudioStatus = "connecting" | "live" | "offline";

/** Polls the Studio agent's public A2A card (CORS-enabled for the card path only). */
export function useStudioAgent(intervalMs = 30_000) {
  const [status, setStatus] = useState<StudioStatus>("connecting");
  const [skills, setSkills] = useState<string[]>([]);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(STUDIO_AGENT.card, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const c = (await r.json()) as { skills?: { id?: string }[] };
        if (stop) return;
        setSkills((c.skills ?? []).map((s) => s.id ?? "").filter(Boolean));
        setStatus("live");
      } catch {
        if (!stop) setStatus("offline");
      } finally {
        if (!stop) setCheckedAt(Date.now());
      }
    };
    void tick();
    const t = setInterval(tick, intervalMs);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [intervalMs]);
  return { status, skills, checkedAt };
}
