"use client";
// "Today on the desk": the execution agent's deterministic, plain-English account of the UTC day
// (GET /summary/today), written for people who have never used crypto.
import { useAgentJson } from "@/lib/useAgentJson";
import { ago } from "@/lib/format";
import type { TodaySummary } from "@/lib/gaps";
import { ModeTag } from "./ui";

const GLOSSARY: { term: string; text: string }[] = [
  { term: "Tokenized stock", text: "A digital token on a blockchain that tracks one share of a real company, like Nvidia. NVDAB and TSLAB are issued by bStocks; they trade around the clock, even when Wall Street is closed." },
  { term: "Analyst (agent)", text: "A separate AI program that sells trading tips. One reads the news, the other watches on-chain trading. Our trader pays for a tip, then checks later whether the tip was right - that becomes the analyst's track record." },
  { term: "b402", text: "Binance's way for one program to pay another per request: the analyst answers \"payment required\", our trader pays about one cent in USDT, and the tip is delivered. Each payment is a real blockchain transaction you can look up." },
  { term: "USDT and BNB", text: "USDT is a digital dollar (1 USDT ≈ $1) used to pay for tips and stocks. BNB pays the small network fee every BNB Chain transaction needs." },
  { term: "Simulation (test-run)", text: "Before any trade is sent, Binance's Transaction API runs it on a copy of the blockchain to make sure it would succeed. If the test-run fails, nothing is sent." },
  { term: "Paper vs live", text: "Paper: everything is real (prices, quotes, test-runs) except the final step - the trade is only recorded, no money moves. Live: the trade is actually sent and real money moves, within strict limits." },
  { term: "bps (basis points)", text: "One hundredth of a percent. 50 bps = 0.5%. Used for small price differences." },
];

export function TodayCard() {
  const { data, status, error } = useAgentJson<TodaySummary>("/summary/today", 30_000, 20_000);

  let body;
  if (data) {
    body = (
      <>
        <p className="px-4 pt-4 text-[15px] leading-relaxed text-fg sm:px-5 sm:text-[16px]">{data.paragraph}</p>
        {data.facts.length ? (
          <dl className="mt-4 mr-[-1px] grid border-t border-line sm:grid-cols-2 xl:grid-cols-3">
            {data.facts.map((f) => (
              <div key={f.id} className="min-w-0 border-r border-b border-line px-4 py-3 sm:px-5">
                <dt className="text-[10px] font-semibold tracking-[0.16em] text-faint uppercase">{f.label}</dt>
                <dd className="mt-1 text-[13px] leading-snug text-fg">
                  {f.text}
                  {f.links?.length ? (
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {f.links.map((l) => (
                        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="font-mono text-[12px] text-info hover:underline">
                          {l.label}
                        </a>
                      ))}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </>
    );
  } else if (status === "unsupported") {
    body = <p className="px-4 py-4 text-[13px] text-dim sm:px-5">Not available on this agent version - the execution agent has no GET /summary/today yet. Rebuild and restart it to see the daily summary.</p>;
  } else if (status === "offline" || status === "error") {
    body = <p className="px-4 py-4 text-[13px] text-dim sm:px-5">The execution agent is unreachable, so there is no summary to show{error ? ` (${error})` : ""}.</p>;
  } else {
    body = <p className="px-4 py-4 text-[13px] text-dim sm:px-5">Reading today&apos;s events…</p>;
  }

  return (
    <section aria-labelledby="today-title" className="border border-line border-t-2 border-t-accent bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <h2 id="today-title" className="text-[11px] font-semibold tracking-[0.14em] text-fg uppercase">
            Today on the desk
          </h2>
          {data ? <ModeTag mode={data.mode} /> : null}
        </div>
        <span suppressHydrationWarning className="text-[12px] text-faint">
          {data ? `${data.day} UTC · written from logged events, no AI · ${ago(data.generatedAt, Date.now())}` : ""}
          {data && status !== "ok" ? <span className="ml-2 text-neg">stale</span> : null}
        </span>
      </header>
      <div className={data?.facts.length ? "-mb-px" : "pb-4"}>{body}</div>
      <details className="group border-t border-line">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-4 text-[13px] font-medium text-fg hover:bg-panel-2 sm:px-5 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="inline-block w-3 text-gold transition-transform group-open:rotate-90">
            ›
          </span>
          What do these words mean?
        </summary>
        <dl className="grid gap-x-8 gap-y-3 px-4 pt-1 pb-4 sm:grid-cols-2 sm:px-5">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="min-w-0">
              <dt className="text-[13px] font-semibold text-fg">{g.term}</dt>
              <dd className="mt-0.5 text-[13px] leading-relaxed text-dim">{g.text}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
