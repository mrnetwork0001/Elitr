# Elitr Desk Brief (BNB Agent Studio)

`studio/ElitrDesk/` is a **BNB Agent Studio** seller agent called **Elitr Desk Brief**. It serves a short, factual brief about the live Elitr trading desk over **x402** (`/x402?prompt=brief`) and has an **A2A** face with a free preview and the brief offer. It runs on **BSC mainnet**, has its own wallet and its own **ERC-8004 identity (#367734)**, and is **self-hosted** on the Elitr server behind https://desk.elitr.xyz. The x402 brief is **free** (`price_usd = "0"`): paid x402 needs B402 merchant credentials we could not obtain in time, so no payment challenge is issued and the Studio runtime's payment rail stays dormant.

## Live deployment (current)

| | |
| --- | --- |
| Agent card (A2A) | https://desk.elitr.xyz/.well-known/agent-card.json |
| Brief (x402, FREE) | `GET https://desk.elitr.xyz/x402?prompt=brief` |
| ERC-8004 | **#367734** on BSC mainnet (IdentityRegistry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`), tx [`0xd95b1b47…e22b`](https://bscscan.com/tx/0xd95b1b475f44dd6537b3df63c380d7d0d4f948d001434cd8ed3856b96a5ae22b) |
| Wallet | `0xFD9fBD6719a0b521314a67fF36EF26634bf71642` (fresh mainnet evm-local keystore; the earlier testnet throwaway `0x5310…72E5` is retired) |
| Hosting | self-hosted on the Elitr server (AWS Lightsail, Frankfurt): systemd unit `elitr-desk` runs `bag dev --logs --host 127.0.0.1 --port 9000` with `BNBAGENT_PUBLIC_URL=https://desk.elitr.xyz`; Caddy terminates HTTPS |
| Config | `studio.toml`: `[network].default = "bsc-mainnet"`, `[deploy].destination = "self"`, `[payments.seller].price_usd = "0"`, assets `["U"]` |

**Why not the 48 h managed trial?** It's testnet-only, and its clock starts at the first deploy, so it would expire before judging (12–23 Oct), and the rules require the deployed link to stay reachable. NodeOps was offline after a security incident, and AWS AgentCore needs a quota plus OAuth-gated endpoints. Self-hosting keeps the agent up through judging, on mainnet.

**Why FREE x402?** Paid x402 on any Studio target needs B402 merchant credentials, sandbox or production. The application form was closed when we applied, and Studio's own b402 guide says not to claim mainnet paid readiness until settlement polling lands. Self-funding over b402 is demonstrated on mainnet by Elitr's analysts instead (see the root README's on-chain proof).

It was scaffolded with `bag init ElitrDesk --rails b402 --destination platform --protocols A2A,X402 --payment-protocol x402 --seller-price-usd 0.01 --llm-provider pieverse-llm --model auto/free --network bsc-testnet --wallet-kind evm-local` (`@bnbagent/studio-cli@0.0.14`). The scaffold's testnet / managed-platform / paid defaults were later changed in `studio.toml` to mainnet, `destination = "self"` and `price_usd = "0"` (see the table above and the appendix).

## How it relates to Elitr

Elitr (https://elitr.xyz) runs on BSC mainnet. It has two analyst agents that sell signals over b402: news (ERC-8004 #365554) and on-chain flow (#365555). A trader agent (#365556) buys those signals, trades six bStocks (NVDAB, TSLAB, BABAB, CRCLB, SNDKB, METAB) and rates the analysts on ERC-8004.

Elitr Desk Brief is a **separate, downstream agent**. It only reads Elitr's free public endpoints:

| Endpoint | Used for |
| --- | --- |
| `agent.elitr.xyz/summary/today` | plain-English daily summary, decisions, counts |
| `agent.elitr.xyz/state` | mode (paper/live), positions, P&L, analysts' hit rate, trust and ERC-8004 ids |
| `agent.elitr.xyz/rwa/board` | weekend-gap board (token price vs reference) and US market status |
| `agent.elitr.xyz/.well-known/agent-registration.json`, `analyst.elitr.xyz/info`, `flow.elitr.xyz/info` | optional: trader registry id, analyst kinds |

It turns that data into a structured brief and resells it. It never calls the analysts' paid `/signal` endpoints, and it does not touch `apps/*` or Elitr's mainnet keys.

## What a buyer gets

`GET|POST /x402?prompt=brief` returns `{"result": "<JSON brief>"}`. The brief contains:

- `mode`, `desk.killSwitch`, `desk.liveTrading`, and the trader's ERC-8004 id and registry
- `summary.text`: Elitr's own plain-English paragraph for today, copied verbatim, plus counts and the latest decisions
- `analysts[]`: name, kind, ERC-8004 id, samples, hits, hit rate, trust, weight, paused/online
- `positions[]`: open positions only, with `pnl` (net, realized, unrealized, signal spend, gas)
- `weekendGap`:
  - US market status, next open and next close
  - the top 5 tokenized-stock spreads, computed as (on-chain price − Yahoo reference) / reference in bps. Only tokens with a reference price and measured liquidity are ranked. A spread above 2000 bps is dropped as a likely share-multiplier artefact, and the number of excluded tokens is reported.
  - the desk's own assets, cross-issuer pairs, and coverage notes (for example, xStocks is not covered by the RWA API)
- `headline` and `headlineSource`: a deterministic one-liner. If a Pieverse key is active, the LLM (`auto/free`) may reword it, but only if every number it writes already appears in the facts. Otherwise the deterministic version is kept.
- `text`: a human-readable rendering
- `sources[]`: every URL fetched, with ok/error
- `disclaimer`

**No invented data.** Every value is copied from the endpoints above, or computed from them by arithmetic. A missing value comes back as `null`.

**Elitr down means no charge.** The Studio runtime settles payment *before* running the work, and keeps the payment if the work fails. To avoid charging for a brief it can't build, the `/x402` route fetches Elitr data **before** handing the request to the B402 seller. If Elitr is unreachable, the route answers `503 {"error": "...no payment was requested or settled..."}` with `Retry-After: 30`, and no 402 challenge is issued. The paid work then reuses that same snapshot, so after settlement it does no network I/O to Elitr. Per-request timeout is 8 s, with 3 attempts and backoff, and the snapshot is cached for 20 s.

**A2A skills.** Send these as `message/send` with a data part:

- `{"skill":"brief_preview"}` (free): mode, day, US market status, ERC-8004 ids, and the x402 offer
- `{"skill":"desk_brief"}`: returns the x402 offer (URL, price `0`, network `bsc-mainnet`)

The agent card is at https://desk.elitr.xyz/.well-known/agent-card.json. Its name is "Elitr Desk Brief", its provider and documentation links point to https://elitr.xyz, its `url` is the public HTTPS base (`BNBAGENT_PUBLIC_URL`), and its description lists the mainnet ids #365554, #365555 and #365556.

### Code (all under `ElitrDesk/app/agent/src/`)

- `elitr.ts` (new): fetches the endpoints (timeouts, retries, shape checks) and builds the brief. It has no signing, wallet or LLM.
- `deskBrief.ts` (new): the x402 work hook, the request-scoped snapshot (`AsyncLocalStorage`), the guarded LLM headline pass, and the x402 offer.
- `unifiedMain.ts`: fetches Elitr data in the `/x402` route before payment; the B402 work is now `deskBriefWork`.
- `executor.ts`: adds the `brief_preview` and `desk_brief` A2A skills.
- `agentCard.ts`: name, description, provider and skills.
- `signing.ts`, the price path and the security policy are unchanged.

Optional environment variables:

- `ELITR_AGENT_URL`, `ELITR_NEWS_ANALYST_URL`, `ELITR_FLOW_ANALYST_URL`
- `ELITR_FETCH_TIMEOUT_MS`, `ELITR_FETCH_ATTEMPTS`, `ELITR_CACHE_SECONDS`, `ELITR_TOP_GAPS`, `ELITR_MAX_PLAUSIBLE_GAP_BPS`
- `ELITR_BRIEF_LLM=off`
- `ELITR_RESOLVE_IP`: local dev only. It pins `*.elitr.xyz` to an IP if your resolver has a stale cache. Never set it in deploy.

## Why this fits "Best Use of BNB Agent Studio"

| Criterion | How Elitr Desk Brief uses Studio |
| --- | --- |
| **Agent identity** | It has its own wallet (`0xFD9f…1642`) and its own ERC-8004 registration on **BSC mainnet, #367734**, minted with `bag erc8004 register --network bsc-mainnet` (gas sponsored by the MegaFuel relay), plus an A2A agent card. The card and the brief link to the three Elitr mainnet ERC-8004 agents it reports on (#365554, #365555, #365556), so one identity points at the identities it rates and resells. |
| **Autonomous runtime** | It runs the Studio runtime (`bag dev`) as a systemd unit on the Elitr server behind Caddy, with no human in the loop: any agent can call `/x402` or A2A, and it fetches, checks and builds the brief by itself. Signing stays in fixed code (`signing.ts`), never in an LLM tool. The managed 48 h testnet trial was not used, because it would have expired before judging. |
| **x402** | The brief is served over Studio's x402 route, **free** (`price_usd = "0"`, asset `U`, `bsc-mainnet`). Paid x402 on any Studio target needs B402 merchant credentials, and the application form was locked, so no payment is charged here. Self-funding over b402 is demonstrated on mainnet by Elitr's analysts instead (20+ real settlements). |
| **A2A** | It has a free `brief_preview` skill and a `desk_brief` skill that returns the x402 offer. This is agent-to-agent discovery that leads into an x402 call, the same pattern Elitr's trader uses with its analysts, now one level up. |

## Local smoke test (done 2026-10-07, on the original testnet / PAID config, no funds, no deploy)

- `bag doctor` passes:
  - studio.toml, entrypoint, wallet ↔ keystore, WALLET_PASSWORD, RPC, PAID $0.01 policy, ZIP bundle
- `bag doctor` shows warnings:
  - Pieverse not activated
  - wallet has 0 tBNB / 0 U
  - not yet on ERC-8004
  - M01 replay advisory
- `bag doctor` FAIL: **B402 merchant credentials missing**, so the paid rail stays dormant (see the appendix for the credential application).
- `bag dev` (PAID config):
  - agent card OK
  - A2A `brief_preview` returned live Elitr data
  - A2A `desk_brief` returned the offer
  - `/x402` returned `503 x402 rail dormant` (no B402 creds)
- `bag dev` with Elitr URL pointed at a dead host: `/x402` returned `503 Elitr desk data is unavailable…no payment was requested or settled` before reaching the B402 seller.
- `bag dev` with price set to `0` (FREE): `/x402?prompt=brief` returned a full brief built from live data. This FREE mode is what now runs in production.

Reproduce locally (from `studio/ElitrDesk`, current mainnet / FREE config):

```bash
bag dev                                            # :9000
curl -s localhost:9000/.well-known/agent-card.json
curl -s localhost:9000/ -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"kind":"message","role":"user","messageId":"m1","parts":[{"kind":"data","data":{"skill":"brief_preview"}}]}}}'
curl -s "localhost:9000/x402?prompt=brief"         # full brief, no 402 (price_usd = "0")
```

## Appendix: the original managed-trial plan (not used)

The project was first set up for Studio's **48 h managed testnet trial** (`bag deploy --provider bnb`, BSC testnet, paid x402 at $0.01 in TEST_U). That plan was dropped on 8 Oct 2026 because the trial clock starts at the first deploy and cannot be reset, so the link would have died before judging (12-23 Oct). What was prepared, for the record:

- **Testnet throwaway wallet** `0x53102f38FE622B91708081661Df2939Ea08B72E5` (`bag wallet new --generate-password`; its key would have been sent to the platform operator on deploy). Retired; the mainnet wallet in the table at the top replaced it.
- **B402 sandbox merchant credentials.** Paid x402 on any Studio target needs them: an RSA-1024 key pair under `.studio/b402/<env>/`, the platform relay's egress IPs for the allowlist (`bag platform login`, then `GET /v1/b402/whitelist-ips` with the session token), and an application at https://developers.binance.com/en/docs/products/onchainpay-x402/basics/6.apply-developer-account. The form was locked when we applied, so the paid rail never left `503 x402 rail dormant`. The documented fallback, `bag config set payments.seller.price_usd 0` (FREE), is what runs now.
- **Funding and readiness:** testnet tBNB / U from https://t.me/bnbchain_official_bot, `bag doctor`, `bag deploy prepare --provider bnb`.
- **Buyer:** a second scaffold (`bag init DeskBuyer …`) with its own wallet, so payer and payee differ, then `bag x402 quote` / `trust --cap 0.01` / `buy --max-usd 0.01` against the deployed `/x402` URL, and `bag audit tail` plus `bag wallet balance --all` on the seller side.
- **Deploy and identity:** `bag platform credit`, `bag deploy --provider bnb`, `bag deploy info --with-curl`, then `bag erc8004 register --name "Elitr Desk Brief"` and `bag deploy verify --provider bnb` on the **testnet** registry.

Of these, only the ERC-8004 registration was carried over, on mainnet instead (#367734, `bag erc8004 register --network bsc-mainnet`, gas sponsored). Everything else above is superseded by the "Live deployment" table.

## Secrets / git

Everything secret is under `ElitrDesk/.studio/`: the keystore, `.env.local` (WALLET_PASSWORD, Pieverse key, B402 creds), `b402/` RSA keys and logs. The repo-root `.gitignore` ignores:

- `studio/**/.studio/`, `studio/**/.env.local`, `studio/**/.env`
- `studio/**/node_modules/`, `studio/**/dist/`, `studio/**/vendor/*.tgz`
- `studio/**/agentcore/.env.local`, `studio/**/.claude/skills/`

The scaffold's own `.gitignore` files cover the same paths.
