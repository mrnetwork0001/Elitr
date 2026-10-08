"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "elitr.operatorToken";

/** Operator bearer token for POST /cycle and /kill, kept for this tab's session only. Storage may be unavailable. */
export function useOperatorToken() {
  const [token, setTokenState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const t = window.sessionStorage.getItem(KEY);
      if (t) setTokenState(t);
    } catch {
      /* storage blocked - token lives in memory only */
    }
  }, []);

  const setToken = useCallback((t: string | null) => {
    const v = t?.trim() || null;
    setTokenState(v);
    try {
      if (v) window.sessionStorage.setItem(KEY, v);
      else window.sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { token, setToken };
}
