"use client";
import { useEffect } from "react";

/**
 * Progressive enhancement for the landing page: white page background, smooth anchor scrolling, and
 * reveal-on-scroll for every [data-reveal] element. Without JS (or with reduced motion) nothing is hidden.
 */
export function Reveal() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = { bg: html.style.background, scroll: html.style.scrollBehavior };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    html.style.background = "#ffffff";
    if (!reduce) html.style.scrollBehavior = "smooth";

    let io: IntersectionObserver | undefined;
    if (!reduce && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            e.target.setAttribute("data-in", "");
            io?.unobserve(e.target);
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0 },
      );
      document.querySelectorAll("[data-reveal]:not([data-in])").forEach((el) => io!.observe(el));
      html.classList.add("lp-js");
    }

    return () => {
      io?.disconnect();
      html.classList.remove("lp-js");
      html.style.background = prev.bg;
      html.style.scrollBehavior = prev.scroll;
    };
  }, []);

  return null;
}
