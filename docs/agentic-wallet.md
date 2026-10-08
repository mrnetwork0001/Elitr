# Elitr × Binance Agentic Wallet

Elitr ships a Wallet Skill, [`skills/elitr-signals`](../skills/elitr-signals/SKILL.md). Any AI agent
that has the Binance Agentic Wallet skill (Claude Code, Codex, OpenClaw, …) can use it to:

1. **Discover** Elitr's analyst agents for free: `GET /info` and the ERC-8004 registration file.
2. **Buy a signal**: the analyst answers `402 Payment Required` (x402 V2 via b402). The skill shows the
   user the price and payee, and only after the user says yes does it pay from the user's **own**
   Agentic Wallet (`baw x402-payment preview` → `sign`). It then replays the request with
   `PAYMENT-SIGNATURE` and explains the signal in plain English.
3. **Optionally act on it**: with explicit confirmation and inside a budget the user sets, buy the
   bStock (one of the six Elitr trades: NVDAB, TSLAB, BABAB, CRCLB, SNDKB, METAB) in that same
   wallet (`baw market-order quote` → `swap`).

## Why it matters

- **Elitr becomes a marketplace instead of a closed loop.** Without the skill, only Elitr's own
  execution agent buys signals. With it, any agent with an Agentic Wallet becomes a paying customer
  of the same b402 endpoint, with no Elitr account, API key or SDK.
- **The whole AI execution layer is used.** Discovery (ERC-8004 registration file), payment (Agentic
  Wallet x402 signing, b402 verify and settle, gas sponsored), and execution (Agentic Wallet swap
  into a bStock) all run in one conversation, and every payment and trade needs a human "yes".
- **People who don't use crypto can "copy the desk".** Agentic Wallet is an MPC wallet created and
  signed into from the Binance App. There is no seed phrase or private key to handle. The user asks
  "should I buy NVDAB?", approves a $0.01 payment, reads two analysts' opinions, and can buy $2 of
  the tokenized stock.
- **The analysts get the payments.** Every external purchase emits the analyst's `payment.verified`
  event, which shows on the Elitr dashboard, with the external payer's address.

## Install

Requires Node 18 or later, a Binance account, an MPC Wallet in the Binance App, and an Agentic
Wallet. The Agentic Wallet can be created during the first sign-in.

```bash
# 1. Binance Agentic Wallet skill (official). It installs the `baw` CLI on first use if missing.
npx skills add binance/binance-skills-hub/skills/binance-web3/binance-agentic-wallet

# 2. Make sure baw meets the skill's requiredCliVersion. Skill v1.12.0 requires 1.10.0.
baw cli-check --required-version 1.10.0 --json   # 1.9.0 was installed at first (needUpdateCli: true); the runs below used 1.10.0
npm install -g @binance/agentic-wallet@1.10.0

# 3. Optional but recommended: the token audit used by the agentic-wallet swap pre-check
npx skills add binance/binance-skills-hub/skills/binance-web3/query-token-audit

# 4. The Elitr skill, from this repo (run at the repo root)
npx skills add ./skills/elitr-signals
#    after the repo is public: npx skills add <github-owner>/<repo>/skills/elitr-signals

# 5. Point it at the analysts. The defaults are the live hosts https://analyst.elitr.xyz and https://flow.elitr.xyz
export ELITR_ANALYSTS="http://localhost:4001,http://localhost:4003"   # local dev only
```

`npx skills add /Users/…/Elitr/skills/elitr-signals --list` was used to check that the installer
finds and parses the skill. Its output was "Local path validated, Found 1 skill: elitr-signals".

## First real paid run (for the demo recording)

Before recording:

- **The analysts must be able to reach b402.** On 2026-10-07 both local analysts answered
  `503 {"error":"b402 unavailable: fetch failed (UND_ERR_CONNECT_TIMEOUT)"}`, because
  `https://web3.binance.com` timed out from this machine. `www.binance.com` was reachable.
  `curl -m 15 -X POST https://web3.binance.com/build/api/v2/b402/supported` should connect (an
  unsigned call returns an error, which is fine). Binance also blocks some regions; see
  [deploy.md](deploy.md).
- **Payment config.** Both analysts' 402 carries two accepts, USDT via `permit2-exact` and U via
  `eip3009`, and both routes are proven with the Agentic Wallet. See
  [Payment config](#payment-config-two-accepts-both-proven). Pick the option by token, not by index.
- **Fund the Agentic Wallet on BSC.** Run `baw wallet address --json` to get its address. Send it
  about $3 of USDT or U (whichever option you will pick) and about $0.50 of BNB for swap gas.
  x402 payments are gasless. Swaps are not.
- **Start everything:** analysts on :4001 and :4003, then the dashboard (`apps/web`), so the
  Timeline is connected to both analysts' `/events`.

On camera:

1. **Sign in.** In Claude Code, say *"Sign in to Binance Agentic Wallet"*. The agent runs
   `baw auth signin --json`, shows a 6-character pairing code, and opens a QR page. In the Binance
   App:
   - scan the QR code and check that the pairing code matches
   - tick "I agree to enable Secure Auto Sign" and tap **Confirm**
   - tick the three security checks and tap **Continue**

   The agent then runs `baw auth verify` and `baw wallet status`, which should show `CONNECTED`.
2. **Show the guardrails.** In the Binance App, open Agentic Wallet → Settings (top-right icon) and
   set a small daily limit, a small x402 limit, and a token scope. Then ask the agent *"What are my
   wallet limits?"*. It runs `baw wallet settings --json` and reads back `dailyLimit`,
   `x402DailyLimit`, `x402QuotaLeft` and `sessionExpireTime`. These settings can only be changed in
   the App. The agent can read them but cannot change them.
3. **Discover.** Ask *"What Elitr analysts are there and what do they charge?"*. The skill runs
   `scripts/discover.mjs` and shows a table with the price (0.01), horizon (1h news, 30m flow) and
   symbols.
4. **Buy one signal ($0.01).** Ask *"Get me the Elitr flow analyst's signal on NVDAB."* The skill:
   1. Calls `/signal` and gets `402`.
   2. Runs `baw x402-payment preview` and shows both options (USDT, U) with amount, payee
      `0x66A4c73e7C02858B49F15fBC24589A76B97C0F5a`, and your balance.
   3. Waits for you to say **"yes"** to one option.
   4. Runs `baw x402-payment sign`. If you picked USDT, the first payment also sends a Permit2
      approve (`approveTxHash`, gas sponsored on BSC). U needs no approve.
   5. Replays the request right away with `PAYMENT-SIGNATURE`.
   6. Prints the signal: stance, score out of 100, horizon, rationale, sources, and the settlement
      tx link.
5. **Optional: buy about $2 of NVDAB** (or any of the six bStocks). Say *"Buy 2 USDT of NVDAB."* The skill:
   1. Resolves NVDAB from the `type=3` bStock list and checks it equals
      `0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436`.
   2. Runs the token audit.
   3. Runs `baw market-order quote` and shows the risk notice.
   4. Waits for **"yes"**.
   5. Runs `baw market-order swap`.
   6. Polls `baw market-order list --orderId …` until the status is `FINISHED`.

   This only works during US market hours. Outside them the quote fails (Trading API
   `40369 BSTOCK_INVALID_TRADING_TIME`). If $2 is below a minimum, the agent relays the error.
6. Optionally, say *"Sign out"* (`baw auth signout`).

### What to look for

**Elitr dashboard (Timeline, analyst lane):**
- `payment.required` is logged on the first call.
- `Verified 0.01 USDT from 0xABCD…1234` (or `0.01 U …`, `payment.verified`) appears, where the payer
  is the **Agentic Wallet address**, not the execution agent's wallet.
- `signal.produced` follows with the score.

**BscScan, signal payment** (`https://bscscan.com/tx/<PAYMENT-RESPONSE.transaction>`):
- A transfer of 0.01 of the price token from the Agentic Wallet address to `payTo`
  `0x66A4…0F5a`.
- The transaction is sent by the b402 relayer, not by the user, because gas is sponsored.
- For `permit2-exact`, the call goes through the b402 Permit2 proxy (`spenderAddress`
  `0x3038…8633`).
- The first USDT payment also has a separate `approve` from the Agentic Wallet to the canonical
  Permit2 contract `0x000000000022D473030F116dDEE9F6B43aC78BA3`.
- For U/USD1 `eip3009`, the call is `transferWithAuthorization` and there is no approve.

**BscScan, NVDAB buy:** a swap transaction sent from the Agentic Wallet address. USDT goes out and
NVDAB `0x02Fc…7436` comes in. Gas is paid in BNB.

## Payment config: two accepts, both proven

**What the analysts emit:** the 402 from both analysts carries **two** entries in `accepts[]`, both
`scheme: exact` on `eip155:56` for 0.01:

| Accept | Token | `extra.assetTransferMethod` | Approval |
| --- | --- | --- | --- |
| USDT `0x55d398326f99059fF775485246999027B3197955` | Tether USD | `permit2-exact`, `spenderAddress` `0x3038f7ac3b4D1a3fe886BdCB5cD01e9f6BDd8633` (b402 Permit2 proxy) | one-time approve from the wallet to canonical Permit2, gas sponsored |
| U `0xcE24439F2D9C6a2289F741120FE202248B666666` | United Stables | `eip3009` | none (`transferWithAuthorization`) |

**Both routes were run end to end with baw 1.10.0 on 2026-10-07 (BSC mainnet):**

- **USDT / `permit2-exact`.** `preview` showed the USDT option as `assetTransferMethod: "permit2"`,
  `READY_TO_SIGN`, `needApproveFirst: true`. The Agentic Wallet maps b402's `permit2-exact` to its
  own `permit2` internally; the naming difference between the two docs does not break anything in
  practice. `sign` returned `approveTxHash` for the sponsored Permit2 approve, and the replay
  settled. Approve
  [`0x62c332337eb1eb24fd2589dfe9c5afea30c9024d12ec5624cd7744724f1cc822`](https://bscscan.com/tx/0x62c332337eb1eb24fd2589dfe9c5afea30c9024d12ec5624cd7744724f1cc822),
  settle
  [`0x559b481ee017167040751bac274f5daf62d0bc97c75bac295ef03a9b338659b9`](https://bscscan.com/tx/0x559b481ee017167040751bac274f5daf62d0bc97c75bac295ef03a9b338659b9).
- **U / `eip3009`.** No approval. `sign` → settled signal in 3.5 s. Settle
  [`0xd2535021423ae6d30b4bbc6fde8f2b58fc0bc22dba7831c7d97c7eed78ca2e4e`](https://bscscan.com/tx/0xd2535021423ae6d30b4bbc6fde8f2b58fc0bc22dba7831c7d97c7eed78ca2e4e).

**Pick by token, not by index.** After the wallet was topped up with U, `preview` reordered the
options (U became index 1, USDT index 2). `selectedIndex` is not stable across previews of the
same 402, so a script must choose the option by `tokenAddress`.

If a preview ever returns `UNSUPPORTED_METHOD` for one option, use the other accept. There is no
need to change the analysts' configuration: `ANALYST_PAYMENT_ASSET` / `ANALYST_PAYMENT_METHOD` set
the primary accept (USDT, `permit2-exact`) and `ANALYST_PAYMENT_ALT_ASSET` /
`ANALYST_PAYMENT_ALT_METHOD` the second (U, `eip3009`); see `apps/analyst-agent/src/b402.ts`. USD1
(`0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d`) is also `eip3009` on b402 and would work the same
way as U.

**Signature lifetime:**
- The analyst runs verify, then produces the signal, then settles. The news analyst's signal step
  can include an LLM call when its 120 s cache is cold.
- Agentic Wallet signatures expire at `signatureExpiresAt`. The skill's campaign guide calls them
  short-lived (about 30 s).
- If settle happens after expiry, the user gets `402 settlement failed: …` and is not charged.
- For the recording, warm the cache first. For example, let the execution agent buy the same
  symbol a moment earlier, or use the flow analyst, which is deterministic and fast.

## Gaps and friction found

Facts with sources, for the DX report's "AI stack" section.

1. **The installed CLI was older than the skill requires.** `baw --version` returned `1.9.0`. The
   skill `binance-agentic-wallet` v1.12.0 frontmatter has `requiredCliVersion: '1.10.0'`, and
   `baw cli-check --required-version 1.10.0 --json` returned `needUpdateCli: true`. npm latest is
   `1.10.0`. The install docs say Skills "will detect [a missing baw] and install it automatically
   on first use". Upgrading is left to the skill's preflight step. We upgraded to 1.10.0 before the
   paid runs.
2. **Nested `--help` prints the top-level help.** In baw 1.9.0, `baw x402-payment preview --help`,
   `baw market-order swap --help` and `baw wallet status --help` all print the root usage. The
   working form is `baw x402-payment help preview`.
3. **The default `--gasLevel` changed between CLI versions.** `baw market-order help swap` in 1.9.0
   said `(default: "HIGH")` (and `limit-order buy` help also said `HIGH`), while the skill's
   `references/market-order.md` says `MEDIUM`. In 1.10.0 the swap default is `MEDIUM`, matching
   the skill docs.
4. **Permit2 method naming differs between the Agentic Wallet and b402 docs.** Agentic Wallet x402
   reference: supported methods are `eip3009`, `permit2`, `spl-transfer`. b402 Supported Payment
   Methods: `eip3009`, `permit2-exact`, `permit2-upto`. Neither document maps one to the other, and
   preview is resolved server-side. In practice it works: the 1.10.0 preview of our 402 shows the
   `permit2-exact` accept as `permit2` and signs it (approve `0x62c3…c822`, settle `0x559b…59b9`).
5. **The x402 preview example contradicts b402.** In `references/x402-payment.md`, the example
   output lists a BSC USDT option with `"assetTransferMethod": "eip3009"`. The b402 asset table
   says USDT has EIP-3009 = **No**; only U and USD1 have it.
6. **Signature lifetime is only in the campaign file.** "~30 seconds" appears only in the (expired)
   `references/campaign.md`. `x402-payment.md` mentions only the `signatureExpiresAt` field. A
   merchant that does work between verify and settle (as x402 merchants should, so they don't
   charge for failed work) has no documented time budget.
7. **There is no x402 page in the Agentic Wallet docs.** The Agentic Wallet "Skills Reference" page
   (`/agentic-wallet/skills-reference`) lists the skill's references without `x402-payment.md`
   (also missing: `approvals`, `gas`, `external-sign`, `speedup-cancel`, `campaign`). The Use Cases
   map has no x402 use case. x402 for buyers is documented only inside the skill. (Source: the
   repo's snapshot `docs/reference/binance-web3-llms-full.txt`.)
8. **The tokenized-stocks prerequisite skill only knows Ondo.** The Tokenized Securities use case
   ("trade tokenized stocks (bStock and Ondo)") requires the `binance-tokenized-securities-info`
   skill, saying "Without it, the Agent can't map 'AAPL' to a tradable token". That skill (v1.1)
   says `type=1` = Ondo is "currently the only supported tokenized stock provider". The
   agentic-wallet SKILL.md works around this by calling the RWA list API with `type=3` directly,
   and warns that "Older versions of it only know `type=1`".
9. **xStocks is not documented for trading.** The agentic-wallet SKILL.md maps `type=2` =
   "xStocks-style (`…x`)" for resolution, but the Agentic Wallet trading docs only mention bStock
   and Ondo. Elitr's news analyst lists `TSLAx`. The skill marks it signal-only.
10. **An expired campaign is still in the skill.** In skill v1.12.0, SKILL.md routes "buy/sell a
    bStock (币股)" to `references/campaign.md` (about 43 KB). That campaign ran 2026-08-17 to
    2026-09-01, so after that date the agent reads the file only to be told to ignore it.
11. **Preview requires sign-in.** `baw x402-payment preview` (a read-only quote) returns
    `NOT_LOGGED_IN` (code `10003000`) when signed out, so an agent cannot show the wallet-side
    price breakdown before the user signs in. Our skill decodes the 402 itself
    (`scripts/decode-402.mjs`) to show the price first.
12. **Docs and b402 were unreachable from our network.** On 2026-10-07, `developers.binance.com`
    pages and `https://web3.binance.com` (b402 and the web3 dev docs) timed out from our network
    (`UND_ERR_CONNECT_TIMEOUT`), while `www.binance.com` RWA endpoints answered. Our page research
    used the hub clone and the local `llms-full` snapshot. The URL
    `/agentic-wallet/use-cases/trading/stock-trading` from the hackathon brief does not exist in
    that snapshot; the page there is `/use-cases/trading/tokenized-securities`. This may be specific
    to our network. Re-check before quoting it.
13. **Positive:**
    - The Agentic Wallet x402 flow is two commands plus a header replay.
    - Preview reports balance, approval need and daily-limit blocks before anything is signed.
    - On BSC the Permit2 approve is gas-sponsored.
    - x402 spending has its own daily limit (`x402DailyLimit`), separate from trading.
    - The bStock list API (`…/rwa/stock/detail/list/ai?type=3`) returned NVDAB and TSLAB with the
      same contracts as our `packages/shared/src/assets.ts` (checked 2026-10-07; the four bStocks
      added on 2026-10-08 were verified on-chain against the PancakeSwap v3 factory instead).
    - Both of Elitr's accepts (USDT `permit2-exact`, U `eip3009`) are payable from one preview; the
      user can pick either token.

## Files

- `skills/elitr-signals/SKILL.md`: triggers, flow, confirmations, error table
- `skills/elitr-signals/references/elitr-api.md`: endpoints, schemas, error codes, symbols
- `skills/elitr-signals/references/payment-flow.md`: `baw x402-payment` usage for Elitr
- `skills/elitr-signals/references/trade-flow.md`: bStock purchase (any of the six) via `baw market-order`
- `skills/elitr-signals/scripts/discover.mjs`: free discovery and comparison table
- `skills/elitr-signals/scripts/decode-402.mjs`: unpaid request, decoded price, ready `baw` preview command
- `skills/elitr-signals/scripts/replay.mjs`: replays with `PAYMENT-SIGNATURE`, decodes `PAYMENT-RESPONSE`, prints the signal
