import { parseAbi, type PublicClient } from "viem";
import type { BinanceWeb3Client, RwaToken } from "@elitr/binance";
import { ASSETS, USDT_BSC, type TokenizedStock } from "@elitr/shared";

const CHAIN = "56";

// ---- TradFi reference: Yahoo Finance chart API ------------------------------
// The RWA `referencePrice` is documented as "derived from the on-chain token price, not an official
// quote from the traditional stock market" (docs/reference/ref-rwa-data.md), so it cannot serve as an
// independent reference. Yahoo gives the real exchange price (last close when the market is shut).

export interface YahooQuote {
  price: number;
  marketTime: number; // unix ms of regularMarketPrice
  marketOpen: boolean; // inside today's regular session
  exchange: string;
}

export async function fetchYahoo(ticker: string): Promise<YahooQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
  // A short browser UA is accepted; a full Chrome UA string was answered with 429 during testing.
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}: ${text.slice(0, 120)}`);
  const meta = JSON.parse(text)?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  if (!meta || !Number.isFinite(price) || price <= 0) throw new Error(`Yahoo returned no regularMarketPrice for ${ticker}`);
  const reg = meta.currentTradingPeriod?.regular;
  const now = Date.now() / 1000;
  return {
    price,
    marketTime: Number(meta.regularMarketTime) * 1000,
    marketOpen: !!reg && now >= reg.start && now < reg.end,
    exchange: String(meta.fullExchangeName ?? meta.exchangeName ?? ""),
  };
}

// ---- Binance RWA Data API ---------------------------------------------------

export interface MarketStatus {
  openState: boolean;
  marketStatus: string;
  reasonCode: string | null;
  reasonMsg: string | null;
  nextOpenTime: number | null;
}

export interface RwaSnapshot {
  listed: boolean;
  token?: RwaToken;
  status?: MarketStatus;
  tokenPrice?: number;
  referencePrice?: number;
  priceUpdatedAt?: number;
}

/**
 * The token-list object nests a "Market status information" object containing openState / marketStatus /
 * reasonCode / reasonMsg / nextOpenTime (ref-rwa-data.md, Get RWA Token List). The rendered docs do not
 * name the parent key, so locate it structurally instead of guessing a field name.
 */
export function findMarketStatus(obj: Record<string, unknown> | undefined): MarketStatus | undefined {
  if (!obj) return undefined;
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object" && "openState" in v) {
      const m = v as Record<string, unknown>;
      return {
        openState: m.openState === true,
        marketStatus: String(m.marketStatus ?? "unknown"),
        reasonCode: (m.reasonCode as string | null) ?? null,
        reasonMsg: (m.reasonMsg as string | null) ?? null,
        nextOpenTime: m.nextOpenTime == null ? null : Number(m.nextOpenTime),
      };
    }
  }
  return undefined;
}

export async function fetchRwa(client: BinanceWeb3Client, asset: TokenizedStock): Promise<RwaSnapshot> {
  const platformId = asset.platform === "bStocks" ? "bstock" : asset.platform === "Ondo" ? "ondo" : undefined;
  if (!platformId) throw new Error(`RWA Data API has no platformId for ${asset.platform}`);
  const addr = asset.address.toLowerCase();
  const [tokens, prices] = await Promise.all([
    client.rwaTokens({ binanceChainId: CHAIN, platformId }),
    client.rwaPrice(CHAIN, [asset.address]),
  ]);
  const token = (tokens ?? []).find((t) => t.tokenContractAddress?.toLowerCase() === addr);
  const p = (prices ?? []).find((x) => x.tokenContractAddress?.toLowerCase() === addr);
  let status = findMarketStatus(token);
  if (!status && token) {
    // Underlying-market endpoint carries the same market-status object.
    status = findMarketStatus(await client.rwaUnderlyingMarket(CHAIN, asset.address));
  }
  const num = (v: unknown) => (v == null || v === "" ? undefined : Number(v));
  return {
    listed: !!token,
    token,
    status,
    tokenPrice: num(p?.tokenPrice ?? token?.tokenPrice),
    referencePrice: num(p?.referencePrice ?? token?.referencePrice),
    priceUpdatedAt: num(p?.tokenPriceUpdatedAt),
  };
}

// ---- Binance Market API -----------------------------------------------------

export async function fetchOnchainPrice(client: BinanceWeb3Client, asset: Pick<TokenizedStock, "symbol" | "address">): Promise<{ price: number; time: number }> {
  const rows = await client.marketPrice([{ binanceChainId: CHAIN, tokenContractAddress: asset.address }]);
  const row = (rows ?? []).find((r) => r.tokenContractAddress?.toLowerCase() === asset.address.toLowerCase()) ?? rows?.[0];
  const price = Number(row?.price);
  if (!row || !Number.isFinite(price) || price <= 0) throw new Error(`Market API returned no price for ${asset.symbol}: ${JSON.stringify(rows)}`);
  return { price, time: Number(row.time) };
}

// ---- PancakeSwap v3 pool price (on-chain, no API key) ------------------------

// PancakeSwap v3 factory on BSC (pool.factory() of both bStock pools returns this address).
export const PCS_V3_FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865" as const;
export const WBNB = { symbol: "WBNB", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as const, decimals: 18 };
// factory.getPool(WBNB, USDT, 500) on 2026-10-04 — the deepest WBNB/USDT v3 pool (~4.7k WBNB vs ~3.1k at
// fee 100). Re-verified against the factory at runtime before first use.
export const WBNB_USDT_POOL = "0x36696169C63e42cd08ce11f5deeBbCeBae652050" as const;

const poolAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function factory() view returns (address)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint32 feeProtocol, bool unlocked)",
]);
const factoryAbi = parseAbi(["function getPool(address, address, uint24) view returns (address)"]);

/**
 * Price of `base` in units of `quote` from a v3 sqrtPriceX96.
 * sqrtPriceX96 = sqrt(token1/token0 in raw units) * 2^96, so token0 priced in token1 is
 * (sqrtP / 2^96)^2 * 10^(dec0 - dec1); invert when the base token is token1.
 */
export function priceFromSqrtX96(sqrtPriceX96: bigint, dec0: number, dec1: number, baseIsToken0: boolean): number {
  if (sqrtPriceX96 <= 0n) throw new Error("sqrtPriceX96 must be positive");
  const r = Number(sqrtPriceX96) / 2 ** 96;
  const p01 = r * r * 10 ** (dec0 - dec1);
  return baseIsToken0 ? p01 : 1 / p01;
}

const verified = new Map<string, { baseIsToken0: boolean }>();

/** Check on-chain that `pool` is the PCS v3 pool for exactly {base, quote}; cached per process. */
async function verifyPool(pc: PublicClient, pool: `0x${string}`, base: `0x${string}`, quote: `0x${string}`): Promise<{ baseIsToken0: boolean }> {
  const key = `${pool}:${base}:${quote}`.toLowerCase();
  const hit = verified.get(key);
  if (hit) return hit;
  const [t0, t1, fee, factory] = await Promise.all([
    pc.readContract({ address: pool, abi: poolAbi, functionName: "token0" }),
    pc.readContract({ address: pool, abi: poolAbi, functionName: "token1" }),
    pc.readContract({ address: pool, abi: poolAbi, functionName: "fee" }),
    pc.readContract({ address: pool, abi: poolAbi, functionName: "factory" }),
  ]);
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (!eq(factory, PCS_V3_FACTORY)) throw new Error(`pool ${pool} factory ${factory} is not PancakeSwap v3 ${PCS_V3_FACTORY}`);
  const baseIsToken0 = eq(t0, base) && eq(t1, quote);
  if (!baseIsToken0 && !(eq(t0, quote) && eq(t1, base))) throw new Error(`pool ${pool} holds ${t0}/${t1}, expected ${base}/${quote}`);
  const canonical = await pc.readContract({ address: PCS_V3_FACTORY, abi: factoryAbi, functionName: "getPool", args: [t0, t1, fee] });
  if (!eq(canonical, pool)) throw new Error(`factory.getPool(${t0}, ${t1}, ${fee}) = ${canonical}, not ${pool}`);
  const v = { baseIsToken0 };
  verified.set(key, v);
  return v;
}

export interface PoolPrice {
  price: number; // quote per base (USDT per token)
  source: "pcs-v3-slot0";
  pool: `0x${string}`;
}

async function readPoolPrice(
  pc: PublicClient,
  pool: `0x${string}`,
  base: { address: `0x${string}`; decimals: number },
  quote: { address: `0x${string}`; decimals: number },
): Promise<PoolPrice> {
  const { baseIsToken0 } = await verifyPool(pc, pool, base.address, quote.address);
  const [sqrtPriceX96] = await pc.readContract({ address: pool, abi: poolAbi, functionName: "slot0" });
  const [dec0, dec1] = baseIsToken0 ? [base.decimals, quote.decimals] : [quote.decimals, base.decimals];
  return { price: priceFromSqrtX96(sqrtPriceX96, dec0, dec1, baseIsToken0), source: "pcs-v3-slot0", pool };
}

/** USDT price of a tokenized stock from its primary PancakeSwap v3 pool (slot0 — spot, not TWAP). */
export async function poolPrice(pc: PublicClient, symbol: string): Promise<PoolPrice> {
  const asset = ASSETS[symbol];
  if (!asset) throw new Error(`unknown asset ${symbol}`);
  if (!asset.primaryPool) throw new Error(`${symbol} has no primaryPool configured`);
  return readPoolPrice(pc, asset.primaryPool, asset, USDT_BSC);
}

/** BNB/USD: Binance Market API (WBNB) when a client is configured, else the PCS WBNB/USDT v3 pool. */
export async function bnbUsd(pc: PublicClient, binance: BinanceWeb3Client | null): Promise<{ price: number; source: string }> {
  if (binance) {
    try {
      const p = await fetchOnchainPrice(binance, WBNB);
      return { price: p.price, source: "binance-market" };
    } catch {
      /* fall through to the on-chain pool — a real price either way */
    }
  }
  const p = await readPoolPrice(pc, WBNB_USDT_POOL, WBNB, USDT_BSC);
  return { price: p.price, source: p.source };
}
