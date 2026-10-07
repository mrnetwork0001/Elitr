"use client";
// Agent wallet as seen by the Binance Wallet API (balances, transactions) and Address Portfolio,
// next to the agent's own BSC RPC reads, so every number says where it came from.
import type { ReactNode } from "react";
import type { ExecState, StateStatus } from "@/lib/useExecutionState";
import { BSCSCAN_ADDRESS, BSCSCAN_TX } from "@/lib/config";
import { ago, num, shortAddr, shortHash, usd } from "@/lib/format";
import { walletApiFields, type WalletApiFields } from "@/lib/gaps";
import { Empty } from "./ui";

function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 border border-line bg-panel">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-[11px] font-medium tracking-[0.12em] text-dim uppercase">{title}</h2>
        {aside ? <span className="min-w-0 truncate text-[12px] text-faint">{aside}</span> : null}
      </header>
      {children}
    </section>
  );
}

function ErrLine({ what, error }: { what: string; error: string }) {
  return (
    <p className="px-4 py-3 text-[12px] leading-relaxed text-neg">
      {what} failed: <span className="font-mono">{error}</span>
    </p>
  );
}

const KIND_TONE: Record<string, string> = {
  swap: "bg-accent text-ink",
  "b402 payment": "bg-ink text-white",
  approval: "border border-line-strong text-dim",
  transfer: "border border-line-strong text-dim",
  other: "border border-line text-faint",
};

const humanKey = (k: string) => k.replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

export function WalletApiCard({ state, status, now }: { state: ExecState | null; status: StateStatus; now: number }) {
  if (status === "offline" && !state)
    return (
      <Card title="Wallet · Binance Wallet API">
        <Empty tone="offline" title="Execution agent unreachable" hint="The Wallet API view is served by the execution agent's GET /state." />
      </Card>
    );
  const f = walletApiFields(state?.raw);
  if (f === "unsupported")
    return (
      <Card title="Wallet · Binance Wallet API">
        <Empty title="Not available on this agent version" hint="This execution agent build does not report walletApi / portfolio / walletTxs in GET /state. Rebuild and restart the agent to enable it." />
      </Card>
    );
  if (!f || f.walletApiStatus === "loading")
    return (
      <Card title="Wallet · Binance Wallet API">
        <Empty title="Asking the Binance Wallet API…" hint="Balances, recent transactions and the portfolio overview refresh every minute." />
      </Card>
    );
  return <Loaded f={f} state={state} now={now} />;
}

function Loaded({ f, state, now }: { f: WalletApiFields; state: ExecState | null; now: number }) {
  const w = f.walletApi;
  const rpc = state?.balances;
  const rpcOf = (sym: string): number | null => {
    const s = sym.toUpperCase();
    if (s === "BNB" || s === "WBNB") return rpc?.bnb ?? null;
    if (s === "USDT") return rpc?.usdt ?? null;
    const k = Object.keys(rpc?.tokens ?? {}).find((x) => x.toUpperCase() === s);
    return k ? (rpc?.tokens[k] ?? null) : null;
  };
  const addr = f.walletApiAddress;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Card
        title="Wallet · Binance Wallet API"
        aside={
          addr ? (
            <a href={BSCSCAN_ADDRESS(addr)} target="_blank" rel="noopener noreferrer" className="font-mono text-info hover:underline">
              {shortAddr(addr)}
            </a>
          ) : undefined
        }
      >
        {w?.error ? <ErrLine what="all-token-balances-by-address" error={w.error} /> : null}
        {w && !w.error ? (
          w.tokens.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-[13px]">
                <thead>
                  <tr className="text-[10px] tracking-[0.12em] text-dim uppercase">
                    <th className="px-4 py-2 text-left font-medium">Token</th>
                    <th className="px-3 py-2 text-right font-medium" title="Binance Wallet API">Balance (API)</th>
                    <th className="px-3 py-2 text-right font-medium" title="The agent's own eth_call / getBalance over BSC RPC">Balance (RPC)</th>
                    <th className="px-4 py-2 text-right font-medium" title="Binance Wallet API valuation">USD (API)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {w.tokens.map((t) => {
                    const r = rpcOf(t.symbol);
                    return (
                      <tr key={`${t.symbol}-${t.address ?? "native"}`}>
                        <td className="px-4 py-2">
                          <span className="font-mono font-semibold">{t.symbol}</span>
                          {t.risky ? <span className="ml-2 text-[10px] font-bold tracking-[0.1em] text-neg uppercase">risk</span> : null}
                        </td>
                        <td className="num px-3 py-2 text-right">{num(t.balance, 6)}</td>
                        <td className="num px-3 py-2 text-right text-dim">{r != null ? num(r, 6) : <span className="text-faint">—</span>}</td>
                        <td className="num px-4 py-2 text-right">{t.usd != null ? usd(t.usd) : <span className="text-faint">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line-strong">
                    <td className="px-4 py-2 text-[11px] tracking-[0.12em] text-dim uppercase" colSpan={3}>
                      Total (Wallet API)
                    </td>
                    <td className="num px-4 py-2 text-right font-semibold">{w.totalUsd != null ? usd(w.totalUsd) : "—"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="px-4 py-4 text-[13px] text-dim">The Wallet API reports no token balances for this address.</p>
          )
        ) : null}
        <p suppressHydrationWarning className="border-t border-line px-4 py-2.5 text-[12px] leading-relaxed text-faint">
          API columns: Binance Wallet API <span className="font-mono">all-token-balances-by-address</span>
          {w ? ` · ${now ? ago(w.fetchedAt, now) : ""}` : ""}. RPC column: the agent&apos;s own BSC reads, which the risk engine uses.
          {f.walletApiAddress && !state?.wallet ? " Read-only address (no signing key on this agent)." : ""}
        </p>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        <Card title="Recent on-chain transactions" aside={f.walletTxs ? `Wallet API · ${now ? ago(f.walletTxs.fetchedAt, now) : ""}` : undefined}>
          {f.walletTxs?.error ? <ErrLine what="transactions-by-address" error={f.walletTxs.error} /> : null}
          {f.walletTxs && !f.walletTxs.error ? (
            f.walletTxs.items.length ? (
              <ol className="divide-y divide-line">
                {f.walletTxs.items.map((t) => (
                  <li key={t.txHash} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3 px-4 py-2 text-[13px]">
                    <span className={`inline-flex h-5 items-center px-1.5 text-[9px] font-bold tracking-[0.1em] whitespace-nowrap uppercase ${KIND_TONE[t.kind] ?? KIND_TONE.other}`}>{t.kind}</span>
                    <span className="min-w-0 truncate">
                      {t.label}
                      {t.amount != null && t.symbol ? (
                        <span className="num ml-2 text-dim">
                          {t.direction === "out" ? "−" : t.direction === "in" ? "+" : ""}
                          {num(t.amount, 6)} {t.symbol}
                        </span>
                      ) : null}
                      {t.status && !/^(success|1|ok)$/i.test(t.status) ? <span className="ml-2 text-neg">{t.status}</span> : null}
                    </span>
                    <span suppressHydrationWarning className="flex items-baseline gap-3 text-[12px]">
                      <span className="text-faint">{t.time && now ? ago(t.time, now) : ""}</span>
                      <a href={BSCSCAN_TX(t.txHash)} target="_blank" rel="noopener noreferrer" className="font-mono text-info hover:underline">
                        {shortHash(t.txHash)}
                      </a>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-4 py-4 text-[13px] text-dim">No transactions in the last 6 months for this address.</p>
            )
          ) : null}
          <p className="border-t border-line px-4 py-2.5 text-[12px] text-faint">Swaps and b402 payments are labelled from the agent&apos;s own records; everything else uses the API&apos;s fields.</p>
        </Card>

        <Card title="Address portfolio" aside={f.portfolio ? `Binance Address Portfolio · ${now ? ago(f.portfolio.fetchedAt, now) : ""}` : undefined}>
          {f.portfolio?.error ? <ErrLine what="portfolio/overview" error={f.portfolio.error} /> : null}
          {f.portfolio && !f.portfolio.error ? (
            f.portfolio.overview.length ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-3">
                {f.portfolio.overview.map((o) => (
                  <div key={o.key} className="min-w-0">
                    <dt className="truncate text-[10px] font-semibold tracking-[0.12em] text-faint uppercase" title={o.key}>
                      {humanKey(o.key)}
                    </dt>
                    <dd className="num mt-0.5 truncate text-[14px]">{typeof o.value === "number" ? num(o.value, 4) : o.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="px-4 py-4 text-[13px] text-dim">The portfolio overview returned no figures for this address yet.</p>
            )
          ) : null}
        </Card>
      </div>
    </div>
  );
}
