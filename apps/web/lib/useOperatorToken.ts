"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "elitr.operatorToken";

/** Operator bearer token for POST /cycle and /kill, kept only in this browser. Storage may be unavailable. */
export function useOperatorToken() {
  const [token, setTokenState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const t = window.localStorage.getItem(KEY);
      if (t) setTokenState(t);
    } catch {
      /* storage blocked — token lives in memory only */
    }
  }, []);

  const setToken = useCallback((t: string | null) => {
    const v = t?.trim() || null;
    setTokenState(v);
    try {
      if (v) window.localStorage.setItem(KEY, v);
      else window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { token, setToken };
}
