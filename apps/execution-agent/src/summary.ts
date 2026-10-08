// "Today on the desk": a deterministic, plain-English account of the current UTC day, built only from
// recorded events and the agent's state. No LLM: every sentence traces back to a logged event.

import { existsSync, readFileSync } from "node:fs";
import type { AgentEvent, AnalystStats, FillMode, PositionView, RiskCheck } from "@elitr/shared";

type Ev<T extends AgentEvent["type"]> = Extract<AgentEvent, { type: T }>;

// ---- plain-language vocabulary (the one place rule ids are translated) -----------------

/** Why a rule blocks a trade, phrased to follow "because". */
export const RULE_PLAIN: Record<string, string> = {
  gapPreScreen: "the token wasn't trading far enough below the real stock price for a buy to be possible, so no tip was bought",
  killSwitch: "the emergency stop (kill switch) is switched on",
  minConfidence: "the analyst was not confident enough",
  stance: "the analyst did not expect the price to rise",
  maxSignalAge: "the analyst's tip was too old to act on",
  minGapBps: "the token was not cheap enough compared with the real stock",
  maxTradeUsd: "the trade would be larger than the per-trade limit",
  maxPositionUsd: "it would make the holding larger than allowed",
  maxPortfolioUsd: "it would push total holdings over the limit",
  maxDailySpendUsd: "today's spending limit was already used up",
  minLiquidityUsd: "the trading pool was too small to trade safely",
  maxSlippageBps: "the trade would move the price too much, or no price quote was available",
  simulatableRoute: "no swap could be safely test-run first",
  sufficientUsdt: "the wallet did not have enough USDT (digital dollars)",
  sufficientGas: "the wallet did not have enough BNB to pay network fees",
  positionExists: "there was nothing to sell",
  simulation: "the test-run of the transaction failed",
};

export const EXIT_PLAIN: Record<string, string> = {
  takeProfit: "to lock in a profit",
  stopLoss: "to cap a loss",
  bearish: "because the analyst turned negative on it",
};

const STOCK_NAME: Record<string, string> = { NVDA: "Nvidia", TSLA: "Tesla", AAPL: "Apple", MSFT: "Microsoft", AMZN: "Amazon", GOOGL: "Alphabet", META: "Meta" };

/** Translate a raw "unavailable: …" cause into words a non-developer understands. */
export function plainCause(raw: string): string {
  const t = raw.replace(/^unavailable:\s*/i, "");
  if (/EXECUTION_PRIVATE_KEY/.test(t)) return "the agent has no wallet key configured";
  if (/BINANCE_WEB3_API_KEY|client unavailable|not configured/i.test(t)) return "the Binance API keys are not configured";
  if (/fetch failed|ETIMEDOUT|ECONN|timed? ?out|network/i.test(t)) return "Binance's data service could not be reached";
  if (/market (closed|pause)|not tradable|40369/i.test(t)) return "the US stock market is closed";
  if (/no signal purchased|no analyst selected|no eligible/i.test(t)) return "no analyst tip could be bought";
  if (/Yahoo/i.test(t)) return "the real stock price could not be fetched";
  return t.length > 90 ? `${t.slice(0, 87)}…` : t;
}

// ---- helpers ---------------------------------------------------------------------------

export const utcDayStart = (now: number) => {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

const money = (n: number) => {
  const a = Math.abs(n);
  const s = a < 1 ? `$${a.toFixed(a < 0.1 ? 3 : 2).replace(/0$/, "")}` : `$${a.toFixed(2)}`;
  return n < 0 ? `-${s}` : s;
};
const signedMoney = (n: number) => (n > 0 ? `+${money(n)}` : money(n));
const pctTxt = (bps: number) => `${(Math.abs(bps) / 100).toFixed(Math.abs(bps) < 100 ? 2 : 1)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listJoin = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export function stockName(symbol: string, underlying?: string | null): string {
  const u = underlying ?? symbol.replace(/(B|on|x)$/, "");
  return STOCK_NAME[u] ?? u;
}

const WEEKDAY = (ms: number) => new Date(ms).toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" });

/** Parse the minGapBps check value: "-34.5 bps (ref 239.24 vs on-chain 240.07)". */
export function parseGap(check: RiskCheck | undefined): { gapBps: number; ref: number; onchain: number } | null {
  if (!check) return null;
  const m = /^(-?\d+(?:\.\d+)?) bps \(ref ([\d.]+) vs on-chain ([\d.]+)\)/.exec(check.value);
  return m ? { gapBps: Number(m[1]), ref: Number(m[2]), onchain: Number(m[3]) } : null;
}

/** The decision's main reason, in plain words (after "because"). */
export function holdReason(decision: Ev<"decision">, risk: Ev<"risk.evaluated"> | undefined): string {
  const failed = (risk?.checks ?? []).filter((c) => !c.ok);
  const byRule = (r: string) => failed.find((c) => c.rule === r);
  const reasons = decision.reasons.join(" | ");
  const parts: string[] = [];

  const marketClosed = /market (closed|pause|premarket|postmarket|overnight)[^|]*(not tradable|quote skipped)|not tradable/i.test(reasons) || failed.some((c) => /market .*quote skipped|40369/.test(c.value));
  if (byRule("killSwitch")) parts.push(RULE_PLAIN.killSwitch);
  else if (marketClosed) parts.push("the US stock market is closed");
  else {
    const sig = byRule("minConfidence") ?? byRule("stance") ?? byRule("maxSignalAge");
    if (sig && /unavailable/.test(sig.value)) {
      const cause = plainCause(sig.value);
      parts.push(/analyst tip/.test(cause) ? "no analyst tip could be bought" : `there was no usable analyst tip (${cause})`);
    }
    else if (byRule("stance")) parts.push(`the analyst did not expect the price to rise (${byRule("stance")!.value})`);
    else if (byRule("minConfidence")) parts.push(`the analyst was not confident enough (score ${byRule("minConfidence")!.value.split(" ")[0]}, needs ${byRule("minConfidence")!.limit.replace(">= ", "")})`);
    else if (sig) parts.push(RULE_PLAIN[sig.rule]);
  }

  const gap = parseGap(risk?.checks.find((c) => c.rule === "minGapBps"));
  if (gap) {
    const close = /last close \(([^)]+)\)/.exec(reasons);
    const refWord = close ? `${WEEKDAY(Date.parse(close[1]))}'s closing price` : "the live stock price";
    const dir = gap.gapBps < 0 ? "above" : "below";
    const enough = byRule("minGapBps") ? (gap.gapBps < 0 ? "" : ", not far enough below to buy") : "";
    parts.push(`the token is trading ${pctTxt(gap.gapBps)} ${dir} ${refWord}${enough}`);
  } else if (!parts.length && byRule("minGapBps")) parts.push(`${RULE_PLAIN.minGapBps} (${plainCause(byRule("minGapBps")!.value)})`);

  if (!parts.length) {
    const other = failed.find((c) => RULE_PLAIN[c.rule]);
    if (other) parts.push(/unavailable/.test(other.value) ? `${RULE_PLAIN[other.rule]} (${plainCause(other.value)})` : RULE_PLAIN[other.rule]);
    else if (failed[0]) parts.push(plainCause(failed[0].value));
  }
  return listJoin(parts) || "no rule allowed a trade";
}

// ---- events ------------------------------------------------------------------------------

/** Today's (UTC) events from the agent's JSONL log. The in-memory hub keeps only the last 500. */
export function loadEventsSince(file: string, since: number): AgentEvent[] {
  if (!existsSync(file)) return [];
  const out: AgentEvent[] = [];
  const lines = readFileSync(file, "utf8").split("\n");
  // Newest last: walk backwards and stop at the first event before `since`.
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (!l) continue;
    let e: AgentEvent;
    try {
      e = JSON.parse(l);
    } catch {
      continue;
    }
    if (e.ts < since) break;
    out.push(e);
  }
  return out.reverse();
}

// ---- summary -------------------------------------------------------------------------------

export interface SummaryInput {
  now: number;
  events: AgentEvent[]; // today's, oldest first
  mode: FillMode;
  killSwitch: boolean;
  pnl: { realizedUsd: number; unrealizedUsd: number; signalSpendUsd: number; gasSpendUsd: number; netUsd: number } | null;
  positions: PositionView[];
  analystName: (id: string) => string;
  underlyingOf: (symbol: string) => string | null;
}

export interface SummaryFact {
  id: string;
  label: string;
  text: string;
  links?: { label: string; href: string }[];
}

export interface TodaySummary {
  day: string;
  generatedAt: number;
  mode: FillMode;
  source: "deterministic";
  paragraph: string;
  facts: SummaryFact[];
  decisions: { symbol: string; name: string; action: string; reason: string; at: number; counts: Record<string, number> }[];
  counts: { signals: number; signalUsd: number; decisions: number; trades: number; scored: number; ratingsPosted: number; errors: number };
}

const TX = (h: string) => `https://bscscan.com/tx/${h}`;

export function buildSummary(inp: SummaryInput): TodaySummary {
  const { events, now } = inp;
  const of = <T extends AgentEvent["type"]>(t: T) => events.filter((e): e is Ev<T> => e.type === t);
  const day = new Date(utcDayStart(now)).toISOString().slice(0, 10);
  const dayTxt = new Date(utcDayStart(now)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const facts: SummaryFact[] = [];
  const sentences: string[] = [];

  sentences.push(
    `Today (${dayTxt}, UTC) the desk is running in ${inp.mode === "live" ? "LIVE mode, trading with real money" : "PAPER mode: prices and quotes are real, trades are only recorded, no real money moves"}.`,
  );
  if (inp.killSwitch) sentences.push("The emergency stop is on, so it will not trade until it is restarted.");

  // Signals bought (b402)
  const pays = of("payment.sent");
  const payUsd = pays.reduce((s, p) => s + Number(p.amount) / 1e18, 0); // BSC stablecoins accepted by b402 use 18 decimals
  const byAnalyst = new Map<string, number>();
  for (const p of pays) byAnalyst.set(p.analystId ?? "unknown", (byAnalyst.get(p.analystId ?? "unknown") ?? 0) + 1);
  const fromTxt = listJoin([...byAnalyst].map(([id, n]) => `${n} from the ${inp.analystName(id)}`));
  if (pays.length) {
    sentences.push(`It bought ${plural(pays.length, "trading tip")} from AI analysts for ${money(payUsd)} in total (${fromTxt}), each paid on-chain with b402.`);
    facts.push({
      id: "signals",
      label: "Tips bought",
      text: `${plural(pays.length, "signal")} for ${money(payUsd)} - ${fromTxt}.`,
      links: pays.filter((p) => p.txHash).slice(-5).map((p) => ({ label: `payment ${p.txHash!.slice(0, 10)}…`, href: TX(p.txHash!) })),
    });
  } else {
    sentences.push("It has not bought any analyst tips yet today.");
    facts.push({ id: "signals", label: "Tips bought", text: "None yet today." });
  }

  // Decisions per asset
  const decisions = of("decision");
  const risks = of("risk.evaluated");
  const symbols = [...new Set(decisions.map((d) => d.symbol))];
  const decOut: TodaySummary["decisions"] = [];
  for (const sym of symbols) {
    const ds = decisions.filter((d) => d.symbol === sym);
    const last = ds[ds.length - 1];
    const risk = risks.filter((r) => r.symbol === sym && r.ts <= last.ts + 1000).pop();
    const counts: Record<string, number> = {};
    for (const d of ds) counts[d.action] = (counts[d.action] ?? 0) + 1;
    const name = stockName(sym, inp.underlyingOf(sym));
    const reason = last.action === "hold" ? holdReason(last, risk) : last.action === "sell" ? EXIT_PLAIN[last.exitReason ?? ""] ?? "an exit rule fired" : "every safety check passed";
    decOut.push({ symbol: sym, name, action: last.action, reason, at: last.ts, counts });
  }
  if (decOut.length) {
    const phr = decOut.map((d) => {
      const verb = d.action === "hold" ? "held" : d.action === "buy" ? "bought" : "sold";
      const times = Object.values(d.counts).reduce((a, b) => a + b, 0);
      return `${verb} ${d.name} (${d.symbol}) because ${d.reason}${times > 1 ? ` (latest of ${times} checks today)` : ""}`;
    });
    sentences.push(`Most recently it ${listJoin(phr)}.`);
    for (const d of decOut)
      facts.push({
        id: `decision-${d.symbol}`,
        label: `${d.name} (${d.symbol})`,
        text: `${d.action === "hold" ? "Held" : d.action === "buy" ? "Bought" : "Sold"} because ${d.reason}. Today: ${Object.entries(d.counts).map(([a, n]) => `${n} ${a}`).join(", ")}.`,
      });
  } else sentences.push("It has not evaluated any trade yet today.");

  // Trades / fills
  const fills = of("trade.filled");
  if (fills.length) {
    const t = fills.map((f) => `${f.side === "buy" ? "bought" : "sold"} ${f.qty.toFixed(4)} ${f.symbol} for ${money(f.usd)}${f.mode === "paper" ? " (paper)" : ""}`);
    sentences.push(`It ${listJoin(t)}.`);
    facts.push({
      id: "trades",
      label: "Trades",
      text: `${plural(fills.length, "fill")}: ${t.join("; ")}.`,
      links: fills.filter((f) => f.txHash).map((f) => ({ label: `${f.side} ${f.symbol} on BscScan`, href: TX(f.txHash!) })),
    });
  } else {
    facts.push({ id: "trades", label: "Trades", text: "No trades today - every check above has to pass before the agent buys or sells." });
  }
  const blockedSims = of("risk.blocked").filter((b) => b.rule === "simulation");
  if (blockedSims.length) facts.push({ id: "simulation", label: "Test-runs", text: `${plural(blockedSims.length, "trade")} stopped because the transaction test-run (Transaction API) failed.` });

  // Analyst track record
  const scored = of("signal.scored");
  if (scored.length) {
    // Only calls that moved trust are tallied (counted !== false); neutral / inconclusive ones are named apart.
    const per = new Map<string, { n: number; right: number; skipped: number }>();
    for (const s of scored) {
      const p = per.get(s.analystId) ?? { n: 0, right: 0, skipped: 0 };
      if (s.counted === false) p.skipped++;
      else {
        p.n++;
        if (s.correct) p.right++;
      }
      per.set(s.analystId, p);
    }
    const lastStats = new Map<string, AnalystStats>();
    for (const r of of("reputation.updated")) lastStats.set(r.stats.analystId, r.stats);
    const txt = [...per].map(([id, p]) => {
      const st = lastStats.get(id);
      const trust = st ? ` (trust now ${Math.round(st.trust * 100)}%)` : "";
      const skipped = p.skipped ? `${p.skipped} inconclusive` : "";
      if (!p.n) return `the ${inp.analystName(id)} had ${plural(p.skipped, "inconclusive call")}${trust}`;
      return `the ${inp.analystName(id)} was right on ${p.right} of ${p.n} counted ${p.n === 1 ? "call" : "calls"}${skipped ? `, ${skipped}` : ""}${trust}`;
    });
    sentences.push(`${plural(scored.length, "earlier tip")} ${scored.length === 1 ? "was" : "were"} checked against the real price: ${listJoin(txt)}.`);
    const tr = listJoin(txt);
    facts.push({ id: "track-record", label: "Analyst track record", text: `${tr.charAt(0).toUpperCase()}${tr.slice(1)}. Better track records get chosen (and paid) more often.` });
  }
  const posted = of("reputation.posted");
  const postedOk = posted.filter((p) => p.txHash);
  if (posted.length)
    facts.push({
      id: "ratings",
      label: "On-chain ratings",
      text: `${plural(postedOk.length, "rating")} posted to the ERC-8004 reputation registry${posted.length > postedOk.length ? `, ${posted.length - postedOk.length} not posted` : ""}.`,
      links: postedOk.slice(-5).map((p) => ({ label: `rating for ${inp.analystName(p.analystId)}`, href: TX(p.txHash!) })),
    });

  // P&L
  if (inp.pnl) {
    const p = inp.pnl;
    const held = inp.positions.filter((x) => x.qty > 0);
    sentences.push(
      `Overall result so far (${inp.mode}): ${signedMoney(p.netUsd)}` +
        (p.realizedUsd || p.unrealizedUsd ? `, of which ${signedMoney(p.realizedUsd)} from closed trades and ${signedMoney(p.unrealizedUsd)} on open holdings` : "") +
        `, after ${money(p.signalSpendUsd)} spent on tips${p.gasSpendUsd ? ` and ${money(p.gasSpendUsd)} on network fees` : ""}.`,
    );
    facts.push({
      id: "pnl",
      label: "Profit & loss",
      text: `Net ${signedMoney(p.netUsd)} (all-time, ${inp.mode}). ${held.length ? `Holding ${listJoin(held.map((h) => `${h.qty.toFixed(4)} ${h.symbol}`))}.` : "No open holdings."}`,
    });
  }

  const errors = of("error");
  if (errors.length) {
    const where = new Map<string, number>();
    for (const e of errors) where.set(e.where.split(":")[0], (where.get(e.where.split(":")[0]) ?? 0) + 1);
    const top = [...where].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w, n]) => `${w} ×${n}`);
    facts.push({ id: "errors", label: "Problems logged", text: `${plural(errors.length, "error")} today (${top.join(", ")}). Each one made the agent skip that step - it never guesses a missing price.` });
  }

  return {
    day,
    generatedAt: now,
    mode: inp.mode,
    source: "deterministic",
    paragraph: sentences.join(" "),
    facts,
    decisions: decOut,
    counts: { signals: pays.length, signalUsd: payUsd, decisions: decisions.length, trades: fills.length, scored: scored.length, ratingsPosted: postedOk.length, errors: errors.length },
  };
}
