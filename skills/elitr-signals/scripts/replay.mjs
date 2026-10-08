#!/usr/bin/env node
// Replay an Elitr /signal request with the PAYMENT-SIGNATURE produced by `baw x402-payment sign`,
// then decode the PAYMENT-RESPONSE settlement header and print the Signal. Node 18+, no dependencies.
// This script does not sign anything; it only sends the header value it is given.
//
//   node replay.mjs "<base>/signal?symbol=NVDAB" "<paymentHeaderValue>"
//   node replay.mjs "<base>/signal?symbol=NVDAB" "<paymentHeaderValue>" --json
//
// Run it IMMEDIATELY after `sign` - Agentic Wallet signatures are short-lived (signatureExpiresAt).
// Exit codes: 0 = 200 with signal, 2 = any other HTTP status (body printed), 1 = usage/network error.

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const [url, signature] = args.filter((a) => !a.startsWith("--"));
if (!url || !signature) {
  console.error('usage: node replay.mjs "<base>/signal?symbol=NVDAB" "<paymentHeaderValue>" [--json]');
  process.exit(1);
}

const decode = (b64) => {
  try {
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
};

let res;
try {
  // The news analyst may call an LLM between verify and settle; allow time for it.
  res = await fetch(url, { headers: { Accept: "application/json", "PAYMENT-SIGNATURE": signature }, signal: AbortSignal.timeout(120_000) });
} catch (e) {
  console.error(`request failed: ${e.cause?.code ?? e.message} - the payment may or may not have settled; check \`baw wallet tx-history\` before retrying`);
  process.exit(1);
}
const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}
const prHeader = res.headers.get("payment-response");
const settlement = prHeader ? decode(prHeader) : null;
const paymentRequired = res.headers.get("payment-required");
const result = {
  status: res.status,
  settlement, // { success, transaction (txHash), network, payer, ... } on 200
  bscscan: settlement?.transaction ? `https://bscscan.com/tx/${settlement.transaction}` : null,
  body,
  retryHint:
    res.status === 402
      ? "Payment rejected (see body.error). Do not re-sign automatically; report to the user."
      : res.status === 503 && typeof body?.error === "string" && body.error.includes("payment NOT settled")
        ? "Signal unavailable and payment NOT settled. The same signature may be replayed once before signatureExpiresAt; otherwise nothing was charged."
        : res.status === 502
          ? "Settlement state uncertain (see body.transaction). Do NOT pay again; check the tx on BscScan first."
          : null,
  paymentRequired: paymentRequired ? decode(paymentRequired) : null,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else if (res.status === 200 && body && typeof body === "object") {
  const s = body;
  console.log(`Paid. Settlement tx: ${result.bscscan ?? "(no PAYMENT-RESPONSE header)"}`);
  console.log(`\n${s.symbol} (${s.underlying}) - ${s.stance}, score ${s.score}/100, horizon ${Math.round(s.horizonSec / 60)} min`);
  console.log(`Analyst: ${s.analystId}  model: ${s.model}  inputs: ${s.headlineCount}  generated: ${s.generatedAt}`);
  console.log(`\nRationale: ${s.rationale}`);
  if (s.sources?.length) {
    console.log("\nSources:");
    for (const x of s.sources) console.log(`  - ${x.title} (${x.publishedAt}) ${x.url}`);
  }
} else {
  console.log(`HTTP ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  if (result.retryHint) console.log(result.retryHint);
}
process.exitCode = res.status === 200 ? 0 : 2;
