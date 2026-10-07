// Shapes of the execution agent's read-only routes (/rwa/board, /summary/today, /state wallet fields)
// and small formatters for them. Mirrors apps/execution-agent/src/{rwaBoard,summary,walletApi}.ts.

export interface MarketState {
  openState: boolean;
  marketStatus: string;
  reasonCode: string | null;
  reasonMsg: string | null;
  nextOpenTime: number | null;
  nextCloseTime: number | null;
}

export interface BoardToken {
  symbol: string;
  name: string | null;
  address: string;
  platformId: string;
  issuer: string;
  assetType: string | null;
  underlying: string;
  underlyingName: string | null;
  tokenPrice: number | null;
  referencePrice: number | null;
  priceUpdatedAt: number | null;
  refSpreadBps: number | null;
  yahooPrice: number | null;
  yahooTime: number | null;
  yahooSpreadBps: number | null;
  traderGapBps: number | null;
  market: MarketState | null;
  volume24hUsd: number | null;
  marketCapUsd: number | null;
  peRatioTTM: number | null;
  sectors: number[];
  traded: boolean;
  liquidityUsd: number | null;
  topPool: string | null;
  underlyingMarket: Record<string, number | string | null> | null;
}

export interface CrossIssuerPair {
  underlying: string;
  name: string | null;
  legs: { symbol: string; issuer: string; address: string; tokenPrice: number | null; liquidityUsd: number | null; topPool: string | null }[];
  crossSpreadBps: number | null;
}

export interface RwaBoard {
  fetchedAt: number;
  chainId: string;
  platforms: { platformId: string; issuer: string; tokens: number; bscTokens: number | null; error?: string }[];
  xStocks: { covered: false; note: string };
  market: (MarketState & { agree: number; total: number; lastCloseTime: number | null; lastCloseSource: string | null }) | null;
  tokens: BoardToken[];
  pairs: CrossIssuerPair[];
  sectors: { tabId: number; label: string; count: number | null; error?: string }[];
  sectorsFetchedAt: number | null;
  yahoo: { source: string; requested: number; priced: number; error?: string; note: string };
  minGapBps: number | null;
  errors: string[];
  notes: string[];
}

export interface TodaySummary {
  day: string;
  generatedAt: number;
  mode: "paper" | "live";
  source: "deterministic";
  paragraph: string;
  facts: { id: string; label: string; text: string; links?: { label: string; href: string }[] }[];
  decisions: { symbol: string; name: string; action: string; reason: string; at: number; counts: Record<string, number> }[];
  counts: { signals: number; signalUsd: number; decisions: number; trades: number; scored: number; ratingsPosted: number; errors: number };
}

export interface WalletToken {
  symbol: string;
  address: string | null;
  balance: number;
  priceUsd: number | null;
  usd: number | null;
  risky: boolean | null;
}

export interface WalletTx {
  txHash: string;
  time: number | null;
  kind: string;
  label: string;
  status: string | null;
  symbol: string | null;
  amount: number | null;
  direction: "in" | "out" | "self" | null;
  feeBnb: number | null;
}

export interface WalletApiFields {
  walletApi: { tokens: WalletToken[]; totalUsd: number | null; fetchedAt: number; source: string; error?: string } | null;
  portfolio: { overview: { key: string; value: string | number }[]; fetchedAt: number; source: string; error?: string } | null;
  walletTxs: { items: WalletTx[]; fetchedAt: number; source: string; error?: string } | null;
  walletApiAddress: string | null;
  walletApiStatus: string;
}

/** "unsupported" when the agent's /state predates these fields. */
export function walletApiFields(raw: unknown): WalletApiFields | "unsupported" | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!("walletApi" in o) && !("walletApiStatus" in o)) return "unsupported";
  return o as unknown as WalletApiFields;
}

// ---- formatting ----

const ET = "America/New_York";

/** "Tue 16:00 ET" */
export function etTime(ms: number): string {
  const d = new Date(ms);
  const wd = d.toLocaleDateString("en-US", { weekday: "short", timeZone: ET });
  const hm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ET });
  return `${wd} ${hm} ET`;
}

/** "2d 4h", "4h 21m", "12m" */
export function span(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${mm}m`;
  return `${mm}m`;
}

/** "+23.4" / "-5.0" bps */
export function bpsTxt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(Math.abs(n) >= 100 ? 0 : 1)}`;
}

/** Premium (on-chain dearer) in red, discount in green, near-zero muted. */
export function spreadTone(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || Math.abs(n) < 10) return "text-dim";
  return n > 0 ? "text-neg" : "text-pos";
}

export const MARKET_LABEL: Record<string, string> = {
  premarket: "Pre-market",
  regular: "Open",
  postmarket: "After hours",
  overnight: "Overnight",
  closed: "Closed",
  pause: "Halted",
};

export function compactUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(a < 10 ? 2 : 0)}`;
}
