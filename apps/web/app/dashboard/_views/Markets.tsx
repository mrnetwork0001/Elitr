"use client";
import Link from "next/link";
import { useDashboard } from "@/lib/dashboard";
import { BSCSCAN_ADDRESS } from "@/lib/config";
import { forSymbol, latest } from "@/lib/derive";
import { ago, price, shortAddr } from "@/lib/format";
import { SignalCard } from "@/components/SignalCard";
import { PriceCard } from "@/components/PriceCard";
import { RiskPanel } from "@/components/RiskPanel";
import { AssetTabs } from "@/components/ui";
import { IconArrowRight } from "@/components/NavIcons";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold tracking-[0.16em] text-faint uppercase">{label}</dt>
      <dd className="num mt-1 truncate text-[14px] text-fg">{children}</dd>
    </div>
  );
}

export function MarketsView() {
  const d = useDashboard();
  const sym = d.asset;
  const row = d.state?.assets.find((a) => a.symbol === sym);
  const mark = d.state?.marks?.[sym];
  const evs = forSymbol(d.events, sym);
  const decision = latest(evs, "decision");
  const risk = latest(evs, "risk.evaluated");
  const execution = d.conn.execution?.status ?? "offline";

  return (
    <section aria-label={`${sym} market view`} className="flex flex-col gap-4">
      <div className="border border-line bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <h2 className="font-mono text-[22px] font-semibold tracking-tight text-fg">{sym}</h2>
            <span className="truncate text-[13px] text-dim">
              {row?.underlying ? `tokenized ${row.underlying}` : "tokenized stock"}
              {row?.platform ? ` · ${row.platform}` : ""}
            </span>
          </div>
          <AssetTabs assets={d.assets} value={sym} onChange={d.setAsset} label="Select asset" />
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-4">
          <Field label="Mark (agent)">{mark !== undefined ? price(mark) : <span className="text-dim">not reported</span>}</Field>
          <Field label="Last decision">
            {decision ? (
              <>
                <span className={`font-semibold uppercase ${decision.action === "buy" ? "text-pos" : decision.action === "sell" ? "text-neg" : "text-fg"}`}>{decision.action}</span>
                <span suppressHydrationWarning className="ml-2 text-[12px] text-dim">
                  {d.now ? ago(decision.ts, d.now) : ""}
                </span>
              </>
            ) : (
              <span className="text-dim">none yet</span>
            )}
          </Field>
          <Field label="Risk">
            {risk ? (
              <span className={`font-semibold uppercase ${risk.passed ? "text-fg" : "text-neg"}`}>{risk.passed ? "Pass" : "Blocked"}</span>
            ) : (
              <span className="text-dim">not evaluated</span>
            )}
          </Field>
          <Field label="Contract">
            {row?.address ? (
              <a href={BSCSCAN_ADDRESS(row.address)} target="_blank" rel="noopener noreferrer" className="font-mono text-[13px] text-info underline-offset-2 hover:underline" title={row.address}>
                {shortAddr(row.address)}
              </a>
            ) : (
              <span className="text-dim">not reported</span>
            )}
          </Field>
        </dl>
      </div>

      <Link href="/dashboard/gaps" className="group flex items-center justify-between gap-3 border border-line bg-panel px-4 py-3 transition-colors hover:border-line-strong">
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold tracking-[0.16em] text-gold uppercase">Weekend gap board</span>
          <span className="mt-0.5 block text-[13px] text-dim">Every bStocks and Ondo token on BSC: on-chain vs Binance reference vs Yahoo, market status and cross-issuer spreads.</span>
        </span>
        <IconArrowRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
      </Link>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <SignalCard events={d.events} symbol={sym} analystsOffline={d.analystsOffline} now={d.now} nameOf={d.nameOf} />
          <PriceCard events={d.events} symbol={sym} execution={execution} now={d.now} />
        </div>
        <RiskPanel events={d.events} symbol={sym} execution={execution} now={d.now} />
      </div>
    </section>
  );
}
