"use client";
import type { AgentEvent, AgentId, AnalystCandidate, AnalystId, AnalystInfo } from "@elitr/shared";
import type { AgentConn } from "@/lib/useAgentStream";
import type { ExecState, StateStatus } from "@/lib/useExecutionState";
import { identities, latestReputation, latestSelections, ofType, type EventOf } from "@/lib/derive";
import { ANALYST_IDS, ANALYST_KIND_FALLBACK, BSCSCAN_NFT, BSCSCAN_TX, KIND_LABEL, agentMeta } from "@/lib/config";
import { ago, bps, fromUnits, isAddress, isTxHash, payUsd, pct, price, shortHash, toNum } from "@/lib/format";
import { Badge, Empty, ExtLink, IconCheck, IconX, Panel } from "./ui";

export interface AnalystCardData {
  id: AnalystId;
  name: string;
  kind: string | null;
  description: string | null;
  online: boolean | null;
  priceUsd: number | null;
  samples: number | null;
  hits: number | null;
  hitRate: number | null;
  trust: number | null;
  weight: number | null;
  paused: boolean | null;
  avgReturnBps: number | null;
  erc8004AgentId: string | null;
  registry: string | null;
  identityTx: string | null;
}

const first = <T,>(...v: (T | null | undefined)[]): T | null => {
  for (const x of v) if (x !== null && x !== undefined) return x;
  return null;
};

/** Merge GET /state analysts, reputation.updated, identity.registered and GET /info into one row per analyst. */
export function analystCards(
  events: AgentEvent[],
  state: ExecState | null,
  info: Partial<Record<AnalystId, AnalystInfo>>,
  conn: Record<AgentId, AgentConn>,
): AnalystCardData[] {
  const rep = latestReputation(events);
  const ids = identities(events);
  const all = new Set<AnalystId>(ANALYST_IDS);
  for (const r of state?.analysts ?? []) all.add(r.analystId);
  for (const k of Object.keys(rep)) all.add(k as AnalystId);
  return [...all].map((id) => {
    const row = state?.analysts.find((r) => r.analystId === id);
    const r = rep[id];
    const inf = info[id];
    const ident = ids[id];
    const required = events.find((e): e is EventOf<"payment.required"> => e.type === "payment.required" && e.agent === id);
    const c = conn[id];
    return {
      id,
      name: first(row?.name, inf?.name, agentMeta(id)?.name) ?? id,
      kind: first<string>(inf?.kind, (ANALYST_KIND_FALLBACK as Record<string, string>)[id]),
      description: inf?.description ?? null,
      online: c ? (c.status === "live" ? true : c.status === "offline" ? (row?.online ?? false) : (row?.online ?? null)) : (row?.online ?? null),
      priceUsd: first(row?.priceUsd, inf?.priceUsd, required ? fromUnits(required.amount) : null),
      samples: first(row?.samples, r?.samples),
      hits: first(row?.hits, r?.hits),
      hitRate: first(row?.hitRate, r?.hitRate),
      trust: first(row?.trust, r?.trust),
      weight: first(row?.weight, r?.weight),
      paused: first(row?.paused, r?.paused),
      avgReturnBps: first(row?.avgReturnBps, r?.avgReturnBps),
      erc8004AgentId: first(row?.erc8004AgentId, inf?.erc8004AgentId, ident?.erc8004AgentId),
      registry: ident?.registry && isAddress(ident.registry) ? ident.registry : null,
      identityTx: ident?.txHash && isTxHash(ident.txHash) ? ident.txHash : null,
    };
  });
}

function TrustBar({ trust, threshold }: { trust: number | null; threshold: number | null }) {
  const t = trust !== null ? Math.max(0, Math.min(1, trust)) : null;
  const below = t !== null && threshold !== null && t < threshold;
  return (
    <div className="relative mt-1.5 h-2 rounded-full bg-line" role="meter" aria-label="Trust" aria-valuemin={0} aria-valuemax={1} aria-valuenow={t ?? undefined}>
      {t !== null ? <div className={`h-full rounded-full ${below ? "bg-neg/80" : "bg-fg/70"}`} style={{ width: `${Math.max(2, t * 100)}%` }} /> : null}
      {threshold !== null ? (
        <span
          className="absolute -top-1 h-4 w-0.5 rounded bg-accent"
          style={{ left: `calc(${Math.max(0, Math.min(1, threshold)) * 100}% - 1px)` }}
          title={`Paused below ${threshold.toFixed(2)}`}
        />
      ) : null}
    </div>
  );
}

function AnalystCard({ a, threshold, minSamples, selectedFor }: { a: AnalystCardData; threshold: number | null; minSamples: number | null; selectedFor: string[] }) {
  const meta = agentMeta(a.id);
  const scored = a.samples ?? 0;
  return (
    <article className={`min-w-0 rounded-lg border bg-panel-2 p-4 ${a.paused ? "border-neg/40" : selectedFor.length ? "border-line-strong" : "border-line"}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`size-1.5 shrink-0 rounded-full ${a.online === true ? "bg-pos" : a.online === false ? "bg-neg" : "bg-warn"}`}
              title={a.online === true ? "online" : a.online === false ? "offline" : "unknown"}
            />
            <h3 className={`truncate text-base font-semibold ${meta?.tone ?? "text-fg"}`}>{a.name}</h3>
          </div>
          <div className="mt-0.5 truncate text-xs text-faint">{a.kind ? (KIND_LABEL[a.kind] ?? a.kind) : "kind not reported"}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {a.paused ? (
            <Badge tone="neg" title="Trust fell below the pause threshold — the trader stopped buying from this analyst">
              Paused
            </Badge>
          ) : selectedFor.length ? (
            <Badge tone="accent">Picked · {selectedFor.join(", ")}</Badge>
          ) : null}
          <span className="num text-xs text-dim">
            <span className="text-fg">{payUsd(a.priceUsd)}</span> / signal
          </span>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <div className="text-[11px] tracking-wide text-faint uppercase">Hit rate</div>
          <div className="num mt-0.5 text-xl font-semibold text-fg">{a.hitRate !== null ? pct(a.hitRate) : "—"}</div>
          <div className="num truncate text-[11px] text-faint">{scored ? `over ${scored} signal${scored === 1 ? "" : "s"}` : "no scored calls yet"}</div>
        </div>
        <div className="min-w-0">
          <div className="text-[11px] tracking-wide text-faint uppercase">Avg return</div>
          <div className={`num mt-0.5 text-xl font-semibold ${a.avgReturnBps === null ? "text-fg" : a.avgReturnBps >= 0 ? "text-pos" : "text-neg"}`}>
            {a.avgReturnBps === null ? "—" : bps(a.avgReturnBps).replace(" bps", "")}
          </div>
          <div className="truncate text-[11px] text-faint">bps per call</div>
        </div>
        <div className="min-w-0">
          <div className="text-[11px] tracking-wide text-faint uppercase">Weight</div>
          <div className="num mt-0.5 text-xl font-semibold text-fg">{a.weight !== null ? `${a.weight.toFixed(2)}×` : "—"}</div>
          <div className="truncate text-[11px] text-faint">on its confidence</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2 text-[11px]">
          <span className="tracking-wide text-faint uppercase">Trust</span>
          <span className="num text-dim">
            <span className="text-fg">{a.trust !== null ? a.trust.toFixed(2) : "—"}</span>
            {threshold !== null ? (
              <span>
                {" "}
                · pause &lt; <span className="text-accent">{threshold.toFixed(2)}</span>
                {minSamples !== null ? ` after ${minSamples}` : ""}
              </span>
            ) : null}
          </span>
        </div>
        <TrustBar trust={a.trust} threshold={threshold} />
      </div>

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-[11px]">
        <span className="text-faint">ERC-8004 identity</span>
        {a.erc8004AgentId ? (
          a.registry ? (
            <ExtLink href={BSCSCAN_NFT(a.registry, a.erc8004AgentId)} className="font-mono" title={`Agent #${a.erc8004AgentId} in registry ${a.registry}`}>
              agent #{a.erc8004AgentId}
            </ExtLink>
          ) : a.identityTx ? (
            <ExtLink href={BSCSCAN_TX(a.identityTx)} className="font-mono">
              agent #{a.erc8004AgentId}
            </ExtLink>
          ) : (
            <span className="font-mono text-fg">agent #{a.erc8004AgentId}</span>
          )
        ) : (
          <span className="text-faint">not registered yet</span>
        )}
      </footer>
    </article>
  );
}

function Selection({ sel, nameOf, now }: { sel: EventOf<"analyst.selected">; nameOf: (id: string) => string; now: number }) {
  const cands = [...(sel.candidates ?? [])].sort((x, y) => (y.draw ?? -1) - (x.draw ?? -1));
  const hasDraws = cands.some((c) => typeof c.draw === "number");
  return (
    <div className="min-w-0 rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-baseline gap-2 text-sm">
          <span className="font-mono text-fg">{sel.symbol}</span>
          <span className="text-faint">→</span>
          {sel.analystId ? (
            <span className={`truncate font-semibold ${agentMeta(sel.analystId)?.tone ?? "text-fg"}`}>{nameOf(sel.analystId)}</span>
          ) : (
            <span className="text-warn">no analyst bought</span>
          )}
        </div>
        <span suppressHydrationWarning className="num text-[11px] text-faint">{now ? ago(sel.ts, now) : ""}</span>
      </div>
      {cands.length ? (
        <ul className="mt-3 space-y-2.5">
          {cands.map((c) => (
            <CandidateRow key={c.analystId} c={c} winner={c.analystId === sel.analystId} hasDraws={hasDraws} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-faint">No candidates reported.</p>
      )}
      {sel.reasons?.length ? (
        <ul className="mt-3 space-y-1 border-t border-line pt-2 text-xs text-dim">
          {sel.reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-faint">–</span>
              <span className="min-w-0 break-words">{r}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CandidateRow({ c, winner, hasDraws }: { c: AnalystCandidate; winner: boolean; hasDraws: boolean }) {
  const v = typeof c.draw === "number" ? c.draw : c.trust;
  const w = Math.max(0, Math.min(1, v));
  return (
    <li className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className={`flex min-w-0 items-center gap-1.5 truncate ${winner ? "font-semibold text-fg" : c.paused ? "text-faint line-through" : "text-dim"}`}>
          {winner ? <span className="text-accent">●</span> : null}
          <span className="truncate">{c.name}</span>
          {c.paused ? <span className="text-[10px] tracking-wide text-neg no-underline uppercase">paused</span> : null}
        </span>
        <span className="num shrink-0 font-mono text-[11px] text-fg">{typeof c.draw === "number" ? `draw ${c.draw.toFixed(3)}` : `trust ${c.trust.toFixed(2)}`}</span>
      </div>
      <div className="relative mt-1 h-2 rounded-sm bg-line" aria-hidden>
        <div className={`h-full rounded-sm ${winner ? "bg-accent" : c.paused ? "bg-line-strong" : "bg-fg/40"}`} style={{ width: `${Math.max(1.5, w * 100)}%` }} />
        {hasDraws ? <span className="absolute -top-0.5 h-3 w-px bg-fg/80" style={{ left: `${Math.max(0, Math.min(1, c.trust)) * 100}%` }} title={`trust (posterior mean) ${c.trust.toFixed(2)}`} /> : null}
      </div>
      <div className="num mt-0.5 truncate text-[10px] text-faint">
        trust {c.trust.toFixed(2)} · hit {c.hitRate !== null ? pct(c.hitRate) : "—"} over {c.samples} · {payUsd(c.priceUsd)}
      </div>
    </li>
  );
}

const STANCE_TONE: Record<string, string> = { bullish: "text-pos", bearish: "text-neg", neutral: "text-dim" };

export function AnalystMarket({
  events,
  state,
  stateStatus,
  info,
  conn,
  assets,
  now,
}: {
  events: AgentEvent[];
  state: ExecState | null;
  stateStatus: StateStatus;
  info: Partial<Record<AnalystId, AnalystInfo>>;
  conn: Record<AgentId, AgentConn>;
  assets: string[];
  now: number;
}) {
  const cards = analystCards(events, state, info, conn);
  const nameOf = (id: string) => cards.find((c) => c.id === id)?.name ?? agentMeta(id)?.name ?? id;
  const threshold = toNum(state?.risk?.minAnalystTrust);
  const minSamples = toNum(state?.risk?.minAnalystSamples);
  const selections = latestSelections(events);
  const selList = [...assets.filter((a) => selections.has(a)).map((a) => selections.get(a)!), ...[...selections.values()].filter((s) => !assets.includes(s.symbol))];
  const scored = ofType(events, "signal.scored").slice(0, 10);
  const posted = ofType(events, "reputation.posted").slice(0, 5);
  const selectedFor = (id: string) => selList.filter((s) => s.analystId === id).map((s) => s.symbol);
  const execOffline = conn.execution?.status === "offline" && stateStatus !== "ok";

  return (
    <Panel
      title={
        <>
          Analyst market <span className="hidden text-faint normal-case tracking-normal sm:inline">· the trader picks who to pay, by track record</span>
        </>
      }
      id="market"
      right={<span className="hidden font-mono text-[11px] text-faint md:inline">Thompson sampling</span>}
      bodyClassName="flex flex-col gap-5"
    >
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((a) => (
          <AnalystCard key={a.id} a={a} threshold={threshold} minSamples={minSamples} selectedFor={selectedFor(a.id)} />
        ))}
      </div>

      <div className="flex flex-col gap-5">
        <section aria-labelledby="sel-title" className="min-w-0">
          <h3 id="sel-title" className="mb-2 text-[11px] font-medium tracking-[0.12em] text-dim uppercase">
            Latest pick per asset
          </h3>
          {selList.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {selList.map((s) => (
                <Selection key={s.id} sel={s} nameOf={nameOf} now={now} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line">
              <Empty
                tone={execOffline ? "offline" : "idle"}
                title={execOffline ? "Execution agent offline" : "No analyst picked yet"}
                hint="Each cycle the trader draws a Thompson sample from every analyst's track record and buys the signal from the highest draw. Paused analysts are skipped."
              />
            </div>
          )}
        </section>

        <section aria-labelledby="calls-title" className="min-w-0">
          <h3 id="calls-title" className="mb-2 flex items-baseline justify-between text-[11px] font-medium tracking-[0.12em] text-dim uppercase">
            Recent calls <span className="font-normal tracking-normal text-faint normal-case">scored after each signal&apos;s horizon</span>
          </h3>
          {scored.length ? (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead className="bg-panel-2 text-left text-[10px] tracking-wide text-faint uppercase">
                  <tr>
                    <th className="px-3 py-2 font-medium">Analyst</th>
                    <th className="px-2 py-2 font-medium">Asset</th>
                    <th className="px-2 py-2 font-medium">Call</th>
                    <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Entry → exit</th>
                    <th className="px-2 py-2 text-right font-medium">Return</th>
                    <th className="px-3 py-2 text-center font-medium">
                      <span className="sr-only">Correct</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {scored.map((s) => (
                    <tr key={s.id} title={new Date(s.ts).toLocaleString()}>
                      <td className={`max-w-28 truncate px-3 py-1.5 ${agentMeta(s.analystId)?.tone ?? "text-fg"}`}>{nameOf(s.analystId)}</td>
                      <td className="px-2 py-1.5 font-mono text-fg">{s.symbol}</td>
                      <td className={`px-2 py-1.5 capitalize ${STANCE_TONE[s.stance] ?? "text-dim"}`}>{s.stance}</td>
                      <td className="num hidden px-2 py-1.5 text-right whitespace-nowrap text-dim sm:table-cell">
                        {price(s.entryPrice)} → <span className="text-fg">{price(s.exitPrice)}</span>
                      </td>
                      <td className={`num px-2 py-1.5 text-right font-mono whitespace-nowrap ${s.returnBps > 0 ? "text-pos" : s.returnBps < 0 ? "text-neg" : "text-dim"}`}>{bps(s.returnBps)}</td>
                      <td className="px-3 py-1.5 text-center">
                        {s.counted === false ? (
                          <span
                            className="text-[10px] font-medium tracking-[0.06em] text-faint uppercase"
                            title={s.stance === "neutral" ? "Neutral call: an abstention, doesn't move trust" : "Price stayed inside the ±25 bps noise band: inconclusive, doesn't move trust"}
                          >
                            {s.stance === "neutral" ? "abstain" : "flat"}
                          </span>
                        ) : (
                          <span className={`inline-grid size-4 place-items-center rounded-full text-[10px] ${s.correct ? "bg-pos/15 text-pos" : "bg-neg/20 text-neg"}`} aria-label={s.correct ? "correct" : "wrong"}>
                            {s.correct ? <IconCheck /> : <IconX />}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line">
              <Empty title="No calls scored yet" hint="A paid signal is scored once its horizon passes: the trader compares the entry price with the price at expiry, in the signal's direction." />
            </div>
          )}

          {posted.length ? (
            <ul className="mt-3 space-y-1.5">
              {posted.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  {p.error && /^skipped/i.test(p.error) ? (
                    <Badge tone="neutral" title={p.error}>not posted</Badge>
                  ) : (
                    <Badge tone={p.error ? "neg" : "pos"}>{p.error ? "rating failed" : "rated on-chain"}</Badge>
                  )}
                  <span className={agentMeta(p.analystId)?.tone ?? "text-fg"}>{nameOf(p.analystId)}</span>
                  <span className="font-mono text-faint">#{p.erc8004AgentId}</span>
                  <span className="num text-dim">
                    {p.value} · {p.tag}
                  </span>
                  {p.txHash && isTxHash(p.txHash) ? (
                    <ExtLink href={BSCSCAN_TX(p.txHash)} className="font-mono">
                      {shortHash(p.txHash)}
                    </ExtLink>
                  ) : null}
                  {p.error ? <span className={`min-w-0 break-words ${/^skipped/i.test(p.error) ? "text-faint" : "text-neg"}`}>{p.error}</span> : null}
                  <span suppressHydrationWarning className="num ml-auto text-[11px] text-faint">{now ? ago(p.ts, now) : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              ERC-8004 feedback: when an analyst has an on-chain identity, the trader posts each scored call to the reputation registry. No ratings posted yet.
            </p>
          )}
        </section>
      </div>
    </Panel>
  );
}
