# Developer Experience Report: evidence record

Elitr's team submitted its Developer Experience Report through the hackathon's official form. This file is the factual record behind it: what happened, where, and what we observed while building and running Elitr on BSC mainnet between 4 and 10 October 2026. Each item can be traced to [`docs/dx-raw-log.md`](docs/dx-raw-log.md) (timestamped), [`docs/agentic-wallet.md`](docs/agentic-wallet.md), [`docs/agent-studio.md`](docs/agent-studio.md), the live event log, or a transaction on BSC.

Doc pages are on `https://web3.binance.com`. API paths are relative to `https://web3.binance.com/build`.

**Modules used:** RWA Data API, Market API, Trading API, Transaction API, Wallet API, b402 Payments, Agentic Wallet with Wallet Skills and the `baw` CLI, and BNB Agent Studio. We did not use the DeFi API.

## 1. Onboarding

- **Timeline.** We applied for the API key on 4 Oct. Our first successful signed call was on 7 Oct: `POST /api/v1/dex/market/price`, HTTP 200, 531 ms. Most of that time went on the key and on network access, not on reading the docs.
- **Network access.** From home Wi-Fi, `web3.binance.com` (CloudFront) accepted the TCP connection, but the TLS handshake stalled. `www.binance.com` loaded fine. This happened on two separate days. A mobile hotspot fixed it at once. The docs have no connectivity or region troubleshooting section.
- **Region.** Two VPS offers we were given were in Montréal, Canada, which is a restricted region. We only found out by reading the hackathon rules. The API still answered unauthenticated requests from there. We moved to Frankfurt.
- **Signing worked first time** once the API was reachable. The Authentication page (`/en/dev-docs/authentication`) warns that `requestPath` must include the `/build` prefix. That warning was accurate and saved us a debugging session.
- **b402 needs its own setup before any call works.** That means a separate application in the developer portal, a write-once `payTo` address, and an API key with the "B402 Payments" permission ticked.
- **llms-full.txt.** We fed `/en/dev-docs/llms-full.txt` to an AI coding agent. Wherever the reference had tables, the agent's output was right. Where it didn't, the agent guessed:
  - It guessed `address` for the Wallet API's wallet parameter, but the API wants `walletAddress`, plus `binanceChainId` and `timeFrame` for the portfolio overview.
  - It inferred the b402 response fields from the guide's prose.
  - It followed the Trading API flow order, which doesn't work for equity tokens (see section 2).

## 2. Documentation issues

- **b402 integration guide** (`/en/dev-docs/products/b402-api/integration-guide`). It says to "select a kind matching the asset", but the kinds returned by `/supported` have no asset field. You have to map the token's EIP-712 `extra.name` to an address yourself.
- **b402 API reference.** Only the response envelope is documented. The fields `kinds`, `isValid`, `invalidReason`, `payer`, `success`, `transaction` and `errorReason` appear only in the integration guide's prose.
- **b402 reference, `extra.spenderAddress`.** It is typed `string | null`, but the official `@bnb-chain/b402` client throws on `null`, and the guide's eip3009 example leaves the key out.
- **Trading API integration flow** (`/en/dev-docs/products/trading-api/integration-flow`). It says to call `/approve-transaction` before `/quote`. For equity tokens, the required `vendor` only exists after `/quote`.
- **RWA Data reference** (`/rwa/tokens`, `/rwa/underlying-market`). Nested objects render as an unnamed "object", so the market-status and market-data keys aren't named.
- **RWA Data `platformId`.** The enum is only `ondo | bstock`. xStocks can't be queried, although the hackathon lists xStocks as an eligible issuer.
- **Wallet API and Address Portfolio** (`/en/dev-docs/products/wallet-api/introduction`). The pages have one-line descriptions, with no parameter or response tables.
- **Transaction API `/simulate`.** The response has no gas figure, so a second call to `/gas-limit` is needed. The docs don't connect the two.
- **Agentic Wallet x402 preview example.** It lists USDT with `eip3009`. The b402 asset table says USDT doesn't support EIP-3009; only U and USD1 do.
- **Under-documented topics:**
  - gas headroom for swaps
  - the x402 signature lifetime, which is about 30 s and is mentioned only in an expired campaign file
  - per-endpoint rate limits
  - connectivity and region checks
  - `@x402/core` spend controls (section 3)

## 3. API pitfalls

- **Trading API `/api/v1/dex/aggregator/swap` gas was too low.** For a 2 USDT → NVDAB swap it returned `tx.gas = 450000`. The Transaction API simulation of the same transaction measured 457,414.
  - Signing with the suggested limit reverted on-chain out of gas: tx [`0xc52edf5c…bfa6`](https://bscscan.com/tx/0xc52edf5c5eacec5e43fc608cb32f5e25a7126454aa7b149f8ed3b06b8e28bfa6), gasUsed 443,576.
  - The retry at max(suggested, simulated) × 1.25 filled: tx [`0x0ce91120…3807`](https://bscscan.com/tx/0x0ce91120a0e7f14792a20565aa99f4a1819afafc0d1f1e9ee51ee3e36aa03807).
- **b402 business failures return HTTP 200.** You have to check `data.isValid` and `data.success`. The b402 success code is the string `"000000000"`, while the other modules return `code: 0`.
- **Wallet API `all-token-balances-by-address`** returned `tokenAssets: []` for a wallet holding BNB and USDT on-chain, and for every wallet we tried.
- **Wallet API `transactions-by-address`** returned `40001 Parameter error` for about 30 parameter combinations, including an empty query. The message doesn't name the parameter.
- **Client SDK messages:**
  - `@x402/core`'s default spend controls reject every b402 asset with "rejected by spendControls" until you call `setSpendControls({allowedAssets})`. The `@bnb-chain/b402` README doesn't mention this.
  - `@x402/fetch` re-wraps `B402Permit2ApprovalRequiredError` as a plain `Error`. The token, owner and required amount are only recoverable through the `onPaymentCreationFailure` hook.
- **Rate limits.** We got four HTTP 429 responses with code `42900` on `/api/v1/dex/market/rwa/tokens` and `/api/v1/dex/market/rwa/price` on 8 Oct, at 12:28 UTC and three within six seconds at 17:16 UTC. We were far below the documented 1,200 requests per 60 s per IP and per key. The error description mentions per-endpoint limits but gives no numbers. We handle 429 as a soft error, and the cycle continues on Yahoo and on-chain prices.
- **Latency observed:**
  - `market/price`: 531 ms
  - `rwa/price`: 302 ms
  - b402 `/supported`: 409 ms
  - unauthenticated probes: 0.28 to 0.65 s

  Loading the full gap board takes about 10 s: two token lists, prices for 488 tokens in batches of 25, and 13 sector tabs.
- **Data we could not take at face value:**
  - The RWA `referencePrice` is documented as derived from the on-chain price, so for most bStocks it equals the token price. On 10 Oct, TSLAB's token price and reference were both 382.90. It can't tell you whether a token is cheap, so we added Yahoo Finance as an independent reference.
  - The RWA market status read "tradable, TRADING" while the US session was closed.
  - On 10 Oct only 233 of the 488 tokens on the gap board agreed on the US market status.
- **Authentication** gave us no trouble.

## 4. AI stack: Agentic Wallet, Wallet Skills, BNB Agent Studio

**Agentic Wallet with `baw`** (two real paid runs on mainnet: USDT via Permit2, approve [`0x62c33233…c822`](https://bscscan.com/tx/0x62c332337eb1eb24fd2589dfe9c5afea30c9024d12ec5624cd7744724f1cc822) and settle `0x559b481e…59b9`; U via EIP-3009, [`0xd2535021…2e4e`](https://bscscan.com/tx/0xd2535021423ae6d30b4bbc6fde8f2b58fc0bc22dba7831c7d97c7eed78ca2e4e), 3.5 s from signature to signal):

- **What worked:**
  - The buyer flow is two commands (`x402-payment preview`, `sign`) plus a header replay.
  - Preview reports balance, approval need and daily-limit blocks before anything is signed.
  - The Permit2 approve is gas-sponsored on BSC.
  - x402 spending has its own daily limit, separate from trading.
  - Login took about a minute (QR code, pairing code, Secure Auto Sign).
- **The installed `baw` (1.9.0) was older than skill v1.12.0 requires (1.10.0).** Upgrading also needed `--allow-scripts=@github/keytar` for Keychain session storage.
- **In 1.9.0, nested `--help` prints the root help.** The working form is `baw x402-payment help preview`. The default `--gasLevel` was HIGH in 1.9.0 help but MEDIUM in the skill docs; 1.10.0 matches the docs.
- **The Permit2 method has two names:** `permit2` in the Agentic Wallet, `permit2-exact` in b402. Neither doc maps one to the other, though preview resolves it correctly.
- **`selectedIndex` is not stable.** After the wallet received U, preview reordered the two payment options, so a script must pick by token.
- **`baw market-order list --orderId 26100700001947839168`** printed "No orders found" seconds after that swap completed.
- **`baw x402-payment preview` returns `NOT_LOGGED_IN` (code `10003000`) when signed out**, although it is a read-only quote.
- **Missing:**
  - an x402 page in the Agentic Wallet docs
  - bStocks (`type=3`) and xStocks in the tokenized-securities prerequisite skill, which knows only Ondo
  - Skill v1.12.0 still routes "buy a bStock" to a 43 KB campaign file for a campaign that ended on 1 Sep

**BNB Agent Studio** (`@bnbagent/studio-cli` 0.0.14, agent "Elitr Desk Brief", ERC-8004 #367734, live at https://desk.elitr.xyz):

- **Managed runtime.** `--destination platform` is a 48-hour BSC testnet trial whose clock starts at first deploy and can't be reset, so it can't stay up through judging (12 to 23 Oct). NodeOps was down after a security incident. AWS AgentCore needs an AgentCore quota and gives only OAuth-gated endpoints. We self-hosted `bag dev` behind Caddy.
- **ERC-8004 registration.**
  - `bag erc8004 register --network bsc-mainnet` refused below about 0.002 BNB, while `bag doctor` warns at 0.02 BNB.
  - The registration (713,813 gas) was then sponsored by MegaFuel and cost 0 BNB: tx [`0xd95b1b47…e22b`](https://bscscan.com/tx/0xd95b1b475f44dd6537b3df63c380d7d0d4f948d001434cd8ed3856b96a5ae22b).
  - The command waited about 5 minutes and reported "broadcast but not confirmed yet", although the tx had confirmed.
  - `update-metadata` did the same: it confirmed at block 126,430,664 but was reported as failed.
- **`bag erc8004 show` and `get-metadata` still answer "has no registered agent" for our wallet**, while the registry returns its owner, tokenURI and metadata for #367734.
- **Config friction.**
  - `bag config set` refuses to switch to bsc-mainnet while the seller assets hold TEST_* ids, and refuses mainnet assets as cross-network first, so both have to be edited in the file together.
  - On mainnet only "U" was accepted as a seller asset.
- **The scaffolded agent card uses only `AGENTCORE_RUNTIME_URL` for its URL**, so a self-hosted agent advertised `http://localhost:9000` until we patched it to read `BNBAGENT_PUBLIC_URL`.
- **Paid x402 on every Studio target needs B402 (OnchainPay) merchant credentials:** an RSA key, an egress-IP allowlist, and separate sandbox and production applications. The application form was closed, and Studio's own guide says not to claim mainnet readiness yet. These credentials are separate from the Web3 API b402 facilitator keys, which work with a normal API key. So the Desk Brief is free (`price_usd = "0"`).

## 5. Tokenized-stock specifics

- **Liquidity on PancakeSwap v3 USDT pools, 4 Oct:**
  - NVDAB about $4.2M
  - TSLAB about $2.0M
  - Ondo pools under $10k
  - TSLAx/USDT about $23

  On 10 Oct our risk checks read about $3.5M in the NVDAB pool and about $96k for SNDKB, against our $50k floor. We skipped TSMB (about $15k a day of volume), IBMB (about a $900 pool), MUB (about a $16k pool) and SPCXB (pre-IPO, no reference price).
- **Slippage:**
  - NVDAB quotes for 10 and 1,000 USDT showed about zero price impact.
  - Our live 2 USDT buy filled at $237.15.
  - The autonomous stop-loss sell of 0.008433 NVDAB filled at $232.12, against a $231.90 trigger mark: tx [`0x37ff1c71…3b11`](https://bscscan.com/tx/0x37ff1c71218a1a68d3c5f04985398fe12796c2a984c6e11e64d8003e941d3b11).
  - We never quoted large enough to find where the book gives out.
- **Outside market hours:**
  - On Sunday 4 Oct, NVDAB traded about 0.6% above Nvidia's Friday close. Midweek it ranged from −0.6% to +0.4%.
  - In the 9 Oct US premarket, all six bStocks sat 50 to 300 bps above Yahoo, for example BABAB +297 bps.
  - On Saturday 10 Oct, against Friday's close: CRCLB +1.1%, SNDKB +0.54%, NVDAB +0.51%, BABAB −0.47%.
  - Mid-cap pools go quiet while the US is closed. Our flow analyst refused signals with "0 SNDKB swaps in the last 60 min" and "4 METAB swaps in the last 60 min", and no payment was settled either time.
- **Gap and actionability.** Against the RWA reference the spread is about zero, because that reference follows the on-chain price. Against Yahoo the gaps were real but mostly premiums. Our trader buys only when a token is at least 50 bps below the reference, so the free pre-screen held off on buying a signal 515 times. Ondo tokens showed 4 to 6% gaps (ECOon +6.2%) with no usable liquidity.
- **Same ticker across issuers.**
  - Only bStocks had tradable depth (NVDAB about $4M, NVDAon under $10k).
  - Ondo routes through RFQ, which the Transaction API can't simulate, so we couldn't dry-run and trade it.
  - xStocks aren't in the RWA Data API.
  - bStocks and Ondo tokens are both beacon proxies with a `compliance()` hook (blocklist and upgrade possible), which isn't documented for developers.
  - The gap board found 40 tickers listed by both bStocks and Ondo.

## 6. Requests that came out of the build

Each of these replaces a workaround we had to write.

- An independent reference price in the RWA Data API, meaning the official last close with its timestamp. We had to add Yahoo.
- A gas figure with headroom in `/simulate`. It would remove the second call and the out-of-gas revert above.
- Simulation with state overrides, to dry-run a sell without holding the tokens. Also RFQ simulation, so Ondo routes can be dry-run.
- An xStocks `platformId` in the RWA Data API.
- A b402 `/supported` that includes the asset address, and one b402 SDK covering both merchant and buyer, with x402 `upto` support.
- Documented Wallet API schemas, plus working `all-token-balances-by-address` and `transactions-by-address`.
- Published per-endpoint rate limits.
- Agent Studio hosting for an existing Node service, and a managed runtime that outlives a 48-hour testnet trial. Also the MCP server, which is listed as "coming soon".
- An x402 page in the Agentic Wallet docs, covering the signature lifetime and the `permit2` / `permit2-exact` naming.
