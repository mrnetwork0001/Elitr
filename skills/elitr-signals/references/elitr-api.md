# Elitr Analyst API

Every Elitr analyst is one HTTP server. All endpoints are `GET`, JSON, CORS-enabled.

## Base URLs

| Analyst | Production (placeholder until deployed) | Local dev |
|---|---|---|
| News-sentiment analyst (`analyst`) | `https://analyst.elitr.xyz` | `http://localhost:4001` |
| On-chain flow analyst (`analyst-flow`) | `https://flow.elitr.xyz` | `http://localhost:4003` |

Override with `ELITR_ANALYSTS="https://a.example,https://b.example"` (comma-separated). The
production hostnames are placeholders; use whatever the Elitr team publishes.

`ELITR_STATS_URL` (optional, future): the Elitr execution agent will expose per-analyst accuracy.
Until it exists, report track record as "not available yet".

## Endpoints

| Path | Paid | Purpose |
|---|---|---|
| `/info` | free | Discovery: `AnalystInfo` + `b402Configured` |
| `/.well-known/agent-registration.json` | free | ERC-8004 registration file (`services`, `x402Support`, `registrations`, `supportedTrust`) |
| `/health` | free | Liveness and configuration |
| `/signal?symbol=<SYMBOL>` | **yes (b402 / x402 V2)** | One `Signal` |

### `GET /info` → `AnalystInfo`

```json
{
  "analystId": "analyst",
  "name": "Elitr News Analyst",
  "kind": "news-sentiment",            // or "onchain-flow"
  "description": "…",
  "symbols": ["NVDAB", "TSLAB", "NVDAon", "TSLAx"],
  "horizonSec": 3600,
  "priceAmount": "10000000000000000",  // smallest units (18 decimals) → 0.01
  "priceAsset": "0x55d398326f99059fF775485246999027B3197955",
  "priceUsd": 0.01,                     // null if the asset is not a known USD stable
  "erc8004AgentId": "…",                // present once registered on-chain
  "b402Configured": true
}
```

### `GET /signal?symbol=NVDAB` without payment → `402`

Header `PAYMENT-REQUIRED: <base64 of the body>`; body:

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": { "url": "<base>/signal?symbol=NVDAB", "description": "…", "mimeType": "application/json" },
  "accepts": [{
    "scheme": "exact", "network": "eip155:56",
    "amount": "10000000000000000",
    "asset": "0x55d398326f99059fF775485246999027B3197955",
    "payTo": "0x…",
    "maxTimeoutSeconds": 300,
    "extra": { "name": "Tether USD", "version": "1", "assetTransferMethod": "permit2-exact", "spenderAddress": "0x…" }
  }]
}
```

The asset/method depend on the analyst's configuration (`ANALYST_PAYMENT_ASSET`,
`ANALYST_PAYMENT_METHOD`): `permit2-exact` (any b402 stable, e.g. USDT) or `eip3009` (U or USD1 only).

### Paid retry → `200`

Request header `PAYMENT-SIGNATURE: <value from baw x402-payment sign>`. Response header
`PAYMENT-RESPONSE: <base64 JSON settle result>` (contains `transaction` = settlement tx hash, `payer`).
Body = `Signal`:

```json
{
  "signalId": "…", "analystId": "analyst", "symbol": "NVDAB", "underlying": "NVDA",
  "score": 72,                     // 1-100 confidence the price rises over the horizon; ~50 = no edge
  "stance": "bullish",             // bullish | neutral | bearish
  "horizonSec": 3600,
  "rationale": "…",
  "sources": [{ "title": "…", "url": "…", "publishedAt": "…" }],
  "generatedAt": "2026-10-07T09:00:00.000Z",
  "model": "claude-…",             // or "deterministic-flow-v1" for the flow analyst
  "headlineCount": 14              // inputs considered (headlines or swaps)
}
```

Server order of operations: decode signature → check `accepted` equals the server's requirements →
b402 **verify** → produce signal → b402 **settle** → 200. If the signal cannot be produced, the
payment is **not settled** (503) and the user is not charged.

### Error responses

| Status | Body `error` | Charged? |
|---|---|---|
| 404 | `unknown symbol; supported: …` | no |
| 503 | `b402 payments are not configured on <id>` | no |
| 503 | `b402 unavailable: …` (analyst cannot reach the b402 facilitator) | no |
| 503 | `<id> cannot produce signals` | no |
| 503 | `signal unavailable, payment NOT settled: insufficient flow: N swaps in the last M min …` | no |
| 402 | `payment invalid: …`, `settlement failed: …`, `payment authorization already used`, `paymentPayload.accepted does not match …` | no |
| 502 | `settlement not confirmed; reconcile before retrying` (+ `transaction`) | **maybe** - check BscScan, do not pay again |
| 502 | `b402 verify failed: …` / `b402 settle failed: …` | no (same signature may be resent once) |

Source: `apps/analyst-agent/src/paywall.ts` in the Elitr repo.

## Symbols

| Symbol | Underlying | Platform | Contract (BSC) | Tradable via Agentic Wallet |
|---|---|---|---|---|
| NVDAB | NVIDIA | bStocks | `0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436` | yes (bStock) |
| TSLAB | Tesla | bStocks | `0x5b1910eAaD6450E50f816082Aa078C41F10C292f` | yes (bStock) |
| NVDAon | NVIDIA | Ondo | `0xA9eE28C80f960B889dFbd1902055218cBa016F75` | yes (Ondo), thin DEX liquidity |
| TSLAx | Tesla | xStocks | `0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0` | not documented - Agentic Wallet docs cover bStock and Ondo only |

NVDAB / TSLAB addresses match the Binance RWA list `…/rwa/stock/detail/list/ai?type=3` (checked 2026-10-07).
