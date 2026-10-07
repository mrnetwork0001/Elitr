"use client";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import s from "@/app/hero.module.css";

const LINKS = [
  ["Proof", "#proof", "0.02s"],
  ["How it works", "#how", "0.08s"],
  ["Analysts", "#market", "0.14s"],
  ["Safety", "#safety", "0.2s"],
  ["FAQ", "#faq", "0.26s"],
] as const;

const d = (delay: string) => ({ "--d": delay }) as CSSProperties;

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h10.2M10.4 5.6 15.2 10l-4.8 4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DashboardButton({ style }: { style?: CSSProperties }) {
  return (
    <Link href="/dashboard" className={`${s.btn} ${s.btnLight} ${s.wipe}`} style={style}>
      <span className={s.btnLabel}>Open Dashboard</span>
      <span className={s.btnIcon}>
        <Arrow />
      </span>
    </Link>
  );
}

export function Hero() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={s.page}>
      <div className={s.bg} aria-hidden="true">
        <div className={s.bgArt}>
          <picture>
            {/* Portrait art on phones; motion layers re-centre for it in hero.module.css (max-width: 820px). */}
            <source media="(max-width: 820px)" srcSet="/hero-mobile.jpg" />
            <img
              className={s.bgImg}
              src="/hero.jpg"
              srcSet="/hero-sm.jpg 900w, /hero.jpg 1672w"
              sizes="100vw"
              alt=""
              aria-hidden="true"
              fetchPriority="high"
              decoding="async"
            />
          </picture>
          <span className={s.glow} />
          <span className={s.shimmer} />
          <span className={`${s.mist} ${s.mistA}`} />
          <span className={`${s.mist} ${s.mistB}`} />
        </div>
        <span className={s.veil} />
        <span className={s.shade} />
      </div>

      <header className={s.nav}>
        <Link className={s.logo} href="/" aria-label="Elitr">
          <svg viewBox="0 0 42 34" aria-hidden="true">
            <polygon points="12,0 30,0 33.2,3.2 15.2,3.2" />
            <polygon points="14.6,5.6 32.6,5.6 35.8,8.8 17.8,8.8" />
            <polygon points="17.2,11.2 35.2,11.2 38.4,14.4 20.4,14.4" />
            <polygon points="3.2,16.8 21.2,16.8 24.4,20 6.4,20" />
            <polygon points="5.8,22.4 23.8,22.4 27,25.6 9,25.6" />
            <polygon points="8.4,28 26.4,28 29.6,31.2 11.6,31.2" />
          </svg>
        </Link>

        <nav className={s.navLinks} aria-label="Primary">
          {LINKS.map(([label, href, delay]) => (
            <a key={label} href={href} className={s.navLink} style={d(delay)}>
              {label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          className={s.burger}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <div id="mobile-menu" className={s.mobileMenu} hidden={!open}>
        <nav className={s.mobileLinks} aria-label="Mobile">
          {LINKS.map(([label, href]) => (
            <a key={label} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
        </nav>
      </div>

      <main className={s.hero}>
        <div className={`${s.badge} ${s.wipe}`} style={d("0.18s")}>
          <span className={s.badgeMark} aria-hidden="true" />
          Agent-to-agent trading on BNB Chain
        </div>

        <h1 className={s.headline}>
          <span className={s.mask}>
            <span className={s.rise} style={d("0.26s")}>
              AI agents trade stocks
            </span>
          </span>
          <span className={s.mask}>
            <span className={`${s.rise} ${s.line}`} style={d("0.4s")}>
              <span className={s.muted}>and pay for </span>
              <span className={s.accent} data-text="being right.">
                being right.
              </span>
            </span>
          </span>
        </h1>

        <div className={s.actions}>
          <DashboardButton style={d("0.56s")} />
          <a href="#how" className={`${s.btn} ${s.btnGhost} ${s.wipe}`} style={d("0.66s")}>
            <span className={s.btnLabel}>See How It Works</span>
          </a>
        </div>
      </main>

      <p className={s.lede}>
        <span className={s.ledeRise} style={d("0.78s")}>
          Elitr&apos;s news and on-chain flow analysts sell signals over Binance b402. The trader picks between them by track record, checks every
          idea against live prices and 14 risk rules, and dry-runs every transaction before trading tokenized stocks on BNB Chain.
        </span>
      </p>
    </div>
  );
}
