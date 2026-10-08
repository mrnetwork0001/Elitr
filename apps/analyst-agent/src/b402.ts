import { createHash } from "node:crypto";
import { BinanceWeb3Client } from "@elitr/binance";

// x402 V2 merchant side of b402 (docs/reference/binance-web3-llms-full.txt, "B402 Integration Guide"
// and "Permit2 Signing"). Wire format follows @x402/core 2.x so @x402/fetch + @bnb-chain/b402 can pay us:
//   402 body + `PAYMENT-REQUIRED` header (base64 JSON PaymentRequired)
//   request header `PAYMENT-SIGNATURE` (base64 JSON PaymentPayload)
//   200 header `PAYMENT-RESPONSE` (base64 JSON settle result)

export const NETWORK = "eip155:56";
const SUPPORTED_TTL_MS = 5 * 60_000;
const METHODS = ["eip3009", "permit2-exact"] as const; // permit2-upto needs settleAmount; not offered
type Method = (typeof METHODS)[number];

export interface PaymentRequirements {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
}
export interface ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
}
export interface PaymentRequired {
  x402Version: 2;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
}
export interface PaymentPayload {
  x402Version: 2;
  resource?: ResourceInfo;
  accepted: PaymentRequirements;
  payload: Record<string, unknown>;
  extensions?: unknown;
}

/** One way to pay: a token and its b402 transfer method. */
export interface PaymentOption {
  asset: string;
  method: Method;
  tokenName?: string;
}

export interface B402Config {
  payTo: string;
  asset: string;
  amount: string;
  method: Method;
  tokenName?: string;
  /** Extra accepted options, offered after the primary one (e.g. U via eip3009 for Agentic Wallet buyers). */
  alternates: PaymentOption[];
  maxTimeoutSeconds: number;
  rpcUrl: string;
}

const ADDR = /^0x[0-9a-fA-F]{40}$/;
export const DEFAULT_PRICE_WEI = "10000000000000000"; // $0.01 in an 18-decimal stable

/**
 * Reads b402 merchant config; returns the list of missing/invalid vars instead of throwing.
 * `prefix` lets a second analyst in the same process override the payee and price
 * (e.g. FLOW_ANALYST_PAY_TO / FLOW_ANALYST_PRICE_WEI), falling back to the ANALYST_* values.
 */
export function b402ConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  prefix?: string,
): { config?: B402Config; problems: string[] } {
  const problems: string[] = [];
  const pick = (name: "PAY_TO" | "PRICE_WEI") => {
    const own = prefix ? `${prefix}_${name}` : undefined;
    return own && env[own] ? { value: env[own]!, var: own } : { value: env[`ANALYST_${name}`], var: `ANALYST_${name}` };
  };
  const payToVar = pick("PAY_TO");
  const priceVar = pick("PRICE_WEI");
  for (const k of ["BINANCE_WEB3_API_KEY", "BINANCE_WEB3_API_SECRET", "ANALYST_PAYMENT_ASSET"]) {
    if (!env[k]) problems.push(`${k} is not set`);
  }
  if (!payToVar.value) problems.push(`${prefix ? `${prefix}_PAY_TO or ` : ""}ANALYST_PAY_TO is not set`);
  const payTo = payToVar.value ?? "";
  const asset = env.ANALYST_PAYMENT_ASSET ?? "";
  const amount = priceVar.value || DEFAULT_PRICE_WEI;
  const method = (env.ANALYST_PAYMENT_METHOD || "permit2-exact") as Method;
  const maxTimeoutSeconds = Number(env.ANALYST_PAYMENT_TIMEOUT_SEC || 300);
  if (payTo && !ADDR.test(payTo)) problems.push(`${payToVar.var} is not an EVM address`);
  if (asset && !ADDR.test(asset)) problems.push("ANALYST_PAYMENT_ASSET is not an EVM address");
  if (!/^[1-9]\d*$/.test(amount)) problems.push(`${priceVar.var} must be a positive integer in atomic units`);
  if (!METHODS.includes(method)) problems.push(`ANALYST_PAYMENT_METHOD must be one of ${METHODS.join(", ")}`);
  if (!Number.isInteger(maxTimeoutSeconds) || maxTimeoutSeconds <= 0) problems.push("ANALYST_PAYMENT_TIMEOUT_SEC must be a positive integer");
  const alternates: PaymentOption[] = [];
  const altAsset = env.ANALYST_PAYMENT_ALT_ASSET ?? "";
  if (altAsset) {
    const altMethod = (env.ANALYST_PAYMENT_ALT_METHOD || "eip3009") as Method;
    if (!ADDR.test(altAsset)) problems.push("ANALYST_PAYMENT_ALT_ASSET is not an EVM address");
    if (!METHODS.includes(altMethod)) problems.push(`ANALYST_PAYMENT_ALT_METHOD must be one of ${METHODS.join(", ")}`);
    if (altAsset.toLowerCase() === asset.toLowerCase() && altMethod === method) problems.push("ANALYST_PAYMENT_ALT_* duplicates the primary payment option");
    alternates.push({ asset: altAsset, method: altMethod, tokenName: env.ANALYST_PAYMENT_ALT_TOKEN_NAME || undefined });
  }
  if (problems.length) return { problems };
  return {
    problems,
    config: {
      payTo,
      asset,
      amount,
      method,
      tokenName: env.ANALYST_PAYMENT_TOKEN_NAME || undefined,
      alternates,
      maxTimeoutSeconds,
      rpcUrl: env.BSC_RPC_URL || "https://bsc-dataseed.bnbchain.org",
    },
  };
}

// Stablecoins b402 accepts on BSC, all 18 decimals (symbol()/decimals() checked on-chain 2026-10-04),
// so 1e18 atomic units = $1. Any other asset gets priceUsd null rather than a guess.
const USD_STABLES_18 = new Set(
  [
    "0x55d398326f99059fF775485246999027B3197955", // USDT
    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC
    "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d", // USD1
    "0xcE24439F2D9C6a2289F741120FE202248B666666", // U (United Stables)
  ].map((a) => a.toLowerCase()),
);
export function priceUsd(asset: string, amount: string): number | null {
  if (!USD_STABLES_18.has(asset.toLowerCase()) || !/^\d+$/.test(amount)) return null;
  return Number(amount) / 1e18;
}

/** Key-order-insensitive structural equality (the doc requires `accepted` to exactly match). */
export function deepEqual(a: unknown, b: unknown): boolean {
  const canon = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canon)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as any)[k])]))
        : v;
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}

export const encodeHeader = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8").toString("base64");

export function decodePaymentSignature(header: string): PaymentPayload {
  let p: any;
  try {
    p = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    throw new Error("PAYMENT-SIGNATURE is not base64-encoded JSON");
  }
  if (p?.x402Version !== 2) throw new Error("PAYMENT-SIGNATURE: x402Version must be 2");
  if (!p.accepted || typeof p.accepted !== "object") throw new Error("PAYMENT-SIGNATURE: missing accepted");
  if (!p.payload || typeof p.payload !== "object") throw new Error("PAYMENT-SIGNATURE: missing payload");
  return p;
}

/** Stable id of a signed authorization, used to refuse replays of an already-used payment. */
export const authorizationId = (p: PaymentPayload) =>
  createHash("sha256").update(JSON.stringify(p.payload)).digest("hex");

export class B402Gateway {
  private supported?: { value: { kinds: any[] }; expires: number };
  private inflight?: Promise<{ kinds: any[] }>;
  private readonly tokenNames = new Map<string, string>();

  constructor(
    readonly config: B402Config,
    private readonly client = BinanceWeb3Client.fromEnv(),
  ) {}

  private async kinds(): Promise<any[]> {
    if (this.supported && Date.now() < this.supported.expires) return this.supported.value.kinds;
    this.inflight ??= this.client
      .b402Supported()
      .then((value) => {
        this.supported = { value, expires: Date.now() + SUPPORTED_TTL_MS };
        return value;
      })
      .finally(() => (this.inflight = undefined));
    return (await this.inflight).kinds ?? [];
  }

  /** The primary requirement, built from the live /supported config. */
  requirements(): Promise<PaymentRequirements> {
    const { asset, method, tokenName } = this.config;
    return this.requirementFor({ asset, method, tokenName });
  }

  /**
   * Every requirement this server accepts: the primary first, then alternates. A buyer picks any one
   * (x402 `accepts[]`). An alternate the facilitator cannot build is skipped, never the primary.
   */
  async allRequirements(): Promise<PaymentRequirements[]> {
    const out = [await this.requirements()];
    for (const alt of this.config.alternates) {
      try {
        out.push(await this.requirementFor(alt));
      } catch (e) {
        console.warn(`[b402] alternate ${alt.asset}/${alt.method} skipped: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return out;
  }

  private async requirementFor(opt: PaymentOption): Promise<PaymentRequirements> {
    const { amount, payTo, maxTimeoutSeconds } = this.config;
    const { asset, method } = opt;
    let candidates = (await this.kinds()).filter(
      (k) =>
        k?.network === NETWORK &&
        k?.scheme === "exact" &&
        (k.x402Version === undefined || k.x402Version === 2) &&
        k.extra?.assetTransferMethod === method,
    );
    // kinds[] carries no asset field; when several share the method, pick by EIP-712 token name
    // (extra.name is the token's on-chain name() - see @bnb-chain/b402 Types.ts PaymentRequirementsExtra).
    if (candidates.length > 1) {
      let name = opt.tokenName ?? this.tokenNames.get(asset.toLowerCase());
      if (!name) {
        name = await erc20Name(this.config.rpcUrl, asset);
        this.tokenNames.set(asset.toLowerCase(), name);
      }
      candidates = candidates.filter((k) => k.extra?.name === name);
    }
    if (candidates.length !== 1) {
      const names = (await this.kinds()).map((k) => `${k?.network}/${k?.scheme}/${k?.extra?.assetTransferMethod}/${k?.extra?.name}`);
      throw new Error(
        `b402 /supported has ${candidates.length} matching kinds for ${NETWORK} exact/${method} asset ${asset} ` +
          `(set the token name to disambiguate). Available: ${names.join(", ") || "none"}`,
      );
    }
    // Copy extra as returned. Null-valued keys are dropped: the doc types spenderAddress as `string | null`
    // and its eip3009 verify example omits it, while @bnb-chain/b402 rejects a null spenderAddress.
    const extra = Object.fromEntries(Object.entries(candidates[0].extra).filter(([, v]) => v !== null));
    return { scheme: "exact", network: NETWORK, amount, asset, payTo, maxTimeoutSeconds, extra };
  }

  verify(payload: PaymentPayload, requirements: PaymentRequirements) {
    return this.client.b402Verify(payload, requirements);
  }
  settle(payload: PaymentPayload, requirements: PaymentRequirements) {
    return this.client.b402Settle(payload, requirements);
  }
}

async function erc20Name(rpcUrl: string, token: string): Promise<string> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: token, data: "0x06fdde03" }, "latest"] }),
    signal: AbortSignal.timeout(10_000),
  });
  const hex: string | undefined = (await res.json())?.result;
  if (!hex || hex.length < 130) throw new Error(`name() call failed for ${token}`);
  const len = parseInt(hex.slice(66, 130), 16);
  return Buffer.from(hex.slice(130, 130 + len * 2), "hex").toString("utf8");
}
