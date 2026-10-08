import { createPublicClient, http, parseAbi, parseAbiItem, type PublicClient } from "viem";
import { bsc } from "viem/chains";
import { USDT_BSC, type TokenizedStock } from "@elitr/shared";

// On-chain order flow for a tokenized stock, read straight from its PancakeSwap v3 USDT pool.
// Every number comes from Swap logs in a real block range; nothing is estimated except the block
// range itself, which is located from timestamps using the chain's measured block time.

const SWAP = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint128 protocolFeesToken0, uint128 protocolFeesToken1)",
);
const POOL_ABI = parseAbi(["function token0() view returns (address)", "function token1() view returns (address)"]);
const Q96 = 2 ** 96;

export interface FlowConfig {
  rpcUrls: string[]; // tried in order for every call; must serve eth_getLogs over the lookback window
  lookbackSec: number;
  largeTradeUsd: number;
  chunkBlocks: number; // initial eth_getLogs range; halved on range-limit errors
}

export function flowConfigFromEnv(env: NodeJS.ProcessEnv = process.env): FlowConfig {
  // bsc-dataseed (the usual BSC_RPC_URL) rejects eth_getLogs outright ("limit exceeded"), so the logs
  // RPC defaults to publicnode, which serves the most recent ~10k blocks (~75 min at 0.45 s blocks).
  const urls = (env.FLOW_RPC_URL || "https://bsc-rpc.publicnode.com").split(",").map((s) => s.trim()).filter(Boolean);
  if (env.BSC_RPC_URL && !urls.includes(env.BSC_RPC_URL)) urls.push(env.BSC_RPC_URL);
  return {
    rpcUrls: urls,
    lookbackSec: Number(env.FLOW_LOOKBACK_SEC || 3600),
    largeTradeUsd: Number(env.FLOW_LARGE_TRADE_USD || 5000),
    chunkBlocks: Number(env.FLOW_LOGS_CHUNK_BLOCKS || 2000),
  };
}

export interface Swap {
  txHash: `0x${string}`;
  blockNumber: bigint;
  logIndex: number;
  side: "buy" | "sell"; // of the tokenized stock
  usd: number; // USDT leg
  qty: number; // stock leg, whole tokens
  priceUsd: number; // pool price after the swap
  trader: string; // tx.from
}

export interface FlowFeatures {
  symbol: string;
  pool: string;
  fromBlock: bigint;
  toBlock: bigint;
  fromTime: number; // unix s
  toTime: number;
  blockTimeSec: number; // measured
  swaps: number;
  buys: number;
  sells: number;
  buyUsd: number;
  sellUsd: number;
  netUsd: number; // buyUsd - sellUsd
  buySellRatio: number | null; // null when there was no sell volume
  traders: number; // distinct tx senders
  buyers: number;
  sellers: number;
  largeBuys: number;
  largeSells: number;
  largeBuyUsd: number;
  largeSellUsd: number;
  priceStart: number;
  priceEnd: number;
  priceChangeBps: number;
  largest: (Swap & { timestamp: number })[]; // top swaps by USD, for sources
}

const errText = (e: unknown) => {
  const x = e as { shortMessage?: string; details?: string; message?: string };
  return [x.shortMessage, x.details].filter(Boolean).join(": ") || String(x.message ?? e);
};
const RANGE_ERR = /limit|range|exceed|too many|too large|block range|max.*block/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class FlowReader {
  private readonly clients: { url: string; client: PublicClient }[];
  private readonly pools = new Map<string, { stockIs0: boolean }>();
  private readonly senders = new Map<string, string>(); // txHash -> from (immutable, safe to cache)

  constructor(readonly config: FlowConfig) {
    if (!config.rpcUrls.length) throw new Error("no RPC URL for flow analysis");
    if (!(config.lookbackSec > 0)) throw new Error("FLOW_LOOKBACK_SEC must be > 0");
    this.clients = config.rpcUrls.map((url) => ({
      url,
      client: createPublicClient({ chain: bsc, transport: http(url, { retryCount: 1, timeout: 20_000 }) }) as PublicClient,
    }));
  }

  /** Runs `fn` on each RPC in order until one succeeds; throws with every RPC's error. */
  private async rpc<T>(what: string, fn: (c: PublicClient) => Promise<T>): Promise<T> {
    const errs: string[] = [];
    for (const { url, client } of this.clients) {
      try {
        return await fn(client);
      } catch (e) {
        errs.push(`${new URL(url).host}: ${errText(e)}`);
      }
    }
    throw new Error(`${what} failed on every RPC (${errs.join("; ")})`);
  }

  /** Verifies on-chain that the pool really is <stock>/USDT and records the token order. */
  private async pool(asset: TokenizedStock): Promise<{ address: `0x${string}`; stockIs0: boolean }> {
    if (!asset.primaryPool) throw new Error(`${asset.symbol} has no primary pool configured`);
    const address = asset.primaryPool;
    const known = this.pools.get(address);
    if (known) return { address, ...known };
    const [t0, t1] = await this.rpc("pool token0/token1", (c) =>
      Promise.all([
        c.readContract({ address, abi: POOL_ABI, functionName: "token0" }),
        c.readContract({ address, abi: POOL_ABI, functionName: "token1" }),
      ]),
    );
    const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    let stockIs0: boolean;
    if (eq(t0, asset.address) && eq(t1, USDT_BSC.address)) stockIs0 = true;
    else if (eq(t1, asset.address) && eq(t0, USDT_BSC.address)) stockIs0 = false;
    else throw new Error(`pool ${address} is ${t0}/${t1}, not ${asset.symbol}/USDT`);
    if (asset.decimals !== 18 || USDT_BSC.decimals !== 18) throw new Error("flow math assumes 18-decimal tokens");
    this.pools.set(address, { stockIs0 });
    return { address, stockIs0 };
  }

  /** Finds [fromBlock, toBlock] covering the last `lookbackSec`, using the measured block time. */
  async window(lookbackSec = this.config.lookbackSec) {
    const latest = await this.rpc("getBlock(latest)", (c) => c.getBlock());
    const probe = 2000n;
    const ref = await this.rpc("getBlock", (c) => c.getBlock({ blockNumber: latest.number - probe }));
    const blockTimeSec = Number(latest.timestamp - ref.timestamp) / Number(probe);
    if (!(blockTimeSec > 0)) throw new Error("could not measure BSC block time");
    const target = Number(latest.timestamp) - lookbackSec;
    let from = latest.number - BigInt(Math.ceil(lookbackSec / blockTimeSec));
    // One secant correction against the real timestamp of the estimated start block.
    const est = await this.rpc("getBlock", (c) => c.getBlock({ blockNumber: from }));
    from += BigInt(Math.round((target - Number(est.timestamp)) / blockTimeSec));
    if (from > latest.number) from = latest.number;
    return { fromBlock: from, toBlock: latest.number, toTime: Number(latest.timestamp), fromTime: target, blockTimeSec };
  }

  /** eth_getLogs over a range, chunked; halves the chunk on range-limit errors and retries transient ones. */
  private async logs(address: `0x${string}`, fromBlock: bigint, toBlock: bigint) {
    const out: Awaited<ReturnType<PublicClient["getLogs"]>> = [];
    let size = BigInt(this.config.chunkBlocks);
    let start = fromBlock;
    let attempt = 0;
    while (start <= toBlock) {
      const end = start + size - 1n > toBlock ? toBlock : start + size - 1n;
      try {
        const got = await this.rpc(`getLogs ${start}-${end}`, (c) => c.getLogs({ address, event: SWAP, fromBlock: start, toBlock: end, strict: true }));
        out.push(...(got as any));
        start = end + 1n;
        attempt = 0;
      } catch (e) {
        const msg = (e as Error).message;
        if (/archive|pruned|missing trie|state.*not available/i.test(msg)) {
          throw new Error(
            `RPC cannot serve Swap logs back to block ${start} (${msg}). Lower FLOW_LOOKBACK_SEC or set FLOW_RPC_URL to an archive-capable BSC RPC`,
          );
        }
        if (RANGE_ERR.test(msg) && size > 50n) {
          size /= 2n;
          continue;
        }
        if (++attempt > 3) throw e;
        await sleep(500 * 2 ** attempt);
      }
    }
    return out as unknown as { args: { amount0: bigint; amount1: bigint; sqrtPriceX96: bigint }; transactionHash: `0x${string}`; blockNumber: bigint; logIndex: number }[];
  }

  /** tx.from for each hash (batched, cached). Throws if any lookup fails - traders are never guessed. */
  private async traders(hashes: `0x${string}`[]) {
    const todo = [...new Set(hashes)].filter((h) => !this.senders.has(h));
    const CONC = 8;
    for (let i = 0; i < todo.length; i += CONC) {
      await Promise.all(
        todo.slice(i, i + CONC).map(async (hash) => {
          for (let a = 0; ; a++) {
            try {
              const tx = await this.rpc(`getTransaction ${hash}`, (c) => c.getTransaction({ hash }));
              this.senders.set(hash, tx.from.toLowerCase());
              return;
            } catch (e) {
              if (a >= 2) throw e;
              await sleep(400 * 2 ** a);
            }
          }
        }),
      );
    }
    if (this.senders.size > 50_000) this.senders.clear();
  }

  async features(asset: TokenizedStock): Promise<FlowFeatures> {
    const { address, stockIs0 } = await this.pool(asset);
    const w = await this.window();
    const logs = await this.logs(address, w.fromBlock, w.toBlock);
    logs.sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1));
    await this.traders(logs.map((l) => l.transactionHash));

    const swaps: Swap[] = logs.map((l) => {
      const { amount0, amount1, sqrtPriceX96 } = l.args;
      const stockAmt = stockIs0 ? amount0 : amount1; // pool's perspective: + received, − paid out
      const usdtAmt = stockIs0 ? amount1 : amount0;
      const p1per0 = (Number(sqrtPriceX96) / Q96) ** 2; // both 18 decimals
      return {
        txHash: l.transactionHash,
        blockNumber: l.blockNumber,
        logIndex: l.logIndex,
        side: usdtAmt > 0n ? "buy" : "sell",
        usd: Math.abs(Number(usdtAmt)) / 1e18,
        qty: Math.abs(Number(stockAmt)) / 1e18,
        priceUsd: stockIs0 ? p1per0 : 1 / p1per0,
        trader: this.senders.get(l.transactionHash)!,
      };
    });

    const buys = swaps.filter((s) => s.side === "buy");
    const sells = swaps.filter((s) => s.side === "sell");
    const sum = (xs: Swap[]) => xs.reduce((t, s) => t + s.usd, 0);
    const large = (xs: Swap[]) => xs.filter((s) => s.usd >= this.config.largeTradeUsd);
    const buyUsd = sum(buys);
    const sellUsd = sum(sells);
    const priceStart = swaps[0]?.priceUsd ?? NaN;
    const priceEnd = swaps.at(-1)?.priceUsd ?? NaN;

    const top = [...swaps].sort((a, b) => b.usd - a.usd).slice(0, 3);
    const stamps = await Promise.all(
      [...new Set(top.map((s) => s.blockNumber))].map(async (n) => [n, await this.rpc("getBlock", (c) => c.getBlock({ blockNumber: n }))] as const),
    );
    const ts = new Map(stamps.map(([n, b]) => [n, Number(b.timestamp)]));

    return {
      symbol: asset.symbol,
      pool: address,
      ...w,
      swaps: swaps.length,
      buys: buys.length,
      sells: sells.length,
      buyUsd,
      sellUsd,
      netUsd: buyUsd - sellUsd,
      buySellRatio: sellUsd > 0 ? buyUsd / sellUsd : null,
      traders: new Set(swaps.map((s) => s.trader)).size,
      buyers: new Set(buys.map((s) => s.trader)).size,
      sellers: new Set(sells.map((s) => s.trader)).size,
      largeBuys: large(buys).length,
      largeSells: large(sells).length,
      largeBuyUsd: sum(large(buys)),
      largeSellUsd: sum(large(sells)),
      priceStart,
      priceEnd,
      priceChangeBps: (priceEnd / priceStart - 1) * 10_000,
      largest: top.map((s) => ({ ...s, timestamp: ts.get(s.blockNumber)! })),
    };
  }
}

// ---------- deterministic-flow-v1 scoring ----------
//
// Four signed components, each in [-1, 1] (positive = bullish):
//   I  volume imbalance      (buyUsd − sellUsd) / (buyUsd + sellUsd)        weight 0.35
//   L  large-trade imbalance (largeBuyUsd − largeSellUsd) / (sum), 0 if none weight 0.25
//   B  breadth               (buyers − sellers) / (buyers + sellers)          weight 0.15
//   M  momentum              tanh(priceChangeBps / 100)                       weight 0.25
// raw = Σ wᵢ·cᵢ ∈ [-1, 1]; evidence shrink k = n / (n + 20) with n = swaps, so a handful of swaps
// cannot produce an extreme call; score = round(50 + 49·k·raw) ∈ [1, 99].
// Stance uses the same cut-offs as the news analyst: bullish > 60, bearish < 40, else neutral.
// The buy/sell ratio is reported but not scored separately - it is a monotone transform of I.

export const FLOW_MODEL = "deterministic-flow-v1";
export const FLOW_WEIGHTS = { imbalance: 0.35, large: 0.25, breadth: 0.15, momentum: 0.25 } as const;

export interface FlowScore {
  score: number;
  stance: "bullish" | "neutral" | "bearish";
  components: { imbalance: number; large: number; breadth: number; momentum: number };
  shrink: number;
}

const ratio = (a: number, b: number) => (a + b > 0 ? (a - b) / (a + b) : 0);

export function scoreFlow(f: FlowFeatures): FlowScore {
  const components = {
    imbalance: ratio(f.buyUsd, f.sellUsd),
    large: ratio(f.largeBuyUsd, f.largeSellUsd),
    breadth: ratio(f.buyers, f.sellers),
    momentum: Number.isFinite(f.priceChangeBps) ? Math.tanh(f.priceChangeBps / 100) : 0,
  };
  const raw =
    FLOW_WEIGHTS.imbalance * components.imbalance +
    FLOW_WEIGHTS.large * components.large +
    FLOW_WEIGHTS.breadth * components.breadth +
    FLOW_WEIGHTS.momentum * components.momentum;
  const shrink = f.swaps / (f.swaps + 20);
  const score = Math.min(99, Math.max(1, Math.round(50 + 49 * shrink * raw)));
  const stance = score > 60 ? "bullish" : score < 40 ? "bearish" : "neutral";
  return { score, stance, components, shrink };
}

export const usdShort = (x: number) =>
  Math.abs(x) >= 1e6 ? `$${(x / 1e6).toFixed(2)}M` : Math.abs(x) >= 1e3 ? `$${(x / 1e3).toFixed(1)}k` : `$${x.toFixed(0)}`;

export function flowRationale(f: FlowFeatures, s: FlowScore): string {
  const mins = Math.round((f.toTime - f.fromTime) / 60);
  const span = mins >= 90 ? `${(mins / 60).toFixed(1)}h` : `${mins} min`;
  const sign = (x: number) => (x >= 0 ? "+" : "−");
  const ratioTxt = f.buySellRatio === null ? "no sells" : `buy/sell ${f.buySellRatio.toFixed(2)}x`;
  const largeTxt =
    f.largeBuys + f.largeSells
      ? `${f.largeBuys} large buys (${usdShort(f.largeBuyUsd)}) vs ${f.largeSells} large sells (${usdShort(f.largeSellUsd)})`
      : "no large trades";
  return (
    `Last ${span} on the PancakeSwap v3 ${f.symbol}/USDT pool: ${f.swaps} swaps from ${f.traders} wallets ` +
    `(${f.buyers} buying, ${f.sellers} selling); buys ${usdShort(f.buyUsd)} vs sells ${usdShort(f.sellUsd)} ` +
    `(net ${sign(f.netUsd)}${usdShort(Math.abs(f.netUsd))}, ${ratioTxt}); ${largeTxt}; ` +
    `price ${sign(f.priceChangeBps)}${Math.abs(f.priceChangeBps / 100).toFixed(2)}% ($${f.priceStart.toFixed(2)} → $${f.priceEnd.toFixed(2)}). ` +
    `Score ${s.score} (${s.stance}).`
  );
}
