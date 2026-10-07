// Tokenized-stock assets on BSC mainnet (chainId 56).
// Addresses and decimals verified on-chain via eth_call on 2026-10-04.
// Restricted to bStocks / Ondo / xStocks per project rules.

export const BSC_CHAIN_ID = 56;

export const USDT_BSC = {
  symbol: "USDT",
  address: "0x55d398326f99059fF775485246999027B3197955",
  decimals: 18,
} as const;

export type Platform = "bStocks" | "Ondo" | "xStocks";

export interface TokenizedStock {
  symbol: string;
  underlying: string; // TradFi ticker
  platform: Platform;
  address: `0x${string}`;
  decimals: number;
  primaryPool?: `0x${string}`; // PancakeSwap v3 vs USDT
}

export const ASSETS: Record<string, TokenizedStock> = {
  NVDAB: {
    symbol: "NVDAB",
    underlying: "NVDA",
    platform: "bStocks",
    address: "0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436",
    decimals: 18,
    primaryPool: "0x8FB4243b553aC29BA088aCf00B9B7dA24bD6690C", // 0.25% fee
  },
  TSLAB: {
    symbol: "TSLAB",
    underlying: "TSLA",
    platform: "bStocks",
    address: "0x5b1910eAaD6450E50f816082Aa078C41F10C292f",
    decimals: 18,
    primaryPool: "0xB0f5E5400E8F0F7C242F2b7740C004f020579c41", // 0.25% fee
  },
  // Deployed on BSC but with negligible DEX liquidity as of 2026-10-04 — tracked, not traded.
  NVDAon: {
    symbol: "NVDAon",
    underlying: "NVDA",
    platform: "Ondo",
    address: "0xA9eE28C80f960B889dFbd1902055218cBa016F75",
    decimals: 18,
  },
  TSLAx: {
    symbol: "TSLAx",
    underlying: "TSLA",
    platform: "xStocks",
    address: "0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0",
    decimals: 18,
  },
};

export const PRIMARY_ASSET = ASSETS.NVDAB;

// Assets the execution agent actively trades (both have deep PCS v3 USDT pools).
export const TRADED_ASSETS: TokenizedStock[] = [ASSETS.NVDAB, ASSETS.TSLAB];
