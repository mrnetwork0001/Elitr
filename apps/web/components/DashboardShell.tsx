"use client";
import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AgentId } from "@elitr/shared";
import { DashboardProvider, useDashboard } from "@/lib/dashboard";
import type { ConnStatus } from "@/lib/useAgentStream";
import { AGENTS } from "@/lib/config";
import { ago, ruleLabel, until } from "@/lib/format";
import { LogoMark } from "./LogoMark";
import { IconBolt } from "./ui";
import {
  IconActivity,
  IconAnalysts,
  IconClose,
  IconCollapse,
  IconControls,
  IconExpand,
  IconGaps,
  IconMarkets,
  IconMenu,
  IconOverview,
  IconPortfolio,
  IconRun,
  IconTrades,
} from "./NavIcons";

// ---------------------------------------------------------------- navigation

type BadgeKey = "trades" | "activity" | "controls";

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  badge?: BadgeKey;
  group: "desk" | "operate";
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", group: "desk", icon: IconOverview, description: "The desk at a glance — P&L, data spend, analyst picks, decisions and risk." },
  { href: "/dashboard/analysts", label: "Analysts", group: "desk", icon: IconAnalysts, description: "Who the trader pays for signals, chosen by Thompson sampling over scored calls." },
  { href: "/dashboard/markets", label: "Markets", group: "desk", icon: IconMarkets, description: "Signal, reference vs on-chain price and risk checks for one tokenized stock." },
  { href: "/dashboard/gaps", label: "Gap board", group: "desk", icon: IconGaps, description: "Every tokenized stock on BSC: on-chain price vs Binance reference vs Yahoo, market status, sectors and cross-issuer spreads (RWA Data API)." },
  { href: "/dashboard/portfolio", label: "Portfolio", group: "desk", icon: IconPortfolio, description: "Wallet balances, spend caps, open positions and P&L." },
  { href: "/dashboard/trades", label: "Trades", group: "desk", icon: IconTrades, badge: "trades", description: "Every trade attempt — Transaction API simulation, broadcast, confirmation and fill." },
  { href: "/dashboard/activity", label: "Activity", group: "desk", icon: IconActivity, badge: "activity", description: "Every event from every agent, newest first." },
  { href: "/dashboard/controls", label: "Controls", group: "operate", icon: IconControls, badge: "controls", description: "Operator actions, risk limits, trading mode and agent health." },
];

function activeItem(pathname: string): NavItem {
  const p = pathname.replace(/\/+$/, "") || "/dashboard";
  return NAV.find((n) => n.href !== "/dashboard" && (p === n.href || p.startsWith(n.href + "/"))) ?? NAV[0];
}

// ---------------------------------------------------------------- small parts

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex min-w-0 items-center gap-3" aria-label="Elitr — about the project">
      <span className="grid size-9 shrink-0 place-items-center bg-ink" aria-hidden="true">
        <LogoMark className="h-[18px] w-auto text-[var(--color-accent)]" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[17px] leading-none font-semibold tracking-[-0.03em] text-fg">Elitr</span>
        {compact ? null : <span className="mt-1.5 text-[10px] leading-none font-medium tracking-[0.12em] whitespace-nowrap text-faint uppercase">Agent trading desk</span>}
      </span>
    </Link>
  );
}

const DOT: Record<ConnStatus, string> = { live: "bg-pos", connecting: "bg-accent", offline: "bg-neg" };
const DOT_LABEL: Record<ConnStatus, string> = { live: "Live", connecting: "Connecting", offline: "Offline" };
const SHORT: Record<string, string> = { analyst: "News analyst", "analyst-flow": "Flow analyst", execution: "Execution" };

export function StatusDot({ status, className = "" }: { status: ConnStatus; className?: string }) {
  return <span aria-hidden="true" className={`inline-block size-2 shrink-0 ${DOT[status]} ${status === "live" ? "live-dot" : ""} ${className}`} />;
}

export function ModeBadge({ size = "md" }: { size?: "sm" | "md" }) {
  const { mode, stateStatus } = useDashboard();
  const h = size === "sm" ? "h-6 px-2 text-[10px]" : "h-7 px-2.5 text-[11px]";
  if (stateStatus !== "ok" || !mode)
    return (
      <span className={`inline-flex shrink-0 items-center border border-line-strong font-semibold tracking-[0.14em] whitespace-nowrap text-dim uppercase ${h}`} title="Trading mode unknown until the execution agent reports GET /state">
        {size === "sm" ? "Unknown" : "Mode unknown"}
      </span>
    );
  if (mode === "live")
    return (
      <span className={`inline-flex shrink-0 items-center gap-1.5 bg-neg font-bold tracking-[0.16em] text-white uppercase ${h}`} title="LIVE — the execution agent broadcasts real transactions on BSC mainnet">
        <span className="live-dot size-1.5 bg-white" aria-hidden="true" />
        Live
      </span>
    );
  return (
    <span
      className={`inline-flex shrink-0 items-center border border-dashed border-info/70 bg-info/[0.07] font-bold tracking-[0.16em] text-info uppercase ${h}`}
      title="PAPER — quotes, prices and Transaction API simulations are real; fills are booked at the quoted amounts and nothing is broadcast. No real money moves."
    >
      Paper
    </span>
  );
}

function KillChip() {
  const { state, stateStatus, killed } = useDashboard();
  if (stateStatus !== "ok" || state?.killSwitch === null || state?.killSwitch === undefined) return null;
  return killed ? (
    <span className="inline-flex h-7 shrink-0 items-center gap-1.5 border border-neg bg-neg px-2.5 text-[11px] font-bold tracking-[0.14em] text-white uppercase">
      <IconBolt /> Kill switch engaged
    </span>
  ) : (
    <span className="inline-flex h-7 shrink-0 items-center gap-1.5 border border-line-strong bg-panel px-2.5 text-[11px] font-medium tracking-[0.12em] text-dim uppercase">
      <span className="size-1.5 bg-pos" aria-hidden="true" /> Kill switch armed
    </span>
  );
}

// ---------------------------------------------------------------- sidebar

function NavList({ items, pathname, onNavigate, collapsed = false }: { items: NavItem[]; pathname: string; onNavigate?: () => void; collapsed?: boolean }) {
  const d = useDashboard();
  const current = activeItem(pathname);
  const badge = (k?: BadgeKey): { text: string; label: string; tone: "count" | "new" | "warn" } | null => {
    if (k === "trades" && d.attemptsToday > 0) return { text: String(d.attemptsToday), label: `${d.attemptsToday} trade attempts today`, tone: "count" };
    if (k === "activity" && d.unseen > 0) return { text: d.unseen > 99 ? "99+" : String(d.unseen), label: `${d.unseen} new live events`, tone: "new" };
    if (k === "controls" && d.state?.configErrors.length)
      return { text: "!", label: `${d.state.configErrors.length} configuration error${d.state.configErrors.length === 1 ? "" : "s"}`, tone: "warn" };
    return null;
  };
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((n) => {
        const active = n.href === current.href;
        const b = badge(n.badge);
        const Icon = n.icon;
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? (b ? `${n.label} · ${b.label}` : n.label) : undefined}
              className={`group relative flex h-11 items-center text-[14px] transition-colors lg:h-10 ${collapsed ? "justify-center" : "gap-3 pr-3 pl-4"} ${
                active ? "bg-ink font-semibold text-white" : "font-medium text-dim hover:bg-panel-2 hover:text-fg"
              }`}
            >
              <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${active ? "bg-accent" : "bg-transparent group-hover:bg-line-strong"}`} />
              <Icon className={`size-[18px] ${active ? "text-[var(--color-accent)]" : "text-faint group-hover:text-fg"}`} />
              <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate"}>{n.label}</span>
              {b && collapsed ? (
                <>
                  <span
                    aria-hidden="true"
                    className={`absolute top-2 right-3.5 size-2 ${b.tone === "warn" ? "bg-neg" : b.tone === "new" ? "bg-accent" : active ? "bg-white/70" : "bg-line-strong"}`}
                  />
                  <span className="sr-only">, {b.label}</span>
                </>
              ) : b ? (
                <>
                  <span
                    aria-hidden="true"
                    className={`num inline-flex h-5 min-w-5 items-center justify-center px-1.5 font-mono text-[10px] font-semibold ${
                      b.tone === "new"
                        ? "bg-accent text-ink"
                        : b.tone === "warn"
                          ? "bg-neg text-white"
                          : active
                            ? "border border-white/25 text-white"
                            : "border border-line-strong text-dim"
                    }`}
                  >
                    {b.text}
                  </span>
                  <span className="sr-only">, {b.label}</span>
                </>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function StatusRail() {
  const d = useDashboard();
  const execUp = d.stateStatus === "ok";
  return (
    <section aria-label="Desk status" className="flex flex-col items-center gap-3 border border-line bg-bg py-3">
      <ul className="flex flex-col items-center gap-2.5">
        {AGENTS.map((a) => {
          const st = d.conn[a.id as AgentId]?.status ?? "connecting";
          return (
            <li key={a.id} title={`${SHORT[a.id] ?? a.name}: ${DOT_LABEL[st]}`} className="grid size-4 place-items-center">
              <StatusDot status={st} />
              <span className="sr-only">
                {SHORT[a.id] ?? a.name}: {DOT_LABEL[st]}
              </span>
            </li>
          );
        })}
      </ul>
      {d.canControl ? (
        <button
          type="button"
          onClick={() => void d.act("cycle")}
          disabled={!execUp || d.busy !== null || d.killed}
          aria-label={d.busy === "cycle" ? "Running cycle" : "Run cycle"}
          title={!execUp ? "Execution agent offline" : d.killed ? "Kill switch engaged" : "Run cycle"}
          className="grid size-10 place-items-center bg-accent text-ink transition-colors hover:bg-[#ffc81a] disabled:cursor-not-allowed disabled:bg-line disabled:text-dim"
        >
          <IconRun className="size-3.5" />
        </button>
      ) : null}
    </section>
  );
}

function StatusCard() {
  const d = useDashboard();
  const execUp = d.stateStatus === "ok";
  const s = d.state;
  return (
    <section aria-label="Desk status" className="border border-line bg-bg">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
        <h2 className="text-[10px] font-semibold tracking-[0.18em] text-dim uppercase">Agents</h2>
        <span className="font-mono text-[10px] text-faint">SSE</span>
      </div>
      <ul className="px-3.5 py-1.5">
        {AGENTS.map((a) => {
          const c = d.conn[a.id as AgentId];
          const st = c?.status ?? "connecting";
          return (
            <li key={a.id} className="flex h-7 items-center justify-between gap-2 text-[13px]" title={`${a.url}/events${st === "offline" && c?.retries ? ` · retry #${c.retries}` : ""}`}>
              <span className="flex min-w-0 items-center gap-2.5">
                <StatusDot status={st} />
                <span className="truncate text-fg">{SHORT[a.id] ?? a.name}</span>
              </span>
              <span className={`text-[11px] tracking-[0.06em] uppercase ${st === "offline" ? "font-medium text-neg" : "text-dim"}`}>{DOT_LABEL[st]}</span>
            </li>
          );
        })}
      </ul>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 border-t border-line px-3.5 py-3 text-[11px]">
        <dt className="font-medium tracking-[0.14em] text-faint uppercase">Mode</dt>
        <dd className="justify-self-end">
          <ModeBadge size="sm" />
        </dd>
        <dt className="font-medium tracking-[0.14em] text-faint uppercase">Kill switch</dt>
        <dd className={`justify-self-end font-semibold tracking-[0.1em] uppercase ${d.killed ? "text-neg" : "text-fg"}`}>
          {!execUp || s?.killSwitch === null || s?.killSwitch === undefined ? <span className="font-normal text-dim normal-case tracking-normal">unknown</span> : d.killed ? "Engaged" : "Armed"}
        </dd>
        <dt className="font-medium tracking-[0.14em] text-faint uppercase">Next cycle</dt>
        <dd suppressHydrationWarning className="num justify-self-end font-mono text-fg">
          {!execUp ? <span className="font-sans text-dim">agent offline</span> : s?.running ? "running…" : s?.nextCycleAt && d.now ? until(s.nextCycleAt, d.now) : "—"}
        </dd>
      </dl>
      <div className="border-t border-line p-3">
        {d.canControl ? (
          <button
            type="button"
            onClick={() => void d.act("cycle")}
            disabled={!execUp || d.busy !== null || d.killed}
            className="flex h-10 w-full items-center justify-center gap-2 bg-accent text-[13px] font-semibold text-ink transition-colors hover:bg-[#ffc81a] disabled:cursor-not-allowed disabled:bg-line disabled:text-dim"
            title={!execUp ? "Execution agent offline" : d.killed ? "Kill switch engaged" : "POST /cycle — run one trading cycle now"}
          >
            <IconRun className="size-3.5" />
            {d.busy === "cycle" ? "Running…" : "Run cycle"}
          </button>
        ) : (
          <p className="text-[12px] leading-snug text-dim">
            Read-only · operator token required.{" "}
            <Link href="/dashboard/controls" className="font-medium text-fg underline decoration-line-strong underline-offset-2 hover:decoration-fg">
              Open controls
            </Link>
          </p>
        )}
        <p role="status" aria-live="polite" className={`text-[12px] leading-snug empty:hidden ${d.notice?.ok ? "mt-2 text-fg" : "mt-2 font-medium text-neg"}`}>
          {d.notice ? d.notice.message : ""}
        </p>
      </div>
    </section>
  );
}

function SidebarContent({
  pathname,
  onClose,
  closeRef,
  onNavigate,
  collapsed = false,
  onToggle,
}: {
  pathname: string;
  onClose?: () => void;
  closeRef?: React.Ref<HTMLButtonElement>;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const toggle = onToggle ? (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      aria-controls="dash-sidebar"
      title={`${collapsed ? "Expand" : "Collapse"} sidebar  [`}
      className="grid size-8 shrink-0 place-items-center text-faint transition-colors hover:bg-panel-2 hover:text-fg"
    >
      {collapsed ? <IconExpand className="size-[18px]" /> : <IconCollapse className="size-[18px]" />}
    </button>
  ) : null;

  if (collapsed)
    return (
      <div className="flex h-full min-h-0 flex-col items-center">
        <div className="flex shrink-0 flex-col items-center gap-2 border-b border-line py-3.5 w-full">
          <Link href="/" aria-label="Elitr — about the project" title="Elitr" className="grid size-9 place-items-center bg-ink">
            <LogoMark className="h-[18px] w-auto text-[var(--color-accent)]" />
          </Link>
          {toggle}
        </div>
        <nav aria-label="Dashboard" className="w-full flex-1 overflow-y-auto px-2 py-4">
          <NavList items={NAV.filter((n) => n.group === "desk")} pathname={pathname} onNavigate={onNavigate} collapsed />
          <div className="mx-3 my-3 h-px bg-line" aria-hidden="true" />
          <NavList items={NAV.filter((n) => n.group === "operate")} pathname={pathname} onNavigate={onNavigate} collapsed />
        </nav>
        <div className="w-full shrink-0 px-2 pb-4">
          <StatusRail />
        </div>
      </div>
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-line pr-3 pl-5">
        <Brand />
        {onClose ? (
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid size-11 shrink-0 place-items-center border border-line-strong text-fg hover:bg-panel-2"
          >
            <IconClose />
          </button>
        ) : (
          toggle
        )}
      </div>
      <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-4 text-[10px] font-semibold tracking-[0.18em] text-faint uppercase" aria-hidden="true">
          Desk
        </p>
        <NavList items={NAV.filter((n) => n.group === "desk")} pathname={pathname} onNavigate={onNavigate} />
        <p className="mt-6 mb-2 px-4 text-[10px] font-semibold tracking-[0.18em] text-faint uppercase" aria-hidden="true">
          Operate
        </p>
        <NavList items={NAV.filter((n) => n.group === "operate")} pathname={pathname} onNavigate={onNavigate} />
      </nav>
      <div className="shrink-0 px-3 pb-4">
        <StatusCard />
        <p className="mt-3 px-1 text-[11px] leading-relaxed text-faint">Everything here is live agent data — nothing is simulated for display.</p>
      </div>
    </div>
  );
}

// Desktop sidebar collapse, remembered per browser; "[" toggles it.
const COLLAPSE_KEY = "elitr.sidebar.collapsed";

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
  return { collapsed, toggle };
}

// ---------------------------------------------------------------- drawer

function useDrawer(pathname: string) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback((instant = false) => {
    const d = dialogRef.current;
    if (!d?.open || d.classList.contains("closing")) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (instant || reduce) {
      d.close();
      return;
    }
    d.classList.add("closing");
    window.setTimeout(() => {
      d.classList.remove("closing");
      if (d.open) d.close();
    }, 170);
  }, []);

  const show = useCallback(() => {
    const d = dialogRef.current;
    if (!d || d.open) return;
    d.showModal();
    setOpen(true);
    document.documentElement.style.overflow = "hidden";
    closeRef.current?.focus();
  }, []);

  // Native close (our close(), Escape fallback, form) — restore scroll and focus.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onClose = () => {
      setOpen(false);
      document.documentElement.style.overflow = "";
      menuRef.current?.focus({ preventScroll: true });
    };
    const onCancel = (e: Event) => {
      e.preventDefault();
      close();
    };
    d.addEventListener("close", onClose);
    d.addEventListener("cancel", onCancel);
    return () => {
      d.removeEventListener("close", onClose);
      d.removeEventListener("cancel", onCancel);
    };
  }, [close]);

  // Route change closes the drawer.
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Growing past the drawer breakpoint closes it (the sidebar is permanent there).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) close(true);
    };
    mq.addEventListener("change", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      document.documentElement.style.overflow = "";
    };
  }, [close]);

  const onBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target !== dialogRef.current) return;
    const r = dialogRef.current.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) close();
  };

  return { dialogRef, menuRef, closeRef, open, show, close, onBackdropClick };
}

// ---------------------------------------------------------------- shell

function Banners() {
  const d = useDashboard();
  const gb = d.globalBlock;
  return (
    <>
      {d.killed ? (
        <div role="alert" className="border-b border-neg bg-neg text-white">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 text-[13px] lg:px-8">
            <IconBolt />
            <span className="font-semibold tracking-[0.12em] uppercase">Kill switch engaged</span>
            <span className="text-white/90">— the execution agent will not open any trades.</span>
          </div>
        </div>
      ) : null}
      {gb ? (
        <div role="alert" className="border-b border-accent/60 bg-accent/15">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2.5 text-[13px] lg:px-8">
            <span className="font-semibold tracking-[0.1em] text-ink uppercase">All assets blocked · {ruleLabel(gb.rule)}</span>
            <span className="min-w-0 break-words text-dim">{gb.detail}</span>
            <span suppressHydrationWarning className="num ml-auto font-mono text-[12px] text-dim">
              {d.now ? ago(gb.ts, d.now) : ""}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PageHeader({ item }: { item: NavItem }) {
  const d = useDashboard();
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.16em] text-faint uppercase">
          <span className="size-2.5 border-2 border-accent bg-white" aria-hidden="true" />
          <span>
            Desk <span aria-hidden="true">/</span> <span className="text-dim">{item.label}</span>
          </span>
        </p>
        <h1 className="mt-2 text-[28px] leading-[1.1] font-semibold tracking-[-0.035em] text-fg lg:text-[34px]">{item.label}</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-dim">{item.description}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 empty:hidden">
        {/* Below lg the mobile top bar already carries the mode badge. */}
        <span className="hidden lg:contents">
          <ModeBadge />
        </span>
        <KillChip />
        {d.stateStatus === "offline" ? (
          <span className="inline-flex h-7 items-center gap-1.5 border border-neg/50 px-2.5 text-[11px] font-medium tracking-[0.1em] text-neg uppercase">
            <span className="size-1.5 bg-neg" aria-hidden="true" /> Execution offline
          </span>
        ) : null}
      </div>
    </header>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/dashboard";
  const item = activeItem(pathname);
  const drawer = useDrawer(pathname);
  const side = useCollapsed();
  const { markActivitySeen, liveIds } = useDashboard();
  const onActivity = item.href === "/dashboard/activity";

  useEffect(() => {
    if (onActivity) markActivitySeen();
  }, [onActivity, liveIds, markActivitySeen]);

  return (
    <div className={`dash-shell min-h-dvh transition-[padding] duration-200 motion-reduce:transition-none ${side.collapsed ? "lg:pl-[76px]" : "lg:pl-[272px]"}`}>
      <a href="#dash-main" className="sr-only z-50 bg-ink px-4 py-3 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>

      {/* Desktop: permanent sidebar */}
      <aside
        id="dash-sidebar"
        className={`fixed inset-y-0 left-0 z-30 hidden overflow-hidden border-r border-line bg-panel transition-[width] duration-200 motion-reduce:transition-none lg:block ${side.collapsed ? "w-[76px]" : "w-[272px]"}`}
      >
        <SidebarContent pathname={pathname} collapsed={side.collapsed} onToggle={side.toggle} />
      </aside>

      {/* Mobile: top bar + drawer */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-panel/95 px-4 backdrop-blur lg:hidden">
        <Brand compact />
        <div className="flex items-center gap-2.5">
          <ModeBadge size="sm" />
          <button
            ref={drawer.menuRef}
            type="button"
            onClick={drawer.show}
            aria-label="Open navigation"
            aria-haspopup="dialog"
            aria-expanded={drawer.open}
            aria-controls="dash-drawer"
            className="grid size-11 place-items-center border border-line-strong bg-panel text-fg hover:bg-panel-2"
          >
            <IconMenu />
          </button>
        </div>
      </header>
      <dialog
        id="dash-drawer"
        ref={drawer.dialogRef}
        aria-label="Dashboard navigation"
        onClick={drawer.onBackdropClick}
        className="drawer fixed inset-y-0 right-auto left-0 m-0 h-dvh max-h-none w-[min(88vw,320px)] max-w-none border-r border-line bg-panel p-0 text-fg lg:hidden"
      >
        <SidebarContent pathname={pathname} onClose={() => drawer.close()} closeRef={drawer.closeRef} onNavigate={() => drawer.close()} />
      </dialog>

      <Banners />

      <main id="dash-main" tabIndex={-1} className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 pt-5 pb-10 outline-none lg:gap-6 lg:px-8 lg:pt-8">
        <PageHeader item={item} />
        {children}
      </main>
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <DashboardProvider>
      <Shell>{children}</Shell>
    </DashboardProvider>
  );
}
