#!/usr/bin/env node
// Elitr analyst discovery - free, read-only. Node 18+ (uses global fetch), no dependencies.
//
//   node discover.mjs                         # bases from $ELITR_ANALYSTS, else the public defaults
//   node discover.mjs http://localhost:4001 http://localhost:4003
//   node discover.mjs --local                 # shortcut for the two local dev analysts
//   node discover.mjs --json                  # machine-readable output
//
// For every base it calls GET /info and GET /.well-known/agent-registration.json and prints a
// comparison table (price, horizon, symbols, payable, ERC-8004 id). It never calls /signal and never pays.

const DEFAULT_BASES = ["https://analyst.elitr.xyz", "https://flow.elitr.xyz"];
const LOCAL_BASES = ["http://localhost:4001", "http://localhost:4003"];

// BSC stablecoins (all 18 decimals). Source: b402 "Supported Payment Methods" production assets table.
const STABLES = {
  "0x55d398326f99059ff775485246999027b3197955": "USDT",
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": "USDC",
  "0xce24439f2d9c6a2289f741120fe202248b666666": "U",
  "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d": "USD1",
};

const args = process.argv.slice(2);
const asJson = args.includes("--json");
let bases = args.filter((a) => !a.startsWith("--"));
if (args.includes("--local")) bases = LOCAL_BASES;
if (!bases.length && process.env.ELITR_ANALYSTS) bases = process.env.ELITR_ANALYSTS.split(",").map((s) => s.trim()).filter(Boolean);
if (!bases.length) bases = DEFAULT_BASES;
bases = bases.map((b) => b.replace(/\/+$/, ""));

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const fmtUnits = (amount, decimals = 18) => {
  if (!/^\d+$/.test(String(amount ?? ""))) return "?";
  const s = String(amount).padStart(decimals + 1, "0");
  const int = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
};
const fmtHorizon = (sec) => (!Number.isFinite(sec) ? "?" : sec % 3600 === 0 ? `${sec / 3600}h` : `${Math.round(sec / 60)}m`);

async function probe(base) {
  const row = { base, ok: false };
  try {
    const info = await getJson(`${base}/info`);
    const sym = STABLES[String(info.priceAsset ?? "").toLowerCase()];
    Object.assign(row, {
      ok: true,
      analystId: info.analystId,
      name: info.name,
      kind: info.kind,
      description: info.description,
      symbols: info.symbols ?? [],
      horizonSec: info.horizonSec,
      priceAmount: info.priceAmount,
      priceAsset: info.priceAsset,
      priceToken: sym ?? null,
      price: sym ? `${fmtUnits(info.priceAmount)} ${sym}` : `${info.priceAmount} units of ${info.priceAsset}`,
      priceUsd: info.priceUsd ?? null,
      b402Configured: info.b402Configured ?? null,
      erc8004AgentId: info.erc8004AgentId ?? null,
      signalUrl: `${base}/signal?symbol=<SYMBOL>`,
    });
  } catch (e) {
    row.error = `GET /info failed: ${e.cause?.code ?? e.message}`;
    return row;
  }
  try {
    const reg = await getJson(`${base}/.well-known/agent-registration.json`);
    row.registration = {
      x402Support: reg.x402Support ?? null,
      active: reg.active ?? null,
      onChainRegistrations: Array.isArray(reg.registrations) ? reg.registrations.length : 0,
      supportedTrust: reg.supportedTrust ?? [],
    };
  } catch (e) {
    row.registration = { error: e.cause?.code ?? e.message };
  }
  return row;
}

const rows = await Promise.all(bases.map(probe));

if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const table = rows.map((r) =>
    r.ok
      ? {
          analyst: r.name,
          kind: r.kind,
          price: r.price + (r.priceUsd != null ? ` (~$${r.priceUsd})` : ""),
          horizon: fmtHorizon(r.horizonSec),
          symbols: r.symbols.join(","),
          payable: r.b402Configured === false ? "NO (b402 off)" : "yes",
          erc8004: r.erc8004AgentId ?? (r.registration?.onChainRegistrations ? "registered" : "not yet"),
          base: r.base,
        }
      : { analyst: "OFFLINE", kind: "-", price: "-", horizon: "-", symbols: "-", payable: "-", erc8004: "-", base: `${r.base} (${r.error})` },
  );
  const cols = Object.keys(table[0]);
  const w = Object.fromEntries(cols.map((c) => [c, Math.max(c.length, ...table.map((t) => String(t[c]).length))]));
  const line = (o) => cols.map((c) => String(o[c]).padEnd(w[c])).join("  ");
  console.log(line(Object.fromEntries(cols.map((c) => [c, c]))));
  console.log(cols.map((c) => "-".repeat(w[c])).join("  "));
  for (const t of table) console.log(line(t));
  const live = rows.filter((r) => r.ok);
  for (const r of live) console.log(`\n${r.name}: ${r.description}`);
  if (!live.length) process.exitCode = 1;
}
