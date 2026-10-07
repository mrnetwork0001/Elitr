// Read-only dashboard routes added on top of server.ts:
//   GET /rwa/board       Weekend Gap board (RWA Data API, cached 60 s)
//   GET /wallet/api      Wallet API balances + transactions, Address Portfolio overview (cached 60 s)
//   GET /summary/today   plain-English account of the current UTC day (cached 15 s)
// and the `walletApi` / `portfolio` / `walletTxs` fields merged into GET /state.

import type { ExecutionAgent } from "./cycle.js";
import { Cached, errText } from "./apiThrottle.js";
import { RwaBoard } from "./rwaBoard.js";
import { EVENTS_FILE } from "./state.js";
import { buildSummary, loadEventsSince, utcDayStart, type TodaySummary } from "./summary.js";
import { resolveAddress, WalletApiReader } from "./walletApi.js";

export interface Extras {
  /** null → not one of ours (caller continues to its own 404). */
  route(method: string, path: string): Promise<{ status: number; body: unknown } | null>;
  /** Extra /state fields; never waits on the network (serves the last cached wallet read). */
  stateFields(): Record<string, unknown>;
}

export function makeExtras(agent: ExecutionAgent): Extras {
  const { d } = agent;
  const board = new RwaBoard(d.binance, { minGapBps: d.risk.minGapBps });
  const wallet = new WalletApiReader(
    d.binance,
    () => resolveAddress(d.account?.address),
    () => {
      const s = d.store.get();
      return { trades: s.trades, payments: s.payments };
    },
  );
  const summary = new Cached<TodaySummary>(15_000, async () => {
    const now = Date.now();
    const statuses = await agent.analystStatuses().catch(() => []);
    const { positions, pnl } = agent.portfolio();
    return buildSummary({
      now,
      events: loadEventsSince(EVENTS_FILE, utcDayStart(now)),
      mode: agent.mode,
      killSwitch: agent.killSwitch || d.risk.killSwitch,
      pnl,
      positions,
      analystName: (id) => {
        const n = statuses.find((s) => s.endpoint.id === id)?.info?.name;
        const short = n?.replace(/^Elitr\s+/i, "");
        return short ? short.charAt(0).toUpperCase() + short.slice(1).toLowerCase() : id === "analyst" ? "News analyst" : id === "analyst-flow" ? "Flow analyst" : id;
      },
      underlyingOf: (sym) => agent.assets.find((a) => a.symbol === sym)?.underlying ?? null,
    });
  });

  return {
    async route(method, path) {
      if (method !== "GET") return null;
      try {
        if (path === "/rwa/board") return { status: 200, body: await board.get() };
        if (path === "/wallet/api") return { status: 200, body: await wallet.get() };
        if (path === "/summary/today") return { status: 200, body: await summary.get() };
      } catch (e) {
        return { status: 502, body: { error: errText(e) } };
      }
      return null;
    },
    stateFields() {
      const w = wallet.peek();
      const who = resolveAddress(d.account?.address);
      if (!w) return { walletApi: null, portfolio: null, walletTxs: null, walletApiAddress: who.address, walletApiStatus: "loading" };
      return { walletApi: w.walletApi, portfolio: w.portfolio, walletTxs: w.transactions, walletApiAddress: w.address, walletApiStatus: w.error ?? "ok" };
    },
  };
}
