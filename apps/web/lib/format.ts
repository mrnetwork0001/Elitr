// Formatting helpers. Pure functions, no data of their own.

const STABLES: Record<string, string> = {
  "0x55d398326f99059ff775485246999027b3197955": "USDT",
  "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d": "USD1",
  "0xce24439f2d9c6a2289f741120fe202248b666666": "U",
};

export function assetSymbol(address: string | undefined): string {
  if (!address) return "";
  const known = STABLES[address.toLowerCase()];
  if (known) return known;
  return shortAddr(address);
}

/** Convert an integer amount in smallest units (string) to a JS number of whole units. */
export function fromUnits(raw: string | number | undefined | null, decimals = 18): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = raw.trim();
  if (!/^-?\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  try {
    const big = BigInt(s);
    const neg = big < 0n;
    const abs = neg ? -big : big;
    const base = 10n ** BigInt(decimals);
    const whole = abs / base;
    const frac = abs % base;
    const n = Number(whole) + Number(frac) / Number(base);
    return neg ? -n : n;
  } catch {
    return null;
  }
}

/** USD with 2–4 decimals: small micro-payments keep their precision. */
export function usd(n: number | null | undefined, opts: { min?: number; max?: number } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  const max = opts.max ?? (abs !== 0 && abs < 1 ? 4 : 2);
  const min = Math.min(opts.min ?? 2, max);
  return (
    (n < 0 ? "-$" : "$") +
    abs.toLocaleString("en-US", { minimumFractionDigits: min, maximumFractionDigits: max })
  );
}

/** USD from an 18-decimal smallest-unit string. */
export function usdFromUnits(raw: string | undefined, decimals = 18): string {
  return payUsd(fromUnits(raw, decimals));
}

/** Micro-payment USD: sub-dollar amounts always show 4 decimals ($0.0100). */
export function payUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return Math.abs(n) < 1 && n !== 0 ? usd(n, { min: 4, max: 4 }) : usd(n);
}

export function price(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  const digits = n >= 1 ? 2 : 6;
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function num(n: number | null | undefined, maxFrac = 4): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", { maximumFractionDigits: maxFrac });
}

/** Token amount: tries smallest units first (long integer strings), else a plain number. */
export function tokenAmount(raw: string | number | undefined | null, decimals = 18, maxFrac = 6): string {
  if (raw === undefined || raw === null || raw === "") return "-";
  if (typeof raw === "string" && /^\d{13,}$/.test(raw.trim())) return num(fromUnits(raw, decimals), maxFrac);
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? num(n, maxFrac) : String(raw);
}

export function bps(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  const r = Math.round(n);
  return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r).toLocaleString("en-US")} bps`;
}

export function shortAddr(a: string | undefined | null, head = 6, tail = 4): string {
  if (!a) return "";
  return a.length <= head + tail + 1 ? a : `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export function shortHash(h: string | undefined | null): string {
  return shortAddr(h, 8, 6);
}

export function isTxHash(h: unknown): h is string {
  return typeof h === "string" && /^0x[0-9a-fA-F]{64}$/.test(h);
}

export function isAddress(a: unknown): a is string {
  return typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);
}

export function ago(ts: number | null | undefined, now: number): string {
  if (!ts || !now) return "";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function until(ts: number | null | undefined, now: number): string {
  if (!ts || !now) return "";
  const s = Math.round((ts - now) / 1000);
  if (s <= 0) return "due";
  if (s < 60) return `in ${s}s`;
  const m = Math.floor(s / 60);
  return `in ${m}m ${String(s % 60).padStart(2, "0")}s`;
}

export function clock(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function startOfLocalDay(now: number): number {
  const d = new Date(now || Date.now());
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Accepts unix ms, unix seconds, or an ISO string. */
export function toMs(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;
  if (typeof v === "string" && v) {
    const n = Number(v);
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

export function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

export function hostOf(s: string): string {
  try {
    return new URL(s).hostname.replace(/^www\./, "");
  } catch {
    return s;
  }
}

export function pathOf(s: string): string {
  try {
    const p = new URL(s).pathname;
    return p.length > 1 ? (p.length > 48 ? p.slice(0, 47) + "…" : p) : "";
  } catch {
    return "";
  }
}

const RULE_LABELS: Record<string, string> = {
  killSwitch: "Kill switch",
  minConfidence: "Signal confidence",
  maxSignalAgeSec: "Signal age",
  minGapBps: "Price gap",
  maxTradeUsd: "Trade size",
  maxPositionUsd: "Position size",
  maxDailySpendUsd: "Daily spend",
  maxSlippageBps: "Slippage",
  minLiquidityUsd: "Pool liquidity",
  maxDailyDataUsd: "Daily data spend",
  maxPortfolioUsd: "Portfolio size",
  takeProfitBps: "Take profit",
  stopLossBps: "Stop loss",
  exitOnBearish: "Exit on bearish",
  minAnalystTrust: "Analyst trust",
  stance: "Signal stance",
  bullish: "Signal stance",
  maxSignalAge: "Signal age",
  sufficientUsdt: "USDT balance",
  sufficientGas: "BNB for gas",
  sufficientToken: "Token balance",
  simulatableRoute: "Route can be simulated",
  analystNoSignal: "Analyst signal",
  positionExists: "Position held",
  simulation: "Simulation",
};

export function ruleLabel(rule: string): string {
  if (RULE_LABELS[rule]) return RULE_LABELS[rule];
  const spaced = rule.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_.-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Signed USD for P&L: +$1.23 / -$0.45. */
export function signedUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  if (n === 0) return "$0.00";
  return (n > 0 ? "+" : "") + usd(n);
}

/** 0..1 → "64%". */
export function pct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(digits)}%`;
}

export function toneOf(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n === 0) return "text-fg";
  return n > 0 ? "text-pos" : "text-neg";
}
