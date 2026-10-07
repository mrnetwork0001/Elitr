import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { FlowDiagram } from "@/components/landing/FlowDiagram";
import { IconCheck, IconShield } from "@/components/ui";
import { LogoMark } from "@/components/LogoMark";

export const metadata: Metadata = {
  title: "How Elitr works",
  description:
    "Three autonomous AI agents on BNB Chain: two analysts compete to sell signals over b402, a trader picks between them by track record, checks every idea against live prices and hard risk limits, then trades tokenized stocks on BSC.",
};

const NAV = [
  ["Problem", "#problem"],
  ["How it works", "#how"],
  ["Analyst market", "#market"],
  ["Safety", "#safety"],
  ["Guide", "#guide"],
  ["FAQ", "#faq"],
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

const STEPS: { n: string; title: string; body: string; api: string }[] = [
  { n: "01", title: "Pick an analyst", body: "Two analysts sell signals for each stock: one reads the news, one reads on-chain swap flow. The Execution agent draws a Thompson sample from each one's track record and buys from the highest draw. Analysts whose trust falls too low are paused.", api: "Analyst market" },
  { n: "02", title: "Buy the signal", body: "It asks the chosen analyst for a signal, gets an HTTP 402 price tag, signs a USDT payment and retries. The analyst checks the payment with Binance's b402 facilitator, and only settles once it has actually produced the signal. No signal, no charge.", api: "b402 payments" },
  { n: "03", title: "Get three prices", body: "The real stock price from Yahoo Finance, the Binance RWA Data reference price and market status, and the live on-chain token price — for NVDAB and TSLAB.", api: "RWA Data · Market API" },
  { n: "04", title: "Check exits first", body: "For a held position, the agent sells on take-profit, stop-loss, or a bearish signal before it considers buying more.", api: "Portfolio" },
  { n: "05", title: "Quote the trade", body: "Asks the aggregator for the best route. Only regular swap routes are accepted, because only those can be simulated.", api: "Trading API" },
  { n: "06", title: "Run the risk checks", body: "14 rules on a buy (portfolio cap included), 6 on a sell. Every rule is logged with its observed value and limit. One failure and the agent holds.", api: "Risk engine" },
  { n: "07", title: "Dry-run, then fill", body: "The swap is simulated first. In paper mode a passing simulation is booked at the real quoted amounts; in live mode the agent signs locally and broadcasts.", api: "Transaction API" },
  { n: "08", title: "Score the analyst", body: "When a signal's horizon ends (1 hour for news, 30 minutes for flow), the trader checks the pool price: was the call right, and by how many basis points? It updates that analyst's hit rate, trust and weight, and can post the rating on-chain to the ERC-8004 reputation registry.", api: "Reputation" },
];

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

const LIQUIDITY: [string, string, string, string][] = [
  ["bStocks", "NVDAB", "≈ $4.2M", "Traded"],
  ["bStocks", "TSLAB", "≈ $2.0M", "Traded"],
  ["Ondo", "NVDAon / TSLAon", "< $10k", "Tracked"],
  ["xStocks", "TSLAx", "≈ $23", "Tracked"],
];

const PANELS: [string, string][] = [
  ["Top bar", "Connection status of all three agents, the PAPER / LIVE badge, the kill switch, and operator controls (read-only for visitors)."],
  ["Agent-to-agent flow", "Every b402 payment from the trader to each analyst, with the BscScan settlement link and today's spend."],
  ["Analyst market", "Each analyst's price, hit rate, trust and weight, who was picked for each stock and why, and every scored call."],
  ["Portfolio & P&L", "Net P&L after signal costs and gas, positions per stock with take-profit and stop-loss levels. Paper fills are always labelled."],
  ["Signal · Prices · Risk", "Per stock: the latest signal and which analyst sold it, reference vs on-chain prices, and every risk rule from the last check."],
  ["Execution log", "Each attempt as a pipeline: simulated → broadcast → filled, buy or sell, with the exit reason and PAPER or LIVE."],
  ["Timeline", "Every event from all three agents, filterable, with raw JSON for anyone who wants to verify."],
];

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
    "A standard for on-chain agent identity and reputation. Each Elitr agent gets an ERC-8004 identity on BSC, and the trader posts every analyst's accuracy to the reputation registry, so any other agent can read an analyst's record before buying from it. The code is built and tested against the live BSC registries; Elitr's agents are being registered on mainnet now.",
  ],
  [
    "Can I check the agents myself?",
    "Yes. Each analyst publishes its price, symbols and horizon at GET /info, and every agent serves its ERC-8004 registration file at /.well-known/agent-registration.json. Every event the agents emit is on the dashboard timeline with its raw JSON, and payments and trades link to BscScan.",
  ],
  [
    "Is this financial advice?",
    "No. Elitr is an experimental hackathon project. Tokenized stocks carry issuer, liquidity and regulatory risk, and are not available to US persons or in several other regions.",
  ],
];

function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-xs font-medium tracking-wider text-accent uppercase">{eyebrow}</div>
        <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{title}</h2>
        {intro ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-dim sm:text-base">{intro}</p> : null}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

export default function Learn() {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <LogoMark className="h-[18px] w-auto text-accent" />
            Elitr<span className="text-accent">.</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-dim md:flex">
            {NAV.map(([label, href]) => (
              <a key={href} href={href} className="hover:text-fg">
                {label}
              </a>
            ))}
          </nav>
          <Link
            href="/dashboard"
            className="ml-auto rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-bg hover:bg-accent/90"
          >
            Open dashboard
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 text-xs text-dim">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Built for BNB Hack: Tokenized Stocks Edition
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl leading-[1.08] font-semibold tracking-tight text-fg sm:text-6xl">
            Two analysts compete to sell the idea. One trader <span className="text-accent">picks who to trust.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-dim sm:text-lg">
            Elitr is an agent-to-agent trading desk on BNB Chain. A news analyst and an on-chain flow analyst sell signals over b402 payments. The
            Execution agent chooses between them by track record, checks each idea against live prices and 14 hard risk rules, dry-runs every
            transaction, and manages a small NVDAB + TSLAB portfolio with take-profit and stop-loss exits.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-bg hover:bg-accent/90">
              Open live dashboard
            </Link>
            <a href="#how" className="rounded-md border border-line-strong px-5 py-2.5 text-sm font-medium text-fg hover:border-dim">
              See how it works
            </a>
          </div>
          <div className="mt-12">
            <FlowDiagram />
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            {[
              ["3", "autonomous agents"],
              ["14", "risk checks before every buy"],
              ["100%", "of transactions dry-run first"],
              ["2", "tokenized stocks traded"],
            ].map(([v, l]) => (
              <div key={l} className="bg-panel px-4 py-4">
                <dt className="sr-only">{l}</dt>
                <dd className="num text-2xl font-semibold text-fg">{v}</dd>
                <dd className="mt-0.5 text-xs text-faint">{l}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Problem */}
        <Section
          id="problem"
          eyebrow="The problem"
          title="AI trading agents are opaque, can't pay for what they use, and aren't safe to hand a wallet."
          intro="Tokenized stocks bring US equities on-chain around the clock. That's a great playground for autonomous agents, and a dangerous one."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {PROBLEMS.map((p, i) => (
              <div key={p.title} className="rounded-xl border border-line bg-panel p-5">
                <div className="num font-mono text-xs text-faint">0{i + 1}</div>
                <h3 className="mt-2 text-base font-semibold text-fg">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-dim">{p.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Solution */}
        <Section
          id="solution"
          eyebrow="What Elitr solves"
          title="Split the job between agents, make them pay each other, keep score, and make every step visible."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {[
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
            ].map((c) => (
              <div key={c.title} className="rounded-xl border border-line bg-panel p-5">
                <div className="text-accent">
                  <IconCheck />
                </div>
                <h3 className="mt-3 text-base font-semibold text-fg">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-dim">{c.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-line bg-panel-2 p-5">
              <div className="text-[11px] font-medium tracking-wider text-faint uppercase">Agent A · seller</div>
              <h3 className="mt-1 text-lg font-semibold text-info">The News analyst</h3>
              <p className="mt-2 text-sm leading-relaxed text-dim">
                Reads the last 48 hours of Yahoo Finance and Google News headlines about the stock behind each token, and asks Claude for a 1–100
                confidence score that must cite the headlines behind it. Each call is meant to hold for an hour.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-panel-2 p-5">
              <div className="text-[11px] font-medium tracking-wider text-faint uppercase">Agent C · seller</div>
              <h3 className="mt-1 text-lg font-semibold text-flow">The Flow analyst</h3>
              <p className="mt-2 text-sm leading-relaxed text-dim">
                Reads what money is actually doing: every PancakeSwap v3 swap in the token&apos;s pool over the last hour. It scores buy-vs-sell volume,
                large-trade imbalance, buyer-vs-seller wallets and momentum. Deterministic, no LLM, and it refuses to sell a signal when there are too
                few swaps to say anything. Each call is meant to hold for 30 minutes.
              </p>
            </div>
            <div className="rounded-xl border border-accent/40 bg-panel-2 p-5">
              <div className="text-[11px] font-medium tracking-wider text-faint uppercase">Agent B · buyer</div>
              <h3 className="mt-1 text-lg font-semibold">The Execution agent</h3>
              <p className="mt-2 text-sm leading-relaxed text-dim">
                Holds the capital. Chooses which analyst to pay, scores every call it buys, compares real and on-chain prices, runs every risk rule,
                simulates each swap with Binance&apos;s Transaction API, and only then fills — on paper by default.
              </p>
            </div>
          </div>
        </Section>

        {/* How it works */}
        <Section
          id="how"
          eyebrow="How it works"
          title="One cycle, eight steps, for each stock, every 15 minutes."
          intro="Each step emits an event you can watch live on the dashboard. Nothing is simulated for display: if data is missing, the agent says so and holds."
        >
          <ol className="relative space-y-3">
            {STEPS.map((s) => (
              <li key={s.n} className="grid gap-3 rounded-xl border border-line bg-panel p-4 sm:grid-cols-[64px_1fr_auto] sm:items-start sm:p-5">
                <div className="num font-mono text-sm text-accent">{s.n}</div>
                <div>
                  <h3 className="text-base font-semibold text-fg">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-dim">{s.body}</p>
                </div>
                <span className="w-fit rounded-md border border-line-strong px-2 py-0.5 font-mono text-[11px] whitespace-nowrap text-dim">{s.api}</span>
              </li>
            ))}
          </ol>

          <div className="mt-10 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <div>
              <h3 className="text-lg font-semibold">How agents pay each other</h3>
              <p className="mt-2 text-sm leading-relaxed text-dim">
                b402 is Binance's facilitator for x402, which turns HTTP's long-unused <span className="font-mono text-fg">402 Payment Required</span>{" "}
                status into a real payment step. No accounts, no invoices: the price travels with the response.
              </p>
              <ol className="mt-4 space-y-2 text-sm text-dim">
                {[
                  "Execution requests /signal from the analyst it picked and gets 402 with the price, token and payee.",
                  "It signs a USDT payment authorisation with its wallet and retries.",
                  "The analyst checks it with the b402 facilitator, produces the signal, then settles. If it can't produce one, the payment is never taken.",
                  "The signal comes back with a settlement receipt, viewable on BscScan.",
                ].map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="num font-mono text-accent">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-line bg-panel p-4 font-mono text-[12px] leading-relaxed text-dim">
              <span className="text-faint">{"# Execution → Analyst\n"}</span>
              <span className="text-fg">GET /signal?symbol=NVDAB</span>
              {"\n\n"}
              <span className="text-faint">{"# Analyst → Execution\n"}</span>
              <span className="text-warn">HTTP/1.1 402 Payment Required</span>
              {"\nPAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6Mi…\n\n"}
              {`{ "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:56",
    "amount": "10000000000000000",
    "asset": "0x55d3…7955",   `}
              <span className="text-faint">{"// USDT\n"}</span>
              {`    "payTo": "0x…" }] }

`}
              <span className="text-faint">{"# Retry with PAYMENT-SIGNATURE → 200 OK\n"}</span>
              <span className="text-pos">{`{ "symbol": "NVDAB", "score": 72, "stance": "bullish", … }`}</span>
            </pre>
          </div>
        </Section>

        {/* Analyst market */}
        <Section
          id="market"
          eyebrow="Analyst market"
          title="Analysts earn trust by being right. The trader pays for track records, not promises."
          intro="Every signal the trader buys is scored when its horizon ends: was the call right, and by how many basis points? That record decides who gets paid next."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              ["Thompson sampling", "Each analyst's right/wrong record becomes a probability distribution. Every cycle the trader draws once from each and buys from the highest draw, so proven analysts win most purchases and newcomers still get tested."],
              ["Trust-weighted confidence", "Before the risk engine sees it, an analyst's score is pulled toward a neutral 50 by how little the trader trusts it. A 78 from an unproven analyst becomes 64 and fails the 65 minimum; a 72 from a proven one passes as 72."],
              ["Paused when wrong", "Below 0.45 trust after 10 scored calls, an analyst is paused: the trader stops paying it. Hit rate, average return and the pause line are all on the dashboard."],
            ].map(([t, b]) => (
              <div key={t} className="rounded-xl border border-line bg-panel p-5">
                <h3 className="text-base font-semibold text-fg">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-dim">{b}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3 rounded-xl border border-dashed border-line-strong bg-panel-2 p-5">
            <span className="mt-0.5 shrink-0 self-start rounded border border-info/40 bg-info/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap text-info uppercase">Built · registering</span>
            <p className="text-sm leading-relaxed text-dim">
              <span className="font-semibold text-fg">Agents rating agents, on-chain.</span> Each agent gets an ERC-8004 identity on BSC, and after every
              scored call the trader posts the analyst&apos;s accuracy to the ERC-8004 reputation registry, where any other agent can check it before
              paying. The integration is built and tested end to end against BSC mainnet&apos;s live registries; registering Elitr&apos;s agents on mainnet
              is the remaining step. The dashboard shows an identity and an on-chain rating only once they exist.
            </p>
          </div>
        </Section>

        {/* Safety */}
        <Section
          id="safety"
          eyebrow="Safety"
          title="Fourteen rules stand between a signal and a buy."
          intro="All 14 are checked before every buy, and six before every sell, each shown on the dashboard with the observed value next to the limit. The defaults below are deliberately small, and the operator can tighten or loosen them."
        >
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-panel-2 text-left text-xs text-faint">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Rule</th>
                    <th className="px-4 py-2.5 font-medium">Default limit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-panel">
                  {CHECKS.map(([rule, limit]) => (
                    <tr key={rule}>
                      <td className="px-4 py-2.5 text-fg">{rule}</td>
                      <td className="num px-4 py-2.5 text-dim">{limit}</td>
                    </tr>
                  ))}
                  <tr className="bg-panel-2">
                    <td colSpan={2} className="px-4 py-2 text-xs font-medium text-faint">Exits and analyst limits</td>
                  </tr>
                  {EXITS.map(([rule, limit]) => (
                    <tr key={rule}>
                      <td className="px-4 py-2.5 text-fg">{rule}</td>
                      <td className="num px-4 py-2.5 text-dim">{limit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-4">
              {[
                ["Paper by default", "Quotes and dry-runs are real and fills are booked at quoted amounts, but nothing is broadcast until live trading is explicitly switched on."],
                ["Portfolio cap and exits", "A cap on all positions combined, plus automatic take-profit and stop-loss sells, so a winning or losing position never just sits there."],
                ["Dry-run every transaction", "Approvals and swaps go through Binance's Transaction API first. If the simulation fails, the trade doesn't happen."],
                ["Swap routes only", "Off-chain RFQ orders can't be simulated, so Elitr refuses them, even when they quote better."],
                ["Keys stay local", "The agent signs on its own machine. No Binance API ever receives a private key."],
                ["Kill switch", "One operator click stops all new trades until the agent is restarted. Visitors get a read-only dashboard."],
              ].map(([t, b]) => (
                <div key={t} className="flex gap-3 rounded-xl border border-line bg-panel p-4">
                  <span className="mt-0.5 text-accent">
                    <IconShield />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-fg">{t}</div>
                    <p className="mt-1 text-sm leading-relaxed text-dim">{b}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Assets */}
        <Section
          id="assets"
          eyebrow="Assets"
          title="Why Elitr trades NVDAB and TSLAB."
          intro="Tokenized stocks from bStocks, Ondo and xStocks are all deployed on BSC, but only bStocks have the pool depth to trade safely. We checked on-chain before choosing."
        >
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-panel-2 text-left text-xs text-faint">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Platform</th>
                  <th className="px-4 py-2.5 font-medium">Token</th>
                  <th className="px-4 py-2.5 font-medium">Best DEX liquidity on BSC</th>
                  <th className="px-4 py-2.5 font-medium">In Elitr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-panel">
                {LIQUIDITY.map(([p, t, l, s]) => (
                  <tr key={t}>
                    <td className="px-4 py-2.5 text-dim">{p}</td>
                    <td className="px-4 py-2.5 font-mono text-fg">{t}</td>
                    <td className="num px-4 py-2.5 text-fg">{l}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          s === "Traded" ? "bg-accent/15 text-accent" : s === "Backup" ? "bg-info/15 text-info" : "bg-line text-dim"
                        }`}
                      >
                        {s}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-faint">
            Snapshot of 4 Oct 2026 from DexScreener and on-chain pool balances. Liquidity changes constantly.
          </p>
        </Section>

        {/* Stack */}
        <Section id="stack" eyebrow="Built on" title="Binance Web3 API end to end, plus BNB Chain and Claude.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[
              ["b402 Payments", "Agent-to-agent pay-per-signal"],
              ["RWA Data API", "Reference price and market status"],
              ["Market API", "Live on-chain token price"],
              ["Trading API", "Aggregated swap quotes and calldata"],
              ["Transaction API", "Simulation and broadcast"],
              ["BNB Smart Chain", "Mainnet settlement"],
              ["Claude via 0G Compute", "News scoring with citations"],
              ["PancakeSwap v3", "Swap flow and pool prices, read on-chain"],
              ["ERC-8004", "Agent identity and on-chain reputation"],
              ["Docker + CI", "One-command stack, tested on every push"],
              ["Next.js dashboard", "Live event stream from all three agents"],
            ].map(([t, b]) => (
              <div key={t} className="rounded-xl border border-line bg-panel p-4">
                <div className="text-sm font-semibold text-fg">{t}</div>
                <div className="mt-1 text-xs leading-relaxed text-dim">{b}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Guide */}
        <Section
          id="guide"
          eyebrow="New here?"
          title="How to read the dashboard."
          intro="The dashboard is a live window into all three agents. Everything on it comes from real events: if an agent is offline or a cycle hasn't run, the panel says so."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {PANELS.map(([t, b]) => (
              <div key={t} className="rounded-xl border border-line bg-panel p-4">
                <div className="text-sm font-semibold text-fg">{t}</div>
                <p className="mt-1 text-sm leading-relaxed text-dim">{b}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <div className="rounded-xl border border-line bg-panel-2 p-5">
              <h3 className="text-base font-semibold">Badges at a glance</h3>
              <ul className="mt-3 space-y-2.5 text-sm text-dim">
                <li className="flex items-center gap-3">
                  <span className="shrink-0 rounded border border-dashed border-info/70 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-info">PAPER</span>
                  Real data and dry-runs; fills booked, nothing broadcast.
                </li>
                <li className="flex items-center gap-3">
                  <span className="shrink-0 rounded bg-neg px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-white">LIVE</span>
                  The agent can sign and send trades.
                </li>
                <li className="flex items-center gap-3">
                  <span className="rounded bg-pos/15 px-1.5 py-0.5 text-[11px] font-semibold text-pos">PASS</span>
                  Every rule passed in the last check.
                </li>
                <li className="flex items-center gap-3">
                  <span className="rounded bg-neg/15 px-1.5 py-0.5 text-[11px] font-semibold text-neg">BLOCKED</span>
                  At least one rule failed; the agent held.
                </li>
                <li className="flex items-center gap-3">
                  <span className="shrink-0 rounded border border-neg/40 bg-neg/10 px-1.5 py-0.5 text-[11px] font-semibold text-neg">PAUSED</span>
                  An analyst&apos;s trust fell below the line; the trader stopped paying it.
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-line bg-panel-2 p-5">
              <h3 className="text-base font-semibold">Run it yourself</h3>
              <pre className="mt-3 overflow-x-auto font-mono text-[12px] leading-relaxed text-dim">
                {`pnpm install
cp .env.example .env   `}
                <span className="text-faint"># add your keys</span>
                {`
pnpm build
pnpm dev               `}
                <span className="text-faint"># agents :4001-4003, dashboard :3000</span>
                {`

`}
                <span className="text-faint"># or everything in containers</span>
                {`
docker compose up`}
              </pre>
              <p className="mt-3 text-xs leading-relaxed text-faint">
                Needs a Binance Web3 API key with b402 enabled, a Claude key (0G Compute or Anthropic), and a fresh BSC wallet with a little USDT and
                BNB. Run the one-time approval script so swaps can be simulated. Starts in paper mode.
              </p>
            </div>
          </div>
        </Section>

        {/* FAQ */}
        <Section id="faq" eyebrow="FAQ" title="Questions people ask first.">
          <div className="divide-y divide-line rounded-xl border border-line bg-panel">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-fg">
                  {q}
                  <span className="text-faint transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-dim">{a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* CTA */}
        <section className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Watch the agents work.</h2>
              <p className="mt-2 text-sm text-dim">Analyst picks, payments, signals, risk decisions, fills and P&amp;L, live as they happen.</p>
            </div>
            <Link href="/dashboard" className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-bg hover:bg-accent/90">
              Open live dashboard
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-faint sm:px-6 md:flex-row md:justify-between">
          <span>
            Elitr<span className="text-accent">.</span> An experimental entry for BNB Hack: Tokenized Stocks Edition.
          </span>
          <span>Not financial advice. Tokenized stocks are not available to US persons or in other restricted regions.</span>
        </div>
      </footer>
    </>
  );
}
