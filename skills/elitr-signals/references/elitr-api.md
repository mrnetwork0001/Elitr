# Elitr Analyst API

Every Elitr analyst is one HTTP server. All endpoints are `GET`, JSON, CORS-enabled.

## Base URLs

| Analyst | Production (live) | Local dev |
|---|---|---|
| News-sentiment analyst (`analyst`) | `https://analyst.elitr.xyz` | `http://localhost:4001` |
| On-chain flow analyst (`analyst-flow`) | `https://flow.elitr.xyz` | `http://localhost:4003` |

These are the defaults built into `scripts/discover.mjs`. Override with
`ELITR_ANALYSTS="https://a.example,https://b.example"` (comma-separated), e.g. for local dev.

`ELITR_STATS_URL` (optional): the live track record. Default `https://agent.elitr.xyz/state`, the
Elitr execution agent's public state. Its `analysts[]` array carries, per analyst, `analystId`,
`samples`, `hits`, `hitRate` (0..1, `null` until scored), `trust`, `weight`, `paused` and
`avgReturnBps`, as scored by Elitr's own trader after each signal's horizon. Fetch it with `curl`
(`scripts/discover.mjs` does not call it) and use it for the track-record column; if it cannot be
fetched, say so.

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
  "symbols": ["NVDAB", "TSLAB", "BABAB", "CRCLB", "SNDKB", "METAB", "NVDAon", "TSLAx"],  // news analyst: 8; flow analyst: the six bStocks only
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
    "extra": { "name": "Tether USD", "version": "1", "assetTransferMethod": "permit2-exact", "spenderAddress": "0x3038f7ac3b4D1a3fe886BdCB5cD01e9f6BDd8633" }
  }, {
    "scheme": "exact", "network": "eip155:56",
    "amount": "10000000000000000",
    "asset": "0xcE24439F2D9C6a2289F741120FE202248B666666",
    "payTo": "0x…",
    "maxTimeoutSeconds": 300,
    "extra": { "name": "United Stables", "version": "1", "assetTransferMethod": "eip3009" }
  }]
}
```

The live analysts offer **two accepts**: the primary from `ANALYST_PAYMENT_ASSET` /
`ANALYST_PAYMENT_METHOD` (USDT, `permit2-exact`) and an alternate from `ANALYST_PAYMENT_ALT_ASSET` /
`ANALYST_PAYMENT_ALT_METHOD` (U, `eip3009`). `permit2-exact` works for any b402 stable (e.g. USDT);
`eip3009` only for U or USD1. The buyer picks one; verify and settle run against exactly that option.
Both have been paid from the Binance Agentic Wallet (baw 1.10.0, 2026-10-07): USDT approve
`0x62c332337eb1eb24fd2589dfe9c5afea30c9024d12ec5624cd7744724f1cc822` + settle
`0x559b481ee017167040751bac274f5daf62d0bc97c75bac295ef03a9b338659b9`; U settle
`0xd2535021423ae6d30b4bbc6fde8f2b58fc0bc22dba7831c7d97c7eed78ca2e4e`.

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

Six bStocks are traded by Elitr and served by both analysts. NVDAon and TSLAx are served by the news
analyst only (signal-only; Elitr tracks them but does not trade them).

| Symbol | Underlying | Platform | Contract (BSC) | Analysts | Tradable via Agentic Wallet |
|---|---|---|---|---|---|
| NVDAB | NVIDIA | bStocks | `0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436` | news, flow | yes (bStock) |
| TSLAB | Tesla | bStocks | `0x5b1910eAaD6450E50f816082Aa078C41F10C292f` | news, flow | yes (bStock) |
| BABAB | Alibaba | bStocks | `0x4eF9d3062c7F6ebA4AAE4990c5036598C6eff4ec` | news, flow | yes (bStock) |
| CRCLB | Circle | bStocks | `0x80f3D493EBCe97e343c53D29a137942416B4ffC0` | news, flow | yes (bStock) |
| SNDKB | Sandisk | bStocks | `0x3eE4dF61bd4F867E349BEaE8bFE07bc31b4850fb` | news, flow | yes (bStock) |
| METAB | Meta | bStocks | `0x7425889FE94F9d693E8daefE88BCCed6AcFEf4c0` | news, flow | yes (bStock) |
| NVDAon | NVIDIA | Ondo | `0xA9eE28C80f960B889dFbd1902055218cBa016F75` | news | yes (Ondo), thin DEX liquidity |
| TSLAx | Tesla | xStocks | `0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0` | news | not documented - Agentic Wallet docs cover bStock and Ondo only |

NVDAB / TSLAB addresses match the Binance RWA list `…/rwa/stock/detail/list/ai?type=3` (checked
2026-10-07). BABAB / CRCLB / SNDKB / METAB were verified on-chain on 2026-10-08 (PancakeSwap v3
factory `getPool` against USDT, DexScreener cross-check); still confirm each against the `type=3` list
before trading.
