import { createHash, timingSafeEqual } from "node:crypto";
import { REGISTRATION_WELL_KNOWN_PATH, registrationFromEnv } from "@elitr/identity";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { ExecutionAgent } from "./cycle.js";
import { errMsg } from "./trade.js";

export function isLoopback(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "::1" || /^127\.\d+\.\d+\.\d+$/.test(h);
}

/** Constant-time bearer check (hashing first makes the comparison length-independent). */
export function bearerOk(header: string | undefined, token: string): boolean {
  const m = /^Bearer\s+(.+)$/i.exec(header?.trim() ?? "");
  if (!m) return false;
  const a = createHash("sha256").update(m[1].trim()).digest();
  const b = createHash("sha256").update(token).digest();
  return timingSafeEqual(a, b);
}

// POST /cycle and /kill require `Authorization: Bearer $CONTROL_TOKEN` when CONTROL_TOKEN is set;
// index.ts refuses to bind a non-loopback host without one.
export function startServer(agent: ExecutionAgent, port: number, host: string, controlToken?: string): Server {
  const origin = process.env.DASHBOARD_ORIGIN ?? "http://localhost:3000";
  const cors = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json", ...cors });
    res.end(JSON.stringify(body));
  };
  const authorized = (req: IncomingMessage) => !controlToken || bearerOk(req.headers.authorization, controlToken);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const path = new URL(req.url ?? "/", "http://x").pathname;
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, cors);
        return res.end();
      }
      if (req.method === "GET" && path === "/health") return send(res, 200, { ok: true, agent: "execution", running: agent.running });
      if (req.method === "GET" && path === "/events") return agent.d.hub.sse(req, res);
      if (req.method === "GET" && path === "/state") return send(res, 200, await state(agent));
      if (req.method === "GET" && path === REGISTRATION_WELL_KNOWN_PATH) return send(res, 200, registrationFromEnv("execution"));
      if (req.method === "POST" && (path === "/cycle" || path === "/kill") && !authorized(req)) {
        res.setHeader("WWW-Authenticate", 'Bearer realm="elitr-execution"');
        return send(res, 401, { error: "unauthorized: send Authorization: Bearer <CONTROL_TOKEN>" });
      }
      if (req.method === "POST" && path === "/cycle") {
        if (agent.running) return send(res, 409, { error: "a cycle is already running" });
        agent.runCycle("manual").catch(() => {});
        return send(res, 202, { started: true });
      }
      if (req.method === "POST" && path === "/kill") {
        if (!agent.killSwitch) agent.engageKill("POST /kill");
        return send(res, 200, { killSwitch: true });
      }
      send(res, 404, { error: "not found" });
    } catch (e) {
      send(res, 500, { error: errMsg(e) });
    }
  });
  server.listen(port, host, () => console.log(`[execution] listening on http://${host}:${port}`));
  return server;
}

async function state(agent: ExecutionAgent) {
  const { d } = agent;
  let balances: { bnb: string; usdt: string; nvdab: string; tokens: Record<string, number> } | null = null;
  let balanceError: string | undefined;
  try {
    const b = await agent.balances();
    if (b) {
      balances = {
        bnb: b.bnb,
        usdt: b.usdt,
        nvdab: b.nvdab,
        tokens: Object.fromEntries(Object.entries(b.tokens).map(([k, v]) => [k, Number(v)])),
      };
    }
  } catch (e) {
    balanceError = errMsg(e);
  }
  const statuses = await agent.analystStatuses().catch(() => []);
  const analysts = d.cfg.analysts.map((ep) => {
    const s = statuses.find((x) => x.endpoint.id === ep.id);
    return {
      ...d.book.stats(ep.id),
      name: s?.info?.name ?? ep.id,
      url: ep.url,
      online: !!s?.online,
      priceUsd: s?.info?.priceUsd ?? null,
      erc8004AgentId: agent.erc8004IdOf(s, ep.id),
      ...(s?.error ? { error: s.error } : {}),
    };
  });
  const s = d.store.get();
  const a = agent.asset;
  const { positions, pnl } = agent.portfolio();
  const positionUsd = positions.every((p) => p.qty === 0 || p.markUsd != null)
    ? positions.reduce((t, p) => t + p.qty * (p.markUsd ?? 0), 0)
    : null;
  return {
    wallet: d.account?.address ?? null,
    balances,
    positionUsd, // active mode, all traded assets at the latest marks
    dailySpendUsd: d.store.dailySpend(agent.mode),
    dailyDataUsd: s.dailyDataUsd,
    liveTrading: d.cfg.live,
    mode: agent.mode,
    killSwitch: agent.killSwitch || d.risk.killSwitch,
    risk: d.risk,
    lastCycleAt: agent.lastCycleAt,
    nextCycleAt: agent.nextCycleAt,
    running: agent.running,
    asset: { symbol: a.symbol, underlying: a.underlying, platform: a.platform, address: a.address, decimals: a.decimals, primaryPool: a.primaryPool },
    assets: agent.assets.map((x) => x.symbol),
    marks: Object.fromEntries(agent.assets.map((x) => [x.symbol, agent.marks.get(x.symbol) ?? null])),
    positions,
    pnl: { realizedUsd: pnl.realizedUsd, unrealizedUsd: pnl.unrealizedUsd, signalSpendUsd: pnl.signalSpendUsd, gasSpendUsd: pnl.gasSpendUsd, netUsd: pnl.netUsd },
    analysts,
    controlAuth: d.cfg.controlAuth,
    tradeUsd: d.cfg.tradeUsd,
    configErrors: [d.accountError, d.binanceError, balanceError, ...(d.configErrors ?? [])].filter(Boolean),
  };
}
