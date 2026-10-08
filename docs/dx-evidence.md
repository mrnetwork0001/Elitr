# DX evidence pack

These are raw facts sorted under the seven questions of the Developer Experience Report form (https://forms.gle/EUQ39xf54GHjC2ys5). **They are notes, not answers.** The hackathon rejects AI-generated reports, so write each section in your own words, from your own experience, using these as reminders and evidence. Sources and timestamps are in [dx-raw-log.md](dx-raw-log.md) and [agentic-wallet.md](agentic-wallet.md#gaps-and-friction-found).

---

## 1. Onboarding - time to first successful call, where you got stuck

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

## 2. Documentation issues - page + exact place

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

## 3. API pitfalls - confusing errors, edge cases, latency

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

## 4. AI stack feedback - Wallet Skills / Agentic Wallet / CLI

The full list with sources is in [agentic-wallet.md](agentic-wallet.md).
- **The installed `baw` (1.9.0) was older than the skill requires (1.10.0).** Upgrading also needed `--allow-scripts=@github/keytar` for Keychain session storage.
- **Nested `--help` prints the root help** (1.9.0).
- **The default `--gasLevel` changed between CLI versions:** 1.9.0 `--help` said HIGH while the skill docs said MEDIUM; in 1.10.0 the swap default is MEDIUM, matching the docs.
- **The Permit2 method has two names:** `permit2` (Agentic Wallet) versus `permit2-exact` (b402), and neither doc maps them. In practice baw 1.10.0 preview shows our `permit2-exact` accept as `permit2` and signs it (approve `0x62c3…c822`, settle `0x559b…59b9`). We also offer U via `eip3009` as a second accept; that route settled in 3.5 s (`0xd253…4e4e`).
- **`selectedIndex` is not stable:** the preview reordered the two options after the wallet received U, so a script must pick by token, not index.
- **`baw market-order list --orderId` printed "No orders found"** seconds after a completed swap (order 26100700001947839168, balance already updated).
- **The x402 preview example** shows USDT with `eip3009`, which b402 says USDT doesn't support.
- **The x402 signature lifetime (about 30 s)** is only mentioned in an expired campaign file.
- **There is no x402 page** in the Agentic Wallet docs.
- **The tokenized-securities prerequisite skill only knows Ondo** (bStocks needs `type=3`). xStocks trading is undocumented.
- **Login:** QR + pairing code + Secure Auto Sign took about 1 minute. Defaults: daily limit $1,000, x402 limit $20, session about 2 days. Write your own impressions.
- **Agent Studio** (`@bnbagent/studio-cli` 0.0.14; write your own impressions, these are the facts from 8 Oct):
  - it deploys its own generated project, not an existing service
  - the managed `--destination platform` trial is 48 h, BSC testnet only, and its clock starts at the first deploy and cannot be reset, so it cannot stay reachable through judging (12-23 Oct); we did not use it
  - NodeOps (a self-deploy target) was down after a security incident; AWS AgentCore needs an AgentCore quota (new accounts often start at 0) and gives OAuth-gated, never anonymous, endpoints
  - we self-hosted `bag dev --logs` behind Caddy on our own server (desk.elitr.xyz)
  - paid x402 on every Studio target needs B402 (OnchainPay) merchant credentials: sandbox and production applied for separately, RSA-1024 key, egress-IP allowlist (relay IPs only obtainable by curling the platform API with the session token); the application form was locked; Studio's own b402 guide says "Do not claim current mainnet readiness until polling is implemented". These differ from the Binance Web3 API b402 facilitator credentials, which work with a normal API key. So the brief is FREE (`price_usd = "0"`)
  - `bag erc8004 register --network bsc-mainnet` refused below about 0.002 BNB while `bag doctor` warns at 0.02 BNB; the registration (713,813 gas) was then sponsored by the MegaFuel relay and cost 0 BNB; the command waited about 5 min and reported "broadcast but not confirmed yet", leaving `pending_*` keys in studio.toml, although the tx had confirmed (block 126414950) and `bag erc8004 show` already returned agent id 367734; the insufficient-funds hint suggests getting tBNB on mainnet
  - `bag config set` refuses to switch `[network].default` to bsc-mainnet while `[payments.seller].assets` holds TEST_* ids, and refuses mainnet assets first as cross-network; both have to be edited together in the file. On mainnet only "U" was accepted as a seller asset ("USDC" / "USDT" rejected)
  - the scaffolded agent card uses only `AGENTCORE_RUNTIME_URL` for `card.url`, so a self-hosted agent advertises `http://localhost:9000` until patched to read `BNBAGENT_PUBLIC_URL`

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
- **Six-stock basket (8 Oct):** NVDAB, TSLAB, BABAB, CRCLB, SNDKB, METAB are traded; TSMB (thinnest, about $15k/day), IBMB (about $900 pool), SPCXB (pre-IPO, no reference price) and MUB (about $16k pool) were skipped. The four additions were verified on-chain (PancakeSwap v3 factory `getPool`, USDT side of the pool, DexScreener cross-check); the RWA `type=3` list was only checked for NVDAB/TSLAB.
- **Free pre-screen before paying for a signal:** every cycle prices all six for free (Yahoo, RWA reference, on-chain) and only buys a signal where the token trades at least 0.5% below the reference or a position is open. Spreads at the first six-stock cycle: BABAB +22 bps, CRCLB -40, METAB +2, SNDKB -78, TSLAB -55 (bps vs Yahoo).
- **Idle mid-cap pools:** in that first cycle the flow analyst refused a SNDKB signal with "0 SNDKB swaps in the last 60 min" (payment not settled) although SNDKB has about $237k DexScreener liquidity and about $214k/day volume. Mid-cap bStocks pools can sit idle for an hour while the US session is closed, so on-chain flow signals are only meaningful in active hours.
- **Approval targets move with price:** our approve script re-sent USDT/NVDAB/TSLAB approvals because allowances had drifted a few cents below the recomputed targets (USDT 748 < 750 after the $2 live buy; per-token targets are 2 × max position in token units). Harmless (about $0.01 gas, 7 approvals, e.g. `0xf5230862…7faa`), fixed by accepting an allowance within 10% of target.
- **Live fills so far:** one, operator-triggered via `POST /trade` (2 USDT → NVDAB, `0x0ce91120…3807`), through the same quote → simulate → broadcast path the loop uses. No autonomous live fill yet.

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
