"use client";
import { useEffect, useState } from "react";

/**
 * Wall clock that ticks on an interval. Returns 0 until mounted so server HTML and the
 * first client render match (relative times render only after hydration).
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
