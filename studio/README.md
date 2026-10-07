# Elitr Desk Brief (BNB Agent Studio)

`studio/ElitrDesk/` is a **BNB Agent Studio** seller agent called **Elitr Desk Brief**. It sells a short, factual brief about the live Elitr trading desk over **x402** for $0.01 in testnet U, paid through B402. It also has an **A2A** face with a free preview. It has its own wallet and its own ERC-8004 identity. It runs on Studio's managed runtime, and each brief it sells pays its wallet.

It was scaffolded with `bag init ElitrDesk --rails b402 --destination platform --protocols A2A,X402 --payment-protocol x402 --seller-price-usd 0.01 --llm-provider pieverse-llm --model auto/free --network bsc-testnet --wallet-kind evm-local` (`@bnbagent/studio-cli@0.0.14`).

## How it relates to Elitr

Elitr (https://elitr.xyz) runs on BSC mainnet. It has two analyst agents that sell signals over b402: news (ERC-8004 #365554) and on-chain flow (#365555). A trader agent (#365556) buys those signals, trades bStocks NVDAB/TSLAB and rates the analysts on ERC-8004.

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
- `{"skill":"desk_brief"}`: returns the payment offer (URL, price, network)

The agent card is at `/.well-known/agent-card.json`. Its name is "Elitr Desk Brief", its provider and documentation links point to https://elitr.xyz, and its description lists the mainnet ids #365554, #365555 and #365556.

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
| **Agent identity** | It has its own wallet, an ERC-8004 registration on BSC testnet (`bag erc8004 register` / `bag deploy verify`), and an A2A agent card. The card and the brief link to the three Elitr mainnet ERC-8004 agents it reports on, so one identity points at another network's identities. |
| **Autonomous runtime** | It runs as a Studio managed runtime with no human in the loop. Any agent can call `/x402` or A2A, and it fetches, checks, builds and sells the brief by itself. Signing stays in fixed code (`signing.ts`), never in an LLM tool. |
| **Self-funding via x402** | Each brief is paid in testnet U through B402 x402, and the payment settles to the agent's own wallet. Optionally, Studio's Pieverse auto-renew can use that wallet to keep its LLM credit topped up, so the agent pays for its own inference out of what it earns. |
| **A2A** | It has a free `brief_preview` skill and a `desk_brief` skill that returns the payment offer. This is agent-to-agent discovery that leads into an x402 purchase, the same pattern Elitr's trader uses with its analysts, now one level up. |

## Local smoke test (done 2026-10-07, no funds, no deploy)

- `bag doctor` passes:
  - studio.toml, entrypoint, wallet ↔ keystore, WALLET_PASSWORD, RPC, PAID $0.01 policy, ZIP bundle
- `bag doctor` shows warnings:
  - Pieverse not activated
  - wallet has 0 tBNB / 0 U
  - not yet on ERC-8004
  - M01 replay advisory
- `bag doctor` FAIL: **B402 merchant credentials missing**, so the paid rail stays dormant. See [HUMAN] step 1.
- `bag dev` (PAID config):
  - agent card OK
  - A2A `brief_preview` returned live Elitr data
  - A2A `desk_brief` returned the offer
  - `/x402` returned `503 x402 rail dormant` (no B402 creds)
- `bag dev` with Elitr URL pointed at a dead host: `/x402` returned `503 Elitr desk data is unavailable…no payment was requested or settled` before reaching the B402 seller.
- `bag dev` with price temporarily set to `0` (FREE): `/x402?prompt=brief` returned a full brief built from live data. The price was then restored to `0.01`, and studio.toml was confirmed byte-identical.

Reproduce locally (from `studio/ElitrDesk`):

```bash
bag dev                                            # :9000
curl -s localhost:9000/.well-known/agent-card.json
curl -s localhost:9000/ -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"kind":"message","role":"user","messageId":"m1","parts":[{"kind":"data","data":{"skill":"brief_preview"}}]}}}'
curl -si "localhost:9000/x402?prompt=brief"        # 402 challenge once B402 creds are set; 503 dormant before
```

## [HUMAN] steps

The 48 h managed trial starts on the **first successful `bag deploy --provider bnb`** and cannot be reset. Everything before step 6 is safe to do early. Run all commands from `studio/ElitrDesk` unless noted.

The agent wallet already exists. It is a **throwaway testnet** wallet created with `bag wallet new --generate-password`; the password is in `.studio/.env.local`, which is gitignored:

```
0x53102f38FE622B91708081661Df2939Ea08B72E5
```

Its key **is sent to the platform operator on deploy**, so never put mainnet funds or Elitr's mainnet keys anywhere near it.

### 1. Apply for B402 sandbox merchant credentials (do this NOW)

Approval is manual, and without these credentials the paid x402 rail stays **dormant (503)**. Full playbook: `/opt/homebrew/lib/node_modules/@bnbagent/studio-cli/skills/references/bnbagent-studio-selling-via-b402.md`.

1. Generate the RSA key pair (1024-bit, as required by B402):

   ```bash
   umask 077; e=sandbox; mkdir -p .studio/b402/$e
   openssl genpkey -algorithm RSA -out .studio/b402/$e/private.pem -pkeyopt rsa_keygen_bits:1024
   openssl pkey -in .studio/b402/$e/private.pem -pubout -outform DER | openssl base64 -A > .studio/b402/$e/public.der.b64
   openssl pkcs8 -topk8 -nocrypt -in .studio/b402/$e/private.pem -outform DER | openssl base64 -A > .studio/b402/$e/private.der.b64
   ```

2. Get the IP allowlist. Platform relay egress IPs need a GitHub login; logging in does **not** start the trial:

   ```bash
   bag platform login        # prints a GitHub device URL + code
   bag platform whoami >/dev/null
   s=~/.bnbagent-deploy/bnb/session.json
   curl -H "Authorization: Bearer $(jq -er .access_token $s)" "$(jq -er .apiUrl $s)/v1/b402/whitelist-ips"
   curl ipinfo.io/ip         # add your local IP too if you want `bag dev` to reach B402
   ```

3. Apply at https://developers.binance.com/en/docs/products/onchainpay-x402/basics/6.apply-developer-account (**sandbox** = BSC testnet). Fill in:
   - **wallet**: `0x53102f38FE622B91708081661Df2939Ea08B72E5`
   - **public key**: the contents of `public.der.b64`
   - **IP allowlist**: the IPs from step 2

4. When the credentials arrive, open `.studio/.env.local` in an editor and fill in `B402_BASE_URL`, `B402_CLIENT_ID`, `B402_ACCESS_TOKEN` and `B402_PRIVATE_KEY_B64`. For `B402_PRIVATE_KEY_B64`, paste the contents of `private.der.b64` and delete the empty `B402_PRIVATE_KEY=` line, because only one key form is allowed. The managed testnet upstream is `https://qacb.sdtaop.com`.

5. Check the credentials:

   ```bash
   bag x402 sell status --no-probe && bag x402 sell status
   ```

   This must show `eip155:97` with TEST_U active.

**Fallback if approval doesn't arrive before the deadline:** run `bag config set payments.seller.price_usd 0` (FREE mode), then deploy. The brief and A2A still work, but there is no x402 payment, so the "self-funding" part becomes a narrated explanation rather than a live demo.

### 2. (Optional) Activate the LLM wording pass

```bash
bag llm activate    # Pieverse SIWE with the agent wallet, $0 allocation, model auto/free
```

You can skip this. Without it the brief uses the deterministic headline, and every fact is still present.

### 3. Fund with testnet tokens

Use the Telegram bot https://t.me/bnbchain_official_bot. Send each message separately:

- `I would like to get tBNB to my wallet 0x53102f38FE622B91708081661Df2939Ea08B72E5`
- `I would like to get U to my wallet 0x53102f38FE622B91708081661Df2939Ea08B72E5`

Or, after login, run `bag wallet fund`. Then check with `bag wallet balance --all`. tBNB pays gas for the ERC-8004 registration.

### 4. Check readiness

```bash
bag doctor
bag deploy prepare --provider bnb
```

Expect PASS on x402 credentials. The M01 replay-store warning is acknowledged: the managed trial is a single process with an in-memory replay store.

### 5. Prepare the buyer

Use a separate throwaway wallet, so the payer is not the payee. From `studio/`:

```bash
bag init DeskBuyer --rails b402 --destination platform --protocols A2A,X402 --seller-price-usd 0 --llm-provider pieverse-llm --model auto/free --network bsc-testnet --wallet-kind evm-local
cd DeskBuyer && bag wallet new --generate-password
```

Fund it with testnet **U** through the same Telegram bot. `TEST_U` is EIP-3009, which `evm-local` can sign, so the buyer needs no gas.

> **NOTE:** These flags mirror the seller's `bag init` command and have not been tested for this buyer project. If `bag init` rejects them, adjust and retry.

### 6. Deploy (Friday: this starts the 48 h clock)

From `studio/ElitrDesk`:

```bash
bag platform credit                 # confirm trial = available
bag deploy --provider bnb           # summary must say "x402 rail is ACTIVE" and print the anonymous /x402 URL
bag deploy info --with-curl         # buyer-access surface (x402 URL, A2A OAuth invoke-client curl chain)
```

### 7. Register the ERC-8004 identity on BSC testnet

`bag deploy verify` registers with the generic name "studio-agent", so register with the real name first, then reconcile:

```bash
bag erc8004 register --name "Elitr Desk Brief" \
  --description "Sells a factual x402 brief of the live Elitr agent-to-agent trading desk (https://elitr.xyz; BSC mainnet ERC-8004 #365554 news analyst, #365555 flow analyst, #365556 trader)."
bag deploy verify --provider bnb    # probes the endpoint + reconciles ERC-8004 services[] endpoint
bag erc8004 update-metadata --key site --value https://elitr.xyz
bag erc8004 update-metadata --key reports_on --value "bsc-mainnet ERC-8004 #365554,#365555,#365556"
bag erc8004 show                    # note the testnet agentId for the video
```

`register` uses the `[identity].endpoint` that the deploy recorded.

### 8. Buy a brief (demo)

From `studio/DeskBuyer`, with `X` set to the `/x402` URL printed by `bag deploy info` in step 6:

```bash
X="<the /x402 URL printed by bag deploy info>"
bag x402 quote "$X?prompt=brief"                       # shows the 402: $0.01 TEST_U → 0x5310…72E5 on eip155:97
bag x402 trust "$X?prompt=brief" --cap 0.01 --yes      # pins payTo + cap in the buyer's studio.toml
bag x402 buy "$X?prompt=brief" --max-usd 0.01          # pays and prints the brief + settlement receipt
```

Then, from `studio/ElitrDesk`:

```bash
bag audit tail                      # seller-side x402_sell record with tx hash
bag wallet balance --all            # U balance went up
```

### What to show on camera (about 2 min)

1. https://elitr.xyz live (mainnet desk, analysts, trades). Then `bag platform credit`, showing the trial countdown and that this is a managed Studio runtime.
2. The agent card at `<public url>/.well-known/agent-card.json`: name, description, the mainnet ERC-8004 ids.
3. `bag erc8004 show` for the agent's own testnet ERC-8004 identity, shown on testnet BscScan.
4. Optionally, the A2A `brief_preview` call from `bag deploy info --with-curl`, which returns live mode and ERC-8004 ids for free.
5. `bag x402 quote`, showing the 402 challenge at $0.01. Then `bag x402 buy`, showing the brief come back.
6. Compare the brief with elitr.xyz: mode, today's summary, analysts' hit rate and trust, the NVDAB position and P&L, and the top weekend-gap spreads with market status. The numbers match, and `sources[]` shows where each one came from.
7. The settlement tx on testnet BscScan, with U landing in `0x5310…72E5` (the agent paid by another agent). Then `bag deploy logs --provider bnb`.
8. Optionally, show the 503 "no payment was requested or settled" guard. To trigger it, redeploy with `ELITR_AGENT_URL` pointing at a dead host. **Do not do this on the live trial unless there is spare time.**

After the demo, optionally run `bag deploy destroy --provider bnb` (a dry run), and then add `--execute`. The trial is reclaimed automatically at 48 h anyway.

## Secrets / git

Everything secret is under `ElitrDesk/.studio/`: the keystore, `.env.local` (WALLET_PASSWORD, Pieverse key, B402 creds), `b402/` RSA keys and logs. The repo-root `.gitignore` ignores:

- `studio/**/.studio/`, `studio/**/.env.local`, `studio/**/.env`
- `studio/**/node_modules/`, `studio/**/dist/`, `studio/**/vendor/*.tgz`
- `studio/**/agentcore/.env.local`, `studio/**/.claude/skills/`

The scaffold's own `.gitignore` files cover the same paths.
