#!/usr/bin/env node
// Fetch an Elitr /signal URL WITHOUT paying and decode the x402 V2 PaymentRequired it returns.
// Node 18+, no dependencies. It never signs and never pays.
//
//   node decode-402.mjs "http://localhost:4001/signal?symbol=NVDAB"
//   node decode-402.mjs --header <base64 PAYMENT-REQUIRED value>      # decode a header you already have
//   node decode-402.mjs ... --json                                     # machine-readable
//
// Output: a human summary (price, token, payee, method, timeout) to show the user before asking for
// consent, plus the exact `baw x402-payment preview` command to run once the user agrees.
// Exit codes: 0 = got a 402 and decoded it, 2 = the analyst answered something other than 402
// (offline, 503, 404, ...), 1 = usage / decode error.

const STABLES = {
  "0x55d398326f99059ff775485246999027b3197955": "USDT",
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": "USDC",
  "0xce24439f2d9c6a2289f741120fe202248b666666": "U",
  "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d": "USD1",
};
// Method names the Agentic Wallet skill documents for x402-payment preview (references/x402-payment.md,
// reason UNSUPPORTED_METHOD). b402 itself names its Permit2 method "permit2-exact".
const AW_DOCUMENTED_METHODS = ["eip3009", "permit2", "spl-transfer"];

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const hIdx = args.indexOf("--header");
const url = args.find((a, i) => !a.startsWith("--") && (hIdx < 0 || i !== hIdx + 1));

const fmtUnits = (amount, decimals = 18) => {
  if (!/^\d+$/.test(String(amount ?? ""))) return "?";
  const s = String(amount).padStart(decimals + 1, "0");
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${s.slice(0, -decimals)}.${frac}` : s.slice(0, -decimals);
};

function out(obj, code) {
  if (asJson) console.log(JSON.stringify(obj, null, 2));
  process.exitCode = code;
  return obj;
}

let headerB64;
let bodyJson;
let httpStatus = null;

if (hIdx >= 0) {
  headerB64 = args[hIdx + 1];
  if (!headerB64) {
    console.error("--header needs a value");
    process.exit(1);
  }
} else if (url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(60_000), headers: { Accept: "application/json" } });
  } catch (e) {
    const r = out({ ok: false, kind: "offline", url, error: e.cause?.code ?? e.message }, 2);
    if (!asJson) console.log(`Analyst unreachable at ${url}: ${r.error}`);
    process.exit(2);
  }
  httpStatus = res.status;
  const text = await res.text();
  try {
    bodyJson = JSON.parse(text);
  } catch {
    bodyJson = text;
  }
  if (res.status !== 402) {
    const r = out({ ok: false, kind: `http_${res.status}`, url, status: res.status, body: bodyJson }, 2);
    if (!asJson) console.log(`Expected HTTP 402 but got ${r.status}: ${typeof bodyJson === "string" ? bodyJson : JSON.stringify(bodyJson)}`);
    process.exit(2);
  }
  headerB64 = res.headers.get("payment-required") ?? undefined;
} else {
  console.error('usage: node decode-402.mjs "<base>/signal?symbol=NVDAB" | --header <base64>  [--json]');
  process.exit(1);
}

let pr;
try {
  pr = headerB64 ? JSON.parse(Buffer.from(headerB64, "base64").toString("utf8")) : bodyJson;
} catch (e) {
  console.error(`PAYMENT-REQUIRED header is not base64 JSON: ${e.message}`);
  process.exit(1);
}
if (!pr || pr.x402Version !== 2 || !Array.isArray(pr.accepts) || !pr.accepts.length) {
  console.error("Not an x402 V2 PaymentRequired (need x402Version 2 and a non-empty accepts[])");
  process.exit(1);
}
if (!headerB64) headerB64 = Buffer.from(JSON.stringify(pr), "utf8").toString("base64");

const options = pr.accepts.map((a, i) => {
  const token = STABLES[String(a.asset ?? "").toLowerCase()] ?? null;
  const method = a.extra?.assetTransferMethod ?? null;
  return {
    index: i + 1,
    scheme: a.scheme,
    network: a.network,
    chain: a.network === "eip155:56" ? "BNB Smart Chain (56)" : a.network,
    token,
    asset: a.asset,
    amountAtomic: a.amount,
    amount: token ? fmtUnits(a.amount) : null,
    payTo: a.payTo,
    method,
    methodNote:
      method === "permit2-exact"
        ? "b402 Permit2 exact. The Agentic Wallet docs list 'permit2' (not 'permit2-exact'); if preview returns UNSUPPORTED_METHOD the analyst must offer U/USD1 via eip3009. Permit2 also needs a one-time approve (sponsored on BSC per AW docs)."
        : method && !AW_DOCUMENTED_METHODS.includes(method)
          ? "Method not in the Agentic Wallet documented set (eip3009, permit2, spl-transfer)."
          : method === "eip3009"
            ? "EIP-3009 transferWithAuthorization: no approval transaction needed."
            : null,
    maxTimeoutSeconds: a.maxTimeoutSeconds,
  };
});

const result = {
  ok: true,
  status: httpStatus,
  resource: pr.resource ?? null,
  serverMessage: pr.error ?? null,
  options,
  paymentRequiredBase64: headerB64,
  bawPreviewCommand: `baw x402-payment preview --paymentRequirements '${headerB64}' --json`,
};
out(result, 0);

if (!asJson) {
  console.log(`Resource: ${result.resource?.url ?? url ?? "-"}`);
  if (result.resource?.description) console.log(`What you get: ${result.resource.description}`);
  for (const o of options) {
    console.log(`\nOption ${o.index}: ${o.amount ?? o.amountAtomic + " atomic units"} ${o.token ?? o.asset} on ${o.chain}`);
    console.log(`  pay to:  ${o.payTo}`);
    console.log(`  token:   ${o.asset}`);
    console.log(`  method:  ${o.scheme} / ${o.method ?? "-"}`);
    if (o.methodNote) console.log(`  note:    ${o.methodNote}`);
    console.log(`  timeout: ${o.maxTimeoutSeconds}s`);
  }
  console.log(`\nAfter the user confirms, preview with the Agentic Wallet:\n  ${result.bawPreviewCommand}`);
}
