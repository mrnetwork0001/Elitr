import { formatUnits, parseUnits, type PrivateKeyAccount, type PublicClient, type TransactionReceipt } from "viem";
import { BinanceWeb3Client } from "@elitr/binance";
import type { Identity } from "@elitr/identity";
import type { ReputationBook } from "@elitr/reputation";
import {
  PRIMARY_ASSET,
  TRADED_ASSETS,
  type AnalystId,
  type EventHub,
  type FillMode,
  type PositionView,
  type RiskConfig,
  type Side,
  type Signal,
  type TokenizedStock,
} from "@elitr/shared";
import { covers, fetchInfo, type AnalystEndpoint, type AnalystStatus } from "./analysts.js";
import { heldWei, positionView, summarize, type PnlSummary } from "./ledger.js";
import { buySignal } from "./pay.js";
import { bnbUsd, fetchOnchainPrice, fetchRwa, fetchYahoo, poolPrice, type RwaSnapshot, type YahooQuote } from "./prices.js";
import { evaluateRisk, evaluateSellRisk, exitTrigger, type ExitReason } from "./risk.js";
import { dxLog, type StateStore } from "./state.js";
import { errMsg, executeSwap, quoteSwap, type RouteChoice, type TxDeps } from "./trade.js";
import { poolUsdtLiquidity, readBalances, type Balances } from "./wallet.js";

export interface AgentConfig {
  analysts: AnalystEndpoint[];
  live: boolean; // LIVE_TRADING=1
  mevProtection: boolean;
  tradeUsd: number;
  minBnbForGas: number;
  postFeedback: boolean; // ERC-8004 feedback after each scored signal (costs gas)
  controlAuth: boolean; // CONTROL_TOKEN set
}

export interface AgentDeps {
  hub: EventHub;
  store: StateStore;
  risk: RiskConfig;
  pc: PublicClient;
  account: PrivateKeyAccount | null;
  accountError?: string;
  binance: BinanceWeb3Client | null;
  binanceError?: string;
  book: ReputationBook;
  identity: Identity | null;
  identityError?: string;
  cfg: AgentConfig;
  configErrors?: string[]; // non-fatal startup problems (e.g. bad ANALYSTS entries), shown in /state
  assets?: TokenizedStock[]; // defaults to TRADED_ASSETS
}

interface LatestSignal {
  analystId: AnalystId;
  stance: Signal["stance"];
  score: number;
  effectiveScore: number;
  weight: number;
  generatedAt: number;
}

interface Mark {
  price: number;
  source: string;
}

const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const r2 = (n: number) => Math.round(n * 100) / 100;

export class ExecutionAgent {
  killSwitch = false; // runtime switch, one-way until restart
  running = false;
  lastCycleAt: number | null = null;
  nextCycleAt: number | null = null;
  lastOnchainPrice: number | null = null; // primary asset, kept for older dashboard builds
  readonly marks = new Map<string, Mark>();
  readonly latestSignal = new Map<string, LatestSignal>(); // per symbol, from the chosen analyst
  private balCache: Balances | null = null;
  private analystCache: { at: number; statuses: AnalystStatus[] } | null = null;

  constructor(readonly d: AgentDeps) {}

  get asset() {
    return PRIMARY_ASSET;
  }

  get assets(): TokenizedStock[] {
    return this.d.assets ?? TRADED_ASSETS;
  }

  get mode(): FillMode {
    return this.d.cfg.live ? "live" : "paper";
  }

  engageKill(source: string): void {
    this.killSwitch = true;
    this.d.hub.emit({ type: "risk.blocked", symbol: "*", rule: "killSwitch", detail: `kill switch engaged via ${source}; no further cycles will trade until restart` });
  }

  /** Fresh-ish on-chain balances for /state (15 s cache). */
  async balances(): Promise<Balances | null> {
    if (!this.d.account) return null;
    if (this.balCache && Date.now() - this.balCache.readAt < 15_000) return this.balCache;
    this.balCache = await readBalances(this.d.pc, this.d.account.address, this.assets);
    return this.balCache;
  }

  /** GET /info of every configured analyst (cached for `maxAgeMs`). */
  async analystStatuses(maxAgeMs = 30_000): Promise<AnalystStatus[]> {
    if (this.analystCache && Date.now() - this.analystCache.at < maxAgeMs) return this.analystCache.statuses;
    const statuses = await Promise.all(this.d.cfg.analysts.map((ep) => fetchInfo(ep)));
    this.analystCache = { at: Date.now(), statuses };
    return statuses;
  }

  erc8004IdOf(s: AnalystStatus | undefined, id: AnalystId): string | undefined {
    return s?.info?.erc8004AgentId ?? this.d.identity?.agentIdOf(id);
  }

  /** Positions + P&L for the active mode, marked at the latest observed prices. */
  portfolio(): { positions: PositionView[]; pnl: PnlSummary } {
    const l = this.d.store.get().ledgers[this.mode];
    const positions = this.assets.map((a) => positionView(l, a.symbol, this.marks.get(a.symbol)?.price ?? null));
    return { positions, pnl: summarize(l, positions, this.d.store.signalSpendUsd()) };
  }

  async runCycle(trigger: string): Promise<void> {
    if (this.running) throw new Error("a cycle is already running");
    this.running = true;
    this.lastCycleAt = Date.now();
    console.log(`[execution] cycle start (${trigger})`);
    try {
      await this.cycle();
    } catch (e) {
      this.d.hub.emit({ type: "error", where: "cycle", message: errMsg(e) });
    } finally {
      this.running = false;
    }
  }

  /**
   * Operator-initiated trade (POST /trade): the same quote → Transaction API simulation → (live) sign + broadcast
   * path as an autonomous cycle, used to prove the execution flow with a small amount on demand. It skips the
   * signal/gap rules but keeps every safety the swap path has: kill switch, trade-size cap, SWAP-only routes,
   * slippage/price-impact protection and a passing simulation before anything is sent.
   */
  async operatorTrade(symbol: string, side: Side, usd?: number): Promise<{ ok: boolean; detail: string; txHash?: string }> {
    if (this.killSwitch || this.d.risk.killSwitch) return { ok: false, detail: "kill switch engaged" };
    if (this.running) return { ok: false, detail: "a cycle is running - retry in a minute" };
    const asset = this.assets.find((a) => a.symbol.toLowerCase() === symbol.toLowerCase());
    if (!asset) return { ok: false, detail: `unknown symbol; traded: ${this.assets.map((a) => a.symbol).join(", ")}` };
    const { hub, binance, account, risk, store } = this.d;
    const txd = this.txDeps();
    if (!txd || !binance || !account) return { ok: false, detail: "wallet or Binance Web3 API not configured" };
    this.running = true;
    try {
      const bal = await readBalances(this.d.pc, account.address, this.assets);
      this.balCache = bal;
      let amountIn: bigint;
      if (side === "buy") {
        const want = Math.min(usd ?? risk.maxTradeUsd, risk.maxTradeUsd);
        if (!(want > 0)) return { ok: false, detail: "usd must be positive" };
        amountIn = parseUnits(want.toFixed(6), 18);
        if (bal.raw.usdt < amountIn) return { ok: false, detail: `insufficient USDT: have ${bal.usdt}, need ${want}` };
      } else {
        const held = heldWei(store.get().ledgers[this.mode], asset.symbol);
        const onchain = bal.raw.tokens[asset.symbol] ?? 0n;
        amountIn = held < onchain ? held : onchain;
        if (amountIn <= 0n) return { ok: false, detail: `no ${asset.symbol} position to sell (ledger ${held}, wallet ${onchain})` };
      }
      const choice = await quoteSwap(binance, side, asset, account.address, amountIn);
      if (!choice.route) {
        hub.emit({ type: "risk.blocked", symbol: asset.symbol, rule: choice.marketClosed ? "marketClosed" : "simulatableRoute", detail: choice.detail });
        return { ok: false, detail: choice.detail };
      }
      hub.emit({ type: "decision", symbol: asset.symbol, action: side, reasons: [`operator test trade via POST /trade (${this.mode})`, choice.detail] });
      const res = await executeSwap(txd, risk, side, asset, amountIn, choice);
      this.balCache = null;
      this.bookFill(asset, side, amountIn, res);
      if (!res.simulated) return { ok: false, detail: `simulation failed: ${res.failReason ?? "unknown"}` };
      return { ok: true, detail: this.mode === "live" ? "broadcast and confirmed" : "simulated (paper fill booked)", txHash: res.txHash };
    } catch (e) {
      hub.emit({ type: "error", where: `operatorTrade:${asset.symbol}`, message: errMsg(e) });
      return { ok: false, detail: errMsg(e) };
    } finally {
      this.running = false;
    }
  }

  private async step<T>(where: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (e) {
      this.d.hub.emit({ type: "error", where, message: errMsg(e) });
      return null;
    }
  }

  private txDeps(): TxDeps | null {
    const { hub, binance, pc, account, cfg } = this.d;
    if (!binance || !account) return null;
    return { hub, binance, pc, account, live: cfg.live, mevProtection: cfg.mevProtection, onReceipt: (r, l) => this.bookGas(r, l) };
  }

  /** Live gas accounting: receipt gasUsed × effectiveGasPrice, valued at BNB/USD. */
  private async bookGas(r: TransactionReceipt, label: string): Promise<void> {
    try {
      const bnb = Number(formatUnits(r.gasUsed * r.effectiveGasPrice, 18));
      const px = await this.step(`gas.bnbUsd:${label}`, () => bnbUsd(this.d.pc, this.d.binance));
      this.d.store.addGas("live", bnb, px ? bnb * px.price : null);
    } catch (e) {
      this.d.hub.emit({ type: "error", where: `gas:${label}`, message: errMsg(e) });
    }
  }

  private async cycle(): Promise<void> {
    const { hub, risk, account, binance } = this.d;

    // 1. Kill switch
    if (this.killSwitch || risk.killSwitch) {
      hub.emit({ type: "risk.blocked", symbol: "*", rule: "killSwitch", detail: risk.killSwitch ? "KILL_SWITCH env is set" : "kill switch engaged at runtime (POST /kill)" });
      return;
    }

    if (!account) hub.emit({ type: "error", where: "config", message: `${this.accountErr} - skipping b402 payments, wallet balances, quotes and trades` });
    if (!binance) hub.emit({ type: "error", where: "config", message: `${this.binanceErr} - skipping RWA Data, Market, Trading and Transaction API calls (prices fall back to on-chain PancakeSwap v3 slot0)` });

    // 2. Score signals whose horizon has elapsed (pool price on-chain - works without any API key).
    await this.step("reputation.score", () => this.scoreDue());

    // 3. Discover analysts once per cycle (free /info).
    const statuses = await this.analystStatuses(0);
    for (const s of statuses) if (!s.online) hub.emit({ type: "error", where: `analyst.info:${s.endpoint.id}`, message: s.error ?? "offline" });

    // 4. Shared wallet read.
    let bal: Balances | null = null;
    if (account) {
      bal = await this.step("wallet.balances", () => readBalances(this.d.pc, account.address, this.assets));
      if (bal) this.balCache = bal;
    }

    // 5. Marks for every asset first, so the portfolio cap sees all positions.
    const pools = new Map<string, number>();
    for (const a of this.assets) await this.refreshMark(a, pools);

    for (const a of this.assets) {
      await this.step(`asset:${a.symbol}`, () => this.runAsset(a, statuses, bal, pools));
      // A trade invalidates the cache; re-read so the next asset sees post-trade balances.
      if (!this.balCache && account) this.balCache = await this.step("wallet.balances", () => readBalances(this.d.pc, account.address, this.assets));
      bal = this.balCache;
    }

    // 6. Positions + P&L for the active mode.
    const { positions, pnl } = this.portfolio();
    for (const p of positions) hub.emit({ type: "position.updated", position: p, mode: this.mode });
    hub.emit({ type: "pnl.snapshot", mode: this.mode, ...pnl, positions });
  }

  private get accountErr() {
    return this.d.accountError ?? "wallet unavailable";
  }
  private get binanceErr() {
    return this.d.binanceError ?? "Binance Web3 API client unavailable";
  }

  /** Market API price when available, else the PCS v3 pool (slot0). Records the pool price for reuse. */
  private async refreshMark(asset: TokenizedStock, pools: Map<string, number>): Promise<void> {
    const { hub, binance, pc } = this.d;
    const sym = asset.symbol;
    const pool = await this.step(`pool.price:${sym}`, () => poolPrice(pc, sym));
    if (pool) pools.set(sym, pool.price);
    let mark: Mark | null = null;
    if (binance) {
      const m = await this.step(`market.price:${sym}`, () => fetchOnchainPrice(binance, asset));
      if (m) {
        mark = { price: m.price, source: "binance-market" };
        hub.emit({ type: "price.onchain", symbol: sym, token: asset.address, price: m.price, source: "binance-market" });
      }
    }
    if (!mark && pool) {
      mark = { price: pool.price, source: pool.source };
      hub.emit({ type: "price.onchain", symbol: sym, token: asset.address, price: pool.price, source: pool.source });
    }
    if (mark) this.marks.set(sym, mark);
    else this.marks.delete(sym);
    if (asset.symbol === PRIMARY_ASSET.symbol) this.lastOnchainPrice = mark?.price ?? null;
  }

  /** Quantity (smallest units) the active mode holds: paper ledger, or the wallet in live mode. */
  private heldFor(asset: TokenizedStock, bal: Balances | null): bigint | null {
    if (this.mode === "paper") return heldWei(this.d.store.get().ledgers.paper, asset.symbol);
    return bal ? (bal.raw.tokens[asset.symbol] ?? 0n) : null;
  }

  private portfolioUsd(bal: Balances | null): number | null {
    let total = 0;
    for (const a of this.assets) {
      const q = this.heldFor(a, bal);
      if (q == null) return null;
      if (q === 0n) continue;
      const m = this.marks.get(a.symbol);
      if (!m) return null;
      total += Number(formatUnits(q, a.decimals)) * m.price;
    }
    return total;
  }

  // ---- per asset ---------------------------------------------------------------

  private async runAsset(asset: TokenizedStock, statuses: AnalystStatus[], bal: Balances | null, pools: Map<string, number>): Promise<void> {
    const { hub, store, risk, binance, account, cfg } = this.d;
    const sym = asset.symbol;
    const missing: Record<string, string> = {};

    // a. Choose an analyst and buy its signal.
    const signal = await this.acquireSignal(asset, statuses, pools.get(sym) ?? null, missing);

    // b. Reference prices + market status.
    let rwa: RwaSnapshot | null = null;
    if (binance) {
      rwa = await this.step(`rwa:${sym}`, () => fetchRwa(binance, asset));
      if (rwa && !rwa.listed) {
        const msg = `RWA Data API /rwa/tokens (platformId=bstock, binanceChainId=56) does not list ${sym} ${asset.address}`;
        hub.emit({ type: "error", where: "rwa", message: msg });
        dxLog("rwa-data", msg, "GET /api/v1/dex/market/rwa/tokens");
      }
      if (rwa?.referencePrice != null && Number.isFinite(rwa.referencePrice)) {
        hub.emit({ type: "price.reference", symbol: sym, price: rwa.referencePrice, source: "binance-rwa" });
      }
    }
    const marketClosed = rwa?.status && !rwa.status.openState ? rwa.status : null;
    const yahoo: YahooQuote | null = await this.step(`yahoo:${sym}`, () => fetchYahoo(asset.underlying));
    if (yahoo) hub.emit({ type: "price.reference", symbol: sym, price: yahoo.price, source: "yahoo" });
    else missing.minGapBps = "Yahoo reference price unavailable";

    const mark = this.marks.get(sym) ?? null;
    if (!mark) missing.minGapBps ??= "no on-chain price (Market API and PCS v3 pool both failed)";

    const liquidity = await this.step(`pool.liquidity:${sym}`, () => poolUsdtLiquidity(this.d.pc, asset));
    if (liquidity == null) missing.minLiquidityUsd = "pool balance read failed";
    if (!bal) missing.balances = account ? "balance read failed" : this.accountErr;

    const statusNote: string[] = [];
    if (rwa?.status) {
      const s = rwa.status;
      statusNote.push(
        `bStocks market ${s.marketStatus} (${s.openState ? "tradable" : "not tradable"}${s.reasonCode ? `, ${s.reasonCode}` : ""}${s.reasonMsg ? `: ${s.reasonMsg}` : ""})` +
          (s.nextOpenTime ? `, next open ${iso(s.nextOpenTime)}` : ""),
      );
    }
    if (yahoo) {
      statusNote.push(
        `${asset.underlying} regular session ${yahoo.marketOpen ? "open" : "closed"}; Yahoo reference ${yahoo.price} is ${yahoo.marketOpen ? "live" : "the last close"} (${iso(yahoo.marketTime)})`,
      );
    }
    if (mark) statusNote.push(`mark ${mark.price.toFixed(4)} USDT (${mark.source})`);

    // c. Exit check on the open position (active mode).
    const ledger = store.get().ledgers[this.mode];
    const view = positionView(ledger, sym, mark?.price ?? null);
    const latest = this.latestSignal.get(sym) ?? null;
    const exit = exitTrigger(
      {
        now: Date.now(),
        qty: view.qty,
        avgCostUsd: view.avgCostUsd,
        markUsd: mark?.price ?? null,
        signal: latest ? { stance: latest.stance, effectiveScore: latest.effectiveScore, generatedAt: latest.generatedAt } : null,
      },
      risk,
    );
    if (exit) {
      await this.sell(asset, exit, bal, liquidity, marketClosed, statusNote);
      return; // never add to a position on the cycle an exit fired
    }

    // d. Entry (buy) path.
    const held = this.heldFor(asset, bal);
    const positionUsd = held == null ? null : held === 0n ? 0 : mark ? Number(formatUnits(held, asset.decimals)) * mark.price : null;
    if (positionUsd == null) missing.maxPositionUsd = held == null ? (missing.balances ?? "balances unavailable") : "on-chain price unavailable";
    const portfolioUsd = this.portfolioUsd(bal);
    if (portfolioUsd == null) missing.maxPortfolioUsd = !bal && this.mode === "live" ? (missing.balances ?? "balances unavailable") : "an asset's on-chain price is unavailable";

    const amountIn = parseUnits(cfg.tradeUsd.toFixed(6), 18);
    let choice: RouteChoice | null = null;
    if (marketClosed) {
      missing.simulatableRoute = missing.maxSlippageBps = `bStocks market ${marketClosed.marketStatus}${marketClosed.nextOpenTime ? ` until ${iso(marketClosed.nextOpenTime)}` : ""} - quote skipped (would return 40369)`;
    } else if (binance && account) {
      choice = await this.step(`quote:${sym}`, () => quoteSwap(binance, "buy", asset, account.address, amountIn));
      if (choice?.marketClosed) dxLog("trading-api", `Quote for ${sym} rejected with 40369 although RWA market status said tradable`, choice.detail);
    }
    if (!choice) {
      const why = missing.simulatableRoute ?? (!binance ? this.binanceErr : !account ? this.accountErr : "quote failed");
      missing.simulatableRoute = missing.maxSlippageBps = why;
    } else if (!choice.route) missing.maxSlippageBps = choice.detail;
    if (choice?.route == null && choice && choice.all.length && choice.all.every((r) => r.executionMode === "RFQ")) {
      dxLog("trading-api", `Quote for ${sym} returned only RFQ routes - not simulatable via Transaction API`, choice.detail);
    }
    const impact = choice?.route?.priceImpactPercent;

    const checks = evaluateRisk(
      {
        now: Date.now(),
        killSwitch: this.killSwitch || risk.killSwitch,
        signal: signal
          ? { score: signal.effectiveScore, rawScore: signal.score, weight: signal.weight, stance: signal.stance, generatedAt: signal.generatedAt }
          : null,
        referencePrice: yahoo?.price ?? null,
        onchainPrice: mark?.price ?? null,
        tradeUsd: cfg.tradeUsd,
        positionUsd,
        portfolioUsd,
        dailySpendUsd: store.dailySpend(this.mode),
        liquidityUsd: liquidity,
        priceImpactPct: impact == null || impact === "" ? null : Number(impact),
        route: choice ? { ok: !!choice.route, detail: choice.detail } : null,
        usdtBalance: bal ? Number(bal.usdt) : null,
        bnbBalance: bal ? Number(bal.bnb) : null,
        minBnbForGas: cfg.minBnbForGas,
        missing,
      },
      risk,
    );
    const passed = checks.every((c) => c.ok);
    hub.emit({ type: "risk.evaluated", symbol: sym, passed, checks, side: "buy" });

    const reasons: string[] = [];
    reasons.push(
      signal
        ? `signal from ${signal.analystId}: ${signal.score}/100 ${signal.stance} → effective ${r2(signal.effectiveScore)} (weight ${signal.weight.toFixed(2)})`
        : `no signal: ${missing.signal}`,
    );
    if (view.qty > 0) reasons.push(`holding ${view.qty} ${sym} (${this.mode}) at avg ${view.avgCostUsd.toFixed(4)}; no exit rule fired`);
    reasons.push(...statusNote);
    for (const c of checks.filter((c) => !c.ok)) reasons.push(`${c.rule} failed: ${c.value} (limit ${c.limit})`);
    if (passed) reasons.push(`all ${checks.length} risk checks passed`);
    hub.emit({ type: "decision", symbol: sym, action: passed ? "buy" : "hold", reasons });
    if (!passed || !choice?.route) return;

    const txd = this.txDeps();
    if (!txd) return;
    const res = await this.step(`trade:${sym}`, () => executeSwap(txd, risk, "buy", asset, amountIn, choice));
    this.balCache = null;
    if (res) this.bookFill(asset, "buy", amountIn, res);
  }

  /** Pick an analyst (reputation), pay only the chosen one, record the signal for later scoring. */
  private async acquireSignal(
    asset: TokenizedStock,
    statuses: AnalystStatus[],
    entryPrice: number | null,
    missing: Record<string, string>,
  ): Promise<(LatestSignal & { signalId: string }) | null> {
    const { hub, store, risk, pc, account, binance, book, cfg } = this.d;
    const sym = asset.symbol;
    const candidates = statuses.map((s) => ({
      analystId: s.endpoint.id,
      name: s.info?.name ?? s.endpoint.id,
      priceUsd: s.info?.priceUsd ?? null,
      online: covers(s, sym),
    }));
    const choice = book.choose(candidates);
    const extra = statuses
      .filter((s) => !covers(s, sym))
      .map((s) => `${s.endpoint.id} not eligible for ${sym}: ${s.online ? `/info symbols ${JSON.stringify(s.info?.symbols ?? [])}` : (s.error ?? "offline")}`);
    hub.emit({ type: "analyst.selected", symbol: sym, analystId: choice.analystId, reasons: [...choice.reasons, ...extra], candidates: choice.candidates });
    if (!choice.analystId) {
      missing.signal = `no analyst selected (${choice.reasons.join("; ") || "no eligible candidates"})`;
      return null;
    }
    if (!account) {
      missing.signal = this.accountErr;
      return null;
    }
    const ep = statuses.find((s) => s.endpoint.id === choice.analystId)!.endpoint;
    const sig = await this.step(`pay.${ep.id}`, () =>
      buySignal(
        { hub, store, risk, pc, account, binance, analystId: ep.id, analystUrl: ep.url, live: cfg.live, mevProtection: cfg.mevProtection, onReceipt: (r, l) => this.bookGas(r, l) },
        sym,
      ),
    );
    if (!sig) {
      missing.signal = `no signal purchased from ${ep.id} this cycle (see preceding event)`;
      return null;
    }
    const weight = book.weight(sig.analystId);
    const effectiveScore = book.effectiveScore(sig.analystId, sig.score);
    const latest: LatestSignal & { signalId: string } = {
      signalId: sig.signalId,
      analystId: sig.analystId,
      stance: sig.stance,
      score: sig.score,
      effectiveScore,
      weight,
      generatedAt: Date.parse(sig.generatedAt),
    };
    this.latestSignal.set(sym, latest);

    // Record for scoring at its horizon; the entry price is the on-chain pool price at receipt.
    if (entryPrice == null) {
      hub.emit({ type: "error", where: "reputation.record", message: `no PCS v3 pool price for ${sym}; signal ${sig.signalId} from ${sig.analystId} not recorded for scoring` });
    } else {
      try {
        book.record({
          signalId: sig.signalId,
          analystId: sig.analystId,
          symbol: sym,
          stance: sig.stance,
          score: sig.score,
          issuedAt: Date.now(),
          horizonSec: sig.horizonSec,
          entryPrice,
        });
        hub.emit({
          type: "signal.received",
          analystId: sig.analystId,
          signalId: sig.signalId,
          symbol: sym,
          score: sig.score,
          stance: sig.stance,
          weight,
          effectiveScore,
          entryPrice,
          horizonSec: sig.horizonSec,
        });
      } catch (e) {
        hub.emit({ type: "error", where: "reputation.record", message: errMsg(e) });
      }
    }
    return latest;
  }

  /** Full exit of the active mode's position. Mirrors the buy flow (quote → approve → simulate → send). */
  private async sell(
    asset: TokenizedStock,
    exit: { reason: ExitReason; detail: string },
    bal: Balances | null,
    liquidity: number | null,
    marketClosed: RwaSnapshot["status"] | null,
    statusNote: string[],
  ): Promise<void> {
    const { hub, store, risk, binance, account, cfg } = this.d;
    const sym = asset.symbol;
    const missing: Record<string, string> = {};
    const ledgerQty = heldWei(store.get().ledgers[this.mode], sym);
    let qtyWei = ledgerQty;
    if (this.mode === "live") {
      // Never sell more than the agent bought, nor more than the wallet holds.
      const w = bal?.raw.tokens[sym];
      if (w == null) missing.positionExists = missing.balances = bal ? "token balance missing" : this.accountErr;
      qtyWei = w == null ? 0n : w < ledgerQty ? w : ledgerQty;
    }
    if (!bal) missing.balances ??= account ? "balance read failed" : this.accountErr;
    if (liquidity == null) missing.minLiquidityUsd = "pool balance read failed";

    let choice: RouteChoice | null = null;
    if (marketClosed) {
      missing.simulatableRoute = missing.maxSlippageBps = `bStocks market ${marketClosed.marketStatus}${marketClosed.nextOpenTime ? ` until ${iso(marketClosed.nextOpenTime)}` : ""} - quote skipped (would return 40369)`;
    } else if (qtyWei > 0n && binance && account) {
      choice = await this.step(`quote.sell:${sym}`, () => quoteSwap(binance, "sell", asset, account.address, qtyWei));
    }
    if (!choice) {
      const why = missing.simulatableRoute ?? (!binance ? this.binanceErr : !account ? this.accountErr : qtyWei === 0n ? "nothing to sell" : "quote failed");
      missing.simulatableRoute = missing.maxSlippageBps = why;
    } else if (!choice.route) missing.maxSlippageBps = choice.detail;
    const impact = choice?.route?.priceImpactPercent;

    const qty = Number(formatUnits(qtyWei, asset.decimals));
    const checks = evaluateSellRisk(
      {
        killSwitch: this.killSwitch || risk.killSwitch,
        qty,
        liquidityUsd: liquidity,
        priceImpactPct: impact == null || impact === "" ? null : Number(impact),
        route: choice ? { ok: !!choice.route, detail: choice.detail } : null,
        bnbBalance: bal ? Number(bal.bnb) : null,
        minBnbForGas: cfg.minBnbForGas,
        missing,
      },
      risk,
    );
    const passed = checks.every((c) => c.ok);
    hub.emit({ type: "risk.evaluated", symbol: sym, passed, checks, side: "sell" });

    const reasons = [`${exit.reason}: ${exit.detail}`, `selling ${qty} ${sym} (${this.mode} position)`, ...statusNote];
    for (const c of checks.filter((c) => !c.ok)) reasons.push(`${c.rule} failed: ${c.value} (limit ${c.limit})`);
    if (passed) reasons.push(`all ${checks.length} sell checks passed`);
    else reasons.push("exit triggered but blocked - position kept, retried next cycle");
    hub.emit(passed ? { type: "decision", symbol: sym, action: "sell", reasons, exitReason: exit.reason } : { type: "decision", symbol: sym, action: "hold", reasons });
    if (!passed || !choice?.route) return;

    const txd = this.txDeps();
    if (!txd) return;
    const res = await this.step(`trade.sell:${sym}`, () => executeSwap(txd, risk, "sell", asset, qtyWei, choice));
    this.balCache = null;
    if (res) this.bookFill(asset, "sell", qtyWei, res);
  }

  /**
   * Paper: book at the quoted amounts only when the swap simulation passed. Live: amounts from the
   * confirmed receipt's Transfer logs. Anything else books nothing.
   */
  private bookFill(asset: TokenizedStock, side: Side, amountIn: bigint, res: Awaited<ReturnType<typeof executeSwap>>): void {
    const { hub, store, cfg } = this.d;
    const sym = asset.symbol;
    if (!res.simulated) {
      hub.emit({
        type: "risk.blocked",
        symbol: sym,
        rule: "simulation",
        detail: `${side} not filled: Transaction API simulation failed (${res.failReason ?? "unknown"})` +
          (!cfg.live && side === "sell" ? "; paper sells need the wallet to actually hold the tokens for the dry-run to pass" : ""),
      });
      return;
    }
    let tokenWei: bigint;
    let usdtWei: bigint;
    let txHash: string | undefined;
    if (!cfg.live) {
      if (!res.route) return;
      const out = BigInt(res.route.toTokenAmount);
      [tokenWei, usdtWei] = side === "buy" ? [out, amountIn] : [amountIn, out];
    } else {
      if (!res.txHash || res.inWei == null || res.outWei == null) return;
      [tokenWei, usdtWei] = side === "buy" ? [res.outWei, res.inWei] : [res.inWei, res.outWei];
      txHash = res.txHash;
      store.recordTrade({
        ts: Date.now(),
        txHash,
        side,
        symbol: sym,
        amountInUsdt: side === "buy" ? formatUnits(usdtWei, 18) : "0",
        amountOut: side === "buy" ? formatUnits(tokenWei, asset.decimals) : "0",
        amountInToken: side === "sell" ? formatUnits(tokenWei, asset.decimals) : undefined,
        amountOutUsdt: side === "sell" ? formatUnits(usdtWei, 18) : undefined,
      });
    }
    if (tokenWei <= 0n) {
      hub.emit({ type: "error", where: `fill:${sym}`, message: `${side} produced zero ${sym} - nothing booked` });
      return;
    }
    try {
      const f = store.recordFill({ ts: Date.now(), mode: this.mode, symbol: sym, side, qtyWei: tokenWei, decimals: asset.decimals, usd: Number(formatUnits(usdtWei, 18)), txHash });
      hub.emit({ type: "trade.filled", symbol: sym, side, mode: this.mode, qty: f.qty, usd: f.usd, priceUsd: f.priceUsd, txHash, realizedUsd: f.realizedUsd });
    } catch (e) {
      hub.emit({ type: "error", where: `fill:${sym}`, message: errMsg(e) });
    }
  }

  // ---- reputation scoring ---------------------------------------------------------

  private async scoreDue(): Promise<void> {
    const { hub, book, pc } = this.d;
    const now = Date.now();
    const due = book.due(now);
    if (!due.length) return;
    const prices = new Map<string, number | null>();
    for (const rec of due) {
      if (!prices.has(rec.symbol)) {
        const p = await this.step(`pool.price:${rec.symbol}`, () => poolPrice(pc, rec.symbol));
        prices.set(rec.symbol, p?.price ?? null);
      }
      const exitPrice = prices.get(rec.symbol);
      if (exitPrice == null) continue; // retried next cycle
      let scored;
      try {
        scored = book.score(rec.signalId, exitPrice, now);
      } catch (e) {
        hub.emit({ type: "error", where: "reputation.score", message: `${rec.signalId}: ${errMsg(e)}` });
        continue;
      }
      hub.emit({
        type: "signal.scored",
        analystId: scored.analystId,
        signalId: scored.signalId,
        symbol: scored.symbol,
        stance: scored.stance,
        entryPrice: scored.entryPrice,
        exitPrice: scored.exitPrice,
        returnBps: scored.returnBps,
        correct: scored.correct,
        counted: scored.counted,
      });
      const stats = book.stats(scored.analystId);
      hub.emit({ type: "reputation.updated", stats });
      // Only calls that moved trust are worth an on-chain rating (each costs gas).
      if (scored.counted !== false) await this.postFeedback(scored.analystId, scored.signalId, stats.trust, { symbol: scored.symbol, returnBps: scored.returnBps, correct: scored.correct });
    }
  }

  /** ERC-8004 feedback (on-chain, costs gas). Opt-in; failures are reported and never thrown. */
  private async postFeedback(analystId: AnalystId, signalId: string, trust: number, detail: Record<string, unknown>): Promise<void> {
    const { hub, identity, cfg } = this.d;
    if (!cfg.postFeedback) return;
    const value = Math.max(0, Math.min(100, Math.round(trust * 100)));
    const tag = "signal-accuracy";
    if (!identity) {
      hub.emit({ type: "error", where: "erc8004", message: `feedback enabled but no identity configured (${this.d.identityError ?? "identityFromEnv() returned null"})` });
      return;
    }
    const status = this.analystCache?.statuses.find((s) => s.endpoint.id === analystId);
    const agentId = this.erc8004IdOf(status, analystId);
    if (!agentId) {
      hub.emit({ type: "error", where: "erc8004", message: `no ERC-8004 agent id for ${analystId} (/info.erc8004AgentId or identity registry); feedback skipped` });
      return;
    }
    if (!identity.canPost) {
      hub.emit({ type: "reputation.posted", analystId, erc8004AgentId: agentId, value, tag, error: "identity cannot post (EXECUTION_PRIVATE_KEY missing?)" });
      return;
    }
    try {
      const endpoint = status ? `${status.endpoint.url}/signal` : undefined;
      const r = await identity.postFeedback({ analystId, erc8004AgentId: agentId, value, tag, signalId, detail, endpoint });
      if (r.skipped) {
        hub.emit({ type: "reputation.posted", analystId, erc8004AgentId: agentId, value, tag, error: `skipped: ${r.skipped}` });
        return;
      }
      hub.emit({ type: "reputation.posted", analystId, erc8004AgentId: agentId, value, tag, txHash: r.txHash });
    } catch (e) {
      hub.emit({ type: "reputation.posted", analystId, erc8004AgentId: agentId, value, tag, error: errMsg(e) });
    }
  }
}

export function makeBinance(): { client: BinanceWeb3Client | null; error?: string } {
  try {
    return { client: BinanceWeb3Client.fromEnv() };
  } catch (e) {
    return { client: null, error: `BINANCE_WEB3_API_KEY / BINANCE_WEB3_API_SECRET not set (${(e as Error).message})` };
  }
}
