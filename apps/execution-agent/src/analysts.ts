import type { AnalystId, AnalystInfo } from "@elitr/shared";

const ANALYST_IDS: readonly AnalystId[] = ["analyst", "analyst-flow"];

export interface AnalystEndpoint {
  id: AnalystId;
  url: string;
}

/**
 * ANALYSTS="analyst=http://localhost:4001,analyst-flow=http://localhost:4003"; falls back to
 * ANALYST_URL (as "analyst"), then the analyst's default port. Unknown ids are reported, not guessed.
 */
export function parseAnalysts(env: NodeJS.ProcessEnv): { endpoints: AnalystEndpoint[]; errors: string[] } {
  const errors: string[] = [];
  const endpoints: AnalystEndpoint[] = [];
  const raw = env.ANALYSTS?.trim();
  if (raw) {
    for (const part of raw.split(",").map((p) => p.trim()).filter(Boolean)) {
      const eq = part.indexOf("=");
      const id = (eq > 0 ? part.slice(0, eq) : "").trim();
      const url = (eq > 0 ? part.slice(eq + 1) : "").trim().replace(/\/$/, "");
      if (!ANALYST_IDS.includes(id as AnalystId)) {
        errors.push(`ANALYSTS entry "${part}": id must be one of ${ANALYST_IDS.join(", ")}`);
        continue;
      }
      try {
        new URL(url);
      } catch {
        errors.push(`ANALYSTS entry "${part}": invalid URL`);
        continue;
      }
      if (endpoints.some((e) => e.id === id)) {
        errors.push(`ANALYSTS lists "${id}" twice; using the first`);
        continue;
      }
      endpoints.push({ id: id as AnalystId, url });
    }
  }
  if (!endpoints.length) endpoints.push({ id: "analyst", url: (env.ANALYST_URL ?? "http://localhost:4001").replace(/\/$/, "") });
  return { endpoints, errors };
}

export interface AnalystStatus {
  endpoint: AnalystEndpoint;
  online: boolean;
  info?: AnalystInfo;
  error?: string;
  fetchedAt: number;
}

/** Free GET /info. Offline / malformed analysts come back with `online: false` and the reason. */
export async function fetchInfo(ep: AnalystEndpoint, timeoutMs = 5_000): Promise<AnalystStatus> {
  const fetchedAt = Date.now();
  try {
    const res = await fetch(`${ep.url}/info`, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
    const text = await res.text();
    if (!res.ok) return { endpoint: ep, online: false, error: `GET /info HTTP ${res.status}: ${text.slice(0, 160)}`, fetchedAt };
    const info = JSON.parse(text) as AnalystInfo;
    if (!info || typeof info !== "object") return { endpoint: ep, online: false, error: "GET /info returned a non-object", fetchedAt };
    if (info.analystId !== ep.id) {
      return { endpoint: ep, online: false, error: `GET /info reports analystId ${JSON.stringify(info.analystId)}, configured as ${ep.id}`, fetchedAt };
    }
    return { endpoint: ep, online: true, info, fetchedAt };
  } catch (e) {
    return { endpoint: ep, online: false, error: `GET ${ep.url}/info failed: ${(e as Error).message}`, fetchedAt };
  }
}

/** Whether an analyst covers a symbol (an empty/missing list is treated as "not advertised"). */
export function covers(s: AnalystStatus, symbol: string): boolean {
  return !!s.online && Array.isArray(s.info?.symbols) && s.info!.symbols.includes(symbol);
}
