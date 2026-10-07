import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { REGISTRATION_WELL_KNOWN_PATH, registrationFromEnv } from "@elitr/identity";
import { PRIMARY_ASSET, type AnalystInfo, type EventHub, type TokenizedStock } from "@elitr/shared";
import {
  authorizationId,
  B402Gateway,
  decodePaymentSignature,
  deepEqual,
  encodeHeader,
  type B402Config,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
  type ResourceInfo,
} from "./b402.js";
import type { SignalService } from "./signal.js";

// One analyst = one HTTP server: free GET /health, /info, /events and the b402-paywalled GET /signal.
// Every analyst (news, flow, …) reuses this; only the signal producer and its metadata differ.

export const errMsg = (e: unknown): string => {
  if (!(e instanceof Error)) return String(e);
  const c = e.cause as { code?: string; message?: string } | undefined;
  return c ? `${e.message} (${c.code ?? c.message})` : e.message;
};

export interface AnalystServerOptions {
  info: AnalystInfo; // served at /info
  label: string; // log prefix
  port: number;
  hub: EventHub;
  assets: TokenizedStock[]; // symbols this analyst sells
  b402: { config?: B402Config; problems: string[] };
  /** Non-payment prerequisites still missing (e.g. LLM credentials). /signal answers 503 while non-empty. */
  notReady: () => string[];
  signals: SignalService;
  publicUrl?: string; // base for the x402 resource URL
  dashboardOrigin: string;
  resourceDescription: (asset: TokenizedStock) => string;
  health?: () => Record<string, unknown>; // analyst-specific /health fields
}

export function startAnalystServer(o: AnalystServerOptions): Server {
  const { hub, info, label, port } = o;
  const gateway = o.b402.config ? new B402Gateway(o.b402.config) : undefined;
  const problems = o.b402.problems;
  // Authorizations in flight or already settled — a signed payment buys exactly one response.
  const used = new Map<string, "pending" | "settled">();

  const cors = {
    "Access-Control-Allow-Origin": o.dashboardOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE",
    "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
  };
  const send = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { ...cors, "Content-Type": "application/json", ...headers });
    res.end(JSON.stringify(body));
  };

  const findAsset = (symbol: string | null): TokenizedStock | undefined => {
    if (!symbol) return o.assets.includes(PRIMARY_ASSET) ? PRIMARY_ASSET : o.assets[0];
    return o.assets.find((a) => a.symbol.toLowerCase() === symbol.toLowerCase());
  };

  async function signal(req: IncomingMessage, res: ServerResponse, url: URL) {
    const asset = findAsset(url.searchParams.get("symbol"));
    if (!asset) return send(res, 404, { error: `unknown symbol; supported: ${o.assets.map((a) => a.symbol).join(", ")}` });
    if (!gateway) return send(res, 503, { error: `b402 payments are not configured on ${info.analystId}`, missing: problems });
    const missing = o.notReady();
    if (missing.length) return send(res, 503, { error: `${info.analystId} cannot produce signals`, missing });

    let requirements: PaymentRequirements;
    try {
      requirements = await gateway.requirements();
    } catch (e) {
      hub.emit({ type: "error", where: "b402.supported", message: errMsg(e) });
      return send(res, 503, { error: `b402 unavailable: ${errMsg(e)}` });
    }
    const base = o.publicUrl || `http://${req.headers.host ?? `localhost:${port}`}`;
    const resource: ResourceInfo = {
      url: `${base}/signal?symbol=${asset.symbol}`,
      description: o.resourceDescription(asset),
      mimeType: "application/json",
    };
    const paymentRequired = (error: string) => {
      const body: PaymentRequired = { x402Version: 2, error, resource, accepts: [requirements] };
      send(res, 402, body, { "PAYMENT-REQUIRED": encodeHeader(body), "Cache-Control": "no-store" });
    };

    const header = req.headers["payment-signature"];
    if (typeof header !== "string" || !header) {
      hub.emit({ type: "payment.required", resource: resource.url, amount: requirements.amount, asset: requirements.asset });
      return paymentRequired("Payment required");
    }
    let payload: PaymentPayload;
    try {
      payload = decodePaymentSignature(header);
    } catch (e) {
      return paymentRequired(errMsg(e));
    }
    if (!deepEqual(payload.accepted, requirements)) {
      return paymentRequired("paymentPayload.accepted does not match the server-held payment requirements");
    }
    const authId = authorizationId(payload);
    if (used.has(authId)) return paymentRequired("payment authorization already used");
    used.set(authId, "pending");
    if (used.size > 10_000) used.delete(used.keys().next().value!);

    let phase = "verify";
    try {
      const v = await gateway.verify(payload, requirements);
      if (!v.isValid) {
        used.delete(authId);
        return paymentRequired(`payment invalid: ${v.invalidReason ?? "unknown"}${v.invalidMessage ? ` (${v.invalidMessage})` : ""}`);
      }

      phase = "signal";
      let sig;
      try {
        sig = await o.signals.get(asset);
      } catch (e) {
        used.delete(authId); // never settled, buyer may retry with the same authorization
        hub.emit({ type: "error", where: "signal", message: errMsg(e) });
        return send(res, 503, { error: `signal unavailable, payment NOT settled: ${errMsg(e)}` });
      }

      phase = "settle";
      const s = await gateway.settle(payload, requirements);
      if (!s.success) {
        if (s.transaction) {
          // Broadcast but not confirmed successful — doc: reconcile before any retry.
          used.set(authId, "settled");
          hub.emit({ type: "error", where: "b402.settle", message: `unconfirmed settlement ${s.transaction}: ${s.errorReason}` });
          return send(res, 502, { error: "settlement not confirmed; reconcile before retrying", transaction: s.transaction, reason: s.errorReason });
        }
        used.delete(authId);
        return paymentRequired(`settlement failed: ${s.errorReason ?? "unknown"}`);
      }
      used.set(authId, "settled");
      hub.emit({
        type: "payment.verified",
        amount: s.amount ?? requirements.amount,
        asset: requirements.asset,
        payer: s.payer ?? v.payer ?? "",
        txHash: s.transaction,
      });
      hub.emit({
        type: "signal.produced",
        symbol: sig.symbol,
        score: sig.score,
        rationale: sig.rationale,
        sources: sig.sources.map((x) => x.url),
        stance: sig.stance,
        horizonSec: sig.horizonSec,
        signalId: sig.signalId,
      });
      send(res, 200, sig, { "PAYMENT-RESPONSE": encodeHeader(s), "Cache-Control": "no-store" });
    } catch (e) {
      // Transport/envelope error from b402. Settle is idempotent per authorization, so the buyer may resend it.
      used.delete(authId);
      hub.emit({ type: "error", where: `b402.${phase}`, message: errMsg(e) });
      if (!res.headersSent) send(res, 502, { error: `b402 ${phase} failed: ${errMsg(e)}` });
    }
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    if (req.method !== "GET") return send(res, 405, { error: "method not allowed" });
    if (url.pathname === "/health") {
      const missing = [...problems, ...o.notReady()];
      return send(res, 200, {
        ok: true,
        analystId: info.analystId,
        b402Configured: Boolean(gateway),
        ...o.health?.(),
        ...(missing.length ? { missing } : {}),
      });
    }
    if (url.pathname === "/info") return send(res, 200, { ...info, b402Configured: Boolean(gateway) });
    if (url.pathname === REGISTRATION_WELL_KNOWN_PATH) return send(res, 200, registrationFromEnv(info.analystId));
    if (url.pathname === "/events") return hub.sse(req, res);
    if (url.pathname === "/signal") {
      return void signal(req, res, url).catch((e) => {
        hub.emit({ type: "error", where: "signal", message: errMsg(e) });
        if (!res.headersSent) send(res, 500, { error: errMsg(e) });
      });
    }
    send(res, 404, { error: "not found" });
  });

  server.listen(port, () => {
    console.log(`[${label}] listening on :${port}`);
    if (problems.length) console.warn(`[${label}] b402 disabled — ${problems.join("; ")}`);
    const missing = o.notReady();
    if (missing.length) console.warn(`[${label}] signals disabled — ${missing.join("; ")}`);
  });
  return server;
}
