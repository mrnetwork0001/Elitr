import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnalystId, FillMode, Side } from "@elitr/shared";
import { applyFill, emptyLedger, type FillInput, type FillRecord, type LedgerState } from "./ledger.js";

// Repo root: src/state.ts (tsx) and dist/state.js (node) both sit three levels below it.
export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
// EXECUTION_DATA_DIR relocates state/events/reputation (e.g. for test runs that must not touch data/).
export const DATA_DIR = (process.env.EXECUTION_DATA_DIR?.trim() || `${REPO_ROOT}data`).replace(/\/$/, "");
export const EVENTS_FILE = `${DATA_DIR}/execution-events.jsonl`;
export const REPUTATION_FILE = `${DATA_DIR}/reputation.json`;
const STATE_FILE = `${DATA_DIR}/execution-state.json`;
export const KILL_FILE = `${DATA_DIR}/kill-switch`;
const DX_LOG = `${REPO_ROOT}docs/dx-raw-log.md`;

export interface TradeRecord {
  ts: number;
  txHash: string;
  amountInUsdt: string; // human units, from on-chain Transfer logs
  amountOut: string; // human units of the asset
  symbol: string;
  side?: Side; // absent on records written before sells existed (= buy)
  amountInToken?: string; // sells: human units of the asset sold
  amountOutUsdt?: string; // sells: USDT received
}

export interface PaymentRecord {
  ts: number;
  amount: string; // human units
  asset: string; // symbol
  usd: number; // stablecoin amount counted 1:1 against the data budget
  txHash?: string;
  analystId?: AnalystId;
  symbol?: string;
}

/** A live swap that was broadcast but whose receipt has not been booked yet (survives a crash mid-wait). */
export interface PendingTx {
  txHash: string;
  side: Side;
  symbol: string;
  label: string;
  amountIn: string; // smallest units of the from-token
  at: number; // ms, when broadcast returned
}

export interface PersistedState {
  day: string; // UTC YYYY-MM-DD the counters below belong to
  dailySpendUsd: number; // USDT spent on live buys today
  dailyPaperSpendUsd: number; // USDT booked on paper buys today (paper mode's daily cap)
  dailyDataUsd: number; // stablecoins spent on b402 signals today
  signalSpendUsd: number; // all-time b402 spend (payments[] is truncated to the last 500)
  trades: TradeRecord[];
  payments: PaymentRecord[];
  ledgers: Record<FillMode, LedgerState>;
  pending: PendingTx[];
}

const today = () => new Date().toISOString().slice(0, 10);
const empty = (): PersistedState => ({
  day: today(),
  dailySpendUsd: 0,
  dailyPaperSpendUsd: 0,
  dailyDataUsd: 0,
  signalSpendUsd: 0,
  trades: [],
  payments: [],
  ledgers: { paper: emptyLedger(), live: emptyLedger() },
  pending: [],
});

export class StateStore {
  private s: PersistedState;

  constructor(private readonly file = STATE_FILE) {
    this.s = empty();
    if (existsSync(file)) {
      try {
        const loaded = JSON.parse(readFileSync(file, "utf8")) as Partial<PersistedState>;
        const base = empty();
        this.s = {
          ...base,
          ...loaded,
          ledgers: {
            paper: { ...emptyLedger(), ...loaded.ledgers?.paper },
            live: { ...emptyLedger(), ...loaded.ledgers?.live },
          },
          signalSpendUsd: loaded.signalSpendUsd ?? (loaded.payments ?? []).reduce((s, p) => s + p.usd, 0),
          pending: Array.isArray(loaded.pending) ? loaded.pending : [],
        };
      } catch (e) {
        console.error(`[execution] corrupt ${file}, refusing to guess: ${(e as Error).message}`);
        throw e;
      }
    }
    this.roll();
  }

  /** Reset daily counters at UTC midnight (history is kept). */
  private roll(): void {
    if (this.s.day !== today()) {
      this.s.day = today();
      this.s.dailySpendUsd = 0;
      this.s.dailyPaperSpendUsd = 0;
      this.s.dailyDataUsd = 0;
      this.save();
    }
  }

  get(): Readonly<PersistedState> {
    this.roll();
    return this.s;
  }

  recordPayment(p: PaymentRecord): void {
    this.roll();
    this.s.payments.push(p);
    this.s.payments = this.s.payments.slice(-500);
    this.s.dailyDataUsd += p.usd;
    this.s.signalSpendUsd += p.usd;
    this.save();
  }

  recordTrade(t: TradeRecord): void {
    this.roll();
    this.s.trades.push(t);
    this.s.trades = this.s.trades.slice(-500);
    if ((t.side ?? "buy") === "buy") this.s.dailySpendUsd += Number(t.amountInUsdt);
    this.save();
  }

  /** Book a fill into the mode's ledger (avg cost). Paper buys count toward the paper daily cap. */
  recordFill(f: FillInput): FillRecord {
    this.roll();
    const rec = applyFill(this.s.ledgers[f.mode], f);
    if (f.mode === "paper" && f.side === "buy") this.s.dailyPaperSpendUsd += f.usd;
    this.save();
    return rec;
  }

  addGas(mode: FillMode, bnb: number, usd: number | null): void {
    const l = this.s.ledgers[mode];
    l.gasBnb += bnb;
    if (usd != null) l.gasUsd += usd;
    this.save();
  }

  dailySpend(mode: FillMode): number {
    this.roll();
    return mode === "live" ? this.s.dailySpendUsd : this.s.dailyPaperSpendUsd;
  }

  /** All-time b402 spend on signals (USD, stablecoins 1:1). */
  signalSpendUsd(): number {
    return this.s.signalSpendUsd;
  }

  /** Remember a broadcast live swap until its receipt is booked (replaces an entry with the same hash). */
  setPending(p: PendingTx): void {
    this.s.pending = [...this.s.pending.filter((x) => x.txHash.toLowerCase() !== p.txHash.toLowerCase()), p];
    this.save();
  }

  clearPending(txHash: string): void {
    const before = this.s.pending.length;
    this.s.pending = this.s.pending.filter((x) => x.txHash.toLowerCase() !== txHash.toLowerCase());
    if (this.s.pending.length !== before) this.save();
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.s, null, 2));
    renameSync(tmp, this.file);
  }
}

// ---- persisted kill switch ------------------------------------------------------
// POST /kill writes this file so the switch survives a restart; only POST /kill/reset (or an operator
// deleting the file) clears it. A KILL_SWITCH=1 env cannot be reset at runtime.

export interface KillRecord {
  source: string;
  at: string; // ISO time
}

export function writeKillFile(source: string, file = KILL_FILE): KillRecord {
  const rec: KillRecord = { source, at: new Date().toISOString() };
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(rec) + "\n");
  renameSync(tmp, file);
  return rec;
}

/** The persisted record, or null when there is none. An unreadable file still counts as engaged. */
export function readKillFile(file = KILL_FILE): KillRecord | null {
  if (!existsSync(file)) return null;
  try {
    const r = JSON.parse(readFileSync(file, "utf8"));
    return { source: String(r?.source ?? "unknown"), at: String(r?.at ?? "unknown") };
  } catch {
    return { source: "unknown (unreadable kill-switch file)", at: "unknown" };
  }
}

export function removeKillFile(file = KILL_FILE): void {
  if (existsSync(file)) unlinkSync(file);
}

/** Append a factual friction line to docs/dx-raw-log.md (once per distinct `what`). */
export function dxLog(area: string, what: string, evidence: string): void {
  try {
    const existing = existsSync(DX_LOG) ? readFileSync(DX_LOG, "utf8") : "";
    if (existing.includes(what)) return;
    const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
    appendFileSync(DX_LOG, `${ts} | ${area} | ${what} | ${evidence}\n`);
  } catch (e) {
    console.error(`[execution] dx log write failed: ${(e as Error).message}`);
  }
}
