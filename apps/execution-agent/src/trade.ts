import { decodeFunctionData, erc20Abi, formatEther, formatUnits, parseEther, type PrivateKeyAccount, type PublicClient, type TransactionReceipt } from "viem";
import { BinanceApiError, type BinanceWeb3Client, type QuoteRoute } from "@elitr/binance";
import { ASSETS, USDT_BSC, type EventHub, type RiskConfig, type Side, type TokenizedStock } from "@elitr/shared";
import type { PendingTx, StateStore } from "./state.js";
import { erc20Allowance, signTx, toBig, transferredIn, transferredOut, type Address, type UnsignedTx } from "./wallet.js";

const CHAIN = "56";

/** Trading API router on BSC (docs/reference/binance-web3-llms-full.txt, "Router Contract" table). */
export const KNOWN_ROUTERS = ["0xB44446b0c8E56988c34f7Ff73Ae904982b5FdDA5"].map((a) => a.toLowerCase());
export const MAX_GAS = 3_000_000n;
export const MAX_GAS_PRICE_MULTIPLE = 3n;

export interface TxDeps {
  hub: EventHub;
  binance: BinanceWeb3Client;
  pc: PublicClient;
  account: PrivateKeyAccount;
  live: boolean;
  mevProtection: boolean;
  /** Called with every confirmed receipt (gas accounting). Must not throw. */
  onReceipt?: (receipt: TransactionReceipt, label: string) => Promise<void> | void;
  /** Pending-swap records (H1): written right after broadcast, cleared by the caller once the fill is booked. */
  store?: Pick<StateStore, "setPending" | "clearPending">;
  /** Checked right before signing; true aborts the send (kill switch). */
  abort?: () => boolean;
  /** Worst-case fee cap in wei (default EXECUTION_MAX_FEE_BNB, 0.01 BNB). */
  maxFeeWei?: bigint;
}

export function maxFeeWeiFromEnv(env: NodeJS.ProcessEnv = process.env): bigint {
  const v = env.EXECUTION_MAX_FEE_BNB?.trim() || "0.01";
  if (!/^\d+(\.\d+)?$/.test(v) || !(Number(v) > 0)) throw new Error(`EXECUTION_MAX_FEE_BNB invalid: ${JSON.stringify(env.EXECUTION_MAX_FEE_BNB)}`);
  return parseEther(v);
}

/**
 * Sanity limits on what we are about to sign: a runaway gas limit, a fee above the BNB budget, or a
 * gas price far above the network's. Throws with the reason; nothing is signed.
 */
export function checkGasBudget(tx: Pick<UnsignedTx, "gas" | "gasPrice">, networkGasPrice: bigint, maxFeeWei: bigint): void {
  if (tx.gas > MAX_GAS) throw new Error(`refusing to sign: gas limit ${tx.gas} > ${MAX_GAS}`);
  const fee = tx.gas * tx.gasPrice;
  if (fee > maxFeeWei) {
    throw new Error(`refusing to sign: worst-case fee ${formatEther(fee)} BNB (${tx.gas} gas × ${tx.gasPrice} wei) > EXECUTION_MAX_FEE_BNB ${formatEther(maxFeeWei)}`);
  }
  if (networkGasPrice > 0n && tx.gasPrice > networkGasPrice * MAX_GAS_PRICE_MULTIPLE) {
    throw new Error(`refusing to sign: gas price ${tx.gasPrice} wei > ${MAX_GAS_PRICE_MULTIPLE}× network ${networkGasPrice} wei`);
  }
}

/**
 * A swap may only call the spender the quote named (route.approveTarget), or a known Trading API router
 * when the quote named none - never a token contract, which is what an approve() or transfer() would hit.
 */
export function checkSwapDestination(to: string, approveTarget?: string | null): void {
  const t = String(to).toLowerCase();
  const tokens = [USDT_BSC.address, ...Object.values(ASSETS).map((a) => a.address)].map((a) => a.toLowerCase());
  if (tokens.includes(t)) throw new Error(`swap tx.to ${to} is a token contract; refusing`);
  if (approveTarget) {
    if (t !== String(approveTarget).toLowerCase()) throw new Error(`swap tx.to ${to} != route approveTarget ${approveTarget}; refusing`);
    return;
  }
  if (!KNOWN_ROUTERS.includes(t)) throw new Error(`swap tx.to ${to} is not a known router (${KNOWN_ROUTERS.join(", ")}); refusing`);
}

export const errMsg = (e: unknown) =>
  e instanceof BinanceApiError ? `${e.message} (code ${e.code})` : e instanceof Error ? e.message : String(e);

// ---- Transaction API: dry-run every tx before it can be signed ----------------

/**
 * POST /pre-transaction/simulate. The response carries `status` ("SUCCESS"/"FAILED") and `failReason`
 * but no gas figure (docs/reference/ref-transaction-api.md), so on success the Gas Limit endpoint is
 * asked for the estimate reported as gasUsed.
 */
export async function simulateTx(
  d: TxDeps,
  label: string,
  tx: { to: Address; data: `0x${string}`; value: bigint },
  side?: Side,
): Promise<{ ok: boolean; failReason?: string; gasUsed?: string }> {
  const evmTx = { from: d.account.address, to: tx.to, value: tx.value.toString(), data: tx.data };
  const sim = await d.binance.simulate(CHAIN, evmTx);
  const ok = sim?.status === "SUCCESS";
  let gasUsed: string | undefined;
  if (ok) {
    try {
      const g = await d.binance.call<{ gasLimit?: string }>("POST", "/api/v1/dex/pre-transaction/gas-limit", {
        body: { binanceChainId: CHAIN, evmTx },
      });
      gasUsed = g?.gasLimit;
    } catch (e) {
      d.hub.emit({ type: "error", where: `gas-limit:${label}`, message: errMsg(e) });
    }
  }
  const failReason = ok ? undefined : String(sim?.failReason ?? `simulation status ${JSON.stringify(sim?.status)}`);
  d.hub.emit({ type: "tx.simulated", symbol: label, ok, gasUsed, error: failReason, side });
  return { ok, failReason, gasUsed };
}

/**
 * Sign locally, broadcast through the Transaction API, wait for the receipt. Live mode only.
 * With `pending` (a swap), the record is persisted the moment the hash is known, so a crash or RPC
 * failure during the wait leaves a trail that reconcilePending() books later. It is removed here only
 * on a revert; a successful fill is cleared by the caller once it is in the ledger.
 */
export async function sendTx(
  d: TxDeps,
  label: string,
  tx: UnsignedTx,
  side?: Side,
  pending?: Pick<PendingTx, "symbol" | "amountIn">,
): Promise<{ txHash: `0x${string}`; receipt: TransactionReceipt }> {
  if (!d.live) throw new Error("refusing to broadcast: LIVE_TRADING is not 1");
  checkGasBudget(tx, await d.pc.getGasPrice(), d.maxFeeWei ?? maxFeeWeiFromEnv());
  if (d.abort?.()) throw new Error("aborted: kill switch engaged");
  const { raw } = await signTx(d.pc, d.account, tx);
  const res = await d.binance.broadcast({
    binanceChainId: CHAIN,
    signedTransaction: raw,
    address: d.account.address,
    enableMevProtection: d.mevProtection,
  });
  const txHash = res.txHash as `0x${string}`;
  if (pending && side && d.store) d.store.setPending({ txHash, side, symbol: pending.symbol, label, amountIn: pending.amountIn, at: Date.now() });
  d.hub.emit({ type: "tx.broadcast", symbol: label, txHash, side });
  const receipt = await d.pc.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 });
  if (d.onReceipt) await d.onReceipt(receipt, label);
  await crossCheckDetail(d, label, txHash);
  if (receipt.status !== "success") {
    d.store?.clearPending(txHash);
    throw new Error(`${label} tx ${txHash} reverted on-chain`);
  }
  return { txHash, receipt };
}

/** Wallet API detail (`data[].txStatus` pending|success|fail; may be empty until indexed). Best effort. */
async function crossCheckDetail(d: TxDeps, label: string, txHash: string): Promise<void> {
  for (let i = 0; i < 5; i++) {
    try {
      const rows = await d.binance.txDetail(CHAIN, txHash);
      const st = Array.isArray(rows) ? rows[0]?.txStatus : undefined;
      if (st === "fail") d.hub.emit({ type: "error", where: `txDetail:${label}`, message: `Wallet API reports txStatus=fail for ${txHash}` });
      if (st === "success" || st === "fail") return;
    } catch (e) {
      d.hub.emit({ type: "error", where: `txDetail:${label}`, message: errMsg(e) });
      return;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

// ---- Trading API ------------------------------------------------------------

export interface RouteChoice {
  route: QuoteRoute | null; // best SWAP route
  all: QuoteRoute[];
  detail: string;
  marketClosed?: boolean; // quote rejected with 40369 BSTOCK_INVALID_TRADING_TIME
}

/** The two legs of a trade: buy = USDT → asset, sell = asset → USDT. */
export function legs(side: Side, asset: TokenizedStock) {
  const usdt = { symbol: USDT_BSC.symbol, address: USDT_BSC.address as Address, decimals: USDT_BSC.decimals };
  const tok = { symbol: asset.symbol, address: asset.address as Address, decimals: asset.decimals };
  return side === "buy" ? { from: usdt, to: tok } : { from: tok, to: usdt };
}

/**
 * GET /aggregator/quote. bStock quotes may mix a LiquidMesh SWAP route and a PcsXRfq RFQ route
 * (binance-web3-llms-full.txt "Equity Token Trading"). RFQ orders are EIP-712 signatures the
 * Transaction API cannot simulate, so only SWAP routes are eligible.
 */
export async function quoteSwap(
  binance: BinanceWeb3Client,
  side: Side,
  asset: TokenizedStock,
  owner: Address,
  amountIn: bigint,
): Promise<RouteChoice> {
  const { from, to } = legs(side, asset);
  let routes: QuoteRoute[];
  try {
    routes = await binance.quote({
      binanceChainId: CHAIN,
      amount: amountIn.toString(),
      fromTokenAddress: from.address,
      toTokenAddress: to.address,
      userWalletAddress: owner, // required for equity-token quotes
    });
  } catch (e) {
    // e.g. 40369 BSTOCK_INVALID_TRADING_TIME outside US market hours
    const closed = e instanceof BinanceApiError && String(e.code) === "40369";
    return { route: null, all: [], detail: `quote failed: ${errMsg(e)}`, marketClosed: closed };
  }
  routes = routes ?? [];
  const swaps = routes
    .filter((r) => r.executionMode === "SWAP")
    .sort((a, b) => (BigInt(b.toTokenAmount) > BigInt(a.toTokenAmount) ? 1 : -1));
  const offered = routes.map((r) => `${r.vendorName}/${r.executionMode}`).join(", ") || "none";
  if (!swaps.length) return { route: null, all: routes, detail: `no SWAP route (offered: ${offered})` };
  const best = swaps[0];
  return {
    route: best,
    all: routes,
    detail: `${best.vendorName} SWAP ${formatUnits(amountIn, from.decimals)} ${from.symbol} → ${formatUnits(BigInt(best.toTokenAmount), to.decimals)} ${to.symbol} (offered: ${offered})`,
  };
}

/**
 * Gas limit for a live send: the larger of the API-suggested limit and the Transaction API's simulated
 * gas, plus 25% headroom. The Trading API's /swap tx.gas (450,000) once came in below the simulated
 * usage (457,414) and the swap reverted out of gas on-chain (tx 0xc52edf5c…bfa6, 2026-10-07).
 */
export function safeGasLimit(suggested: unknown, simulated: string | undefined, label: string): bigint {
  const a = toBig(suggested, label);
  const b = simulated && /^\d+$/.test(simulated) ? BigInt(simulated) : 0n;
  return ((a > b ? a : b) * 125n) / 100n;
}

/** Re-quote after an approval: same spender, price impact still within the slippage limit. */
export function checkFreshRoute(route: QuoteRoute, spender: Address, maxSlippageBps: number): void {
  if (String(route.approveTarget ?? "").toLowerCase() !== spender.toLowerCase()) {
    throw new Error(`re-quote approveTarget ${route.approveTarget} != approved spender ${spender}; refusing`);
  }
  const impact = route.priceImpactPercent;
  if (impact != null && impact !== "") {
    const bps = Math.abs(Number(impact)) * 100;
    if (!Number.isFinite(bps) || bps > maxSlippageBps) throw new Error(`re-quote price impact ${impact}% exceeds ${maxSlippageBps} bps; refusing`);
  }
}

/** Back-compat wrapper for the buy leg. */
export const quoteBuy = (binance: BinanceWeb3Client, asset: TokenizedStock, owner: Address, amountIn: bigint) =>
  quoteSwap(binance, "buy", asset, owner, amountIn);

/** Resolve approve calldata via /approve-transaction (vendor required for equity tokens) and sanity-check it. */
export async function approveTxFor(
  binance: BinanceWeb3Client,
  token: Address,
  amount: bigint,
  vendor: string,
  expectSpender?: Address | null,
): Promise<{ data: `0x${string}`; spender: Address; gasLimit?: unknown; gasPrice?: unknown }> {
  const resp = await binance.approveTransaction({
    binanceChainId: CHAIN,
    tokenContractAddress: token,
    approveAmount: amount.toString(),
    vendor,
  });
  const item = Array.isArray(resp) ? resp[0] : resp;
  if (!item?.data) throw new Error(`approve-transaction returned no calldata: ${JSON.stringify(resp)}`);
  const { functionName, args } = decodeFunctionData({ abi: erc20Abi, data: item.data });
  if (functionName !== "approve") throw new Error(`approve-transaction calldata is ${functionName}(), not approve()`);
  const [spender, amt] = args as readonly [Address, bigint];
  if (amt !== amount) throw new Error(`approve-transaction encodes amount ${amt}, requested ${amount}; refusing`);
  if (item.dexContractAddress && String(item.dexContractAddress).toLowerCase() !== spender.toLowerCase()) {
    throw new Error(`approve calldata spender ${spender} != dexContractAddress ${item.dexContractAddress}; refusing`);
  }
  if (expectSpender && expectSpender.toLowerCase() !== spender.toLowerCase()) {
    throw new Error(`approve spender ${spender} != quote approveTarget ${expectSpender}; refusing`);
  }
  return { data: item.data, spender, gasLimit: item.gasLimit, gasPrice: item.gasPrice };
}

export interface SwapResult {
  simulated: boolean;
  failReason?: string;
  route?: QuoteRoute; // route the simulated/broadcast swap was built from (its toTokenAmount = quoted out)
  txHash?: string;
  // Live only, from Transfer logs (smallest units):
  inWei?: bigint;
  outWei?: bigint;
}

/** Back-compat alias. */
export type BuyResult = SwapResult;

/**
 * approve (if needed) → swap → simulate → (live) sign + broadcast + confirm, for either side.
 * Paper mode stops after the simulation; the caller books a paper fill only if `simulated`.
 */
export async function executeSwap(
  d: TxDeps,
  cfg: RiskConfig,
  side: Side,
  asset: TokenizedStock,
  amountIn: bigint,
  choice: RouteChoice,
): Promise<SwapResult> {
  const owner = d.account.address;
  const { from, to } = legs(side, asset);
  let route = choice.route;
  if (!route) throw new Error("executeSwap called without a SWAP route");

  // 1. Allowance of the from-token for the route's spender; approval data from /approve-transaction
  //    (vendor is required for equity tokens - ref-trading-api.md "Get ERC-20 Approve Transaction").
  const spender = route.approveTarget as Address | null | undefined;
  if (spender) {
    const allowance = await erc20Allowance(d.pc, from.address, owner, spender);
    if (allowance < amountIn) {
      const label = `${from.symbol}:approve`;
      const ap = await approveTxFor(d.binance, from.address, amountIn, route.vendorName, spender);
      const sim = await simulateTx(d, label, { to: from.address, data: ap.data, value: 0n }, side);
      if (!sim.ok) return { simulated: false, failReason: `approve simulation failed: ${sim.failReason}` };
      if (!d.live) {
        d.hub.emit({
          type: "risk.blocked",
          symbol: asset.symbol,
          rule: "liveTrading",
          detail:
            `${from.symbol} allowance for ${spender} is ${formatUnits(allowance, from.decimals)} < ${formatUnits(amountIn, from.decimals)}; ` +
            `approval simulated OK but not sent (LIVE_TRADING!=1), so the swap simulation below is expected to fail on allowance. ` +
            `Run \`pnpm --filter @elitr/execution-agent approve\` once to set allowances.`,
        });
      } else {
        const { txHash: approveHash } = await sendTx(
          d,
          label,
          { to: from.address, data: ap.data, value: 0n, gas: safeGasLimit(ap.gasLimit, sim.gasUsed, "approve.gasLimit"), gasPrice: toBig(ap.gasPrice, "approve.gasPrice") },
          side,
        );
        d.hub.emit({ type: "tx.confirmed", symbol: label, txHash: approveHash, amountIn: `approve ${formatUnits(amountIn, from.decimals)} ${from.symbol}`, amountOut: "0", side });
        // quoteId TTL is ~30s; the approval wait likely outlived it. The fresh route must still use the
        // spender we just approved and stay within the price-impact limit the risk engine checked.
        const fresh = await quoteSwap(d.binance, side, asset, owner, amountIn);
        if (!fresh.route) {
          d.hub.emit({ type: "risk.blocked", symbol: asset.symbol, rule: "simulatableRoute", detail: fresh.detail });
          return { simulated: false, failReason: fresh.detail };
        }
        checkFreshRoute(fresh.route, spender, cfg.maxSlippageBps);
        route = fresh.route;
      }
    }
  }

  // 2. Build the swap. Slippage and price-impact protection both pinned to the risk limit.
  const pct = String(cfg.maxSlippageBps / 100);
  const sw = await d.binance.swap({
    binanceChainId: CHAIN,
    amount: amountIn.toString(),
    fromTokenAddress: from.address,
    toTokenAddress: to.address,
    userWalletAddress: owner,
    quoteId: route.quoteId,
    slippagePercent: pct,
    priceImpactProtectionPercent: pct,
  });
  if (sw?.executionMode && sw.executionMode !== "SWAP") throw new Error(`swap returned executionMode=${sw.executionMode}; refusing`);
  const tx = sw?.tx;
  if (!tx?.to || !tx?.data) throw new Error(`swap returned no tx: ${JSON.stringify(sw).slice(0, 300)}`);
  if (String(tx.from).toLowerCase() !== owner.toLowerCase()) throw new Error(`swap tx.from ${tx.from} is not the agent wallet`);
  checkSwapDestination(tx.to, route.approveTarget);

  // 3. Dry-run via Transaction API.
  const value = toBig(tx.value ?? "0", "swap.value");
  const sim = await simulateTx(d, asset.symbol, { to: tx.to, data: tx.data, value }, side);
  if (!sim.ok || !d.live) return { simulated: sim.ok, failReason: sim.failReason, route };

  // 4. Live: sign locally → broadcast via Transaction API → confirm.
  const { txHash, receipt } = await sendTx(
    d,
    asset.symbol,
    {
      to: tx.to,
      data: tx.data,
      value,
      gas: safeGasLimit(tx.gas, sim.gasUsed, "swap.gas"),
      gasPrice: toBig(tx.gasPrice, "swap.gasPrice"),
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? toBig(tx.maxPriorityFeePerGas, "swap.maxPriorityFeePerGas") : undefined,
    },
    side,
    { symbol: asset.symbol, amountIn: amountIn.toString() },
  );
  const inWei = transferredOut(receipt, from.address, owner);
  const outWei = transferredIn(receipt, to.address, owner);
  d.hub.emit({
    type: "tx.confirmed",
    symbol: asset.symbol,
    txHash,
    amountIn: `${formatUnits(inWei, from.decimals)} ${from.symbol}`,
    amountOut: `${formatUnits(outWei, to.decimals)} ${to.symbol}`,
    side,
  });
  return { simulated: true, route, txHash, inWei, outWei };
}
