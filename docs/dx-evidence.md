# DX evidence pack

These are raw facts sorted under the seven questions of the Developer Experience Report form (https://forms.gle/EUQ39xf54GHjC2ys5). **They are notes, not answers.** The hackathon rejects AI-generated reports, so write each section in your own words, from your own experience, using these as reminders and evidence. Sources and timestamps are in [dx-raw-log.md](dx-raw-log.md) and [agentic-wallet.md](agentic-wallet.md#gaps-and-friction-found-facts-with-sources-for-the-dx-reports-ai-stack-section).

---

## 1. Onboarding — time to first successful call, where you got stuck

- **Timeline to fill in from memory:**
  - when you opened the docs
  - when you applied for the key (4 Oct)
  - when it was approved
  - first successful signed call: 7 Oct, `POST /market/price` → 200, 531 ms
- **Stuck on network access:**
  - From home Wi-Fi, `web3.binance.com` (CloudFront) accepted TCP but the TLS handshake stalled, while `www.binance.com` loaded fine.
  - A mobile hotspot fixed it immediately.
  - It happened on two separate days.
  - The docs have no connectivity or region troubleshooting section.
- **Signing worked first time** once reachable. The doc's warning that `requestPath` must include `/build` was accurate.
- **B402 needs extra setup before any b402 call works:**
  - a separate application in the portal
  - a write-once `payTo`
  - an API key with the "B402 Payments" permission ticked
- **Region check:**
  - Two VPS offers were in Montréal, Canada, which is restricted.
  - We only found this out by checking the hackathon rules.
  - The API still answered unauthenticated requests from there.

## 2. Documentation issues — page + exact place

- **b402 API reference** (`/rest-api/b402-payments`):
  - only the response envelope is documented
  - `kinds`, `isValid`, `invalidReason`, `payer`, `success`, `transaction`, `errorReason` appear only in the integration-guide prose
- **b402 integration guide:**
  - says "select a kind matching the asset", but `/supported` kinds have no asset field
  - you must map the token's EIP-712 `extra.name` to an address yourself
- **b402 reference types `extra.spenderAddress` as `string | null`:**
  - the official `@bnb-chain/b402` client throws on `null`
  - the guide's eip3009 example omits the key
- **RWA Data reference** (`/rwa/tokens`, `/rwa/underlying-market`):
  - nested objects render as an unnamed "​object"
  - the market-status and market-data keys are not named
- **RWA Data `platformId`** enum is only `ondo | bstock`. xStocks can't be queried, although the hackathon lists xStocks as an eligible issuer.
- **Trading API integration flow** says to call `/approve-transaction` before `/quote`, but for equity tokens `vendor` is required and only exists after `/quote`.
- **Transaction API `/simulate`** response has no gas figure. A second call to `/gas-limit` is needed.
- **Wallet API / Address Portfolio** pages in `llms-full.txt`: one-line descriptions only, with no parameter or response tables.
- **Agentic Wallet:** see section 4.

## 3. API pitfalls — confusing errors, edge cases, latency

- **The Trading API `/swap` gas estimate was too low:**
  - `tx.gas = 450,000` for a 2 USDT → NVDAB swap
  - the Transaction API simulation of the same transaction measured 457,414
  - signing with the suggested limit **reverted on-chain out of gas**: tx `0xc52edf5c…bfa6`, gasUsed 443,576
  - the retry with max(suggested, simulated) × 1.25 succeeded (tx `0x0ce91120…3807`); that route's simulation needed 1,106,050 gas
- **The b402 success code differs:** `"000000000"` (a string) versus `code: 0` everywhere else.
- **b402 business failures return HTTP 200,** so you have to check `data.isValid` and `data.success`.
- **The x402 client SDK silently rejects b402 assets:**
  - `@x402/core` default spend controls reject every b402 asset ("rejected by spendControls")
  - you must call `setSpendControls({allowedAssets})`, and the `@bnb-chain/b402` README doesn't say so
- **The approval error is lost:** `@x402/fetch` re-wraps `B402Permit2ApprovalRequiredError` as a plain `Error`. The token, owner and required amount are only recoverable through the `onPaymentCreationFailure` hook.
- **The Wallet API returned no rows:** `all-token-balances-by-address` returned `tokenAssets: []` for a wallet holding BNB and USDT.
- **The 0G Compute Router ignores Anthropic `output_config`.** Not Binance, but part of the AI stack: Claude returned fenced markdown and structured parsing failed, so we switched to forced tool use.
- **Latency observed:**
  - market price 531 ms
  - RWA price 302 ms
  - b402 `/supported` 409 ms
  - unauthenticated probe about 0.28–0.65 s
- **Market-hours errors:** documented as `40369 BSTOCK_INVALID_TRADING_TIME`. Note whether you actually hit it; the market status read "tradable, TRADING" even with the US session closed.

## 4. AI stack feedback — Wallet Skills / Agentic Wallet / CLI

The full list with sources is in [agentic-wallet.md](agentic-wallet.md).
- **The installed `baw` (1.9.0) was older than the skill requires (1.10.0).** Upgrading also needed `--allow-scripts=@github/keytar` for Keychain session storage.
- **Nested `--help` prints the root help** (1.9.0).
- **The default `--gasLevel`** is HIGH in the CLI but MEDIUM in the skill docs.
- **The Permit2 method has two names:** `permit2` (Agentic Wallet) versus `permit2-exact` (b402). We added U via `eip3009` as a second option so both sides agree.
- **The x402 preview example** shows USDT with `eip3009`, which b402 says USDT doesn't support.
- **The x402 signature lifetime (about 30 s)** is only mentioned in an expired campaign file.
- **There is no x402 page** in the Agentic Wallet docs.
- **The tokenized-securities prerequisite skill only knows Ondo** (bStocks needs `type=3`). xStocks trading is undocumented.
- **Login:** QR + pairing code + Secure Auto Sign took about 1 minute. Defaults: daily limit $1,000, x402 limit $20, session about 2 days. Write your own impressions.
- **Agent Studio:** fill in after you try it. Facts so far:
  - `@bnbagent/studio-cli` 0.0.14
  - it deploys its own generated project, not an existing service
  - the trial runs 48 h on testnet only, from the first deploy

## 5. Tokenized-stock specifics

- **Liquidity on BSC (4 Oct):**
  - bStocks NVDAB/USDT PancakeSwap v3 about $4.2M, TSLAB about $2.0M
  - Ondo pools under $10k
  - TSLAx/USDT about $23
- **Slippage:**
  - 10 vs 1,000 USDT quotes on NVDAB showed about zero price impact
  - our live 2 USDT buy filled at $237.15
- **Outside market hours:**
  - NVDAB traded about 0.6% above NVDA's Friday close on Sunday
  - midweek it ran −0.6% to +0.4% versus the last close
- **On-chain vs reference:**
  - RWA `referencePrice` is documented as derived from the on-chain price, so it is not an independent TradFi quote; we added Yahoo
  - example: tokenPrice 240.77 vs referencePrice 240.58
- **The same stock across issuers:**
  - NVDAB (bStocks) vs NVDAon (Ondo): bStocks is the only one with tradable depth
  - Ondo routes through RFQ, which the Transaction API can't simulate
- **There is no testnet deployment** of NVDAB/TSLAB/TSLAon/TSLAx, so end-to-end testing needs mainnet.
- **Compliance:** bStocks and Ondo tokens are beacon proxies with a `compliance()` hook (blocklist and upgrade possible). This isn't documented for developers.

## 6. Redesign suggestions

Prompts only; the ideas must be yours. For example: a status page and connectivity check, a test key that works on a sandbox, typed response schemas for every endpoint, consistent success codes, a single b402 SDK that is both server and client, gas estimates that include headroom, an xStocks `platformId`, and one doc page for "first signed call in 60 seconds".

## 7. Requested capabilities

Prompts only:
- **Data and simulation:**
  - an RWA endpoint for an independent reference price (last official close + timestamp)
  - simulation with state overrides, so you can dry-run sells without holding the tokens
  - RFQ simulation
- **b402:**
  - `/supported` that includes the asset address
  - x402 `upto` support in the official client
- **Wallet API:** a documented response schema.
- **Agent tooling:**
  - an MCP server (listed as "coming soon")
  - Agent Studio hosting of an existing Node service
