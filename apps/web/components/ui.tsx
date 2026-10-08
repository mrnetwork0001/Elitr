import type { ReactNode } from "react";

export function Panel({
  title,
  right,
  children,
  className = "",
  bodyClassName = "",
  id,
}: {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section
      aria-labelledby={id ? `${id}-title` : undefined}
      className={`flex min-w-0 flex-col rounded-lg border border-line bg-panel ${className}`}
    >
      <header className="flex min-h-10 items-center justify-between gap-3 border-b border-line px-4 py-2">
        <h2 id={id ? `${id}-title` : undefined} className="text-[11px] font-medium tracking-[0.12em] text-dim uppercase">
          {title}
        </h2>
        {right ? <div className="flex min-w-0 items-center gap-2 text-xs text-dim">{right}</div> : null}
      </header>
      <div className={`flex-1 p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Designed empty / offline placeholder. */
export function Empty({
  title,
  hint,
  tone = "idle",
  icon,
}: {
  title: string;
  hint?: ReactNode;
  tone?: "idle" | "offline";
  icon?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
      <div
        className={`grid size-9 place-items-center rounded-full border ${
          tone === "offline" ? "border-neg/40 text-neg" : "border-line-strong text-faint"
        }`}
      >
        {icon ?? (tone === "offline" ? <IconOffline /> : <IconWait />)}
      </div>
      <p className={`text-sm ${tone === "offline" ? "text-fg" : "text-dim"}`}>{title}</p>
      {hint ? <p className="max-w-72 text-xs leading-relaxed text-faint">{hint}</p> : null}
    </div>
  );
}

export function ExtLink({ href, children, className = "", title }: { href: string; children: ReactNode; className?: string; title?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={`inline-flex items-center gap-1 text-info underline-offset-2 hover:underline ${className}`}
    >
      {children}
      <IconExternal />
    </a>
  );
}

export function Stat({ label, value, sub, className = "" }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-[11px] tracking-wide text-faint uppercase">{label}</div>
      <div className="num mt-0.5 truncate text-base font-medium text-fg">{value}</div>
      {sub ? <div className="num mt-0.5 truncate text-xs text-dim">{sub}</div> : null}
    </div>
  );
}

export function Badge({ tone, children, className = "", title }: { tone: "pos" | "neg" | "warn" | "neutral" | "accent" | "info"; children: ReactNode; className?: string; title?: string }) {
  const map = {
    info: "border-info/40 bg-info/10 text-info",
    pos: "border-pos/40 bg-pos/10 text-pos",
    neg: "border-neg/40 bg-neg/10 text-neg",
    warn: "border-warn/40 bg-warn/10 text-warn",
    accent: "border-accent/50 bg-accent/10 text-accent",
    neutral: "border-line-strong bg-panel-2 text-dim",
  } as const;
  return (
    <span title={title} className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase ${map[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** PAPER / LIVE fill-mode tag. Paper fills are never presented as real money. */
export function ModeTag({ mode, className = "" }: { mode: "paper" | "live" | null | undefined; className?: string }) {
  if (mode === "live")
    return (
      <span title="Broadcast on BSC mainnet - real funds" className={`inline-flex shrink-0 items-center rounded bg-neg px-1.5 py-0.5 text-[10px] font-bold tracking-[0.12em] text-white uppercase ${className}`}>
        Live
      </span>
    );
  if (mode === "paper")
    return (
      <span
        title="Paper: the swap was simulated against real quotes and booked at the quoted amounts. Nothing was broadcast; no real funds moved."
        className={`inline-flex shrink-0 items-center rounded border border-dashed border-info/70 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.12em] text-info uppercase ${className}`}
      >
        Paper
      </span>
    );
  return null;
}

/** Segmented asset selector. */
export function AssetTabs({ assets, value, onChange, label = "Asset", allowAll = false }: { assets: string[]; value: string; onChange: (v: string) => void; label?: string; allowAll?: boolean }) {
  const opts = allowAll ? ["all", ...assets] : assets;
  return (
    <div role="tablist" aria-label={label} className="inline-flex shrink-0 rounded-md border border-line bg-bg/40 p-0.5">
      {opts.map((a) => (
        <button
          key={a}
          type="button"
          role="tab"
          aria-selected={value === a}
          onClick={() => onChange(a)}
          className={`h-6 rounded px-2 font-mono text-[11px] transition-colors ${value === a ? "bg-panel-2 text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "text-faint hover:text-fg"}`}
        >
          {a === "all" ? "All" : a}
        </button>
      ))}
    </div>
  );
}

// ---- Icons (inline, 1em, currentColor) ----
const base = { width: "1em", height: "1em", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const IconCheck = () => (
  <svg {...base}>
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);
export const IconX = () => (
  <svg {...base}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);
export const IconExternal = () => (
  <svg {...base} width="0.8em" height="0.8em">
    <path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9" />
  </svg>
);
export const IconWait = () => (
  <svg {...base}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5v3l2 1.5" />
  </svg>
);
export const IconOffline = () => (
  <svg {...base}>
    <path d="M2 2l12 12M5.5 8.8A4 4 0 0 1 8 8M3 6.2A7.5 7.5 0 0 1 6 4.6M10.6 5A7.5 7.5 0 0 1 13 6.2M8 12.5h0" />
  </svg>
);
export const IconBolt = () => (
  <svg {...base}>
    <path d="M9 1.5L3.5 9H8l-1 5.5L12.5 7H8z" />
  </svg>
);
export const IconShield = () => (
  <svg {...base}>
    <path d="M8 1.8l5 2v4c0 3.2-2.2 5.3-5 6.4-2.8-1.1-5-3.2-5-6.4v-4z" />
  </svg>
);
export const IconPlay = () => (
  <svg {...base}>
    <path d="M5 3.5v9l7-4.5z" />
  </svg>
);
export const IconChevron = ({ open }: { open?: boolean }) => (
  <svg {...base} style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform 120ms" }}>
    <path d="M6 4l4 4-4 4" />
  </svg>
);
export const IconAlert = () => (
  <svg {...base}>
    <path d="M8 2l6.5 11.5h-13zM8 6.5v3M8 11.6h0" />
  </svg>
);
export const IconKey = () => (
  <svg {...base}>
    <circle cx="5.5" cy="10.5" r="3" />
    <path d="M7.7 8.3L13.5 2.5M11 5l2 2M12.5 3.5l1.5 1.5" />
  </svg>
);
