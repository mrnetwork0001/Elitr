// Static diagram: two competing analysts ⇄ Execution over b402, Execution → BSC via Binance Web3 API.
import l from "@/app/landing.module.css";
import { cx, reveal } from "./parts";

function Node({ title, role, lines, marker, keyNode = false, delay }: { title: string; role: string; lines: string[]; marker: string; keyNode?: boolean; delay: number }) {
  return (
    <div {...reveal("wipe", delay, cx(l.node, keyNode && l.nodeKey))}>
      <div className={l.nodeRole}>{role}</div>
      <div className={l.nodeTitle}>
        <span className={cx(l.square, marker)} aria-hidden="true" />
        {title}
      </div>
      <ul className={l.nodeLines}>
        {lines.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function Wire({ label, sub, rev = false, delay }: { label: string; sub: string; rev?: boolean; delay: number }) {
  return (
    <div {...reveal("fade", delay, cx(l.wire, rev && l.wireRev))} aria-hidden="true">
      <span className={l.wireLabel}>{label}</span>
      <span className={l.wireTrack} />
      <span className={l.wireSub}>{sub}</span>
    </div>
  );
}

export function FlowDiagram() {
  return (
    <div className={l.flow} role="img" aria-label="Two analyst agents sell signals to the Execution agent over b402; Execution trades six bStocks (NVDAB, TSLAB, BABAB, CRCLB, SNDKB, METAB) on BNB Smart Chain through the Binance Web3 API.">
      <div className={l.flowStack}>
        <Node delay={0} marker={l.squareOutline} role="Seller · Agent A" title="News analyst" lines={["Reads live news per stock", "Claude scores it 1–100", "Sells each signal over b402"]} />
        <Node delay={0.08} marker={l.squareInk} role="Seller · Agent C" title="Flow analyst" lines={["Watches PancakeSwap swaps", "Scores net buy / sell flow", "Sells each signal over b402"]} />
      </div>
      <Wire delay={0.2} label="HTTP 402 ⇄ b402" sub="trader picks one, pays, gets a signal" rev />
      <Node delay={0.28} keyNode marker="" role="Buyer · Agent B" title="Execution" lines={["Thompson-samples the analysts", "Scores every call they sell", "14 risk checks, then dry-run", "Exits on TP / SL / bearish"]} />
      <Wire delay={0.4} label="Binance Web3 API" sub="quote · simulate · broadcast" />
      <Node delay={0.48} marker={l.squareOutline} role="BNB Smart Chain" title="6 bStocks" lines={["NVDAB, TSLAB, BABAB, CRCLB, SNDKB, METAB", "PancakeSwap v3 USDT pools", "Live on BSC mainnet, small limits"]} />
    </div>
  );
}
