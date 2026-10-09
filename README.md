# Elitr

[![CI](https://github.com/mrnetwork0001/Elitr/actions/workflows/ci.yml/badge.svg)](https://github.com/mrnetwork0001/Elitr/actions/workflows/ci.yml)
![BSC mainnet](https://img.shields.io/badge/chain-BSC%20mainnet-F0B90B)
![b402](https://img.shields.io/badge/payments-b402%20%2F%20x402%20v2-222)
![Node](https://img.shields.io/badge/node-%E2%89%A522.12-339933)

**An agent-to-agent market for tokenized-stock signals on BNB Chain.** Analyst agents sell trading signals for six bStocks (NVDAB, TSLAB, BABAB, CRCLB, SNDKB, METAB) behind an HTTP 402 paywall settled with **Binance b402**. An execution agent decides which analyst to pay with Thompson sampling, pays a cent in USDT per signal, checks the signal against Binance RWA Data, Market and Trading API prices and a set of hard risk limits, **dry-runs every transaction with the Binance Transaction API**, and then fills on PancakeSwap: as a paper fill, or live once you turn that on. Every signal is scored against the price after its horizon, so analysts earn a track record. That track record decides who gets paid next time, and it is posted on-chain as ERC-8004 reputation feedback. A Next.js dashboard streams the whole loop live over SSE.

> Built for **BNB Hack: Tokenized Stocks**. BSC mainnet only. The repo defaults to paper mode (`LIVE_TRADING=0`); the hosted desk runs **live** with small limits.

## Live now

| | |
| --- | --- |
| Landing | **https://elitr.xyz** |
| Live dashboard | **https://elitr.xyz/dashboard** (read-only for visitors; operator controls need `CONTROL_TOKEN`) |
| News analyst (b402 seller) | https://analyst.elitr.xyz/info · paid `GET /signal?symbol=NVDAB` |
| Flow analyst (b402 seller) | https://flow.elitr.xyz/info · paid `GET /signal?symbol=TSLAB` |
| Execution agent (trader) | https://agent.elitr.xyz/health · `/state` · `/summary/today` · `/rwa/board` |
| BNB Agent Studio agent "Elitr Desk Brief" | https://desk.elitr.xyz/.well-known/agent-card.json (A2A) · `GET /x402?prompt=brief` |
| ERC-8004 registration files | `/.well-known/agent-registration.json` on each agent host |

Hosted on an AWS Lightsail instance in Frankfurt (eu-central-1, an allowed region for the Binance Web3 API), behind Caddy with automatic HTTPS, each service a systemd unit that restarts on failure. See [Deployment](#deployment).

### On-chain proof (BSC mainnet)

Every row is a real transaction made by the running system.

| What | Transaction / record |
| --- | --- |
| ERC-8004 identity: News analyst **#365554** | [0x81f46ff7…8237](https://bscscan.com/tx/0x81f46ff719e2a7c244ccb39622ae05fd9960883bd19000e0c731c60a8c168237) |
| ERC-8004 identity: Flow analyst **#365555** | [0x902e8d14…db16](https://bscscan.com/tx/0x902e8d14dd118d069151834019f09fc92ceadc0f094fa78ffeb7d35cfcd9db16) |
| ERC-8004 identity: Execution agent **#365556** | [0xeb36036e…cd03](https://bscscan.com/tx/0xeb36036e4d62fad5a6919205de0cecbeb402a03afc6f282d1d0a8432fe5fcd03) |
| ERC-8004 identity: BNB Agent Studio agent "Elitr Desk Brief" **#367734** (registered with `bag erc8004 register`, gas sponsored by MegaFuel) | [0xd95b1b47…e22b](https://bscscan.com/tx/0xd95b1b475f44dd6537b3df63c380d7d0d4f948d001434cd8ed3856b96a5ae22b) |
| Probation in action: both analysts paused overnight, trader buys a probe so one can earn trust back | [0x69281625…22db](https://bscscan.com/tx/0x69281625f60af537971918cb8f2a11bb5b7e207db2c9b7ee51e0b9a1d41d22db) |
| First agent-to-agent b402 payment (trader → flow analyst, 0.01 USDT) | [0xe2a30c08…c49f](https://bscscan.com/tx/0xe2a30c0801799c2b1c128fdc4e332c8485ce3249eacedd52470e2b1971a6c49f) |
| First on-chain agent rating (trader → news analyst, ERC-8004 `giveFeedback`) | [0xf09e9f6e…87d6](https://bscscan.com/tx/0xf09e9f6edd8d64d0fd4f4a75f463ba2106093b16b2f986ad774c7b584aa887d6) |
| First live trade: 2 USDT → 0.008433 NVDAB @ $237.15 (Trading API → Transaction API simulate → broadcast) | [0x0ce91120…3807](https://bscscan.com/tx/0x0ce91120a0e7f14792a20565aa99f4a1819afafc0d1f1e9ee51ee3e36aa03807) |
| Binance **Agentic Wallet** buys a signal: USDT via Permit2 (sponsored approve → b402 settle) | [approve 0x62c33233…c822](https://bscscan.com/tx/0x62c332337eb1eb24fd2589dfe9c5afea30c9024d12ec5624cd7744724f1cc822) · [settle 0x559b481e…59b9](https://bscscan.com/tx/0x559b481ee017167040751bac274f5daf62d0bc97c75bac295ef03a9b338659b9) |
| Binance **Agentic Wallet** buys a signal: U via EIP-3009 (no approval, 3.5 s sign → signal) | [0xd2535021…2e4e](https://bscscan.com/tx/0xd2535021423ae6d30b4bbc6fde8f2b58fc0bc22dba7831c7d97c7eed78ca2e4e) |
| One-time trading approvals (Permit2 for b402; router for USDT, NVDAB, TSLAB) | [0x6996a008…ee66](https://bscscan.com/tx/0x6996a0086d528ce9b4f14fbd8b1378b4e4f31a57ad63f0f0b0ca11d82d44ee66) · [0x56210274…718c](https://bscscan.com/tx/0x56210274fab2121ccc2e74e9df7cb8a3dc9b6350e4ec153669073094eb7b718c) · [0x65de22f1…4314](https://bscscan.com/tx/0x65de22f18f696c0707b95531e35cf92fdd04b5f068712f8acf5bd47e582b4314) · [0x81aebdcf…c9c3](https://bscscan.com/tx/0x81aebdcfa1affb6212e00f887c37495870c628f539ce285fc38e47de644ec9c3) |
| A failed swap we learned from: the Trading API's suggested gas (450k) was below the simulated 457k and the swap reverted out of gas; gas is now max(suggested, simulated) × 1.25 | [0xc52edf5c…bfa6](https://bscscan.com/tx/0xc52edf5c5eacec5e43fc608cb32f5e25a7126454aa7b149f8ed3b06b8e28bfa6) |

Wallets: agent (trader) `0xc742AdA2872a042dD36D2E706907b4036968960C` · analyst payee `0x66A4c73e7C02858B49F15fBC24589A76B97C0F5a` · analyst identity owner `0xCd0a2370F2dC12c1802707B7d9aB3fec891E3c02` · Agentic Wallet demo buyer `0xD15590ba7DfDD11D47a5a13b83E6cf5CC74f6207` · Studio agent `0xFD9fBD6719a0b521314a67fF36EF26634bf71642`.

| Landing | Dashboard |
| --- | --- |
| ![Landing page](docs/screenshots/landing.png) | ![Live dashboard](docs/screenshots/dashboard.png) |

---

## Contents

[Live now](#live-now) · [Architecture](#architecture) · [One cycle](#one-cycle-sequence) · [Features vs judging criteria](#features-mapped-to-judging-criteria) · [Agentic Wallet](#binance-agentic-wallet-elitr-skill) · [Agent Studio](#bnb-agent-studio-elitr-desk-brief) · [Risk controls](#risk-controls) · [Binance APIs used](#binance-web3-apis-used) · [Quickstart](#quickstart) · [Deployment](#deployment) · [Configuration](#configuration) · [Safety](#safety-notes) · [Repo layout](#repo-layout) · [Docs](#more-docs)

## Architecture

```mermaid
flowchart TB
  subgraph Buyer["Execution agent :4002 (apps/execution-agent)"]
    direction LR
    SEL["1. Pick analyst<br/>Thompson sampling"] --> PAY["2. Pay via b402<br/>x402 v2, USDT"] --> RISK["3. Prices + risk<br/>hard limits, fail-closed"] --> EXE["4. Simulate + fill<br/>paper or live, exits"] --> REP["5. Score signal<br/>after its horizon"]
    REP -. "trust" .-> SEL
  end

  subgraph Sellers["Analyst process (apps/analyst-agent)"]
    direction LR
    NA["News analyst :4001<br/>RSS headlines + Claude via 0G Router"]
    FA["Flow analyst :4003<br/>PancakeSwap on-chain flow"]
    NA ~~~ FA
  end

  subgraph Binance["Binance Web3 API (HMAC-signed requests)"]
    direction LR
    B402["b402 facilitator<br/>supported / verify / settle"]
    RWA["RWA Data API<br/>bStocks / Ondo / xStocks"]
    MKT["Market API<br/>on-chain price"]
    TRD["Trading API<br/>quote / approve / swap"]
    TXA["Transaction API<br/>simulate / broadcast"]
    B402 ~~~ RWA ~~~ MKT ~~~ TRD ~~~ TXA
  end

  subgraph BSC["BNB Smart Chain mainnet"]
    direction LR
    USDT["USDT + Permit2<br/>signal payments"]
    PCS["PancakeSwap v3<br/>6 bStocks vs USDT"]
    ERC["ERC-8004 registries<br/>identity + reputation"]
    USDT ~~~ PCS ~~~ ERC
  end

  WEB["Dashboard :3000 (apps/web)<br/>Next.js, live over SSE"]

  Buyer == "GET /signal: 402, PAYMENT-SIGNATURE, signal" ==> Sellers
  Sellers -- "b402 verify + settle" --> Binance
  Buyer -- "RWA Data, Market, Trading, Transaction" --> Binance
  Binance -- "settle USDT, broadcast swaps (live only)" --> BSC
  Sellers -. "flow analyst reads swaps" .-> BSC
  Buyer -- "reputation feedback" --> BSC
  Sellers -. "SSE /events" .-> WEB
  Buyer -. "SSE /events, GET /state" .-> WEB
```

Three services, all plain `node:http`, no framework:

| Service | Port | Role |
| --- | --- | --- |
| `apps/analyst-agent` (news) | 4001 | b402 merchant. Pulls NVDA/TSLA headlines (Yahoo Finance + Google News RSS) and scores them 1-100 with Claude through the 0G Compute Router (Anthropic Messages format). Charges per `GET /signal`. |
| `apps/analyst-agent` (flow) | 4003 | Second seller in the same process. Deterministic signal from PancakeSwap on-chain flow. |
| `apps/execution-agent` | 4002 | b402 buyer and trader: chooses an analyst, pays, prices, runs risk checks, simulates, fills, exits, scores signals, posts reputation. |
| `apps/web` | 3000 | Scrollable landing page + live dashboard app shell (Overview, Analysts, Markets, Gap board, Portfolio, Trades, Activity, Controls); SSE from all agents, `GET /state` from execution. |

Analysts offer **two ways to pay** in every 402 (`accepts[]`): USDT via `permit2-exact` (the Elitr trader's route) and U via `eip3009` (no approval, used by Binance Agentic Wallet buyers). The buyer picks one; the analyst verifies and settles exactly that option.

## One cycle (sequence)

```mermaid
sequenceDiagram
  autonumber
  participant X as Execution agent
  participant A as Analyst (news or flow)
  participant F as Binance b402 facilitator
  participant B as Binance Web3 API
  participant C as BSC / PancakeSwap
  participant R as ERC-8004 Reputation

  X->>X: Thompson-sample analysts (trust, price), skip paused ones
  X->>A: GET /signal?symbol=NVDAB
  A-->>X: 402 Payment Required + PAYMENT-REQUIRED (x402 v2, USDT on eip155:56)
  X->>X: sign Permit2 / EIP-3009 authorization (data budget checked)
  X->>A: GET /signal + PAYMENT-SIGNATURE
  A->>F: POST /api/v2/b402/verify
  F-->>A: isValid
  A->>A: produce signal (LLM over headlines, or on-chain flow)
  A->>F: POST /api/v2/b402/settle
  F->>C: USDT transfer to analyst payTo
  A-->>X: 200 signal + PAYMENT-RESPONSE (settlement tx)
  X->>B: RWA Data /rwa/tokens, /rwa/price (market status, reference)
  X->>B: Market API /market/price (on-chain price)
  X->>B: Trading API /aggregator/quote (SWAP routes only)
  X->>X: risk engine: every check must pass, missing data fails closed
  X->>B: Trading API /approve-transaction + /aggregator/swap (calldata)
  X->>B: Transaction API /pre-transaction/simulate
  alt LIVE_TRADING=1
    X->>B: /pre-transaction/broadcast-transaction (MEV protection)
    B->>C: swap on PancakeSwap
  else default
    X->>X: paper fill at the real quoted amounts
  end
  Note over X: later, once the signal horizon has passed
  X->>B: Market API price at exit
  X->>X: mark signal correct or wrong, update trust and weight
  X->>R: giveFeedback(analyst agentId, score)
```

## Features mapped to judging criteria

| Criterion (weight) | What Elitr does |
| --- | --- |
| **Technical implementation (30%)** | Signed client in `packages/binance` for five Binance Web3 API modules (RWA Data, Market, Trading, Transaction, b402), plus a raw signed call used for the Wallet and Address Portfolio APIs, running live on BSC mainnet with real b402 settlements, a live trade, and ERC-8004 identities and feedback (see [On-chain proof](#on-chain-proof-bsc-mainnet)). Full b402 merchant (x402 v2 `402` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE`, single-use authorizations, settle only after the signal is produced) and buyer (`@x402/fetch` + `@bnb-chain/b402`, Permit2 approval handling). Every approve and swap is simulated through the Transaction API before broadcast. Risk engine fails closed on missing data, and it has unit tests. State persists atomically. CI runs on Node 22 and 24, and Docker images are provided. |
| **Creativity & originality (25%)** | Agents *buy information from each other*: a market of competing analysts with real micropayments. The buyer learns which seller to trust (Beta-Bernoulli posterior + Thompson sampling, price-aware) and publishes the result as portable ERC-8004 on-chain reputation. Two very different sellers compete: an LLM news reader and a deterministic on-chain flow reader. Any **Binance Agentic Wallet** can buy the same signals through the [Elitr Skill](skills/elitr-signals/). A **Weekend Gap board** makes the brief's opening story (frozen Friday reference vs 24/7 tokens) visible across every bStocks and Ondo token. |
| **Developer Experience Report (25%)** | [`DEVELOPER_EXPERIENCE.md`](DEVELOPER_EXPERIENCE.md) is written by the team in their own words (the hackathon rejects generated reports). It is backed by [`docs/dx-raw-log.md`](docs/dx-raw-log.md), a timestamped evidence log (the execution agent also appends to it when it hits API friction), sorted by report question in [`docs/dx-evidence.md`](docs/dx-evidence.md). |
| **Product quality & UX (20%)** | The dashboard shows the payment between agents, the signal and its sources, both reference prices, every risk check with observed vs limit values, the simulation result, fills, positions and P&L, live. There is a kill switch. A plain-English **"Today on the desk"** summary with a glossary is written for people new to crypto. Defaults are safe: simulate-only, small limits. |

### Status

| Feature | Status |
| --- | --- |
| News analyst + flow analyst as b402 merchants (two payment options: USDT/Permit2, U/EIP-3009) | Live on mainnet |
| Execution agent: b402 buyer, RWA/Market/Trading/Transaction/Wallet/Portfolio APIs, risk engine, Transaction API dry-runs | Live on mainnet |
| Thompson-sampling analyst selection, signal scoring, trust / weight / pause | Live, building a track record every 30 min (`LOOP_INTERVAL_SEC`) |
| Six bStocks (NVDAB, TSLAB, BABAB, CRCLB, SNDKB, METAB) with a free gap pre-screen before any signal is bought; exits (take-profit / stop-loss / bearish); paper vs live ledger and P&L | Live (`LIVE_TRADING=1` on the hosted desk) |
| ERC-8004 identities (#365554, #365555, #365556) + on-chain reputation feedback after each scored signal | Live on mainnet |
| Binance Agentic Wallet buying Elitr signals ([Elitr Skill](skills/elitr-signals/)) | Proven on mainnet (USDT and U routes) |
| Weekend Gap board, Wallet API / Address Portfolio, "Today on the desk" summary | Shipped |
| Hosted deployment (https://elitr.xyz), HTTPS, operator auth | Live |
| BNB Agent Studio seller agent "Elitr Desk Brief" ([`studio/`](studio/)), ERC-8004 #367734 | Live on mainnet at https://desk.elitr.xyz (self-hosted; free x402 + A2A) |
| Reputation safeguards: probation when every analyst is paused; neutral and flat-market calls don't move trust | Live |

## Risk controls

Defaults come from [`packages/shared/src/risk.ts`](packages/shared/src/risk.ts). You can override each one with an env var. A check whose input could not be observed this cycle **fails** and shows the reason. It never passes by default.

| Rule | Env var | Default | Meaning |
| --- | --- | --- | --- |
| Kill switch | `KILL_SWITCH` | off | Env flag, or `POST /kill` at runtime. Persisted to `<EXECUTION_DATA_DIR>/kill-switch`, so it survives restarts; one-way until `POST /kill/reset` (same bearer token) or the file is removed. The env flag cannot be reset at runtime. |
| Max trade | `RISK_MAX_TRADE_USD` | $5 | Notional per trade. |
| Max position | `RISK_MAX_POSITION_USD` | $25 | Per asset, after the trade. |
| Max portfolio | `RISK_MAX_PORTFOLIO_USD` | $50 | All positions combined. |
| Max daily spend | `RISK_MAX_DAILY_SPEND_USD` | $25 | USDT spent on buys per UTC day. |
| Max daily data spend | `RISK_MAX_DAILY_DATA_USD` | $1 | b402 spend on signals per UTC day. |
| Max slippage | `RISK_MAX_SLIPPAGE_BPS` | 100 bps | Route price impact; also pinned as swap slippage. Hard cap 500. |
| Min liquidity | `RISK_MIN_LIQUIDITY_USD` | $50,000 | USDT in the primary PancakeSwap v3 pool. |
| Min confidence | `RISK_MIN_CONFIDENCE` | 65 | Signal score (after the reputation weight), 1-100. |
| Stance | n/a | bullish | Buys need a bullish call. |
| Min gap | `RISK_MIN_GAP_BPS` | 50 bps | On-chain price must sit this far below the TradFi reference. |
| Probe signal | `RISK_PROBE_SIGNALS` | on | When no asset clears the free pre-screen and nothing is held, one signal is still bought for the asset closest to qualifying, so the analysts keep being scored (at most $0.01 per cycle). The buy itself still needs every check above. |
| Max signal age | `RISK_MAX_SIGNAL_AGE_SEC` | 300 s | Stale signals are rejected. |
| Take profit | `RISK_TAKE_PROFIT_BPS` | 300 bps | Exit when up this much vs average cost. |
| Stop loss | `RISK_STOP_LOSS_BPS` | 200 bps | Exit when down this much. |
| Exit on bearish | `RISK_EXIT_ON_BEARISH` | on | Sell an open position on a bearish signal. |
| Analyst pause | `RISK_MIN_ANALYST_TRUST` / `RISK_MIN_ANALYST_SAMPLES` | 0.45 / 10 | Stop paying an analyst whose trust falls below 0.45 after 10 scored signals. |
| Simulatable route | n/a | SWAP only | RFQ routes cannot be dry-run, so they are refused. |
| Balances | `EXECUTION_MIN_BNB_GAS` | 0.001 BNB | Enough USDT for the trade and BNB for gas. |

## Binance Web3 APIs used

Base `https://web3.binance.com/build`. Every call is signed (`X-OC-APIKEY`, `X-OC-TIMESTAMP` ISO-8601, `X-OC-NONCE`, `X-OC-RECV-WINDOW`, HMAC `X-OC-SIGN`). See [`packages/binance/src`](packages/binance/src).

| Module | Endpoint | Used by | Purpose |
| --- | --- | --- | --- |
| RWA Data | `GET /api/v1/dex/market/rwa/tokens` | execution | Confirm the asset is a listed bStocks token; market status, next open time. |
| RWA Data | `GET /api/v1/dex/market/rwa/price` | execution | Token price and reference price. |
| RWA Data | `GET /api/v1/dex/market/rwa/underlying-market` | execution | Underlying market data. |
| Market | `POST /api/v1/dex/market/price` | execution | Live on-chain price on BSC. |
| Trading | `GET /api/v1/dex/aggregator/quote` | execution | Cross-DEX quote; only SWAP routes are eligible. |
| Trading | `GET /api/v1/dex/aggregator/approve-transaction` | execution | USDT approval calldata for the route's spender. |
| Trading | `GET /api/v1/dex/aggregator/swap` | execution | Swap calldata with slippage and price-impact protection. |
| Transaction | `POST /api/v1/dex/pre-transaction/simulate` | execution | Dry-run of every approve and swap (and the Permit2 approve). |
| Transaction | `POST /api/v1/dex/pre-transaction/broadcast-transaction` | execution | Broadcast with MEV protection (live mode only). |
| Transaction | `POST /api/v1/dex/pre-transaction/gas-limit` | execution | Gas figure for each simulated transaction (used to size the live gas limit). |
| Transaction | `GET /api/v1/dex/post-transaction/transaction-detail-by-txhash` | execution | Post-trade detail. |
| Wallet | `GET /api/v1/dex/balance/all-token-balances-by-address` | execution | Agent wallet holdings for the Portfolio view. |
| Wallet | `GET /api/v1/dex/post-transaction/transactions-by-address` | execution | Recent on-chain transactions for the Portfolio view. |
| Address Portfolio | `GET /api/v1/dex/market/portfolio/overview` | execution | Portfolio overview of the agent wallet. |
| RWA Data | `GET /api/v1/dex/market/rwa/platforms`, `/rwa/tokens?tabId=…` | execution | Weekend Gap board: every bStocks and Ondo token, sector tabs (Mag 7, AI chips, ETF…). |
| Market | `GET /api/v1/dex/market/token/top-liquidity` | execution | Liquidity for traded and cross-issuer tokens on the Gap board. |
| b402 | `POST /api/v2/b402/supported` | analysts | Payment kinds (scheme, network, Permit2 / EIP-3009, signer). |
| b402 | `POST /api/v2/b402/verify` | analysts | Verify the buyer's signed authorization. |
| b402 | `POST /api/v2/b402/settle` | analysts | Settle on-chain after the signal is produced. |

Other data: BSC JSON-RPC via viem (balances, pool liquidity, receipts), Yahoo Finance chart API (independent TradFi reference; the RWA `referencePrice` is derived from the on-chain price), and Yahoo Finance / Google News RSS (headlines).

**Tokenized stocks.** Traded: six bStocks with verified PancakeSwap v3 USDT pools above the $50k floor and a real underlying with a Yahoo quote: **NVDAB, TSLAB, BABAB, CRCLB, SNDKB, METAB**. Skipped: TSMB (thin volume), IBMB (~$900 pool), SPCXB (pre-IPO, no reference price), MUB (~$16k pool). Tracked but not traded: NVDAon (Ondo), TSLAx (xStocks). Before paying for a signal, the trader pre-screens each asset for free: a signal is bought only when the on-chain price is already at least `RISK_MIN_GAP_BPS` below the Yahoo reference (or a position is open), so the signal budget goes to actionable calls. When nothing qualifies and nothing is held, one probe signal is still bought for the closest asset, so track records keep growing through quiet sessions and weekends (`RISK_PROBE_SIGNALS=0` disables it). Addresses are in [`packages/shared/src/assets.ts`](packages/shared/src/assets.ts) and were verified on-chain.

## Binance Agentic Wallet: Elitr Skill

[`skills/elitr-signals/`](skills/elitr-signals/) is a Binance Wallet Skill. With it, any Agentic Wallet (any Claude Code / AI agent with the Binance skills) can:
1. **discover** Elitr's analysts (`GET /info`: price, horizon, ERC-8004 id)
2. **pay for a signal** with the wallet's own x402 support: `baw x402-payment preview` → `sign` → replay with `PAYMENT-SIGNATURE`
3. explain it in plain English
4. on explicit confirmation, **buy the bStock** in the user's own wallet (`baw market-order`)

Proven on mainnet with both payment routes (see [On-chain proof](#on-chain-proof-bsc-mainnet)). Install and runbook: [`docs/agentic-wallet.md`](docs/agentic-wallet.md).

## BNB Agent Studio: Elitr Desk Brief

[`studio/ElitrDesk/`](studio/ElitrDesk/) is a `bag init` seller agent, "Elitr Desk Brief", built on the Agent Studio runtime. It has its own wallet and its own **ERC-8004 identity #367734 on BSC mainnet**, registered with `bag erc8004 register`. It exposes A2A (`/.well-known/agent-card.json`, skills `brief_preview` and `desk_brief`) and x402 (`/x402?prompt=brief`). The brief covers the live Elitr desk: summary, analysts' track records and ERC-8004 ids, positions and P&L, and weekend-gap spreads. It is built only from Elitr's public endpoints, and a request is never charged if those can't be reached.

**Why self-hosted on mainnet:**
- Studio's managed runtime is a 48 h testnet trial that would expire before judging (12–23 Oct).
- NodeOps, one self-deploy target, was offline after a security incident.
- AWS AgentCore requires a quota and OAuth-gated endpoints.

So it runs on the Elitr server as a systemd service behind https://desk.elitr.xyz, and stays up through judging.

**Why the x402 brief is free:** paid x402 needs B402 production merchant credentials. The application form was closed, and Studio's own docs flag paid mainnet x402 as not yet production-ready. Self-funding over b402 is demonstrated on mainnet by Elitr's analysts, which have 20+ real settlements.

Details: [`studio/README.md`](studio/README.md).

## Quickstart

Requirements: Node ≥ 22.12 (`.nvmrc` = 24), pnpm 9 (`corepack enable`), a Binance Web3 API key with **B402 Payments** permission, and an LLM key (0G Compute Router or Anthropic).

### Local

```bash
corepack enable
pnpm install
cp .env.example .env        # fill in keys (never commit .env)
pnpm build
pnpm dev                    # analysts :4001 + :4003, execution :4002, dashboard http://localhost:3000
```

Trigger a cycle on demand: `curl -X POST localhost:4002/cycle` (send `Authorization: Bearer $CONTROL_TOKEN` when one is set). Run the checks CI runs: `pnpm build && pnpm typecheck && pnpm test`.

### Docker

```bash
cp .env.example .env        # fill in keys, and set CONTROL_TOKEN (e.g. openssl rand -hex 32)
docker compose up -d --build
open http://localhost:3000
docker compose logs -f execution
docker compose down          # state survives in the elitr-data volume
```

Compose overrides what must differ inside containers: execution binds `0.0.0.0`, which is why `CONTROL_TOKEN` is required, and it reaches the analysts at `http://analyst:4001` / `:4003`. `NEXT_PUBLIC_*` URLs are baked into the dashboard at **build** time. Rebuild `web` after you change them. Port 4002 is published on loopback only. See [`docs/deploy.md`](docs/deploy.md) for hosting (Vercel + Railway/Fly/VPS).

## Deployment

Production runs on one AWS Lightsail instance (Ubuntu 24.04, 2 GB, Frankfurt):

| Piece | How |
| --- | --- |
| Code | built on the server with pnpm (`pnpm install --frozen-lockfile`, `pnpm -r build`); the dashboard is built with `NEXT_PUBLIC_*_URL=https://{analyst,flow,agent}.elitr.xyz` |
| Services | systemd units `elitr-analyst` (4001 + 4003), `elitr-execution` (4002), `elitr-web` (3000), all bound to `127.0.0.1`, `Restart=always` |
| HTTPS | Caddy with automatic Let's Encrypt certificates for `elitr.xyz`, `www` (redirects), `analyst.`, `flow.`, `agent.`; SSE streams proxied unbuffered |
| Secrets | `~/elitr/.env` (mode 600), never committed; the analyst-owner key is not on the server |
| Operator controls | `POST /cycle`, `/kill`, `/kill/reset`, `/trade` need `Authorization: Bearer $CONTROL_TOKEN`; browsers may only call the agents from `https://elitr.xyz` (CORS) |
| State | `~/elitr/data/` (events, ledger, reputation) |

`POST /trade` (operator only) runs one small buy or a full-position sell through the same quote → simulate → broadcast path as an autonomous cycle, capped at `RISK_MAX_TRADE_USD`. It proves live execution on demand.

Alternatives (Docker compose, Railway/Fly, VPS) are in [`docs/deploy.md`](docs/deploy.md).

## Configuration

All apps read one `.env` at the repo root. The full annotated list is in [`.env.example`](.env.example).

| Variable | Service | Purpose |
| --- | --- | --- |
| `BINANCE_WEB3_API_KEY`, `BINANCE_WEB3_API_SECRET` | all | Binance Web3 API credentials (analyst key needs B402 Payments permission). |
| `ANALYST_PORT` | analyst | News analyst port (4001). The flow analyst listens on 4003. |
| `ANALYST_PAY_TO` | analyst | Merchant payTo. Must equal the write-once address set in B402 onboarding. |
| `ANALYST_PRICE_WEI` | analyst | Price per signal in smallest units (default 0.01 of an 18-decimal stablecoin). |
| `ANALYST_PAYMENT_ASSET`, `ANALYST_PAYMENT_METHOD` | analyst | USDT + `permit2-exact` (default), or U / USD1 + `eip3009`. |
| `ANALYST_PAYMENT_TOKEN_NAME`, `ANALYST_PAYMENT_TIMEOUT_SEC` | analyst | Kind disambiguation, authorization validity. |
| `ANALYST_PUBLIC_URL` | analyst | Public URL put in the 402 `resource` field. |
| `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN` | analyst | 0G Compute Router (Claude over the Anthropic Messages API). |
| `ANTHROPIC_API_KEY` | analyst | Alternative: Anthropic directly. |
| `ANALYST_MODEL`, `SIGNAL_CACHE_SEC`, `ANALYST_HORIZON_SEC` | analyst | Model id, signal cache TTL, horizon a news call is scored over. |
| `FLOW_ANALYST_PORT`, `FLOW_ANALYST_PAY_TO`, `FLOW_ANALYST_PRICE_WEI`, `FLOW_ANALYST_PUBLIC_URL` | analyst | Flow analyst port (4003, `0` disables), its merchant payTo / price / public URL (fall back to the news analyst's). |
| `FLOW_RPC_URL`, `FLOW_LOOKBACK_SEC`, `FLOW_MIN_SWAPS`, `FLOW_LARGE_TRADE_USD`, `FLOW_HORIZON_SEC`, `FLOW_LOGS_CHUNK_BLOCKS` | analyst | On-chain flow window and thresholds. |
| `EXECUTION_PORT`, `EXECUTION_HOST` | execution | Bind address (default `127.0.0.1:4002`). |
| `CONTROL_TOKEN` | execution | Bearer token for `POST /cycle`, `/kill`, `/kill/reset` and `/trade`. Required when the host is not loopback, and always when `LIVE_TRADING=1`. |
| `ANALYSTS`, `ANALYST_URL` | execution | Analysts to buy from (`id=url,...`), legacy single URL. |
| `EXECUTION_PRIVATE_KEY` | execution | Dedicated hot wallet. Fund with small amounts only. |
| `BSC_RPC_URL` | execution | BSC JSON-RPC. |
| `EXECUTION_TRADE_USD`, `EXECUTION_MIN_BNB_GAS`, `EXECUTION_MEV_PROTECTION` | execution | Trade size, gas floor, MEV-protected broadcast. |
| `EXECUTION_MAX_FEE_BNB` | execution | Worst-case fee (gas limit × gas price) a single signed transaction may cost (default 0.01). Anything above, a gas limit over 3M or a gas price over 3× the network's is refused unsigned. |
| `B402_TRUSTED_SPENDERS` | execution | Override the curated b402 Permit2 spenders. |
| `LOOP_INTERVAL_SEC` | execution | Seconds between cycles (`0` = on-demand only). |
| `EXECUTION_DATA_DIR` | execution | Override the state directory (default `<repo>/data`). |
| `LIVE_TRADING` | execution | `1` to sign and broadcast. Anything else is simulate-only. |
| `RISK_*`, `KILL_SWITCH` | execution | See [Risk controls](#risk-controls). |
| `ERC8004_CHAIN_ID`, `ERC8004_RPC_URL`, `ERC8004_*_REGISTRY` | identity | Chain and registries (canonical BSC 56 / 97 addresses by default). |
| `ERC8004_AGENT_ID_ANALYST`, `ERC8004_AGENT_ID_ANALYST_FLOW`, `ERC8004_AGENT_ID_EXECUTION` | all | Agent ids after `pnpm --filter @elitr/identity register`. |
| `ANALYST_OWNER_PRIVATE_KEY`, `ANALYST_FLOW_OWNER_PRIVATE_KEY`, `EXECUTION_PUBLIC_URL` | identity | Owner keys for registration (must differ from the trader key: no self-feedback). |
| `ERC8004_POST_FEEDBACK` | execution | `1` = post each scored analyst's accuracy on-chain (costs gas). |
| `NEXT_PUBLIC_ANALYST_URL`, `NEXT_PUBLIC_FLOW_ANALYST_URL`, `NEXT_PUBLIC_EXECUTION_URL` | web | Agent URLs the browser connects to (build time). |
| `DASHBOARD_ORIGIN` | agents | CORS origin allowed to read the agents. |

## Safety notes

- **Simulate-only by default.** Quotes, prices, simulations and b402 payments are real, but no swap is signed or broadcast until `LIVE_TRADING=1`. The Permit2 approval for b402 is also simulated and *not sent* in that mode.
- **Every transaction is dry-run** through the Transaction API first. A failed simulation stops the trade.
- **Use a dedicated hot wallet** (`EXECUTION_PRIVATE_KEY`) with a few dollars of USDT and BNB. Approvals are bounded: USDT to the swap router is 30 days of the daily buy budget, USDT to Permit2 is 30 days of the signal budget, and each stock token is 2× the max position. They are never unlimited.
- **Control endpoints** (`POST /cycle`, `/kill`, `/kill/reset`, `/trade`) bind to loopback by default. Exposing them, or running with `LIVE_TRADING=1`, needs `CONTROL_TOKEN`. `/kill` persists to disk and stays engaged across restarts until `POST /kill/reset`.
- **Fail-closed sends.** Every signed transaction is checked against a gas and fee budget first, the swap destination must be the quoted spender or a known PancakeSwap router, and a swap that was broadcast but not booked (crash mid-trade) is reconciled from its receipt on the next start or cycle.
- **Secrets** live only in `.env` (git-ignored, docker-ignored, never baked into images).
- **Regions.** The Binance Web3 API refuses requests from [restricted regions](https://web3.binance.com/en/dev-docs/web3-api-prohibited-regions) (including the US, Canada, the Netherlands, the UK and Japan). Host the agents somewhere allowed. See [`docs/deploy.md`](docs/deploy.md).
- **Issuer controls.** bStocks and Ondo tokens are upgradeable proxies with a compliance hook, so the issuer can block transfers. Not financial advice. Agents are judged on build quality, not P&L.

## Repo layout

```
apps/
  analyst-agent/     b402 merchant: news analyst :4001 (+ flow analyst :4003), signal + scorer
  execution-agent/   b402 buyer + trader: cycle, pay, prices, risk, trade, ledger, state
  web/               Next.js: scrollable landing + /dashboard app shell (7 views + Gap board)
packages/
  binance/           signed Binance Web3 API client (RWA, Market, Trading, Transaction, b402)
  shared/            assets, risk config, event types, SSE EventHub
  reputation/        signal scoring, Beta trust, Thompson-sampling analyst selection
  identity/          ERC-8004 identity + reputation registry client
skills/
  elitr-signals/     Binance Wallet Skill: Agentic Wallet discovers, pays for and acts on Elitr signals
studio/
  ElitrDesk/         BNB Agent Studio seller agent ("Elitr Desk Brief"), self-hosted on BSC mainnet at desk.elitr.xyz
docker/              agent.Dockerfile (both agents), web.Dockerfile
docs/                deploy guide, DX evidence log, API reference snapshots
data/                runtime state + event logs (git-ignored, Docker volume)
```

## More docs

- [`ARCHITECTURE.md`](ARCHITECTURE.md): how it works, module by module.
- [`DEVELOPER_EXPERIENCE.md`](DEVELOPER_EXPERIENCE.md): developer experience report (written by the team in their own words).
- [`docs/dx-raw-log.md`](docs/dx-raw-log.md): timestamped raw evidence behind the DX report.
- [`docs/dx-evidence.md`](docs/dx-evidence.md): that evidence sorted by DX report question.
- [`docs/agentic-wallet.md`](docs/agentic-wallet.md): Elitr Skill for Binance Agentic Wallet, install + paid-run runbook.
- [`docs/agent-studio.md`](docs/agent-studio.md): BNB Agent Studio + ERC-8004 setup.
- [`docs/deploy.md`](docs/deploy.md): alternative deployments (Docker compose, Railway / Fly.io, VPS).
- [`studio/README.md`](studio/README.md): Elitr Desk Brief on BNB Agent Studio.

License: none chosen yet.
