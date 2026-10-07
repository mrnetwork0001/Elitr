import { randomUUID } from "node:crypto";
import { buildQuery, sign } from "./sign.js";

const DEFAULT_BASE = "https://web3.binance.com";
const PREFIX = "/build";

type Query = Record<string, string | number | boolean | undefined>;

export class BinanceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | number | undefined,
    readonly path: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "BinanceApiError";
  }
}

export interface ClientOptions {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
  recvWindowMs?: number;
  /** Called for every response — used to feed the DX evidence log. */
  onResponse?: (info: { method: string; path: string; status: number; code: unknown; ms: number }) => void;
}

export class BinanceWeb3Client {
  private readonly base: string;

  constructor(private readonly opts: ClientOptions) {
    if (!opts.apiKey || !opts.apiSecret) throw new Error("Binance Web3 API key/secret missing");
    this.base = opts.baseUrl ?? DEFAULT_BASE;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env, extra: Partial<ClientOptions> = {}): BinanceWeb3Client {
    return new BinanceWeb3Client({
      apiKey: env.BINANCE_WEB3_API_KEY ?? "",
      apiSecret: env.BINANCE_WEB3_API_SECRET ?? "",
      baseUrl: env.BINANCE_WEB3_BASE_URL,
      ...extra,
    });
  }

  /** Low-level signed call. Returns the parsed JSON envelope untouched. */
  async raw(method: "GET" | "POST", path: string, opts: { query?: Query; body?: unknown } = {}): Promise<any> {
    const pathWithQuery = `${PREFIX}${path}${buildQuery(opts.query)}`;
    const body = opts.body === undefined ? "" : JSON.stringify(opts.body);
    const timestamp = new Date().toISOString(); // ISO 8601 with ms, not epoch
    const headers: Record<string, string> = {
      "X-OC-APIKEY": this.opts.apiKey,
      "X-OC-TIMESTAMP": timestamp,
      "X-OC-SIGN": sign(this.opts.apiSecret, timestamp, method, pathWithQuery, body),
      "X-OC-NONCE": randomUUID(),
      "X-OC-RECV-WINDOW": String(this.opts.recvWindowMs ?? 10_000),
    };
    if (body) headers["Content-Type"] = "application/json";

    const started = Date.now();
    const res = await fetch(`${this.base}${pathWithQuery}`, { method, headers, body: body || undefined });
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    this.opts.onResponse?.({ method, path, status: res.status, code: json?.code, ms: Date.now() - started });
    if (!res.ok) {
      throw new BinanceApiError(`HTTP ${res.status} ${path}: ${json?.msg ?? text.slice(0, 200)}`, res.status, json?.code, path, json);
    }
    return json;
  }

  /** Standard Web3 API call: success is code 0 / "0". Returns `data`. */
  async call<T = any>(method: "GET" | "POST", path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
    const json = await this.raw(method, path, opts);
    if (json?.code !== 0 && json?.code !== "0") {
      throw new BinanceApiError(`API ${json?.code} ${path}: ${json?.msg}`, 200, json?.code, path, json);
    }
    return json.data as T;
  }

  // ---- RWA Data API -------------------------------------------------------
  rwaTokens(q: { binanceChainId?: string; platformId?: "ondo" | "bstock"; tabId?: number }) {
    return this.call<RwaToken[]>("GET", "/api/v1/dex/market/rwa/tokens", { query: q });
  }
  rwaPrice(binanceChainId: string, addresses: string[]) {
    return this.call<RwaPrice[]>("GET", "/api/v1/dex/market/rwa/price", {
      query: { binanceChainId, tokenContractAddresses: addresses.join(",") },
    });
  }
  rwaUnderlyingMarket(binanceChainId: string, tokenContractAddress: string) {
    return this.call<any>("GET", "/api/v1/dex/market/rwa/underlying-market", {
      query: { binanceChainId, tokenContractAddress },
    });
  }

  // ---- Market API ---------------------------------------------------------
  marketPrice(items: { binanceChainId: string; tokenContractAddress: string }[]) {
    return this.call<{ binanceChainId: string; tokenContractAddress: string; price: string; time: string }[]>(
      "POST",
      "/api/v1/dex/market/price",
      { body: items },
    );
  }

  // ---- Trading API --------------------------------------------------------
  quote(q: {
    binanceChainId: string;
    amount: string;
    fromTokenAddress: string;
    toTokenAddress: string;
    userWalletAddress?: string;
    vendor?: "LiquidMesh" | "Pancake" | "Jupiter";
  }) {
    return this.call<QuoteRoute[]>("GET", "/api/v1/dex/aggregator/quote", { query: q });
  }
  approveTransaction(q: { binanceChainId: string; tokenContractAddress: string; approveAmount: string; vendor?: string }) {
    return this.call<any>("GET", "/api/v1/dex/aggregator/approve-transaction", { query: q });
  }
  swap(q: {
    binanceChainId: string;
    amount: string;
    fromTokenAddress: string;
    toTokenAddress: string;
    userWalletAddress: string;
    quoteId: string;
    slippagePercent?: string;
    priceImpactProtectionPercent?: string;
    vendor?: string;
  }) {
    return this.call<any>("GET", "/api/v1/dex/aggregator/swap", { query: q });
  }

  // ---- Transaction API ----------------------------------------------------
  simulate(binanceChainId: string, evmTx: { from: string; to: string; value: string; data: string }) {
    return this.call<any>("POST", "/api/v1/dex/pre-transaction/simulate", { body: { binanceChainId, evmTx } });
  }
  broadcast(body: { binanceChainId: string; signedTransaction: string; address: string; enableMevProtection?: boolean }) {
    return this.call<{ orderId: string; txHash: string }>("POST", "/api/v1/dex/pre-transaction/broadcast-transaction", { body });
  }
  txDetail(binanceChainId: string, txHash: string) {
    return this.call<any>("GET", "/api/v1/dex/post-transaction/transaction-detail-by-txhash", {
      query: { binanceChainId, txHash },
    });
  }

  // ---- b402 facilitator (x402 V2) ------------------------------------------
  // Body is wrapped as {"body": {...}}; success code is the string "000000000".
  private async b402<T>(path: string, inner: unknown): Promise<T> {
    const json = await this.raw("POST", path, { body: { body: inner } });
    if (json?.code !== "000000000") {
      throw new BinanceApiError(`b402 ${json?.code} ${path}: ${json?.msg}`, 200, json?.code, path, json);
    }
    return json.data as T;
  }
  b402Supported() {
    return this.b402<{ kinds: any[]; extensions?: any; signers?: any }>("/api/v2/b402/supported", {});
  }
  b402Verify(paymentPayload: unknown, paymentRequirements: unknown) {
    return this.b402<{ isValid: boolean; invalidReason?: string; invalidMessage?: string; payer?: string }>(
      "/api/v2/b402/verify",
      { x402Version: 2, paymentPayload, paymentRequirements },
    );
  }
  b402Settle(paymentPayload: unknown, paymentRequirements: unknown) {
    return this.b402<{ success: boolean; transaction?: string; payer?: string; network?: string; amount?: string; errorReason?: string }>(
      "/api/v2/b402/settle",
      { x402Version: 2, paymentPayload, paymentRequirements },
    );
  }
}

// Field shapes from docs/reference/ref-rwa-data.md and ref-trading-api.md
export interface RwaToken {
  binanceChainId: string;
  tokenContractAddress: string;
  platformId: string;
  tokenSymbol: string;
  tokenName: string;
  decimals: string;
  underlyingTicker: string;
  tokenPrice?: string;
  referencePrice?: string;
  [k: string]: unknown;
}

export interface RwaPrice {
  binanceChainId: string;
  tokenContractAddress: string;
  platformId: string;
  tokenPrice: string;
  referencePrice: string;
  tokenPriceUpdatedAt: string;
}

export interface QuoteRoute {
  quoteId: string;
  vendorName: string;
  toTokenAmount: string;
  priceImpactPercent?: string;
  executionMode: "SWAP" | "RFQ";
  approveTarget?: string;
  isBest?: boolean;
  estimateGasFee?: string;
  [k: string]: unknown;
}
