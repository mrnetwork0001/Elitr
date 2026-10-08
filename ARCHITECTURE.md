# Elitr Architecture

This document covers how the agents are built and how they use the Binance Web3 API and BNB Chain. For the pitch, diagrams and quickstart, see [README.md](README.md).

## 1. Stack (as built)

| Layer | Choice | Notes |
| --- | --- | --- |
| Runtime | Node.js ≥ 22.12, TypeScript (ESM, `NodeNext`), pnpm 9 workspaces | No agent framework. Each agent is a plain `node:http` server with a self-scheduling loop. |
| LLM | `@anthropic-ai/sdk` → **0G Compute Router** (`ANTHROPIC_BASE_URL=https://router-api.0g.ai`, Bearer `ANTHROPIC_AUTH_TOKEN`) or Anthropic directly | Structured output (JSON schema) for the sentiment score. Only the news analyst uses an LLM. |
| Chain | **viem** on BSC mainnet (chainId 56) | Balances, pool liquidity, receipts, local signing (live mode only). |
| Agent payments | **b402** (Binance's x402 v2 facilitator). Merchant side is our own code; buyer side uses `@x402/fetch` + `@x402/core` + `@bnb-chain/b402` | USDT via Permit2 (`permit2-exact`) or U / USD1 via EIP-3009. |
| Binance Web3 API | `packages/binance`, a hand-written signed client | RWA Data, Market, Trading, Transaction, b402. |
| Dashboard | Next.js 16 (App Router), React 19, Tailwind 4 | Client-side `EventSource` to each agent's `/events`, polling of execution `/state`. |
| Identity / reputation | ERC-8004 Identity + Reputation registries on BSC (`packages/identity`, viem) | Registration CLI plus opt-in `giveFeedback` (`ERC8004_POST_FEEDBACK=1`). See [`docs/agent-studio.md`](docs/agent-studio.md). |
| Ops | GitHub Actions CI, Docker images, docker compose | See [`docs/deploy.md`](docs/deploy.md). |

An earlier draft of this file planned Vercel AI SDK / LangChain and an MCP wrapper. Neither is used.

## 2. Services

### Analyst agent (`apps/analyst-agent`), the seller

- **News analyst, port 4001.** `GET /signal?symbol=NVDAB` takes headlines from the last 48 h (Yahoo Finance RSS + Google News RSS, `src/news.ts`). Claude scores them 1-100 with a stance, a rationale and cited headlines (`src/scorer.ts`). Signals are cached for `SIGNAL_CACHE_SEC`, and concurrent requests share one in-flight computation (`src/signal.ts`).
- **Flow analyst, port 4003** (`FLOW_ANALYST_PORT`, same process). A deterministic signal (`model: "deterministic-flow-v1"`) from PancakeSwap v3 swap flow on the asset's USDT pool.
- **Free endpoints:** `GET /health`, `GET /info` (an `AnalystInfo` with price, horizon, symbols and the ERC-8004 agent id, used by the buyer to compare sellers), and `GET /events` (SSE).
- **Paid endpoint:** `GET /signal`. The b402 merchant gateway is in `src/b402.ts` and `src/server.ts`:
  1. No `PAYMENT-SIGNATURE` header: respond `402` with a `PAYMENT-REQUIRED` header and body (x402 v2: `scheme: exact`, `network: eip155:56`, asset, amount, payTo, `extra` copied from the facilitator's `/supported` kind).
  2. Decode the payload and require `accepted` to deep-equal the server-held requirements. Reject an authorization id that has been seen before (one payment buys one response).
  3. `POST /api/v2/b402/verify`, then produce the signal, then `POST /api/v2/b402/settle`. **Settlement happens only after the signal exists.** If signal production fails, the buyer is never charged and may retry with the same authorization.
  4. Return `200` with the signal and a `PAYMENT-RESPONSE` header carrying the settlement tx. A broadcast-but-unconfirmed settlement is reported as `502` with the tx hash, so the buyer can reconcile.

### Execution agent (`apps/execution-agent`), the buyer and trader

The loop is `src/index.ts`: the next cycle is scheduled only after the previous one finishes, every `LOOP_INTERVAL_SEC`, or on demand with `POST /cycle`. One cycle (`src/cycle.ts`):

1. **Kill switch.** Env `KILL_SWITCH` or runtime `POST /kill`.
2. **Choose an analyst** (`packages/reputation`). Discover sellers via `GET /info` on each entry of `ANALYSTS`. Draw θ ~ Beta(hits+1, misses+1) per unpaused analyst and pick the highest θ − λ·price. Paused analysts (trust below `RISK_MIN_ANALYST_TRUST` after `RISK_MIN_ANALYST_SAMPLES`) are skipped.
3. **Buy the signal** (`src/pay.ts`). `wrapFetchWithPayment` + `B402ExactClientScheme` handle `402 → sign → retry`. The daily data budget (`RISK_MAX_DAILY_DATA_USD`) is checked before signing. If Permit2 allowance is missing, the agent builds a bounded `approve`, simulates it through the Transaction API, and sends it only when live. The signal body is validated.
4. **Prices** (`src/prices.ts`). RWA Data API `/rwa/tokens` (listing and market status, next open) and `/rwa/price`. Yahoo Finance chart API as the independent TradFi reference, because the RWA `referencePrice` is documented as derived from the on-chain price. Market API `/market/price` for the live on-chain price.
5. **Wallet and pool state** (`src/wallet.ts`, viem): BNB, USDT and asset balances, plus USDT depth in the primary PancakeSwap v3 pool.
6. **Quote.** Trading API `/aggregator/quote`. Only `SWAP` routes are eligible, since `RFQ` routes cannot be simulated.
7. **Risk** (`src/risk.ts`). Pure function, unit-tested in `src/risk.test.ts`. Every check returns observed vs limit. A value that was not observed fails closed with the reason. Rules and defaults are in `packages/shared/src/risk.ts` and listed in the README.
8. **Execute** (`src/trade.ts`). `/approve-transaction` (spender must equal the quote's `approveTarget`) → simulate → (live) send. Then `/aggregator/swap` with slippage and price-impact protection pinned to `RISK_MAX_SLIPPAGE_BPS` → **`/pre-transaction/simulate`** → (live) sign locally with viem → `/pre-transaction/broadcast-transaction` with MEV protection → wait for the receipt and read amounts from Transfer logs.
9. **Fill and book** (`src/ledger.ts`). An average-cost ledger per mode. A **paper** fill is booked at the real quoted amounts when the simulation passes and `LIVE_TRADING!=1`. A **live** fill is booked from receipt logs. Exits (take-profit, stop-loss, bearish signal) run through the same quote → simulate → fill path.
10. **Score and reputation.** Once a signal's `horizonSec` has elapsed, it is marked against the on-chain price (`returnBps`, ±25 bps neutral band). Trust is the Beta posterior mean and weight is a smoothstep of trust blended with a prior. When `ERC8004_POST_FEEDBACK=1`, the result is posted as ERC-8004 reputation feedback (`giveFeedback`) for the analyst's agent id.

HTTP: `GET /health`, `GET /state` (wallet, balances, positions, limits, config errors), `GET /events` (SSE), `POST /cycle`, `POST /kill`. The two `POST`s require `Authorization: Bearer $CONTROL_TOKEN` whenever `EXECUTION_HOST` is not loopback, and the agent refuses to start otherwise.

### Dashboard (`apps/web`)

`/` is the landing page with a flow diagram. `/dashboard` is the live view. The browser connects directly to `NEXT_PUBLIC_ANALYST_URL`, `NEXT_PUBLIC_FLOW_ANALYST_URL` and `NEXT_PUBLIC_EXECUTION_URL`. These are inlined at build time. The agents allow that origin through `DASHBOARD_ORIGIN` (CORS). On connect, the `EventHub` SSE stream replays the last 500 events and then streams live, so the dashboard keeps history across reloads and agent restarts.

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

## 5. State and persistence

Everything is under `data/` at the repo root (`/app/data` in Docker, which is a volume):

- `analyst-events.jsonl`, `execution-events.jsonl`: event logs (dashboard history).
- `execution-state.json`: daily counters (UTC), payments, trades, ledger. Written atomically (tmp + rename). A corrupt file stops the agent rather than being guessed at.
- Reputation records (`packages/reputation`): same atomic-write pattern.
- `EXECUTION_DATA_DIR` overrides the execution agent's directory.

The execution agent also appends API friction it detects at runtime (for example an RFQ-only quote, or a token missing from `/rwa/tokens`) to `docs/dx-raw-log.md`, deduplicated by message.

## 6. Deployment

- **Local:** `pnpm dev`, or `docker compose up -d --build`.
- **Hosted:** dashboard on Vercel, agents on Railway / Fly.io / a VPS with docker compose and a persistent volume for `data/`. See [`docs/deploy.md`](docs/deploy.md).
- **BNB Agent Studio / ERC-8004:** see [`docs/agent-studio.md`](docs/agent-studio.md).
