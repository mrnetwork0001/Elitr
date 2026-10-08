// Agent wallet as Binance sees it: Wallet API balances + transaction history, Address Portfolio overview.
// Read-only (address in, data out) - works without the private key via EXECUTION_WALLET_ADDRESS.
//
// Endpoints (binance-web3-llms-full.txt "Wallet API" and "Address Portfolio"):
//   GET /api/v1/dex/balance/all-token-balances-by-address    (address, binanceChainId, excludeRiskToken)
//   GET /api/v1/dex/post-transaction/transactions-by-address (address, binanceChainId, limit)
//   GET /api/v1/dex/market/portfolio/overview                (address, binanceChainId)
// The bundled docs list these endpoints with one-line descriptions only - no parameter or response
// tables - so responses are parsed structurally and every failure is surfaced, never filled in.

import type { BinanceWeb3Client } from "@elitr/binance";
import { Cached, errText, throttled } from "./apiThrottle.js";
import { dxLog, type PaymentRecord, type TradeRecord } from "./state.js";

const CHAIN = "56";
const P = {
  balances: "/api/v1/dex/balance/all-token-balances-by-address",
  txs: "/api/v1/dex/post-transaction/transactions-by-address",
  overview: "/api/v1/dex/market/portfolio/overview",
} as const;

type Row = Record<string, unknown>;
const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null);
const first = (r: Row, keys: string[]) => {
  for (const k of keys) if (r[k] != null && r[k] !== "") return r[k];
  return undefined;
};

/** Depth-first search for the first array of objects that satisfies `pred` on its first element. */
export function findRows(data: unknown, pred: (r: Row) => boolean, depth = 0): Row[] | null {
  if (depth > 4 || data == null) return null;
  if (Array.isArray(data)) {
    if (data.length && data[0] && typeof data[0] === "object" && !Array.isArray(data[0])) {
      if (pred(data[0] as Row)) return data as Row[];
      for (const el of data) {
        const r = findRows(el, pred, depth + 1);
        if (r) return r;
      }
    }
    return null;
  }
  if (typeof data === "object") {
    for (const v of Object.values(data as Row)) {
      const r = findRows(v, pred, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

export interface WalletToken {
  symbol: string;
  address: string | null; // null = native BNB
  balance: number;
  priceUsd: number | null;
  usd: number | null;
  risky: boolean | null;
}

export function parseBalances(data: unknown): WalletToken[] {
  const rows = findRows(data, (r) => "balance" in r || "holdingAmount" in r || "amount" in r) ?? [];
  return rows
    .map((r) => {
      const balance = num(first(r, ["balance", "holdingAmount", "amount"]));
      const priceUsd = num(first(r, ["tokenPrice", "price", "priceUsd"]));
      const usdDirect = num(first(r, ["valueUsd", "usdValue", "balanceUsd", "value"]));
      const addr = str(first(r, ["tokenContractAddress", "tokenAddress", "contractAddress"]));
      return {
        symbol: str(first(r, ["symbol", "tokenSymbol"])) ?? "?",
        address: addr,
        balance: balance ?? 0,
        priceUsd,
        usd: usdDirect ?? (balance != null && priceUsd != null ? balance * priceUsd : null),
        risky: typeof r.isRiskToken === "boolean" ? r.isRiskToken : null,
      };
    })
    .filter((t) => t.balance > 0)
    .sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
}

export type TxKind = "swap" | "b402 payment" | "approval" | "transfer" | "other";

export interface WalletTx {
  txHash: string;
  time: number | null;
  kind: TxKind;
  label: string;
  status: string | null;
  symbol: string | null;
  amount: number | null;
  direction: "in" | "out" | "self" | null;
  feeBnb: number | null;
}

const addrOf = (v: unknown): string | null => {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v[0] && typeof v[0] === "object") return str((v[0] as Row).address);
  if (v && typeof v === "object") return str((v as Row).address);
  return null;
};

/** Classify with what the agent itself recorded (its swaps and b402 settlements), else the API's own fields. */
export function parseTxs(data: unknown, wallet: string, known: { trades: Pick<TradeRecord, "txHash" | "symbol" | "side">[]; payments: Pick<PaymentRecord, "txHash" | "analystId" | "symbol">[] }): WalletTx[] {
  const rows = findRows(data, (r) => "txHash" in r || "txhash" in r || "hash" in r) ?? [];
  const me = wallet.toLowerCase();
  const out: WalletTx[] = [];
  for (const r of rows) {
    const txHash = str(first(r, ["txHash", "txhash", "hash"]));
    if (!txHash) continue;
    const from = addrOf(first(r, ["from", "fromAddress", "fromAddr"]))?.toLowerCase() ?? null;
    const to = addrOf(first(r, ["to", "toAddress", "toAddr"]))?.toLowerCase() ?? null;
    const method = str(first(r, ["methodId", "method", "methodName", "itype", "txType", "type"]))?.toLowerCase() ?? "";
    const trade = known.trades.find((t) => t.txHash?.toLowerCase() === txHash.toLowerCase());
    const pay = known.payments.find((p) => p.txHash?.toLowerCase() === txHash.toLowerCase());
    let kind: TxKind = "other";
    let label = str(first(r, ["methodName", "txType", "type"])) ?? "transaction";
    if (trade) {
      kind = "swap";
      label = `${trade.side ?? "buy"} ${trade.symbol} (agent swap)`;
    } else if (pay) {
      kind = "b402 payment";
      label = `b402 signal payment${pay.analystId ? ` to ${pay.analystId}` : ""}${pay.symbol ? ` (${pay.symbol})` : ""}`;
    } else if (method.includes("approve") || method === "0x095ea7b3") {
      kind = "approval";
      label = "token approval";
    } else if (method.includes("transfer") || method === "0xa9059cbb" || method === "") {
      kind = "transfer";
      label = from === me ? "transfer out" : "transfer in";
    }
    const t = num(first(r, ["txTime", "time", "timestamp", "blockTime"]));
    out.push({
      txHash,
      time: t == null ? null : t < 1e12 ? t * 1000 : t,
      kind,
      label,
      status: str(first(r, ["txStatus", "status"])),
      symbol: str(first(r, ["symbol", "tokenSymbol"])),
      amount: num(first(r, ["amount", "value"])),
      direction: from === me && to === me ? "self" : from === me ? "out" : to === me ? "in" : null,
      feeBnb: num(first(r, ["txFee", "fee", "gasFee"])),
    });
  }
  return out.sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
}

/** Scalar top-level fields of the portfolio overview, as label/value pairs (names come from the API). */
export function parseOverview(data: unknown): { key: string; value: string | number }[] {
  const o = Array.isArray(data) ? data[0] : data;
  if (!o || typeof o !== "object") return [];
  const out: { key: string; value: string | number }[] = [];
  for (const [k, v] of Object.entries(o as Row)) {
    if (typeof v === "number" || (typeof v === "string" && v !== "")) out.push({ key: k, value: v });
    if (out.length >= 16) break;
  }
  return out;
}

export interface WalletApiView {
  address: string | null;
  addressSource: "account" | "EXECUTION_WALLET_ADDRESS" | null;
  walletApi: { tokens: WalletToken[]; totalUsd: number | null; fetchedAt: number; source: "binance-wallet-api"; error?: string } | null;
  portfolio: { overview: { key: string; value: string | number }[]; fetchedAt: number; source: "binance-address-portfolio"; error?: string } | null;
  transactions: { items: WalletTx[]; fetchedAt: number; source: "binance-wallet-api"; error?: string } | null;
  error?: string;
}

export function resolveAddress(account: string | null | undefined, env = process.env): { address: string | null; source: WalletApiView["addressSource"]; error?: string } {
  if (account) return { address: account, source: "account" };
  const a = env.EXECUTION_WALLET_ADDRESS?.trim();
  if (!a) return { address: null, source: null, error: "no wallet: EXECUTION_PRIVATE_KEY and EXECUTION_WALLET_ADDRESS are both unset" };
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return { address: null, source: null, error: `EXECUTION_WALLET_ADDRESS is not an address: ${a}` };
  return { address: a, source: "EXECUTION_WALLET_ADDRESS" };
}

export class WalletApiReader {
  private readonly cache: Cached<WalletApiView>;

  constructor(
    private readonly client: BinanceWeb3Client | null,
    private readonly who: () => { address: string | null; source: WalletApiView["addressSource"]; error?: string },
    private readonly known: () => { trades: TradeRecord[]; payments: PaymentRecord[] },
    ttlMs = 60_000,
  ) {
    this.cache = new Cached(ttlMs, () => this.load());
  }

  get(force = false): Promise<WalletApiView> {
    return this.cache.get(force);
  }

  /** Last good value without waiting (for /state, which must stay fast); kicks a refresh when stale. */
  peek(): WalletApiView | null {
    if (!this.cache.fresh) this.cache.get().catch(() => {});
    return this.cache.peek();
  }

  private call<T>(path: string, query: Record<string, string | number | boolean | undefined>): Promise<T> {
    const c = this.client!;
    return throttled(path, () => c.call<T>("GET", path, { query }));
  }

  private async load(): Promise<WalletApiView> {
    const w = this.who();
    const base: WalletApiView = { address: w.address, addressSource: w.source, walletApi: null, portfolio: null, transactions: null };
    if (!w.address) return { ...base, error: w.error };
    if (!this.client) return { ...base, error: "Binance Web3 API client not configured" };
    const address = w.address;
    const now = () => Date.now();

    const [bal, txs, ov] = await Promise.allSettled([
      this.call<unknown>(P.balances, { address, binanceChainId: CHAIN, excludeRiskToken: true }),
      this.call<unknown>(P.txs, { address, binanceChainId: CHAIN, limit: 20 }),
      this.call<unknown>(P.overview, { address, binanceChainId: CHAIN }),
    ]);

    if (bal.status === "fulfilled") {
      const tokens = parseBalances(bal.value);
      const priced = tokens.filter((t) => t.usd != null);
      base.walletApi = { tokens, totalUsd: priced.length ? priced.reduce((s, t) => s + (t.usd ?? 0), 0) : tokens.length ? null : 0, fetchedAt: now(), source: "binance-wallet-api" };
      if (bal.value != null && !tokens.length && JSON.stringify(bal.value).length > 2) {
        dxLog("wallet-api", "all-token-balances-by-address returned data with no recognisable balance rows", JSON.stringify(bal.value).slice(0, 200));
      }
    } else base.walletApi = { tokens: [], totalUsd: null, fetchedAt: now(), source: "binance-wallet-api", error: errText(bal.reason) };

    if (txs.status === "fulfilled") {
      base.transactions = { items: parseTxs(txs.value, address, this.known()).slice(0, 20), fetchedAt: now(), source: "binance-wallet-api" };
    } else base.transactions = { items: [], fetchedAt: now(), source: "binance-wallet-api", error: errText(txs.reason) };

    if (ov.status === "fulfilled") base.portfolio = { overview: parseOverview(ov.value), fetchedAt: now(), source: "binance-address-portfolio" };
    else base.portfolio = { overview: [], fetchedAt: now(), source: "binance-address-portfolio", error: errText(ov.reason) };

    return base;
  }
}
