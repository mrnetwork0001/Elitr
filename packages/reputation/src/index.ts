/**
 * @elitr/reputation — how the execution agent learns which analyst to trust, and how much.
 *
 * Every paid signal is a falsifiable prediction: "over the next `horizonSec`, `symbol` will go
 * up / down / nowhere". We record it with the on-chain entry price, and once the horizon has
 * elapsed we mark it against the exit price. Nothing here is a vibe score — every number is a
 * deterministic function of recorded (signal, entry, exit) triples, and the file on disk is the
 * whole audit trail.
 *
 * 1. Correctness. returnBps = (exit / entry − 1) · 10⁴, band = `neutralBandBps` (default 25 bps,
 *    roughly one PancakeSwap fee tier + noise, so a call has to clear trading friction to count).
 *      bullish  correct iff returnBps >  +band
 *      bearish  correct iff returnBps <  −band
 *      neutral  correct iff |returnBps| ≤ band   (shown for transparency, but an abstention — see §2)
 *    avgReturnBps = mean of returnBps signed by stance (bullish +r, bearish −r; neutral calls carry
 *    no direction and are excluded) — "how many bps did following this analyst earn, gross".
 *
 * 2. Only directional calls (bullish / bearish) count toward trust. A neutral call is an abstention:
 *    the trader cannot act on it, and "price stays within ±band over 30–60 min" is close to a coin
 *    flip on a 24/7 pool, so scoring it would mostly add noise. Neutral calls are still recorded and
 *    marked, they just don't move samples / hits / trust.
 *    Trust = posterior mean of a Beta(1,1) (uniform) prior updated with hits / misses:
 *      trust = (hits + 1) / (samples + 2)            (Laplace's rule of succession)
 *    It starts at 0.5 with zero data and only moves as evidence accumulates, so one lucky call
 *    cannot make an analyst look like an oracle.
 *
 * 3. Weight ∈ [0,1] scales the analyst's confidence before the risk engine sees it:
 *      effectiveScore = 50 + (score − 50) · weight     (weight 0 ⇒ every call collapses to neutral)
 *    Evidence map: m(trust) = smoothstep((trust − 0.5) / 0.25)
 *      - trust ≤ 0.50 ⇒ 0: no better than a coin flip, its conviction carries no information;
 *      - trust ≥ 0.75 ⇒ 1: 3:1 odds of being right, we take its score at face value;
 *      - smoothstep (3x² − 2x³) in between: continuous, flat at both ends, so a single new sample
 *        near a threshold never makes the weight jump.
 *    Credibility blend: with n scored samples, α = min(1, n / minSamples) and
 *      weight = (1 − α) · prior + α · m(trust),      prior = `priorWeight` (default 0.5)
 *    A new analyst is heard at half volume; the prior is phased out linearly as its track record
 *    reaches `minSamples`, after which the weight is pure evidence. (A hard switch at minSamples
 *    would make the weight jump from 0.5 to m(trust) on one sample.)
 *
 * 4. Pause: paused = samples ≥ minSamples ∧ trust < pauseBelow (default 0.45). A paused analyst is
 *    not bought from at all (saves the b402 fee) — its record is kept and it keeps being scored on
 *    signals already bought, so the pause is a verdict on evidence, not a ban.
 *    Probation: if every online analyst is paused, nobody would ever be paid again, so nobody could
 *    ever earn trust back. choose() then buys one probe from the most-trusted paused analyst
 *    (ties → cheaper). Its weight is ~0 below the trust line, so the probe's confidence collapses to
 *    neutral and cannot trigger a trade — it only buys the evidence needed to recover (or stay paused).
 *
 * 5. Choosing whom to pay — Thompson sampling. For each online, unpaused candidate draw
 *      θ ~ Beta(hits + 1, misses + 1)
 *    (a plausible hit rate given its record) and buy from the highest  θ − λ · priceUsd
 *    (λ = `priceLambda`, default 1 ⇒ a $0.01 price gap is worth one point of hit rate, enough to
 *    break near-ties toward the cheaper seller). Thompson sampling is the Bayes-optimal-in-practice
 *    answer to explore vs exploit: an analyst with few samples has a wide posterior and gets tried
 *    sometimes; a proven one wins most draws; a bad one fades out without a hand-tuned ε.
 *    Beta draws use Gamma variates (Marsaglia–Tsang 2000) with an injectable rng, so a seeded rng
 *    makes every selection reproducible in tests and replays.
 *
 * 6. Persistence: one JSON file, rewritten atomically (write tmp + rename) after every mutation,
 *    parent dirs created. A corrupt file is an explicit error, never a silent reset of history.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { AnalystCandidate, AnalystId, AnalystStats, Stance } from "@elitr/shared";

export interface SignalRecord {
  signalId: string;
  analystId: AnalystId;
  symbol: string;
  stance: Stance;
  score: number;
  issuedAt: number; // ms
  horizonSec: number;
  entryPrice: number;
}
export interface ScoredSignal extends SignalRecord {
  exitPrice: number;
  scoredAt: number;
  returnBps: number;
  correct: boolean;
}
export interface Choice {
  /** True when every analyst was paused and this is a probe purchase (see header §4). */
  probation?: boolean;
  analystId: AnalystId | null;
  reasons: string[];
  candidates: AnalystCandidate[];
}
export interface ReputationOptions {
  neutralBandBps?: number; // default 25
  minSamples?: number; // default 10
  pauseBelow?: number; // default 0.45
  rng?: () => number; // uniform [0,1), default Math.random
  priorWeight?: number; // weight before any evidence, default 0.5
  priceLambda?: number; // hit-rate points per USD of price in choose(), default 1
}
export interface CandidateInput {
  analystId: AnalystId;
  name: string;
  priceUsd: number | null;
  online: boolean;
}

type Entry = SignalRecord & Partial<Pick<ScoredSignal, "exitPrice" | "scoredAt" | "returnBps" | "correct">>;
interface FileShape {
  version: 1;
  signals: Entry[];
}

const STANCES: readonly Stance[] = ["bullish", "neutral", "bearish"];
const isScored = (e: Entry): e is ScoredSignal => typeof e.scoredAt === "number";
const pct = (x: number) => `${Math.round(x * 100)}%`;
const fmt = (x: number) => x.toFixed(2);

// ---------- pure helpers (exported for tests and for explaining numbers in the UI) ----------

export function returnBps(entryPrice: number, exitPrice: number): number {
  return (exitPrice / entryPrice - 1) * 10_000;
}

export function isCorrect(stance: Stance, rBps: number, bandBps: number): boolean {
  if (stance === "bullish") return rBps > bandBps;
  if (stance === "bearish") return rBps < -bandBps;
  return Math.abs(rBps) <= bandBps;
}

export const posteriorMean = (hits: number, samples: number) => (hits + 1) / (samples + 2);

/** 0 at trust ≤ 0.5, 1 at trust ≥ 0.75, smoothstep in between. */
export function evidenceWeight(trust: number): number {
  const x = Math.min(1, Math.max(0, (trust - 0.5) / 0.25));
  return x * x * (3 - 2 * x);
}

function standardNormal(rng: () => number): number {
  // Box–Muller; 1 − u keeps the log argument in (0, 1].
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gamma(shape, 1) via Marsaglia & Tsang (2000); shape < 1 uses the Gamma(shape+1)·U^(1/shape) boost. */
export function sampleGamma(shape: number, rng: () => number = Math.random): number {
  if (!(shape > 0)) throw new Error(`gamma shape must be > 0, got ${shape}`);
  if (shape < 1) return sampleGamma(shape + 1, rng) * Math.pow(1 - rng(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = standardNormal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = 1 - rng();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Beta(a, b) = X / (X + Y) with X ~ Gamma(a), Y ~ Gamma(b). */
export function sampleBeta(a: number, b: number, rng: () => number = Math.random): number {
  const x = sampleGamma(a, rng);
  const y = sampleGamma(b, rng);
  return x / (x + y);
}

// ---------- the book ----------

export class ReputationBook {
  private readonly band: number;
  private readonly minSamples: number;
  private readonly pauseBelow: number;
  private readonly priorWeight: number;
  private readonly priceLambda: number;
  private readonly rng: () => number;
  private readonly signals = new Map<string, Entry>();

  constructor(
    private readonly file: string,
    opts: ReputationOptions = {},
  ) {
    this.band = opts.neutralBandBps ?? 25;
    this.minSamples = opts.minSamples ?? 10;
    this.pauseBelow = opts.pauseBelow ?? 0.45;
    this.priorWeight = opts.priorWeight ?? 0.5;
    this.priceLambda = opts.priceLambda ?? 1;
    this.rng = opts.rng ?? Math.random;
    if (!(this.band >= 0)) throw new Error("neutralBandBps must be >= 0");
    if (!(Number.isInteger(this.minSamples) && this.minSamples >= 0)) throw new Error("minSamples must be a non-negative integer");
    if (!(this.priorWeight >= 0 && this.priorWeight <= 1)) throw new Error("priorWeight must be within 0..1");
    this.load();
  }

  /** Remember a bought signal. Idempotent on signalId (a re-delivered signal is the same call). */
  record(s: SignalRecord): void {
    if (this.signals.has(s.signalId)) return;
    if (!s.signalId) throw new Error("signalId is required");
    if (!STANCES.includes(s.stance)) throw new Error(`invalid stance: ${s.stance}`);
    if (!(Number.isFinite(s.entryPrice) && s.entryPrice > 0)) throw new Error(`invalid entryPrice for ${s.signalId}: ${s.entryPrice}`);
    if (!(Number.isFinite(s.horizonSec) && s.horizonSec > 0)) throw new Error(`invalid horizonSec for ${s.signalId}: ${s.horizonSec}`);
    if (!Number.isFinite(s.issuedAt)) throw new Error(`invalid issuedAt for ${s.signalId}`);
    const { signalId, analystId, symbol, stance, score, issuedAt, horizonSec, entryPrice } = s;
    this.signals.set(signalId, { signalId, analystId, symbol, stance, score, issuedAt, horizonSec, entryPrice });
    this.save();
  }

  /** Signals whose horizon has elapsed and that have not been scored yet, oldest first. */
  due(now: number): SignalRecord[] {
    return [...this.signals.values()]
      .filter((e) => !isScored(e) && e.issuedAt + e.horizonSec * 1000 <= now)
      .sort((a, b) => a.issuedAt + a.horizonSec * 1000 - (b.issuedAt + b.horizonSec * 1000));
  }

  /** Mark a signal against its exit price. Scoring an already-scored signal returns the original verdict. */
  score(signalId: string, exitPrice: number, now: number): ScoredSignal {
    const e = this.signals.get(signalId);
    if (!e) throw new Error(`unknown signal ${signalId}`);
    if (isScored(e)) return { ...e };
    if (!(Number.isFinite(exitPrice) && exitPrice > 0)) throw new Error(`invalid exitPrice for ${signalId}: ${exitPrice}`);
    const r = returnBps(e.entryPrice, exitPrice);
    const scored: ScoredSignal = { ...e, exitPrice, scoredAt: now, returnBps: r, correct: isCorrect(e.stance, r, this.band) };
    this.signals.set(signalId, scored);
    this.save();
    return { ...scored };
  }

  stats(analystId: AnalystId): AnalystStats {
    let samples = 0;
    let hits = 0;
    let dirN = 0;
    let dirSum = 0;
    for (const e of this.signals.values()) {
      if (e.analystId !== analystId || !isScored(e)) continue;
      if (e.stance === "neutral") continue; // abstention: recorded, not scored into trust (§2)
      samples++;
      if (e.correct) hits++;
      dirN++;
      dirSum += e.stance === "bullish" ? e.returnBps : -e.returnBps;
    }
    const trust = posteriorMean(hits, samples);
    const alpha = this.minSamples === 0 ? 1 : Math.min(1, samples / this.minSamples);
    const weight = (1 - alpha) * this.priorWeight + alpha * evidenceWeight(trust);
    return {
      analystId,
      samples,
      hits,
      hitRate: samples ? hits / samples : null,
      trust,
      weight,
      paused: samples >= this.minSamples && trust < this.pauseBelow,
      avgReturnBps: dirN ? dirSum / dirN : null,
    };
  }

  /** Stats for every analyst that has at least one recorded signal. */
  all(): AnalystStats[] {
    const ids = [...new Set([...this.signals.values()].map((e) => e.analystId))].sort();
    return ids.map((id) => this.stats(id));
  }

  weight(analystId: AnalystId): number {
    return this.stats(analystId).weight;
  }

  effectiveScore(analystId: AnalystId, score: number): number {
    return 50 + (score - 50) * this.weight(analystId);
  }

  /** Thompson-sampling choice of which analyst to pay this round (see header, §5). */
  choose(candidates: CandidateInput[]): Choice {
    const reasons: string[] = [];
    const scored: { c: CandidateInput; st: AnalystStats; draw?: number; adj?: number }[] = candidates.map((c) => ({
      c,
      st: this.stats(c.analystId),
    }));
    for (const x of scored) {
      if (!x.c.online) {
        reasons.push(`${x.c.analystId} offline`);
        continue;
      }
      if (x.st.paused) {
        reasons.push(`${x.c.analystId} paused: trust ${pct(x.st.trust)} over ${x.st.samples} signals (< ${pct(this.pauseBelow)})`);
        continue;
      }
      x.draw = sampleBeta(x.st.hits + 1, x.st.samples - x.st.hits + 1, this.rng);
      x.adj = x.draw - this.priceLambda * (x.c.priceUsd ?? 0);
    }
    const out: AnalystCandidate[] = scored.map(({ c, st, draw }) => ({
      analystId: c.analystId,
      name: c.name,
      priceUsd: c.priceUsd,
      samples: st.samples,
      hitRate: st.hitRate,
      trust: st.trust,
      paused: st.paused,
      ...(draw !== undefined ? { draw } : {}),
    }));
    const eligible = scored.filter((x) => x.adj !== undefined).sort((a, b) => b.adj! - a.adj!);
    if (!eligible.length) {
      // Probation (§4): all online analysts paused → buy one probe from the most-trusted one.
      const paused = scored
        .filter((x) => x.c.online && x.st.paused)
        .sort((a, b) => b.st.trust - a.st.trust || (a.c.priceUsd ?? 0) - (b.c.priceUsd ?? 0));
      if (paused.length) {
        const p = paused[0]!;
        reasons.unshift(
          `probation: every analyst is paused, so buying one probe from ${p.c.analystId} (trust ${pct(p.st.trust)} over ${p.st.samples} directional calls) ` +
            `to let it earn trust back; below the trust line its weight is ~0, so this probe cannot trigger a trade`,
        );
        return { analystId: p.c.analystId, reasons, candidates: out, probation: true };
      }
      reasons.unshift(candidates.length ? "no eligible analyst (all offline or paused)" : "no analysts configured");
      return { analystId: null, reasons, candidates: out };
    }
    const [win, ...rest] = eligible;
    const desc = (x: (typeof eligible)[number]) =>
      `${x.c.analystId} ${fmt(x.draw!)}${x.c.priceUsd ? ` ($${x.c.priceUsd})` : ""}`;
    const record = (x: (typeof eligible)[number]) =>
      x.st.samples ? `${x.st.hits}/${x.st.samples} correct` : "no track record yet";
    reasons.unshift(
      rest.length
        ? `picked ${win!.c.analystId}: draw ${fmt(win!.draw!)} vs ${rest.map(desc).join(", ")} (${record(win!)})`
        : `picked ${win!.c.analystId}: only eligible analyst (draw ${fmt(win!.draw!)}, ${record(win!)})`,
    );
    const byDraw = [...eligible].sort((a, b) => b.draw! - a.draw!);
    if (byDraw[0] !== win) reasons.splice(1, 0, `price adjustment (λ=${this.priceLambda}/USD) favoured the cheaper ${win!.c.analystId}`);
    return { analystId: win!.c.analystId, reasons, candidates: out };
  }

  /** Scored signals, most recently scored first. */
  history(limit = 50): ScoredSignal[] {
    return [...this.signals.values()]
      .filter(isScored)
      .sort((a, b) => b.scoredAt - a.scoredAt)
      .slice(0, limit)
      .map((e) => ({ ...e }));
  }

  private load(): void {
    if (!existsSync(this.file)) return;
    let data: FileShape;
    try {
      data = JSON.parse(readFileSync(this.file, "utf8"));
    } catch (e) {
      throw new Error(`reputation file ${this.file} is not valid JSON (${(e as Error).message}); refusing to discard history`);
    }
    if (data?.version !== 1 || !Array.isArray(data.signals)) throw new Error(`reputation file ${this.file} has an unknown format`);
    for (const e of data.signals) this.signals.set(e.signalId, e);
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    const data: FileShape = { version: 1, signals: [...this.signals.values()] };
    writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
    renameSync(tmp, this.file);
  }
}
