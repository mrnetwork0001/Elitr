import { randomUUID } from "node:crypto";
import { formatUnits, parseUnits, type PrivateKeyAccount, type PublicClient } from "viem";
import { x402Client, wrapFetchWithPayment, decodePaymentResponseHeader, type PaymentRequirements } from "@x402/fetch";
import {
  B402ExactClientScheme,
  B402Permit2ApprovalRequiredError,
  B402_PERMIT2_ADDRESS,
  CURATED_B402_SPENDERS,
  type B402Permit2ApprovalRequest,
} from "@bnb-chain/b402/client";
import type { BinanceWeb3Client } from "@elitr/binance";
import { USDT_BSC, type AnalystId, type EventHub, type RiskConfig, type Signal } from "@elitr/shared";
import type { StateStore } from "./state.js";
import { errMsg, sendTx, simulateTx, type TxDeps } from "./trade.js";
import { approveCalldata, erc20Allowance, erc20Balance, type Address } from "./wallet.js";

const NETWORK = "eip155:56";

// Stablecoins the b402 facilitator offers on BSC (.env.example): USDT settles via Permit2,
// U and USD1 via EIP-3009. All 18 decimals on BSC (verified with eth_call decimals()).
// Amounts are counted 1:1 in USD against risk.maxDailyDataUsd.
const STABLES: Record<string, { symbol: string; decimals: number }> = {
  [USDT_BSC.address.toLowerCase()]: { symbol: "USDT", decimals: 18 },
  "0xce24439f2d9c6a2289f741120fe202248b666666": { symbol: "U", decimals: 18 },
  "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d": { symbol: "USD1", decimals: 18 },
};

export type { Signal };

export const DEFAULT_HORIZON_SEC = 3600;
export const MIN_HORIZON_SEC = 60;
export const MAX_HORIZON_SEC = 86_400;

export interface PayDeps {
  hub: EventHub;
  store: StateStore;
  risk: RiskConfig;
  pc: PublicClient;
  account: PrivateKeyAccount;
  binance: BinanceWeb3Client | null;
  analystId: AnalystId;
  analystUrl: string;
  live: boolean;
  mevProtection: boolean;
  onReceipt?: TxDeps["onReceipt"];
  abort?: TxDeps["abort"];
}

function trustedSpenders(): string[] {
  const fromEnv = process.env.B402_TRUSTED_SPENDERS?.split(",").map((s) => s.trim()).filter(Boolean);
  return fromEnv?.length ? fromEnv : [CURATED_B402_SPENDERS[NETWORK]!.exact];
}

/**
 * Validate an analyst's /signal body. Older analysts omit signalId / analystId / horizonSec: the analyst
 * id comes from our config (the URL we paid), a signalId is generated locally, and the horizon defaults
 * to 1 h and is clamped to [1 min, 24 h] (reported via `hub`) so a seller cannot park a call for years
 * or have it scored before the pool moved. A body that names a different analyst than the one we paid
 * is rejected.
 */
export function parseSignal(body: unknown, symbol: string, analystId: AnalystId, hub?: Pick<EventHub, "emit">): Signal {
  const b = body as Partial<Signal> | null;
  const problems: string[] = [];
  if (!b || typeof b !== "object") throw new Error("analyst returned a non-object body");
  if (b.symbol !== symbol) problems.push(`symbol=${JSON.stringify(b.symbol)}`);
  if (typeof b.score !== "number" || b.score < 1 || b.score > 100) problems.push(`score=${JSON.stringify(b.score)}`);
  if (!["bullish", "neutral", "bearish"].includes(b.stance as string)) problems.push(`stance=${JSON.stringify(b.stance)}`);
  if (typeof b.generatedAt !== "string" || Number.isNaN(Date.parse(b.generatedAt))) problems.push(`generatedAt=${JSON.stringify(b.generatedAt)}`);
  if (b.analystId != null && b.analystId !== analystId) problems.push(`analystId=${JSON.stringify(b.analystId)} (paid ${analystId})`);
  if (b.horizonSec != null && !(typeof b.horizonSec === "number" && b.horizonSec > 0)) problems.push(`horizonSec=${JSON.stringify(b.horizonSec)}`);
  if (problems.length) throw new Error(`analyst signal failed validation: ${problems.join(", ")}`);
  const wanted = b.horizonSec ?? DEFAULT_HORIZON_SEC;
  const horizonSec = Math.min(MAX_HORIZON_SEC, Math.max(MIN_HORIZON_SEC, wanted));
  if (horizonSec !== wanted) hub?.emit({ type: "error", where: `pay.${analystId}`, message: `horizonSec ${wanted} clamped to ${horizonSec} (allowed ${MIN_HORIZON_SEC}-${MAX_HORIZON_SEC})` });
  return {
    ...(b as Signal),
    analystId,
    signalId: typeof b.signalId === "string" && b.signalId ? b.signalId : `local-${randomUUID()}`,
    horizonSec,
    sources: Array.isArray(b.sources) ? b.sources : [],
  };
}

/** Pay the analyst over b402 (x402 V2) and return its signal, or null when blocked/failed (events emitted). */
export async function buySignal(d: PayDeps, symbol: string): Promise<Signal | null> {
  const remainingUsd = d.risk.maxDailyDataUsd - d.store.get().dailyDataUsd;
  if (remainingUsd <= 0) {
    d.hub.emit({
      type: "risk.blocked",
      symbol,
      rule: "maxDailyDataUsd",
      detail: `spent $${d.store.get().dailyDataUsd.toFixed(4)} on signals today; cap $${d.risk.maxDailyDataUsd}`,
    });
    return null;
  }
  const result = await attempt(d, symbol, remainingUsd);
  if (result.kind === "approval") {
    const approved = await approvePermit2(d, symbol, result.approval);
    if (!approved) return null;
    const retry = await attempt(d, symbol, remainingUsd);
    if (retry.kind === "approval") throw new Error("Permit2 allowance still insufficient after approval");
    return retry.signal;
  }
  return result.signal;
}

type Attempt = { kind: "done"; signal: Signal | null } | { kind: "approval"; approval: B402Permit2ApprovalRequest };

async function attempt(d: PayDeps, symbol: string, remainingUsd: number): Promise<Attempt> {
  const owner = d.account.address;
  const assets = Object.keys(STABLES) as Address[];
  const balances = new Map<string, bigint>();
  await Promise.all(assets.map(async (a) => balances.set(a, await erc20Balance(d.pc, a, owner))));

  let selected: PaymentRequirements | undefined;
  let paid = false;
  let approval: B402Permit2ApprovalRequest | undefined;
  let policyNote = "";

  const client = new x402Client()
    .register(
      NETWORK,
      new B402ExactClientScheme({
        account: d.account,
        permit2Allowance: ({ token, owner: o, spender }) => erc20Allowance(d.pc, token, o, spender),
        trustedSpenders: { [NETWORK]: trustedSpenders() },
      }),
    )
    // B402ExactClientScheme exposes no findDefaultAsset, so x402's default spend controls would reject
    // every b402 asset. Allow only our stablecoins, each capped at the remaining daily data budget.
    .setSpendControls({
      maxAmountPerPayment: false,
      allowedAssets: assets.map((a) => ({
        network: NETWORK,
        asset: a,
        maxAmountPerPayment: parseUnits(remainingUsd.toFixed(6), STABLES[a].decimals).toString(),
      })),
    })
    // Only offers we can actually fund; EIP-3009 first (no ERC-20 approval needed).
    .registerPolicy((_v, reqs) => {
      const fundable = reqs.filter((r) => (balances.get(r.asset.toLowerCase()) ?? 0n) >= BigInt(r.amount));
      if (!fundable.length) {
        policyNote = reqs
          .map((r) => {
            const s = STABLES[r.asset.toLowerCase()];
            const have = balances.get(r.asset.toLowerCase()) ?? 0n;
            return `${s?.symbol ?? r.asset}: need ${formatUnits(BigInt(r.amount), s?.decimals ?? 18)}, have ${formatUnits(have, s?.decimals ?? 18)}`;
          })
          .join("; ");
        return [];
      }
      const rank = (r: PaymentRequirements) => (r.extra?.assetTransferMethod === "eip3009" ? 0 : 1);
      return [...fundable].sort((a, b) => rank(a) - rank(b));
    });
  client.onBeforePaymentCreation(async (ctx) => {
    selected = ctx.selectedRequirements;
  });
  client.onAfterPaymentCreation(async () => {
    paid = true;
  });
  // @x402/fetch re-wraps scheme errors in a plain Error, so capture the typed approval error here.
  client.onPaymentCreationFailure(async (ctx) => {
    if (ctx.error instanceof B402Permit2ApprovalRequiredError) approval = ctx.error.approval;
  });

  const url = `${d.analystUrl.replace(/\/$/, "")}/signal?symbol=${encodeURIComponent(symbol)}`;
  const fetchWithPay = wrapFetchWithPayment(fetch, client);
  let res: Response;
  try {
    res = await fetchWithPay(url, { signal: AbortSignal.timeout(90_000) });
  } catch (e) {
    if (approval) return { kind: "approval", approval };
    const msg = errMsg(e) + (policyNote ? ` - insufficient balance (${policyNote})` : "");
    d.hub.emit({ type: "error", where: `pay.${d.analystId}`, message: msg });
    return { kind: "done", signal: null };
  }

  const text = await res.text();
  let settle: ReturnType<typeof decodePaymentResponseHeader> | undefined;
  const hdr = res.headers.get("PAYMENT-RESPONSE") ?? res.headers.get("X-PAYMENT-RESPONSE");
  if (hdr) {
    try {
      settle = decodePaymentResponseHeader(hdr);
    } catch (e) {
      d.hub.emit({ type: "error", where: `pay.${d.analystId}`, message: `undecodable PAYMENT-RESPONSE header: ${errMsg(e)}` });
    }
  }

  if (paid && selected && (res.ok || settle?.transaction)) {
    const s = STABLES[selected.asset.toLowerCase()];
    const amount = formatUnits(BigInt(selected.amount), s.decimals);
    d.store.recordPayment({
      ts: Date.now(),
      amount,
      asset: s.symbol,
      usd: Number(amount),
      txHash: settle?.transaction || undefined,
      analystId: d.analystId,
      symbol,
    });
    d.hub.emit({
      type: "payment.sent",
      amount: String(selected.amount),
      asset: selected.asset,
      payTo: selected.payTo,
      txHash: settle?.transaction || undefined,
      analystId: d.analystId,
    });
  }

  if (res.status === 503 && !settle?.transaction) {
    // e.g. the flow analyst's "insufficient flow": no signal today, payment not settled - not a fault.
    d.hub.emit({ type: "risk.blocked", symbol, rule: "analystNoSignal", detail: `${d.analystId} has no signal for ${symbol} (HTTP 503: ${text.slice(0, 160)}); nothing settled` });
    return { kind: "done", signal: null };
  }
  if (!res.ok) {
    d.hub.emit({
      type: "error",
      where: `pay.${d.analystId}`,
      message: `analyst HTTP ${res.status}${settle?.errorReason ? ` (${settle.errorReason})` : ""}: ${text.slice(0, 300)}`,
    });
    return { kind: "done", signal: null };
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    d.hub.emit({ type: "error", where: `pay.${d.analystId}`, message: `analyst returned non-JSON: ${text.slice(0, 200)}` });
    return { kind: "done", signal: null };
  }
  return { kind: "done", signal: parseSignal(body, symbol, d.analystId, d.hub) };
}

/**
 * One-time ERC-20 approve of the payment token to canonical Permit2 (README of @bnb-chain/b402:
 * "Permit2 Exact requires a one-time token approval to canonical Permit2"). Bounded to 30 days of
 * the data budget rather than unlimited. Simulated via the Transaction API; sent only when live.
 */
async function approvePermit2(d: PayDeps, symbol: string, a: B402Permit2ApprovalRequest): Promise<boolean> {
  const s = STABLES[a.token.toLowerCase()] ?? { symbol: a.token, decimals: 18 };
  const label = `${s.symbol}:approve-permit2`;
  const budget = parseUnits((d.risk.maxDailyDataUsd * 30).toFixed(6), s.decimals);
  const amount = budget > a.requiredAmount ? budget : a.requiredAmount;
  const have = `allowance ${formatUnits(a.currentAllowance, s.decimals)} < ${formatUnits(a.requiredAmount, s.decimals)} ${s.symbol} to Permit2 ${B402_PERMIT2_ADDRESS}`;
  if (!d.binance) {
    d.hub.emit({ type: "error", where: "pay.permit2", message: `${have}; cannot simulate the approve - Binance Web3 API key/secret missing` });
    return false;
  }
  const data = approveCalldata(B402_PERMIT2_ADDRESS, amount);
  const txd: TxDeps = { hub: d.hub, binance: d.binance, pc: d.pc, account: d.account, live: d.live, mevProtection: d.mevProtection, onReceipt: d.onReceipt, abort: d.abort };
  const sim = await simulateTx(txd, label, { to: a.token, data, value: 0n });
  if (!sim.ok) return false;
  if (!d.live) {
    d.hub.emit({
      type: "risk.blocked",
      symbol,
      rule: "permit2Approval",
      detail: `${have}. approve(${formatUnits(amount, s.decimals)}) simulated OK but not sent because LIVE_TRADING!=1 - signal not purchased.`,
    });
    return false;
  }
  const [gas, gasPrice] = await Promise.all([
    d.pc.estimateGas({ account: d.account.address, to: a.token, data }),
    d.pc.getGasPrice(),
  ]);
  const { txHash } = await sendTx(txd, label, { to: a.token, data, value: 0n, gas: (gas * 12n) / 10n, gasPrice });
  d.hub.emit({ type: "tx.confirmed", symbol: label, txHash, amountIn: `approve ${formatUnits(amount, s.decimals)} ${s.symbol}`, amountOut: "0" });
  return true;
}
