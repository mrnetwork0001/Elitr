# Elitr Architecture

This document covers how the agents are built and how they use the Binance Web3 API and BNB Chain. For the pitch, diagrams and quickstart, see [README.md](README.md).

## 1. Stack (as built)

| Layer | Choice | Notes |
| --- | --- | --- |
| Runtime | Node.js ≥ 22.12, TypeScript (ESM, `NodeNext`), pnpm 9 workspaces | No agent framework. Each agent is a plain `node:http` server with a self-scheduling loop. |
| LLM | `@anthropic-ai/sdk` → **0G Compute Router** (`ANTHROPIC_BASE_URL=https://router-api.0g.ai`, Bearer `ANTHROPIC_AUTH_TOKEN`) or Anthropic directly | The sentiment score is extracted with forced tool use (`tools` + `tool_choice`), not `output_config`: the 0G Router passes tools through but does not enforce `output_config`, which came back as fenced markdown. Only the news analyst uses an LLM. |
| Chain | **viem** on BSC mainnet (chainId 56) | Balances, pool liquidity, receipts, local signing (live mode only). |
| Agent payments | **b402** (Binance's x402 v2 facilitator). Merchant side is our own code; buyer side uses `@x402/fetch` + `@x402/core` + `@bnb-chain/b402` | USDT via Permit2 (`permit2-exact`) or U / USD1 via EIP-3009. |
| Binance Web3 API | `packages/binance`, a hand-written signed client | Five modules have typed helpers in the client: RWA Data, Market, Trading, Transaction, b402. Wallet, Address Portfolio, `rwa/platforms`, `token/top-liquidity` and `pre-transaction/gas-limit` are raw `client.call`s from the execution agent (`walletApi.ts`, `rwaBoard.ts`, `trade.ts`). |
| Dashboard | Next.js 16 (App Router), React 19, Tailwind 4 | Client-side `EventSource` to each agent's `/events`, polling of execution `/state`. |
| Identity / reputation | ERC-8004 Identity + Reputation registries on BSC (`packages/identity`, viem) | Registration CLI plus opt-in `giveFeedback` (`ERC8004_POST_FEEDBACK=1`). See [`docs/agent-studio.md`](docs/agent-studio.md). |
| Studio agent | `studio/ElitrDesk`, a `bag init` seller on `@bnbagent/studio-runtime` | "Elitr Desk Brief", ERC-8004 #367734 on BSC mainnet, A2A card at `desk.elitr.xyz`, free x402 brief. See [`studio/README.md`](studio/README.md). |
| Ops | AWS Lightsail (Frankfurt) + Caddy + systemd in production; GitHub Actions CI; Docker images and docker compose for local runs and alternative hosts | See [Deployment](#6-deployment) and [`docs/deploy.md`](docs/deploy.md). |

An earlier draft of this file planned Vercel AI SDK / LangChain and an MCP wrapper. Neither is used.

## 2. Services

### Analyst agent (`apps/analyst-agent`), the seller

- **News analyst, port 4001.** `GET /signal?symbol=NVDAB` takes headlines from the last 48 h (Yahoo Finance RSS + Google News RSS, `src/news.ts`). Claude scores them 1-100 with a stance, a rationale and cited headlines (`src/scorer.ts`). Signals are cached for `SIGNAL_CACHE_SEC`, and concurrent requests share one in-flight computation (`src/signal.ts`). Serves eight symbols: the six traded bStocks plus NVDAon and TSLAx (signal-only).
- **Flow analyst, port 4003** (`FLOW_ANALYST_PORT`, same process). A deterministic signal (`model: "deterministic-flow-v1"`) from PancakeSwap v3 swap flow on the asset's USDT pool. Serves the six traded bStocks.
- **Free endpoints:** `GET /health`, `GET /info` (an `AnalystInfo` with price, horizon, symbols and the ERC-8004 agent id, used by the buyer to compare sellers), and `GET /events` (SSE).
- **Paid endpoint:** `GET /signal`. The b402 merchant gateway is in `src/b402.ts` and `src/server.ts`:
  1. No `PAYMENT-SIGNATURE` header: respond `402` with a `PAYMENT-REQUIRED` header and body (x402 v2: `scheme: exact`, `network: eip155:56`, asset, amount, payTo, `extra` copied from the facilitator's `/supported` kind).
  2. Decode the payload and require `accepted` to deep-equal the server-held requirements. Reject an authorization id that has been seen before (one payment buys one response).
  3. `POST /api/v2/b402/verify`, then produce the signal, then `POST /api/v2/b402/settle`. **Settlement happens only after the signal exists.** If signal production fails, the buyer is never charged and may retry with the same authorization.
  4. Return `200` with the signal and a `PAYMENT-RESPONSE` header carrying the settlement tx. A broadcast-but-unconfirmed settlement is reported as `502` with the tx hash, so the buyer can reconcile.

### Execution agent (`apps/execution-agent`), the buyer and trader

The loop is `src/index.ts`: the next cycle is scheduled only after the previous one finishes, every `LOOP_INTERVAL_SEC` (production: `1800`, 30 minutes), or on demand with `POST /cycle`. One cycle runs the steps below for each of the six traded bStocks (`TRADED_ASSETS` in `packages/shared`: NVDAB, TSLAB, BABAB, CRCLB, SNDKB, METAB) (`src/cycle.ts`):

1. **Kill switch.** Env `KILL_SWITCH` or runtime `POST /kill`.
2. **Free gap pre-screen.** Before any signal is bought, the free prices (step 4) are read for every asset and a signal is only purchased where the token trades at least `minGapBps` below the TradFi reference, or where a position is open. This keeps the daily data budget (`RISK_MAX_DAILY_DATA_USD`, production `1`) on actionable calls.
3. **Choose an analyst** (`packages/reputation`). Discover sellers via `GET /info` on each entry of `ANALYSTS`. Draw θ ~ Beta(hits+1, misses+1) per unpaused analyst and pick the highest θ − λ·price. Paused analysts (trust below `RISK_MIN_ANALYST_TRUST` after `RISK_MIN_ANALYST_SAMPLES`) are skipped.
4. **Buy the signal** (`src/pay.ts`). `wrapFetchWithPayment` + `B402ExactClientScheme` handle `402 → sign → retry`. The daily data budget is checked before signing. If Permit2 allowance is missing, the agent builds a bounded `approve` (30 days of signal budget, 60 USDT), simulates it through the Transaction API, and sends it only when live. The signal body is validated.
5. **Prices** (`src/prices.ts`). RWA Data API `/rwa/tokens` (listing and market status, next open) and `/rwa/price`. Yahoo Finance chart API as the independent TradFi reference, because the RWA `referencePrice` is documented as derived from the on-chain price. Market API `/market/price` for the live on-chain price.
6. **Wallet and pool state** (`src/wallet.ts`, viem): BNB, USDT and asset balances, plus USDT depth in the primary PancakeSwap v3 pool.
7. **Quote.** Trading API `/aggregator/quote`. Only `SWAP` routes are eligible, since `RFQ` routes cannot be simulated.
8. **Risk** (`src/risk.ts`). Pure function, unit-tested in `src/risk.test.ts`. Every check returns observed vs limit. A value that was not observed fails closed with the reason. Rules and defaults are in `packages/shared/src/risk.ts` and listed in the README.
9. **Execute** (`src/trade.ts`). `/approve-transaction` (spender must equal the quote's `approveTarget`) → simulate → (live) send. Then `/aggregator/swap` with slippage and price-impact protection pinned to `RISK_MAX_SLIPPAGE_BPS` → **`/pre-transaction/simulate`** → (live) sign locally with viem → `/pre-transaction/broadcast-transaction` with MEV protection → wait for the receipt and read amounts from Transfer logs. Approvals are bounded, not unlimited: router USDT = 30 × the daily spend cap (750 USDT), per-token = 2 × the max position.
10. **Fill and book** (`src/ledger.ts`). An average-cost ledger per mode. A **paper** fill is booked at the real quoted amounts when the simulation passes and `LIVE_TRADING!=1`. A **live** fill is booked from receipt logs. Exits (take-profit, stop-loss, bearish signal) run through the same quote → simulate → fill path.
11. **Score and reputation.** Once a signal's `horizonSec` has elapsed, it is marked against the on-chain price (`returnBps`, ±25 bps neutral band). Trust is the Beta posterior mean and weight is a smoothstep of trust blended with a prior. When `ERC8004_POST_FEEDBACK=1`, the result is posted as ERC-8004 reputation feedback (`giveFeedback`) for the analyst's agent id.

The only live fill so far (`0x0ce91120…3807`, 2 USDT → NVDAB) was operator-triggered through `POST /trade`, which runs the same quote → Transaction API simulate → broadcast path as step 9. No autonomous live fill has happened yet.

HTTP (`src/server.ts`, `src/routes.ts`):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `GET` | `/state` | Wallet, balances, positions, limits, config errors, and `analysts[]` with each analyst's samples, hits, hit rate, trust and weight |
| `GET` | `/events` | SSE event stream (replays history on connect) |
| `GET` | `/summary/today` | Plain-English daily summary, decisions, counts |
| `GET` | `/rwa/board` | Weekend-gap board (token price vs reference) and US market status, from raw RWA Data calls |
| `GET` | `/wallet/api` | Wallet API / Address Portfolio view of the trader wallet, from raw Wallet API calls |
| `GET` | `/.well-known/agent-registration.json` | ERC-8004 registration file |
| `POST` | `/cycle` | Run one cycle now |
| `POST` | `/kill` | Flip the runtime kill switch |
| `POST` | `/trade` | Operator-only: one small buy or a full-position sell through the same quote → simulate → broadcast path, capped at `RISK_MAX_TRADE_USD` |

All three `POST`s require `Authorization: Bearer $CONTROL_TOKEN` whenever `CONTROL_TOKEN` is set (the hosted desk has it set). The agent refuses to start when `EXECUTION_HOST` is not loopback and no token is set.

### Dashboard (`apps/web`)

`/` is the landing page with a flow diagram. `/dashboard` is the live view. The browser connects directly to `NEXT_PUBLIC_ANALYST_URL`, `NEXT_PUBLIC_FLOW_ANALYST_URL` and `NEXT_PUBLIC_EXECUTION_URL`. These are inlined at build time. The agents allow that origin through `DASHBOARD_ORIGIN` (CORS). On connect, the `EventHub` SSE stream replays the last 500 events and then streams live, so the dashboard keeps history across reloads and agent restarts.

### Studio agent (`studio/ElitrDesk`), a downstream seller

"Elitr Desk Brief" is a separate `bag init` seller agent on `@bnbagent/studio-runtime`, with its own wallet and its own ERC-8004 identity (#367734, BSC mainnet, registration gas sponsored). It reads only the execution agent's free endpoints (`/summary/today`, `/state`, `/rwa/board`, `/.well-known/agent-registration.json`) plus the analysts' `/info`, and resells them as a brief: over A2A (`https://desk.elitr.xyz/.well-known/agent-card.json`, skills `brief_preview` and `desk_brief`) and over x402 (`GET /x402?prompt=brief`, free: `price_usd = "0"`). It never calls the paid `/signal` endpoints and does not share keys with `apps/*`. Details in [`studio/README.md`](studio/README.md).

## 3. Shared packages

| Package | Contents |
| --- | --- |
| `packages/binance` | `BinanceWeb3Client`: request signing (`X-OC-APIKEY`, ISO-8601 `X-OC-TIMESTAMP`, `X-OC-NONCE`, `X-OC-RECV-WINDOW`, HMAC `X-OC-SIGN` over timestamp + method + path-with-query + body), the envelope check (`code` 0 for Web3 APIs, `"000000000"` for b402, whose body is wrapped as `{"body": …}`), a typed `BinanceApiError`, and an `onResponse` hook for latency and status logging. Signing has a unit test. |
| `packages/shared` | `ASSETS` (six bStocks traded: NVDAB, TSLAB, BABAB, CRCLB, SNDKB, METAB; NVDAon, TSLAx tracked), risk config schema (zod), the `AgentEvent` union streamed to the dashboard, the `Signal` / `AnalystInfo` wire types, and `EventHub` (JSONL-persisted SSE hub). |
| `packages/reputation` | Signal scoring, Beta trust, weight, pause rule and Thompson-sampling selection with an injectable RNG. Persisted atomically. Unit-tested. |
| `packages/identity` | ERC-8004 registration file builder, `elitr-identity` CLI (`register`), and the reputation feedback client. Canonical registries for BSC 56 / 97 by default. Unit-tested. |

## 4. Binance Web3 API usage

| Module | Endpoints | Why |
| --- | --- | --- |
| RWA Data (`/rwa-data`) | `GET /api/v1/dex/market/rwa/tokens`, `/rwa/price`, `/rwa/underlying-market` | Confirm the token is a listed bStocks asset. Market status and next open time feed the decision log. |
| Market (`/general-data`) | `POST /api/v1/dex/market/price` | Live on-chain price, compared with the TradFi reference (`minGapBps`). |
| Trading (`/trading-api`) | `GET /api/v1/dex/aggregator/quote`, `/approve-transaction`, `/swap` | Route, approval and swap calldata. Vendor-specific approval for equity tokens: quote, then approve(vendor), then swap. |
| Transaction (`/transaction-api`) | `POST /api/v1/dex/pre-transaction/simulate`, `/broadcast-transaction`, `GET /post-transaction/transaction-detail-by-txhash` | Dry-run of **every** transaction (approve, Permit2 approve, swap) before any broadcast. MEV-protected broadcast in live mode. |
| b402 (`/b402-payments`) | `POST /api/v2/b402/supported`, `/verify`, `/settle` | Merchant side of the agent-to-agent payment. |
| Raw `client.call`s (execution agent only, no typed helper) | Wallet API `balance/all-token-balances-by-address`, `post-transaction/transactions-by-address`; Address Portfolio `market/portfolio/overview`; RWA Data `rwa/platforms`; Market `token/top-liquidity`; Transaction `pre-transaction/gas-limit` | `/wallet/api` and `/rwa/board` views, pool liquidity for the gap board, and the gas figure the simulate response does not include (`trade.ts`). |

The five rows above the raw-call row are the modules with typed helpers in `packages/binance`.

## 5. State and persistence

Everything is under `data/` at the repo root (`/app/data` in Docker, which is a volume):

- `analyst-events.jsonl`, `execution-events.jsonl`: event logs (dashboard history).
- `execution-state.json`: daily counters (UTC), payments, trades, ledger. Written atomically (tmp + rename). A corrupt file stops the agent rather than being guessed at.
- Reputation records (`packages/reputation`): same atomic-write pattern.
- `EXECUTION_DATA_DIR` overrides the execution agent's directory.

The execution agent also appends API friction it detects at runtime (for example an RFQ-only quote, or a token missing from `/rwa/tokens`) to `docs/dx-raw-log.md`, deduplicated by message.

## 6. Deployment

- **Local:** `pnpm dev`, or `docker compose up -d --build`.
- **Production:** one AWS Lightsail instance in Frankfurt (an allowed region for the Binance Web3 API). Caddy terminates HTTPS for `elitr.xyz`, `analyst.`, `flow.`, `agent.` and `desk.elitr.xyz` and proxies SSE unbuffered. Each service is a systemd unit bound to loopback: `elitr-analyst` (4001 + 4003), `elitr-execution` (4002), `elitr-web` (3000), `elitr-desk` (9000, the Studio agent) and `caddy`. Two timers: `elitr-watchdog.timer` runs [`deploy/watchdog.sh`](deploy/watchdog.sh) every 5 minutes (restarts inactive or twice-unhealthy units, restarts the execution agent when the last cycle is older than 2.5 × `LOOP_INTERVAL_SEC`, checks the public hosts and the wallet runway, writes one health line per day) and a nightly backup timer for `data/`. The loop runs every 30 minutes (`LOOP_INTERVAL_SEC=1800`).
- **Alternatives:** Vercel for the dashboard, Railway / Fly.io / a VPS with docker compose for the agents. See [`docs/deploy.md`](docs/deploy.md).
- **BNB Agent Studio / ERC-8004:** see [`docs/agent-studio.md`](docs/agent-studio.md) and [`studio/README.md`](studio/README.md).
