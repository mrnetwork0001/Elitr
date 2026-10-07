"use client";
// Dashboard-wide live data. Mounted once in app/dashboard/layout.tsx so the three SSE
// streams and the /state poll survive client-side navigation between views.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AgentEvent, AgentId, AnalystId, AnalystInfo, FillMode } from "@elitr/shared";
import { useAgentStream, type AgentConn } from "./useAgentStream";
import { useExecutionState, type ActionResult, type ExecState, type StateStatus } from "./useExecutionState";
import { useOperatorToken } from "./useOperatorToken";
import { useAnalystInfo } from "./useAnalystInfo";
import { useNow } from "./useNow";
import { symbolsSeen, tradeAttempts, type EventOf } from "./derive";
import { startOfLocalDay } from "./format";
import { AGENTS, DEFAULT_ASSETS } from "./config";
import { analystCards } from "@/components/AnalystMarket";
import { portfolioData, type PortfolioData } from "@/components/Portfolio";

const ASSET_KEY = "elitr.asset";

export type ActionKind = "cycle" | "kill";

export interface Dashboard {
  events: AgentEvent[];
  conn: Record<AgentId, AgentConn>;
  liveIds: ReadonlySet<string>;
  state: ExecState | null;
  stateStatus: StateStatus;
  fetchedAt: number | null;
  info: Partial<Record<AnalystId, AnalystInfo>>;
  now: number;

  assets: string[];
  asset: string;
  setAsset: (a: string) => void;

  nameOf: (id: string) => string;
  portfolio: PortfolioData;
  mode: FillMode | null;
  killed: boolean;
  analystsOffline: boolean;
  /** risk.blocked for symbol "*" that is still current (and not the kill switch, which has its own banner). */
  globalBlock: EventOf<"risk.blocked"> | null;
  attemptsToday: number;

  // Operator controls
  token: string | null;
  setToken: (t: string | null) => void;
  /** Agent requires a bearer token for POST /cycle and /kill. */
  authRequired: boolean;
  canControl: boolean;
  tokenRejected: boolean;
  setTokenRejected: (v: boolean) => void;
  busy: ActionKind | null;
  notice: { ok: boolean; message: string } | null;
  act: (kind: ActionKind) => Promise<ActionResult>;

  // Activity badge
  unseen: number;
  markActivitySeen: () => void;
}

const Ctx = createContext<Dashboard | null>(null);

export function useDashboard(): Dashboard {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return v;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { events, conn, liveIds } = useAgentStream();
  const { token, setToken } = useOperatorToken();
  const exec = useExecutionState(5000, token);
  const info = useAnalystInfo();
  const now = useNow(1000);

  // ---- Assets: configured traded assets, plus anything the agent reports or streams ----
  const assets = useMemo(() => {
    const out = [...DEFAULT_ASSETS];
    for (const a of exec.state?.assets ?? []) if (!out.includes(a.symbol)) out.push(a.symbol);
    for (const s of symbolsSeen(events)) if (s && !out.includes(s)) out.push(s);
    return out;
  }, [exec.state?.assets, events]);
  const [assetPref, setAssetPref] = useState(DEFAULT_ASSETS[0]);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ASSET_KEY);
      if (saved) setAssetPref(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const setAsset = useCallback((a: string) => {
    setAssetPref(a);
    try {
      window.localStorage.setItem(ASSET_KEY, a);
    } catch {
      /* ignore */
    }
  }, []);
  const asset = assets.includes(assetPref) ? assetPref : assets[0];

  // ---- Derived ----
  const cards = useMemo(() => analystCards(events, exec.state, info, conn), [events, exec.state, info, conn]);
  const nameOf = useCallback((id: string) => cards.find((c) => c.id === id)?.name ?? AGENTS.find((a) => a.id === id)?.name ?? id, [cards]);
  const portfolio = useMemo(() => portfolioData(exec.state, exec.status, events, exec.fetchedAt), [exec.state, exec.status, events, exec.fetchedAt]);
  const killed = exec.status === "ok" && exec.state?.killSwitch === true;
  const mode: FillMode | null = exec.state?.mode ?? (exec.state ? (exec.state.liveTrading ? "live" : "paper") : null);

  const globalBlock = useMemo(() => {
    const gb = events.find((e) => e.type === "risk.blocked" && e.symbol === "*") as EventOf<"risk.blocked"> | undefined;
    const lastEval = events.find((e) => e.type === "risk.evaluated");
    if (!gb) return null;
    if (lastEval && gb.ts < lastEval.ts - 1000) return null;
    if (killed && gb.rule === "killSwitch") return null;
    return gb;
  }, [events, killed]);

  const analystsOffline = conn.analyst?.status === "offline" && conn["analyst-flow"]?.status === "offline";
  const dayStart = startOfLocalDay(now);
  const attemptsToday = useMemo(() => (now ? tradeAttempts(events).filter((a) => a.startedAt >= dayStart).length : 0), [events, dayStart, now]);

  // ---- Operator actions (shared by the sidebar and the Controls view) ----
  const authRequired = exec.state?.controlAuth === true;
  const canControl = !authRequired || !!token;
  const [tokenRejected, setTokenRejected] = useState(false);
  const [busy, setBusy] = useState<ActionKind | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { runCycle, engageKill } = exec;

  const act = useCallback(
    async (kind: ActionKind) => {
      setBusy(kind);
      setNotice(null);
      const r = await (kind === "cycle" ? runCycle() : engageKill());
      setBusy(null);
      let message: string;
      if (r.status === 401 || r.status === 403) {
        setTokenRejected(true);
        message = `${r.status} Unauthorized — operator token ${token ? "rejected" : "required"}`;
      } else {
        if (r.ok) setTokenRejected(false);
        message = r.ok ? (kind === "cycle" ? "Cycle started" : "Kill switch engaged") : `${kind === "cycle" ? "Cycle" : "Kill"} failed: ${r.message}`;
      }
      setNotice({ ok: r.ok, message });
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), 8000);
      return r;
    },
    [runCycle, engageKill, token],
  );
  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  // ---- Unseen live events (Activity badge) ----
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const unseen = useMemo(() => {
    let n = 0;
    for (const id of liveIds) if (!seen.has(id)) n++;
    return n;
  }, [liveIds, seen]);
  const markActivitySeen = useCallback(() => {
    setSeen((prev) => {
      let changed = false;
      for (const id of liveIds) if (!prev.has(id)) changed = true;
      return changed ? new Set(liveIds) : prev;
    });
  }, [liveIds]);

  const value: Dashboard = {
    events,
    conn,
    liveIds,
    state: exec.state,
    stateStatus: exec.status,
    fetchedAt: exec.fetchedAt,
    info,
    now,
    assets,
    asset,
    setAsset,
    nameOf,
    portfolio,
    mode,
    killed,
    analystsOffline,
    globalBlock,
    attemptsToday,
    token,
    setToken,
    authRequired,
    canControl,
    tokenRejected,
    setTokenRejected,
    busy,
    notice,
    act,
    unseen,
    markActivitySeen,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
