// Everything below the hero: the full explainer (formerly /learn), in the hero's visual language.
import Link from "next/link";
import type { ReactNode } from "react";
import l from "@/app/landing.module.css";
import { FlowDiagram } from "./FlowDiagram";
import { Accent, Arrow, DashboardButton, Mark, cx, reveal } from "./parts";

const STATS = [
  ["3", "autonomous agents"],
  ["14", "risk checks before every buy"],
  ["100%", "of transactions dry-run first"],
  ["2", "tokenized stocks traded"],
] as const;

const PROBLEMS = [
  {
    title: "Trading bots are black boxes",
    body: "Most bots are one script that makes up its own mind. You can't see where an idea came from, what it cost, or why a trade was made.",
  },
  {
    title: "Agents can't tell good data from bad",
    body: "AI agents scrape, hardcode or share API keys. There's no simple, per-request way for one agent to pay another for information, and no record of whether that information was ever right.",
  },
  {
    title: "Tokenized stocks never close, but stocks do",
    body: "Tokens trade 24/7 while the underlying market sleeps. Prices drift, quotes go stale, and liquidity is thin on most platforms, so naive bots buy at the wrong price.",
  },
  {
    title: "A bot with a wallet can drain it",
    body: "Give an agent a private key and no limits, and one bad signal or a reverting swap can cost real money. Safety is usually an afterthought.",
  },
];

const SOLUTIONS = [
  {
    title: "Accountable signals",
    body: "Ideas come from separate analyst agents that cite their inputs. Every signal is paid for and scored afterwards, so every analyst has a receipt trail on BSC and a public hit rate.",
  },
  {
    title: "A real agent market",
    body: "Analysts compete for each purchase over b402: no shared keys, no subscriptions. The trader pays the one with the better record, and stops paying one that keeps being wrong.",
  },
  {
    title: "Safety by default",
    body: "Hard limits, a portfolio cap, take-profit and stop-loss exits, a kill switch, swap-only routes and a mandatory dry-run. Paper trading is the default.",
  },
];

const AGENTS: { role: string; title: string; body: string; marker: string; key?: boolean }[] = [
  {
    role: "Agent A · seller",
    title: "The News analyst",
    marker: l.squareOutline,
    body: "Reads the last 48 hours of Yahoo Finance and Google News headlines about the stock behind each token, and asks Claude for a 1–100 confidence score that must cite the headlines behind it. Each call is meant to hold for an hour.",
  },
  {
    role: "Agent C · seller",
    title: "The Flow analyst",
    marker: l.squareInk,
    body: "Reads what money is actually doing: every PancakeSwap v3 swap in the token's pool over the last hour. It scores buy-vs-sell volume, large-trade imbalance, buyer-vs-seller wallets and momentum. Deterministic, no LLM, and it refuses to sell a signal when there are too few swaps to say anything. Each call is meant to hold for 30 minutes.",
  },
  {
    role: "Agent B · buyer",
    title: "The Execution agent",
    marker: "",
    key: true,
    body: "Holds the capital. Chooses which analyst to pay, scores every call it buys, compares real and on-chain prices, runs every risk rule, simulates each swap with Binance's Transaction API, and only then fills — on paper by default.",
  },
];

const STEPS: { n: string; title: string; body: string; api: string }[] = [
  { n: "01", title: "Pick an analyst", body: "Two analysts sell signals for each stock: one reads the news, one reads on-chain swap flow. The Execution agent draws a Thompson sample from each one's track record and buys from the highest draw. Analysts whose trust falls too low are paused.", api: "Analyst market" },
  { n: "02", title: "Buy the signal", body: "It asks the chosen analyst for a signal, gets an HTTP 402 price tag, signs a USDT payment and retries. The analyst checks the payment with Binance's b402 facilitator, and only settles once it has actually produced the signal. No signal, no charge.", api: "b402 payments" },
  { n: "03", title: "Get three prices", body: "The real stock price from Yahoo Finance, the Binance RWA Data reference price and market status, and the live on-chain token price — for NVDAB and TSLAB.", api: "RWA Data · Market API" },
  { n: "04", title: "Check exits first", body: "For a held position, the agent sells on take-profit, stop-loss, or a bearish signal before it considers buying more.", api: "Portfolio" },
  { n: "05", title: "Quote the trade", body: "Asks the aggregator for the best route. Only regular swap routes are accepted, because only those can be simulated.", api: "Trading API" },
  { n: "06", title: "Run the risk checks", body: "14 rules on a buy (portfolio cap included), 6 on a sell. Every rule is logged with its observed value and limit. One failure and the agent holds.", api: "Risk engine" },
  { n: "07", title: "Dry-run, then fill", body: "The swap is simulated first. In paper mode a passing simulation is booked at the real quoted amounts; in live mode the agent signs locally and broadcasts.", api: "Transaction API" },
  { n: "08", title: "Score the analyst", body: "When a signal's horizon ends (1 hour for news, 30 minutes for flow), the trader checks the pool price: was the call right, and by how many basis points? It updates that analyst's hit rate, trust and weight, and posts the rating on-chain to the ERC-8004 reputation registry.", api: "Reputation" },
];

const TX = "https://bscscan.com/tx/";
const PROOF: [string, string, string][] = [
  ["ERC-8004 identities", "News analyst #365554 · Flow analyst #365555 · Trader #365556", "0x81f46ff719e2a7c244ccb39622ae05fd9960883bd19000e0c731c60a8c168237"],
  ["Agent pays agent (b402)", "Trader → flow analyst, 0.01 USDT for a signal, settled by Binance's facilitator", "0xe2a30c0801799c2b1c128fdc4e332c8485ce3249eacedd52470e2b1971a6c49f"],
  ["Agent rates agent (ERC-8004)", "Trader posts the news analyst's accuracy to the reputation registry", "0xf09e9f6edd8d64d0fd4f4a75f463ba2106093b16b2f986ad774c7b584aa887d6"],
  ["Live trade", "2 USDT → 0.008433 NVDAB, simulated with the Transaction API, then broadcast", "0x0ce91120a0e7f14792a20565aa99f4a1819afafc0d1f1e9ee51ee3e36aa03807"],
  ["Binance Agentic Wallet buys a signal", "Paid in U via EIP-3009, no approval needed, 3.5 s from signature to signal", "0xd2535021423ae6d30b4bbc6fde8f2b58fc0bc22dba7831c7d97c7eed78ca2e4e"],
  ["BNB Agent Studio agent registers", "Elitr Desk Brief #367734, self-hosted on mainnet at desk.elitr.xyz (gas sponsored by MegaFuel)", "0xd95b1b475f44dd6537b3df63c380d7d0d4f948d001434cd8ed3856b96a5ae22b"],
];

const B402_STEPS = [
  "Execution requests /signal from the analyst it picked and gets 402 with the price, token and payee.",
  "It signs a USDT payment authorisation with its wallet and retries.",
  "The analyst checks it with the b402 facilitator, produces the signal, then settles. If it can't produce one, the payment is never taken.",
  "The signal comes back with a settlement receipt, viewable on BscScan.",
];

const MARKET = [
  ["Thompson sampling", "Each analyst's right/wrong record becomes a probability distribution. Every cycle the trader draws once from each and buys from the highest draw, so proven analysts win most purchases and newcomers still get tested."],
  ["Trust-weighted confidence", "Before the risk engine sees it, an analyst's score is pulled toward a neutral 50 by how little the trader trusts it. A 78 from an unproven analyst becomes 64 and fails the 65 minimum; a 72 from a proven one passes as 72."],
  ["Paused when wrong", "Below 0.45 trust after 10 scored calls, an analyst is paused: the trader stops paying it. Hit rate, average return and the pause line are all on the dashboard."],
] as const;

const CHECKS: [string, string][] = [
  ["Kill switch", "Off (one click stops everything)"],
  ["Signal confidence", "≥ 65 / 100, weighted by analyst trust"],
  ["Signal stance", "Bullish"],
  ["Signal age", "≤ 5 minutes"],
  ["Price gap", "On-chain ≥ 0.5% below reference"],
  ["Trade size", "≤ $5"],
  ["Position size (per stock)", "≤ $25"],
  ["Portfolio size (all stocks)", "≤ $50"],
  ["Daily trading spend", "≤ $25"],
  ["Pool liquidity", "≥ $50,000"],
  ["Slippage / price impact", "≤ 1%"],
  ["Route can be simulated", "Swap routes only"],
  ["USDT balance", "Enough for the trade"],
  ["BNB for gas", "≥ 0.001 BNB"],
];

const EXITS: [string, string][] = [
  ["Take profit", "+3% over average cost"],
  ["Stop loss", "−2% under average cost"],
  ["Bearish signal", "Sell on a bearish call (configurable)"],
  ["Analyst pause", "Trust < 0.45 after 10 scored calls"],
];

const GUARDS = [
  ["Paper by default", "Quotes and dry-runs are real and fills are booked at quoted amounts, but nothing is broadcast until live trading is explicitly switched on."],
  ["Portfolio cap and exits", "A cap on all positions combined, plus automatic take-profit and stop-loss sells, so a winning or losing position never just sits there."],
  ["Dry-run every transaction", "Approvals and swaps go through Binance's Transaction API first. If the simulation fails, the trade doesn't happen."],
  ["Swap routes only", "Off-chain RFQ orders can't be simulated, so Elitr refuses them, even when they quote better."],
  ["Keys stay local", "The agent signs on its own machine. No Binance API ever receives a private key."],
  ["Kill switch", "One operator click stops all new trades until the agent is restarted. Visitors get a read-only dashboard."],
] as const;

const LIQUIDITY: [string, string, string, "Traded" | "Tracked"][] = [
  ["bStocks", "NVDAB", "≈ $4.2M", "Traded"],
  ["bStocks", "TSLAB", "≈ $2.0M", "Traded"],
  ["Ondo", "NVDAon / TSLAon", "< $10k", "Tracked"],
  ["xStocks", "TSLAx", "≈ $23", "Tracked"],
];

const STACK = [
  ["b402 Payments", "Agent-to-agent pay-per-signal"],
  ["RWA Data API", "Reference price and market status"],
  ["Market API", "Live on-chain token price"],
  ["Trading API", "Aggregated swap quotes and calldata"],
  ["Transaction API", "Simulation and broadcast"],
  ["BNB Smart Chain", "Mainnet settlement"],
  ["Claude via 0G Compute", "News scoring with citations"],
  ["PancakeSwap v3", "Swap flow and pool prices, read on-chain"],
  ["ERC-8004", "Agent identity and on-chain reputation"],
  ["BNB Agent Studio", "Desk-brief agent (#367734) with A2A + x402 at desk.elitr.xyz"],
  ["Docker + CI", "One-command stack, tested on every push"],
  ["Next.js dashboard", "Live event stream from all three agents"],
] as const;

const PANELS = [
  ["Top bar", "Connection status of all three agents, the PAPER / LIVE badge, the kill switch, and operator controls (read-only for visitors)."],
  ["Agent-to-agent flow", "Every b402 payment from the trader to each analyst, with the BscScan settlement link and today's spend."],
  ["Analyst market", "Each analyst's price, hit rate, trust and weight, who was picked for each stock and why, and every scored call."],
  ["Portfolio & P&L", "Net P&L after signal costs and gas, positions per stock with take-profit and stop-loss levels. Paper fills are always labelled."],
  ["Signal · Prices · Risk", "Per stock: the latest signal and which analyst sold it, reference vs on-chain prices, and every risk rule from the last check."],
  ["Execution log", "Each attempt as a pipeline: simulated → broadcast → filled, buy or sell, with the exit reason and PAPER or LIVE."],
  ["Timeline", "Every event from all three agents, filterable, with raw JSON for anyone who wants to verify."],
] as const;

const BADGES = [
  ["PAPER", l.pillPaper, "Real data and dry-runs; fills booked, nothing broadcast."],
  ["LIVE", l.pillLive, "The agent can sign and send trades."],
  ["PASS", l.pillPass, "Every rule passed in the last check."],
  ["BLOCKED", l.pillBlocked, "At least one rule failed; the agent held."],
  ["PAUSED", l.pillPaused, "An analyst's trust fell below the line; the trader stopped paying it."],
] as const;

const FAQ: [string, ReactNode][] = [
  [
    "Does Elitr trade real money?",
    "Only when its operator switches it on. By default it runs in paper mode: every price, quote and dry-run is real, but nothing is broadcast. Live mode trades small amounts on BSC mainnet, capped by the risk limits.",
  ],
  [
    "What is paper mode?",
    "The default. The agent does everything for real up to the last step: it buys real signals, fetches real prices and quotes, and simulates the exact swap with Binance's Transaction API. If the simulation passes, the fill is booked at the quoted amounts, but nothing is broadcast. The dashboard marks every paper fill and paper P&L as PAPER — it is never presented as real money.",
  ],
  [
    "Why pay your own analyst?",
    "Because a paid signal comes with a track record. Every call is scored when its horizon ends, so each analyst builds a public hit rate and average return. The trader favours analysts that have been right, weights their confidence by trust, and stops paying one that keeps being wrong until its record recovers.",
  ],
  [
    "How does it choose between analysts?",
    "Thompson sampling. Each analyst's record of right and wrong calls becomes a probability distribution; the trader draws once from each and buys from the highest draw. Good analysts win most draws, while newer ones still get a chance to prove themselves.",
  ],
  [
    "Why does it say “hold” so often?",
    "Because holding is usually the right call. If the US market is closed, the signal is weak, or the token is trading above the real stock price, a rule fails and the agent explains which one.",
  ],
  [
    "What is b402?",
    "Binance's payment facilitator for x402, a standard that revives HTTP's 402 “Payment Required” status. A server names its price, the client signs a stablecoin payment, and the facilitator verifies and settles it on BSC, with gas sponsored.",
  ],
  [
    "Why NVDAB and TSLAB, not Ondo or xStocks?",
    "Liquidity. On BSC, only bStocks have real pool depth today. Ondo and xStocks tokens exist on BSC but their pools are too thin to trade safely, so Elitr tracks them without trading them.",
  ],
  [
    "Who holds the keys?",
    "The Execution agent signs with its own dedicated hot wallet, locally. Binance's Trading and Transaction APIs never see a private key. Fund it with small amounts only.",
  ],
  [
    "What is ERC-8004?",
    "A standard for on-chain agent identity and reputation. Each Elitr agent gets an ERC-8004 identity on BSC, and the trader posts every analyst's accuracy to the reputation registry, so any other agent can read an analyst's record before buying from it. Elitr's agents are registered on BSC mainnet (#365554 news analyst, #365555 flow analyst, #365556 trader, plus #367734, the BNB Agent Studio desk-brief agent), and the trader has been posting ratings since 7 Oct 2026.",
  ],
  [
    "Can I check the agents myself?",
    <>
      Yes. Each analyst publishes its price, symbols and horizon at <code className={l.inlineCode}>GET /info</code>, and every agent serves its ERC-8004
      registration file at <code className={l.inlineCode}>/.well-known/agent-registration.json</code>. Every event the agents emit is on the dashboard
      timeline with its raw JSON, and payments and trades link to BscScan.
    </>,
  ],
  [
    "Is this financial advice?",
    "No. Elitr is an experimental hackathon project. Tokenized stocks carry issuer, liquidity and regulatory risk, and are not available to US persons or in several other regions.",
  ],
];

/* ---------- building blocks ---------- */

type Title = { lead: string; muted?: string; accent: string; tail?: string };

function Heading({ title, as: Tag = "h2", className }: { title: Title; as?: "h1" | "h2"; className?: string }) {
  return (
    <div {...reveal("rise", 0, l.mask)}>
      <Tag className={className ?? l.h2}>
        {title.lead}
        {title.muted ? <span className={l.hMuted}>{title.muted}</span> : null}
        <Accent>{title.accent}</Accent>
        {title.tail}
      </Tag>
    </div>
  );
}

function Eyebrow({ idx, label }: { idx: string; label: string }) {
  return (
    <div {...reveal("wipe", 0, l.eyebrow)}>
      <span className={l.eyebrowMark} aria-hidden="true" />
      <span className={l.eyebrowIdx}>{idx}</span>
      <span className={l.eyebrowRule} aria-hidden="true" />
      {label}
    </div>
  );
}

function Head({ idx, eyebrow, title, intro }: { idx: string; eyebrow: string; title: Title; intro?: ReactNode }) {
  return (
    <header className={l.head}>
      <div>
        <Eyebrow idx={idx} label={eyebrow} />
        <Heading title={title} />
      </div>
      {intro ? <p {...reveal("fade", 0.15, l.intro)}>{intro}</p> : null}
    </header>
  );
}

function Section({ id, dark, children, label }: { id: string; dark?: boolean; children: ReactNode; label?: string }) {
  return (
    <section id={id} className={cx(l.section, dark && l.dark)} aria-label={label}>
      {children}
    </section>
  );
}

const stagger = (i: number, step = 0.07) => Math.min(i * step, 0.5);

/* ---------- page ---------- */

export function Sections() {
  return (
    <div className={l.root}>
      {/* Overview */}
      <Section id="overview" label="Overview">
        <div {...reveal("wipe", 0, l.badge)}>
          <span className={l.badgeMark} aria-hidden="true" />
          Built for BNB Hack: Tokenized Stocks Edition
        </div>
        <Heading
          as="h2"
          className={l.h1}
          title={{ lead: "Two analysts compete to sell the idea. ", muted: "One trader ", accent: "picks who to trust." }}
        />
        <p {...reveal("fade", 0.12, l.lead)}>
          Elitr is an agent-to-agent trading desk on BNB Chain. A news analyst and an on-chain flow analyst sell signals over b402 payments. The
          Execution agent chooses between them by track record, checks each idea against live prices and 14 hard risk rules, dry-runs every
          transaction, and manages a small NVDAB + TSLAB portfolio with take-profit and stop-loss exits.
        </p>
        <FlowDiagram />
        <dl className={l.stats}>
          {STATS.map(([v, label], i) => (
            <div key={label} {...reveal("wipe", stagger(i), l.stat)}>
              <dt className={l.statLabel} style={{ order: 2 }}>
                {label}
              </dt>
              <dd className={l.statValue}>{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* On-chain proof */}
      <Section id="proof">
        <Head
          idx="LIVE"
          eyebrow="On-chain proof"
          title={{ lead: "Not a mock-up. ", muted: "Real agents, ", accent: "real transactions." }}
          intro="Elitr runs live on BSC mainnet. Every row below is a transaction the system made itself — open any of them on BscScan."
        />
        <div {...reveal("fade", 0, l.scrollX)}>
          <table className={cx(l.table, l.proofTable)}>
            <thead>
              <tr>
                <th scope="col">What happened</th>
                <th scope="col">Details</th>
                <th scope="col">Transaction</th>
              </tr>
            </thead>
            <tbody>
              {PROOF.map(([what, detail, hash]) => (
                <tr key={hash}>
                  <td>{what}</td>
                  <td>{detail}</td>
                  <td>
                    <a className={l.proofLink} href={`${TX}${hash}`} target="_blank" rel="noreferrer">
                      {hash.slice(0, 10)}…{hash.slice(-4)} ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Problem */}
      <Section id="problem">
        <Head
          idx="01"
          eyebrow="The problem"
          title={{ lead: "AI trading agents are opaque, can't pay for what they use, and aren't safe to hand ", accent: "a wallet." }}
          intro="Tokenized stocks bring US equities on-chain around the clock. That's a great playground for autonomous agents, and a dangerous one."
        />
        <div className={cx(l.cells, l.cols4)}>
          {PROBLEMS.map((p, i) => (
            <article key={p.title} {...reveal("wipe", stagger(i), l.cell)}>
              <div className={l.cellIdx}>
                <span>0{i + 1}</span>
                <span className={cx(l.square, l.squareOutline)} aria-hidden="true" />
              </div>
              <h3 className={l.h3}>{p.title}</h3>
              <p className={l.body}>{p.body}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* Solution */}
      <Section id="solution">
        <Head
          idx="02"
          eyebrow="What Elitr solves"
          title={{ lead: "Split the job between agents, make them pay each other, keep score, and make every step ", accent: "visible." }}
        />
        <div className={cx(l.cells, l.cols3)}>
          {SOLUTIONS.map((c, i) => (
            <article key={c.title} {...reveal("wipe", stagger(i), l.cell)}>
              <div className={l.cellIdx}>
                <span className={l.square} aria-hidden="true" />
              </div>
              <h3 className={l.h3}>{c.title}</h3>
              <p className={l.body}>{c.body}</p>
            </article>
          ))}
        </div>

        <div className={l.subhead}>The three agents</div>
        <div className={cx(l.cells, l.cols3)}>
          {AGENTS.map((a, i) => (
            <article key={a.title} {...reveal("wipe", stagger(i), cx(l.cell, a.key && l.agentKey))}>
              <div className={l.agentRole}>
                <span className={cx(l.square, a.marker)} aria-hidden="true" />
                {a.role}
              </div>
              <h3 className={l.h3}>{a.title}</h3>
              <p className={l.body}>{a.body}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section id="how">
        <Head
          idx="03"
          eyebrow="How it works"
          title={{ lead: "One cycle, eight steps, for each stock, ", accent: "every 15 minutes." }}
          intro="Each step emits an event you can watch live on the dashboard. Nothing is simulated for display: if data is missing, the agent says so and holds."
        />
        <ol className={cx(l.cells, l.cols4)}>
          {STEPS.map((s, i) => (
            <li key={s.n} {...reveal("wipe", stagger(i % 4), cx(l.cell, l.stepCell))}>
              <div className={l.cellIdx}>
                <span className={l.stepNum}>{s.n}</span>
                <span className={l.tag}>{s.api}</span>
              </div>
              <h3 className={l.h3}>{s.title}</h3>
              <p className={l.body}>{s.body}</p>
            </li>
          ))}
        </ol>

        <div className={l.subhead}>How agents pay each other</div>
        <div className={l.split}>
          <div {...reveal("fade", 0)}>
            <h3 className={l.h3}>b402: the price travels with the response.</h3>
            <p className={l.body} style={{ marginTop: 12, maxWidth: 560 }}>
              b402 is Binance&apos;s facilitator for x402, which turns HTTP&apos;s long-unused <code className={l.inlineCode}>402 Payment Required</code>{" "}
              status into a real payment step. No accounts, no invoices: the price travels with the response.
            </p>
            <ol className={l.numList}>
              {B402_STEPS.map((t, i) => (
                <li key={t}>
                  <span>0{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </div>
          <div {...reveal("wipe", 0.1, l.codeWrap)}>
            <div className={l.codeBar}>b402 · HTTP exchange</div>
            <pre className={l.code}>
              <span className={l.cDim}>{"# Execution → Analyst\n"}</span>
              <span className={l.cFg}>GET /signal?symbol=NVDAB</span>
              {"\n\n"}
              <span className={l.cDim}>{"# Analyst → Execution\n"}</span>
              <span className={l.cWarn}>HTTP/1.1 402 Payment Required</span>
              {"\nPAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6Mi…\n\n"}
              {`{ "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:56",
    "amount": "10000000000000000",
    "asset": "0x55d3…7955",   `}
              <span className={l.cDim}>{"// USDT\n"}</span>
              {`    "payTo": "0x…" }] }

`}
              <span className={l.cDim}>{"# Retry with PAYMENT-SIGNATURE → 200 OK\n"}</span>
              <span className={l.cPos}>{`{ "symbol": "NVDAB", "score": 72, "stance": "bullish", … }`}</span>
            </pre>
          </div>
        </div>
      </Section>

      {/* Analyst market */}
      <Section id="market">
        <Head
          idx="04"
          eyebrow="Analyst market"
          title={{ lead: "Analysts earn trust by being right. ", muted: "The trader pays for track records, ", accent: "not promises." }}
          intro="Every signal the trader buys is scored when its horizon ends: was the call right, and by how many basis points? That record decides who gets paid next."
        />
        <div className={cx(l.cells, l.cols3)}>
          {MARKET.map(([t, b], i) => (
            <article key={t} {...reveal("wipe", stagger(i), l.cell)}>
              <div className={l.cellIdx}>
                <span>0{i + 1}</span>
              </div>
              <h3 className={l.h3}>{t}</h3>
              <p className={l.body}>{b}</p>
            </article>
          ))}
        </div>
        <div {...reveal("wipe", 0.1, l.callout)}>
          <span className={l.calloutTag}>Live on BSC</span>
          <p>
            <strong>Agents rating agents, on-chain.</strong> Each agent gets an ERC-8004 identity on BSC, and after every scored call the trader posts the
            analyst&apos;s accuracy to the ERC-8004 reputation registry, where any other agent can check it before paying. Elitr&apos;s agents are
            registered on BSC mainnet as <strong>#365554</strong> (news analyst), <strong>#365555</strong> (flow analyst), <strong>#365556</strong>{" "}
            (trader) and <strong>#367734</strong> (the Agent Studio desk-brief agent), and the trader posts a rating after every scored call. Every identity and rating links to BscScan from the dashboard.
          </p>
        </div>
      </Section>

      {/* Safety (dark band) */}
      <Section id="safety" dark>
        <Head
          idx="05"
          eyebrow="Safety"
          title={{ lead: "Fourteen rules stand between a signal and ", accent: "a buy." }}
          intro="All 14 are checked before every buy, and six before every sell, each shown on the dashboard with the observed value next to the limit. The defaults below are deliberately small, and the operator can tighten or loosen them."
        />
        <div className={l.safetyGrid}>
          <div {...reveal("fade", 0)}>
            <table className={l.table}>
              <thead>
                <tr>
                  <th scope="col">Rule</th>
                  <th scope="col">Default limit</th>
                </tr>
              </thead>
              <tbody>
                {CHECKS.map(([rule, limit], i) => (
                  <tr key={rule}>
                    <td>
                      <span className={l.ruleIdx}>{String(i + 1).padStart(2, "0")}</span>
                      {rule}
                    </td>
                    <td className={l.limit}>{limit}</td>
                  </tr>
                ))}
                <tr className={l.tableGroup}>
                  <td colSpan={2}>Exits and analyst limits</td>
                </tr>
                {EXITS.map(([rule, limit]) => (
                  <tr key={rule}>
                    <td>
                      <span className={l.ruleIdx}>—</span>
                      {rule}
                    </td>
                    <td className={l.limit}>{limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className={l.guards}>
            {GUARDS.map(([t, b], i) => (
              <li key={t} {...reveal("wipe", stagger(i, 0.05), l.guard)}>
                <span className={l.square} aria-hidden="true" />
                <div>
                  <div className={l.guardTitle}>{t}</div>
                  <p>{b}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Assets */}
      <Section id="assets">
        <Head
          idx="06"
          eyebrow="Assets"
          title={{ lead: "Why Elitr trades ", accent: "NVDAB and TSLAB." }}
          intro="Tokenized stocks from bStocks, Ondo and xStocks are all deployed on BSC, but only bStocks have the pool depth to trade safely. We checked on-chain before choosing."
        />
        <div {...reveal("fade", 0, l.scrollX)}>
          <table className={cx(l.table, l.assetTable)}>
            <thead>
              <tr>
                <th scope="col">Platform</th>
                <th scope="col">Token</th>
                <th scope="col">Best DEX liquidity on BSC</th>
                <th scope="col">In Elitr</th>
              </tr>
            </thead>
            <tbody>
              {LIQUIDITY.map(([p, t, liq, status]) => (
                <tr key={t}>
                  <td>{p}</td>
                  <td>
                    <span className={l.token}>{t}</span>
                  </td>
                  <td>{liq}</td>
                  <td>
                    <span className={status === "Traded" ? l.statusTraded : l.statusTracked}>{status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={l.note}>Snapshot of 4 Oct 2026 from DexScreener and on-chain pool balances. Liquidity changes constantly.</p>
      </Section>

      {/* Stack */}
      <Section id="stack">
        <Head idx="07" eyebrow="Built on" title={{ lead: "Binance Web3 API end to end, plus ", accent: "BNB Chain and Claude." }} />
        <div className={cx(l.cells, l.cols4)}>
          {STACK.map(([t, b], i) => (
            <div key={t} {...reveal("wipe", stagger(i % 4), cx(l.cell, l.stackCell))}>
              <div className={l.stackTitle}>{t}</div>
              <p className={l.small}>{b}</p>
            </div>
          ))}
          <Link href="/dashboard" {...reveal("wipe", stagger(3), cx(l.cell, l.stackCell, l.stackCta))}>
            <span className={l.stackTitle}>See it running</span>
            <Arrow />
          </Link>
        </div>
      </Section>

      {/* Guide */}
      <Section id="guide">
        <Head
          idx="08"
          eyebrow="New here?"
          title={{ lead: "How to read ", accent: "the dashboard." }}
          intro="The dashboard is a live window into all three agents. Everything on it comes from real events: if an agent is offline or a cycle hasn't run, the panel says so."
        />
        <div className={cx(l.cells, l.cols2, l.panels)}>
          {PANELS.map(([t, b], i) => (
            <div key={t} {...reveal("wipe", stagger(i % 2), l.cell)}>
              <div className={l.cellIdx} style={{ marginBottom: 18 }}>
                <span>{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className={l.h3}>{t}</h3>
              <p className={l.body}>{b}</p>
            </div>
          ))}
        </div>

        <div className={l.split} style={{ marginTop: "clamp(56px, 6vw, 88px)" }}>
          <div {...reveal("fade", 0)}>
            <h3 className={l.h3} style={{ marginBottom: 18 }}>
              Badges at a glance
            </h3>
            <ul className={l.badgeList}>
              {BADGES.map(([name, cls, text]) => (
                <li key={name}>
                  <span className={cx(l.pill, cls)}>{name}</span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div {...reveal("fade", 0.1)}>
            <h3 className={l.h3} style={{ marginBottom: 18 }}>
              Run it yourself
            </h3>
            <div className={l.codeWrap}>
              <div className={l.codeBar}>Terminal</div>
              <pre className={l.code}>
                <span className={l.cFg}>{"pnpm install\ncp .env.example .env   "}</span>
                <span className={l.cDim}># add your keys</span>
                <span className={l.cFg}>{"\npnpm build\npnpm dev               "}</span>
                <span className={l.cDim}># agents :4001-4003, dashboard :3000</span>
                {"\n\n"}
                <span className={l.cDim}># or everything in containers</span>
                <span className={l.cFg}>{"\ndocker compose up"}</span>
              </pre>
            </div>
            <p className={l.runNote}>
              Needs a Binance Web3 API key with b402 enabled, a Claude key (0G Compute or Anthropic), and a fresh BSC wallet with a little USDT and BNB.
              Run the one-time approval script so swaps can be simulated. Starts in paper mode.
            </p>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq">
        <div className={l.faqGrid}>
          <div className={l.faqHead}>
            <Head idx="09" eyebrow="FAQ" title={{ lead: "Questions people ", accent: "ask first." }} />
          </div>
          <div className={l.faqList}>
            {FAQ.map(([q, a], i) => (
              <details key={q} {...reveal("fade", stagger(i, 0.03), l.faqItem)}>
                <summary>
                  {q}
                  <span className={l.faqIcon} aria-hidden="true" />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className={l.cta} aria-label="Open the dashboard">
        <div className={l.ctaBg} aria-hidden="true">
          <picture>
            <source media="(max-width: 820px)" srcSet="/hero-mobile.jpg" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero.jpg" srcSet="/hero-sm.jpg 900w, /hero.jpg 1672w" sizes="100vw" alt="" loading="lazy" decoding="async" />
          </picture>
        </div>
        <div {...reveal("wipe", 0, l.ctaPanel)}>
          <Heading title={{ lead: "Watch the agents ", accent: "work." }} />
          <p className={l.ctaText}>Analyst picks, payments, signals, risk decisions, fills and P&amp;L, live as they happen.</p>
          <div className={l.actions}>
            <DashboardButton>Open live dashboard</DashboardButton>
            <a href="#how" className={cx(l.btn, l.btnGhost)}>
              <span className={l.btnLabel}>See How It Works</span>
            </a>
          </div>
        </div>
      </section>

      <footer className={l.footer}>
        <span className={l.footBrand}>
          <Mark />
          <span>
            <b>
              Elitr<span className={l.dot}>.</span>
            </b>{" "}
            An experimental entry for BNB Hack: Tokenized Stocks Edition.
          </span>
        </span>
        <span>Not financial advice. Tokenized stocks are not available to US persons or in other restricted regions.</span>
      </footer>
    </div>
  );
}
