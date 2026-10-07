import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import l from "@/app/landing.module.css";

export const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/** Stagger delay for a reveal animation. */
export const d = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

/** Props that make an element reveal on scroll (see Reveal.tsx). */
export const reveal = (kind: "wipe" | "rise" | "fade", delay = 0, extra?: string) => ({
  className: cx(kind === "wipe" ? l.wipe : kind === "rise" ? l.rise : l.fade, extra),
  "data-reveal": "",
  style: d(delay),
});

export function Mark(props: { className?: string }) {
  return (
    <svg viewBox="0 0 42 34" aria-hidden="true" {...props}>
      <polygon points="12,0 30,0 33.2,3.2 15.2,3.2" />
      <polygon points="14.6,5.6 32.6,5.6 35.8,8.8 17.8,8.8" />
      <polygon points="17.2,11.2 35.2,11.2 38.4,14.4 20.4,14.4" />
      <polygon points="3.2,16.8 21.2,16.8 24.4,20 6.4,20" />
      <polygon points="5.8,22.4 23.8,22.4 27,25.6 9,25.6" />
      <polygon points="8.4,28 26.4,28 29.6,31.2 11.6,31.2" />
    </svg>
  );
}

export function Arrow() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h10.2M10.4 5.6 15.2 10l-4.8 4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DashboardButton({ className, children = "Open Dashboard" }: { className?: string; children?: ReactNode }) {
  return (
    <Link href="/dashboard" className={cx(l.btn, l.btnPrimary, className)}>
      <span className={l.btnLabel}>{children}</span>
      <span className={l.btnIcon}>
        <Arrow />
      </span>
    </Link>
  );
}

export function Accent({ children }: { children: string }) {
  return (
    <span className={l.accent} data-text={children}>
      {children}
    </span>
  );
}
