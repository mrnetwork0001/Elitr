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
  /** The analyst's own public base URL (its ERC-8004 registration file's `web` service), when it serves one. */
  publicUrl?: string;
}

const REGISTRATION_PATH = "/.well-known/agent-registration.json";
const registrationCache = new Map<string, { at: number; url?: string }>();

/** True for URLs that must never appear in a public payload (loopback / unspecified hosts). */
export function isInternalUrl(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return h === "localhost" || h === "::1" || h === "::" || h === "0.0.0.0" || /^127\.\d+\.\d+\.\d+$/.test(h) || h.endsWith(".localhost");
  } catch {
    return true;
  }
}

/**
 * Public URL to show for an analyst: its registration file's `web` endpoint, else ANALYST_PUBLIC_URL /
 * FLOW_ANALYST_PUBLIC_URL from our env, else nothing. Internal (localhost) URLs are never returned.
 */
export function publicAnalystUrl(id: AnalystId, fromRegistration?: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const fromEnv = id === "analyst" ? env.ANALYST_PUBLIC_URL : env.FLOW_ANALYST_PUBLIC_URL || env.ANALYST_FLOW_PUBLIC_URL;
  for (const c of [fromRegistration, fromEnv]) {
    const u = c?.trim().replace(/\/+$/, "");
    if (u && /^https?:\/\//i.test(u) && !isInternalUrl(u)) return u;
  }
  return undefined;
}

/** Best-effort, cached for an hour: the `web` service of the analyst's registration file. */
async function registrationWebUrl(ep: AnalystEndpoint, timeoutMs: number): Promise<string | undefined> {
  const hit = registrationCache.get(ep.url);
  if (hit && Date.now() - hit.at < 60 * 60_000) return hit.url;
  let url: string | undefined;
  try {
    const res = await fetch(`${ep.url}${REGISTRATION_PATH}`, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
    if (res.ok) {
      const reg = (await res.json()) as { services?: { name?: string; endpoint?: string }[] };
      const web = reg?.services?.find((s) => s?.name === "web")?.endpoint;
      if (typeof web === "string") url = web;
    }
  } catch {
    /* no registration file: fall back to env */
  }
  registrationCache.set(ep.url, { at: Date.now(), url });
  return url;
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
    const publicUrl = await registrationWebUrl(ep, timeoutMs);
    return { endpoint: ep, online: true, info, fetchedAt, ...(publicUrl ? { publicUrl } : {}) };
  } catch (e) {
    // No URL in the message: it is shown in /state, and the configured endpoint may be internal.
    return { endpoint: ep, online: false, error: `GET /info failed: ${(e as Error).message}`, fetchedAt };
  }
}

/** Whether an analyst covers a symbol (an empty/missing list is treated as "not advertised"). */
export function covers(s: AnalystStatus, symbol: string): boolean {
  return !!s.online && Array.isArray(s.info?.symbols) && s.info!.symbols.includes(symbol);
}
