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
  // Added 2026-10-08 after on-chain verification (PCS v3 factory getPool, USDT side of the pool, DexScreener cross-check).
  BABAB: {
    symbol: "BABAB",
    underlying: "BABA",
    platform: "bStocks",
    address: "0x4eF9d3062c7F6ebA4AAE4990c5036598C6eff4ec",
    decimals: 18,
    primaryPool: "0xfD95CB1391999006Eb91797a7c62acFe88b20292", // 0.25% fee, ~$455k USDT side, DexScreener ~$2.5M
  },
  CRCLB: {
    symbol: "CRCLB",
    underlying: "CRCL",
    platform: "bStocks",
    address: "0x80f3D493EBCe97e343c53D29a137942416B4ffC0",
    decimals: 18,
    primaryPool: "0x29967c54c5Bf12E8158c8894376064b30ebaB297", // 0.25% fee, ~$179k USDT side, DexScreener ~$925k
  },
  SNDKB: {
    symbol: "SNDKB",
    underlying: "SNDK",
    platform: "bStocks",
    address: "0x3eE4dF61bd4F867E349BEaE8bFE07bc31b4850fb",
    decimals: 18,
    primaryPool: "0xE4B5403f5103b02d1E8193B0D7D76D49F3F8ad77", // 0.25% fee, ~$99k USDT side, DexScreener ~$237k
  },
  METAB: {
    symbol: "METAB",
    underlying: "META",
    platform: "bStocks",
    address: "0x7425889FE94F9d693E8daefE88BCCed6AcFEf4c0",
    decimals: 18,
    primaryPool: "0xC2151a561E928D16576d75Ea88544543ac63D80B", // 0.25% fee, ~$103k USDT side, DexScreener ~$214k
  },
  // Deployed on BSC but with negligible DEX liquidity as of 2026-10-04 - tracked, not traded.
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

// Assets the execution agent actively trades: bStocks with a verified PCS v3 USDT pool above the
// $50k liquidity floor and a real (post-IPO) underlying with a Yahoo quote. Skipped: TSMB (thinnest,
// ~$15k/day volume), IBMB (~$900 pool), SPCXB (pre-IPO, no reference price), MUB (~$16k pool).
export const TRADED_ASSETS: TokenizedStock[] = [ASSETS.NVDAB, ASSETS.TSLAB, ASSETS.BABAB, ASSETS.CRCLB, ASSETS.SNDKB, ASSETS.METAB];
