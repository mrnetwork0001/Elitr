"use client";
import { useEffect, useState } from "react";
import l from "@/app/landing.module.css";
import { Mark, cx } from "./parts";

const LINKS = [
  ["How it works", "how"],
  ["Analysts", "market"],
  ["Safety", "safety"],
  ["Guide", "guide"],
  ["FAQ", "faq"],
] as const;

/** Slim glass header (logo left, section links right) that slides in once the hero has scrolled away. Desktop only. */
export function StickyHeader() {
  const [on, setOn] = useState(false);
  const [active, setActive] = useState<string | null>(null);

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
    </header>
  );
}
