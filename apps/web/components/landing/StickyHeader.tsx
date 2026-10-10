"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import l from "@/app/landing.module.css";
import { Mark, cx } from "./parts";

const LINKS = [
  ["Proof", "proof"],
  ["How it works", "how"],
  ["Analysts", "market"],
  ["Safety", "safety"],
  ["Guide", "guide"],
  ["FAQ", "faq"],
] as const;

/**
 * Slim glass header that slides in once the hero has scrolled away and stays pinned while scrolling.
 * Desktop: logo left, section links right. Phones: logo + burger that opens a section menu.
 */
export function StickyHeader() {
  const [on, setOn] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // The menu closes when the header hides, on Escape, and after picking a link.
  useEffect(() => {
    if (!on) setOpen(false);
  }, [on]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      setOn(window.scrollY > window.innerHeight - 80);
      const probe = window.innerHeight * 0.35;
      let current: string | null = null;
      for (const [, id] of LINKS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= probe && el.getBoundingClientRect().bottom > probe) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header className={cx(l.root, l.sticky, on && l.stickyOn)} aria-hidden={!on} inert={!on}>
      <a href="#top" className={l.stickyLogo} aria-label="Elitr, back to top">
        <Mark />
        Elitr
      </a>
      <nav className={l.stickyLinks} aria-label="Sections">
        {LINKS.map(([label, id]) => (
          <a key={id} href={`#${id}`} className={cx(l.stickyLink, active === id && l.stickyLinkActive)}>
            {label}
          </a>
        ))}
      </nav>
      <button
        type="button"
        className={cx(l.stickyBurger, open && l.stickyBurgerOpen)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="sticky-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>
      <nav id="sticky-menu" className={l.stickyMenu} aria-label="Sections" hidden={!open}>
        {LINKS.map(([label, id]) => (
          <a key={id} href={`#${id}`} className={cx(l.stickyMenuLink, active === id && l.stickyMenuLinkActive)} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
        <Link href="/dashboard" className={l.stickyMenuCta} onClick={() => setOpen(false)}>
          Open Dashboard
        </Link>
      </nav>
    </header>
  );
}
