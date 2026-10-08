import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AnalystId, Stance } from "@elitr/shared";
import { evidenceWeight, isCorrect, ReputationBook, returnBps, sampleBeta, type SignalRecord } from "./index.js";

const dir = mkdtempSync(join(tmpdir(), "elitr-rep-"));
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
let n = 0;
const file = () => join(dir, `sub${n}`, `book-${n++}.json`);

/** mulberry32 — tiny deterministic PRNG for reproducible draws. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let sid = 0;
const sig = (analystId: AnalystId, stance: Stance, over: Partial<SignalRecord> = {}): SignalRecord => ({
  signalId: `s${sid++}`,
  analystId,
  symbol: "NVDAB",
  stance,
  score: stance === "bullish" ? 70 : stance === "bearish" ? 30 : 50,
  issuedAt: 1_000_000,
  horizonSec: 60,
  entryPrice: 100,
  ...over,
});

/** Records and scores `hits` correct + `misses` wrong bullish calls for an analyst. */
function seed(book: ReputationBook, id: AnalystId, hits: number, misses: number) {
  for (let i = 0; i < hits + misses; i++) {
    const s = sig(id, "bullish");
    book.record(s);
    book.score(s.signalId, i < hits ? 101 : 99, 2_000_000);
  }
}

test("scoring rules: band edges for every stance", () => {
  assert.equal(returnBps(100, 101), 100.00000000000009);
  assert.ok(Math.abs(returnBps(200, 190) - -500) < 1e-9);
  assert.equal(isCorrect("bullish", 26, 25), true);
  assert.equal(isCorrect("bullish", 25, 25), false);
  assert.equal(isCorrect("bearish", -26, 25), true);
  assert.equal(isCorrect("bearish", -25, 25), false);
  assert.equal(isCorrect("neutral", 25, 25), true);
  assert.equal(isCorrect("neutral", -25, 25), true);
  assert.equal(isCorrect("neutral", 25.1, 25), false);

  const book = new ReputationBook(file());
  const b = sig("analyst", "bullish");
  const r = sig("analyst", "bearish");
  const z = sig("analyst", "neutral");
  [b, r, z].forEach((s) => book.record(s));
  assert.equal(book.score(b.signalId, 100.5, 5).correct, true); // +50 bps
  assert.equal(book.score(r.signalId, 100.5, 5).correct, false);
  const zs = book.score(z.signalId, 100.2, 5); // +20 bps, inside band
  assert.equal(zs.correct, true);
  assert.ok(Math.abs(zs.returnBps - 20) < 1e-9);
  // Neutral is marked (correct=true above) but is an abstention: only the two directional calls count.
  // avgReturnBps: bullish +50, bearish −(+50) = −50 → 0
  const st = book.stats("analyst");
  assert.equal(st.samples, 2);
  assert.equal(st.hits, 1);
  assert.ok(Math.abs(st.avgReturnBps!) < 1e-9);
});

test("score() validates input and is stable once scored", () => {
  const book = new ReputationBook(file());
  const s = sig("analyst", "bullish");
  book.record(s);
  assert.throws(() => book.score("nope", 1, 1), /unknown signal/);
  assert.throws(() => book.score(s.signalId, 0, 1), /invalid exitPrice/);
  const first = book.score(s.signalId, 110, 10);
  const again = book.score(s.signalId, 50, 20);
  assert.deepEqual(again, first);
  assert.throws(() => book.record(sig("analyst", "bullish", { entryPrice: 0 })), /invalid entryPrice/);
});

test("trust, weight and pause thresholds", () => {
  const book = new ReputationBook(file(), { minSamples: 10, pauseBelow: 0.45 });
  const fresh = book.stats("analyst");
  assert.deepEqual(fresh, {
    analystId: "analyst",
    samples: 0,
    hits: 0,
    hitRate: null,
    trust: 0.5,
    weight: 0.5,
    paused: false,
    avgReturnBps: null,
  });
  assert.equal(evidenceWeight(0.5), 0);
  assert.equal(evidenceWeight(0.4), 0);
  assert.equal(evidenceWeight(0.75), 1);
  assert.equal(evidenceWeight(0.9), 1);
  assert.equal(evidenceWeight(0.625), 0.5);

  // 5 of 5 correct: halfway through the credibility ramp
  seed(book, "analyst", 5, 0);
  const half = book.stats("analyst");
  assert.equal(half.trust, 6 / 7);
  assert.equal(half.weight, 0.5 * 0.5 + 0.5 * 1);
  assert.equal(half.paused, false);

  // bad analyst: 3/10 correct → trust 4/12 ≈ 0.33 < 0.45 → paused, weight 0
  seed(book, "analyst-flow", 3, 7);
  const bad = book.stats("analyst-flow");
  assert.equal(bad.samples, 10);
  assert.equal(bad.hitRate, 0.3);
  assert.equal(bad.trust, 4 / 12);
  assert.equal(bad.weight, 0);
  assert.equal(bad.paused, true);
  assert.equal(book.effectiveScore("analyst-flow", 90), 50);
  assert.equal(book.effectiveScore("analyst", 90), 50 + 40 * 0.75);

  // 9 samples, terrible: not paused yet (below minSamples)
  const b2 = new ReputationBook(file());
  seed(b2, "analyst", 0, 9);
  assert.equal(b2.stats("analyst").paused, false);
  seed(b2, "analyst", 0, 1);
  assert.equal(b2.stats("analyst").paused, true);
  assert.deepEqual(
    book.all().map((s) => s.analystId),
    ["analyst", "analyst-flow"],
  );
});

test("record() is idempotent on signalId", () => {
  const book = new ReputationBook(file());
  const s = sig("analyst", "bullish");
  book.record(s);
  book.record({ ...s, entryPrice: 999 });
  book.score(s.signalId, 101, 5);
  book.record(s); // re-delivery after scoring must not reset the verdict
  assert.equal(book.history().length, 1);
  assert.equal(book.history()[0]!.entryPrice, 100);
  assert.equal(book.stats("analyst").samples, 1);
});

test("due() returns only elapsed, unscored signals, oldest deadline first", () => {
  const book = new ReputationBook(file());
  const a = sig("analyst", "bullish", { issuedAt: 0, horizonSec: 100 }); // due at 100_000
  const b = sig("analyst", "bullish", { issuedAt: 0, horizonSec: 10 }); // due at 10_000
  const c = sig("analyst", "bullish", { issuedAt: 0, horizonSec: 1000 }); // due at 1_000_000
  [a, b, c].forEach((s) => book.record(s));
  assert.deepEqual(book.due(9_999), []);
  assert.deepEqual(book.due(10_000).map((s) => s.signalId), [b.signalId]);
  assert.deepEqual(book.due(100_000).map((s) => s.signalId), [b.signalId, a.signalId]);
  book.score(b.signalId, 101, 100_000);
  assert.deepEqual(book.due(2_000_000).map((s) => s.signalId), [a.signalId, c.signalId]);
});

test("persistence round-trip with atomic write", () => {
  const f = file();
  const book = new ReputationBook(f);
  seed(book, "analyst", 3, 1);
  const pending = sig("analyst-flow", "bearish");
  book.record(pending);
  assert.ok(existsSync(f));
  assert.ok(!existsSync(`${f}.${process.pid}.tmp`));
  const again = new ReputationBook(f);
  assert.deepEqual(again.stats("analyst"), book.stats("analyst"));
  assert.deepEqual(again.history(), book.history());
  assert.deepEqual(again.due(Number.MAX_SAFE_INTEGER).map((s) => s.signalId), [pending.signalId]);
  assert.equal(JSON.parse(readFileSync(f, "utf8")).version, 1);

  writeFileSync(f, "{not json");
  assert.throws(() => new ReputationBook(f), /not valid JSON/);
});

test("Beta sampler has the right mean", () => {
  const rng = seeded(7);
  let s = 0;
  const N = 20_000;
  for (let i = 0; i < N; i++) s += sampleBeta(8, 4, rng);
  assert.ok(Math.abs(s / N - 8 / 12) < 0.01, `mean ${s / N}`);
  let t = 0;
  for (let i = 0; i < N; i++) t += sampleBeta(0.5, 0.5, rng);
  assert.ok(Math.abs(t / N - 0.5) < 0.01, `mean ${t / N}`);
});

const cands = [
  { analystId: "analyst" as const, name: "News", priceUsd: 0.01, online: true },
  { analystId: "analyst-flow" as const, name: "Flow", priceUsd: 0.01, online: true },
];

test("choose() is deterministic with a seeded rng", () => {
  const f = file();
  const base = new ReputationBook(f);
  seed(base, "analyst", 4, 2);
  seed(base, "analyst-flow", 2, 2);
  const a = new ReputationBook(f, { rng: seeded(42) }).choose(cands);
  const b = new ReputationBook(f, { rng: seeded(42) }).choose(cands);
  assert.deepEqual(a, b);
  assert.ok(a.analystId);
  assert.ok(a.candidates.every((c) => typeof c.draw === "number"));
  assert.match(a.reasons[0]!, /^picked analyst(-flow)?: draw 0\.\d\d vs analyst/);
});

test("choose() skips offline and paused analysts and explains why", () => {
  const book = new ReputationBook(file(), { rng: seeded(1) });
  seed(book, "analyst", 2, 10); // trust 3/14 → paused
  const c = book.choose(cands);
  assert.equal(c.analystId, "analyst-flow");
  assert.ok(c.reasons.some((r) => /analyst paused: trust 21% over 12 signals/.test(r)), c.reasons.join(" | "));
  assert.equal(c.candidates.find((x) => x.analystId === "analyst")!.draw, undefined);

  // Only the paused analyst is online → probation probe instead of buying nothing forever.
  const probe = book.choose([cands[0]!, { ...cands[1]!, online: false }]);
  assert.equal(probe.analystId, "analyst");
  assert.equal(probe.probation, true);
  assert.match(probe.reasons[0]!, /probation: every analyst is paused/);
  assert.ok(probe.reasons.includes("analyst-flow offline"));
  // Nobody online at all → nobody.
  const none = book.choose([{ ...cands[0]!, online: false }, { ...cands[1]!, online: false }]);
  assert.equal(none.analystId, null);
  assert.match(none.reasons[0]!, /no eligible analyst/);
  assert.equal(book.choose([]).analystId, null);
});

test("choose() statistically prefers the better analyst but still explores", () => {
  const book = new ReputationBook(file(), { rng: seeded(2024) });
  seed(book, "analyst", 14, 6); // 70%
  seed(book, "analyst-flow", 9, 11); // 45% — not paused (trust 10/22 ≈ 0.4545)
  assert.equal(book.stats("analyst-flow").paused, false);
  const wins = { analyst: 0, "analyst-flow": 0 };
  for (let i = 0; i < 2000; i++) wins[book.choose(cands).analystId as AnalystId]++;
  assert.ok(wins.analyst > 1800, JSON.stringify(wins));
  assert.ok(wins["analyst-flow"] > 0, "a weaker analyst with real uncertainty is still sampled sometimes");
});

test("price adjustment breaks ties toward the cheaper analyst", () => {
  const book = new ReputationBook(file(), { rng: seeded(9), priceLambda: 1 });
  seed(book, "analyst", 30, 10);
  seed(book, "analyst-flow", 30, 10);
  const wins = { analyst: 0, "analyst-flow": 0 };
  const priced = [
    { ...cands[0]!, priceUsd: 0.05 },
    { ...cands[1]!, priceUsd: 0.01 },
  ];
  for (let i = 0; i < 2000; i++) wins[book.choose(priced).analystId as AnalystId]++;
  assert.ok(wins["analyst-flow"] > wins.analyst, JSON.stringify(wins));
});

test("probation picks the most-trusted paused analyst and its weight stays ~0", () => {
  const book = new ReputationBook(file(), { rng: seeded(7) });
  seed(book, "analyst", 2, 10); // trust 3/14 ≈ 0.21
  seed(book, "analyst-flow", 4, 10); // trust 5/16 ≈ 0.31 → most trusted of the paused
  assert.equal(book.stats("analyst").paused, true);
  assert.equal(book.stats("analyst-flow").paused, true);
  const c = book.choose(cands);
  assert.equal(c.analystId, "analyst-flow");
  assert.equal(c.probation, true);
  assert.ok(book.weight("analyst-flow") < 0.01, "a paused analyst's conviction carries no weight");
  assert.ok(Math.abs(book.effectiveScore("analyst-flow", 90) - 50) < 1, "a probe cannot push the confidence rule");
});

test("neutral calls never move trust", () => {
  const book = new ReputationBook(file());
  for (let i = 0; i < 12; i++) {
    const z = sig("analyst", "neutral");
    book.record(z);
    book.score(z.signalId, 101, 5); // +100 bps: a "wrong" neutral
  }
  const st = book.stats("analyst");
  assert.equal(st.samples, 0);
  assert.equal(st.paused, false);
  assert.equal(st.trust, 0.5);
});

test("directional calls inside the noise band are inconclusive and don't move trust", () => {
  const book = new ReputationBook(file());
  const flat = sig("analyst", "bullish");
  const small = sig("analyst", "bearish");
  const hit = sig("analyst", "bullish");
  [flat, small, hit].forEach((s) => book.record(s));
  const f = book.score(flat.signalId, 100.01, 5); // +1 bps, pool barely traded
  const m = book.score(small.signalId, 99.877, 5); // −12.3 bps: right direction, below the band
  const h = book.score(hit.signalId, 100.5, 5); // +50 bps
  assert.equal(f.counted, false);
  assert.equal(m.counted, false);
  assert.equal(h.counted, true);
  const st = book.stats("analyst");
  assert.equal(st.samples, 1);
  assert.equal(st.hits, 1);
});
