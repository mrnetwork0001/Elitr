// Static hero diagram: two competing analysts ⇄ Execution over b402, Execution → BSC via Binance Web3 API.

function Node({ title, role, lines, accent = false, tone = "text-fg" }: { title: string; role: string; lines: string[]; accent?: boolean; tone?: string }) {
  return (
    <div className={`min-w-0 rounded-xl border bg-panel p-4 ${accent ? "border-accent/50" : "border-line-strong"}`}>
      <div className="text-[11px] font-medium tracking-wider text-faint uppercase">{role}</div>
      <div className={`mt-0.5 text-base font-semibold ${tone}`}>{title}</div>
      <ul className="mt-2 space-y-1 text-xs text-dim">
        {lines.map((l) => (
          <li key={l} className="flex gap-1.5">
            <span className="text-faint">›</span>
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Wire({ label, sub, reverse = false }: { label: string; sub: string; reverse?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-1 py-2">
      <span className="text-center font-mono text-[11px] text-accent">{label}</span>
      <svg viewBox="0 0 12 40" className="h-10 w-3 md:hidden" aria-hidden>
        <line x1="6" y1="2" x2="6" y2="32" stroke="var(--color-accent)" strokeWidth="1.5" className="wire-active" />
        <path d={reverse ? "M1 10 L6 2 L11 10" : "M1 32 L6 38 L11 32"} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
      </svg>
      <svg viewBox="0 0 120 12" className="hidden h-3 w-full max-w-[140px] md:block" aria-hidden>
        <line x1="2" y1="6" x2="110" y2="6" stroke="var(--color-accent)" strokeWidth="1.5" className="wire-active" />
        <path d={reverse ? "M10 1 L2 6 L10 11" : "M110 1 L118 6 L110 11"} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
      </svg>
      <span className="text-center text-[11px] text-faint">{sub}</span>
    </div>
  );
}

export function FlowDiagram() {
  return (
    <div className="rounded-2xl border border-line bg-panel-2/60 p-4 sm:p-5">
      <div className="grid items-center gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
          <Node role="Seller · Agent A" title="News analyst" tone="text-info" lines={["Reads live news per stock", "Claude scores it 1–100", "Sells each signal over b402"]} />
          <Node role="Seller · Agent C" title="Flow analyst" tone="text-flow" lines={["Watches PancakeSwap swaps", "Scores net buy / sell flow", "Sells each signal over b402"]} />
        </div>
        <Wire label="HTTP 402 ⇄ b402" sub="trader picks one, pays, gets a signal" reverse />
        <Node accent role="Buyer · Agent B" title="Execution" lines={["Thompson-samples the analysts", "Scores every call they sell", "14 risk checks, then dry-run", "Exits on TP / SL / bearish"]} />
        <Wire label="Binance Web3 API" sub="quote · simulate · broadcast" />
        <Node role="BNB Smart Chain" title="NVDAB · TSLAB" lines={["bStocks tokenized NVIDIA & Tesla", "PancakeSwap v3 USDT pools", "Paper by default, live on demand"]} />
      </div>
    </div>
  );
}
