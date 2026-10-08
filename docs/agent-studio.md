# ERC-8004 identity, on-chain reputation and BNB Agent Studio — runbook

Elitr's angle for **Best Use of BNB Agent Studio** is that agents rate agents. Each of our three agents
(`analyst`, `analyst-flow`, `execution`) has an ERC-8004 identity. After a signal's horizon has passed,
the trader scores the analyst's call and posts the result to the **ERC-8004 Reputation Registry** on BSC with
`giveFeedback()`. That feedback sits on-chain where anyone can read it, filter it by reviewer, and compose
with it. Studio's own seller agents use the same canonical registries.

> **Status (8 Oct 2026):**
> - **Identities and ratings:** the three Elitr agents are registered on BSC mainnet (#365554 news analyst, #365555 flow analyst, #365556 trader), and on-chain ratings are live.
> - **Studio agent:** "Elitr Desk Brief" is registered as **#367734** and self-hosted at https://desk.elitr.xyz. See [`studio/README.md`](../studio/README.md).
> - **This runbook:** the manual steps below have all been completed.

Steps marked **[HUMAN]** need a person: a login, a funded key, a broadcast, or a judgement call.
Every other step is read-only or simulate-only.

---

## 0. Facts this runbook relies on (verified 2026-10-04)

| Item | Value | Source / check |
| --- | --- | --- |
| Spec | ERC-8004 (Draft), registration file `type = …#registration-v1`, Reputation `giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)` | https://eips.ethereum.org/EIPS/eip-8004 (raw: https://github.com/ethereum/ERCs/blob/master/ERCS/erc-8004.md) |
| **No `feedbackAuth`** | The current spec and the deployed v2.0.0 contracts don't require a pre-authorisation from the agent owner. Any address can post feedback **except the agent's owner or approved operator** (reverts `"Self-feedback not allowed"`). | Spec "Giving Feedback"; `ReputationRegistryUpgradeable.sol` in https://github.com/erc-8004/erc-8004-contracts |
| BSC mainnet (56) IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | erc-8004-contracts README, plus bnbagent-sdk `typescript/src/config.ts`. On-chain: code present, `name()="AgentIdentity"`, `getVersion()="2.0.0"` |
| BSC mainnet (56) ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | erc-8004-contracts README. On-chain: `getVersion()="2.0.0"`, `getIdentityRegistry()` = the address above |
| BSC testnet (97) IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | Same sources. On-chain `getVersion()="2.0.0"` |
| BSC testnet (97) ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | Same sources. `getIdentityRegistry()` = the testnet identity address |
| Agent Studio CLI | `@bnbagent/studio-cli@0.0.14` (bin `bag`), runtime `@bnbagent/studio-runtime@0.0.14`, SDK `@bnbagent/sdk@0.6.0` | `npm view`; https://github.com/bnb-chain/bnbagent-sdk; https://docs.bnbchain.org/developer-kit/bnbchain-studio/ |
| Managed trial | 48 h, **BSC testnet only**. The clock starts at the first deploy and a redeploy does not reset it. Runtime and data are deleted at expiry. `evm-local` key material is sent to the operator's secret store. | studio-cli README; https://www.bnbchain.org/en/bnb-agent-studio |

`packages/identity` defaults to these addresses for chains 56 and 97. Set `ERC8004_*_REGISTRY` only to override them.

### What Studio is, and what it is not

- `bag init` scaffolds **its own** TypeScript seller-agent project (`app/agent/src/sellerCore.ts`, `main.ts`, …)
  on `@bnbagent/studio-runtime`, with A2A, MCP and X402/MPP faces. `bag deploy --provider bnb|aws|azure|nodeops`
  ships **that generated project**. It doesn't host an arbitrary existing Node service, so our three
  `apps/*` servers can't be pushed to the managed runtime unchanged.
- To mint an identity, Studio calls the same canonical `IdentityRegistry.register(agentURI)` that we call directly
  with viem. Studio allows one agent per wallet: `bag erc8004 register` refuses if the wallet already owns one.
  Our own CLI has no such limit, but we still use separate owner keys (see 1.2).
- The trial ends after 48 h, but the rules say the deployed link must stay reachable through judging (12–23 Oct).
  **The managed trial therefore can't be the deployed link.** Use it to demo the Studio runtime (record it for
  the video), and host the real services yourself.

---

## 1. Keys and funding

1.1 **[HUMAN]** Decide which chain gets the identities. **Recommended: BSC mainnet (56).** Trades already happen
on mainnet, so feedback lands on the chain where the trader acts, and the cost is negligible (see 1.4).
Testnet (97) works the same way if you set `ERC8004_CHAIN_ID=97`.

1.2 **[HUMAN]** Create **one new wallet that owns the analyst identities**. Do not reuse the trader key:
an owner can never be rated by its own key, so the trader must not own an analyst identity.
- `ANALYST_OWNER_PRIVATE_KEY`: owns `analyst` and, unless overridden, `analyst-flow`.
- Optional `ANALYST_FLOW_OWNER_PRIVATE_KEY`: a separate owner for `analyst-flow`.
- `execution` is minted by the existing `EXECUTION_PRIVATE_KEY`. Its `agentWallet` then equals the address that
  posts feedback, as the spec recommends ("the agent SHOULD use the address set in the on-chain optional
  agentWallet metadata as the clientAddress").

The CLI refuses to mint an analyst identity whose owner equals the trader's address.

1.3 **[HUMAN]** Fund the wallets on the chosen chain:
- Analyst owner: **0.0005 BNB** covers two registrations with a large margin.
- Trader (`EXECUTION_PRIVATE_KEY`): it already holds gas for trades. Add **0.0005 BNB**, which covers its own
  registration plus about 50 feedback posts.

1.4 Gas measured on an anvil fork of BSC mainnet at block ~125.6M. The mainnet gas price observed was 0.05 gwei.

| Call | Gas | Cost at 0.05 gwei |
| --- | --- | --- |
| `register(dataURI)` (registration file stored fully on-chain, ~1.3 kB) | ~1,080,000 | ~0.000054 BNB |
| `register(https URI)` | ~178,000 | ~0.0000089 BNB |
| `giveFeedback` with inline feedback file (data URI + keccak hash) | ~120,000 | ~0.000006 BNB |

None of this uses Studio's MegaFuel sponsorship, so the wallets pay their own gas.

---

## 2. Mint the three ERC-8004 identities

All commands run from the repo root. The CLI reads the root `.env`. **Without `--yes` nothing is sent:** it
prints the registration JSON, the predicted agentId and a gas estimate from `simulateContract`.

2.1 Set the public base URLs in `.env`. They go into the registration file and should be the URLs judges can reach:
```
ANALYST_PUBLIC_URL=https://<analyst host>
ANALYST_FLOW_PUBLIC_URL=https://<flow analyst host>
EXECUTION_PUBLIC_URL=https://<execution host>
ERC8004_CHAIN_ID=56
# ERC8004_RPC_URL=...   (defaults to BSC_RPC_URL on 56)
ANALYST_OWNER_PRIVATE_KEY=0x...
```

2.2 Preview what will be minted (no transaction is sent):
```
pnpm --filter @elitr/identity card     -- --subject analyst
pnpm --filter @elitr/identity register -- --subject analyst
pnpm --filter @elitr/identity register -- --subject analyst-flow
pnpm --filter @elitr/identity register -- --subject execution
```

2.3 **[HUMAN]** Mint by adding `--yes`. Each run prints `ERC8004_AGENT_ID_…=<id>` and a JSON object shaped like the
`identity.registered` event:
```
pnpm --filter @elitr/identity register -- --subject analyst --yes
pnpm --filter @elitr/identity register -- --subject analyst-flow --yes
pnpm --filter @elitr/identity register -- --subject execution --yes
```
By default `agentURI` is a base64 `data:` URI, so the registration file lives fully on-chain and survives hosting
going away. The file's `registrations` entry already contains the agent's own id. Pass `--uri https://…` to
point at a hosted file instead.

2.4 **[HUMAN]** Paste the three ids into `.env`:
```
ERC8004_AGENT_ID_ANALYST=<id>
ERC8004_AGENT_ID_ANALYST_FLOW=<id>
ERC8004_AGENT_ID_EXECUTION=<id>
```

2.5 Verify the identities (read-only):
```
pnpm --filter @elitr/identity show -- --subject analyst
```
You can also look up the NFT on BscScan at https://bscscan.com/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432?a=<id>.

2.6 If a public URL changes later: run `pnpm --filter @elitr/identity set-uri -- --subject <s>` to simulate,
then add `--yes` to send. **[HUMAN]**

---

## 3. Turn on on-chain reputation

3.1 Add to `.env`:
```
ERC8004_POST_FEEDBACK=1
# optional:
# ERC8004_FEEDBACK_INLINE=0   # send feedbackURI="" and feedbackHash=0 (cheaper, but no verifiable detail)
# ERC8004_WAIT_RECEIPT=0      # return as soon as the tx is broadcast
```

3.2 **[HUMAN]** Restart the execution agent. Each time a signal is scored, it calls `identity.postFeedback(...)`.
That call simulates `giveFeedback` and then sends it, and the agent emits `reputation.posted` with the `txHash`.
The on-chain fields are:
- `value`: the analyst's 0–100 accuracy score, rounded, with `valueDecimals = 0`.
- `tag1`: the tag the trader passes (for example `accuracy`).
- `feedbackURI`: a `data:` URI of the spec's off-chain feedback file. It holds `agentRegistry`, `agentId`,
  `clientAddress`, `createdAt`, `value`, plus an `elitr` block with signalId, the exact value and stats.
- `feedbackHash`: `keccak256` of that JSON.

3.3 Check the reputation (read-only). `pnpm --filter @elitr/identity show -- --subject analyst` prints
`getSummary()` across all clients. Alternatively, call
`ReputationRegistry.readAllFeedback(<id>, [<trader address>], "accuracy", "", false)` on BscScan.

When `ERC8004_POST_FEEDBACK` is unset, `postFeedback` returns `{ skipped }` and sends nothing.

---

## 4. Agent Studio itself (optional, for the award narrative)

Run these in a **separate directory outside this repo**. Approve each command one at a time, and don't grant `bag:*`.

4.1 **[HUMAN]** Install the CLI (requires Node >= 22, pnpm 10 via corepack, and Bun >= 1.3 to deploy):
```
npm install --global @bnbagent/studio-cli
bag skills install          # interactive; scripted form per README: --target both --scope user
```

4.2 Show interop with Studio. Our identities are on the canonical registry Studio uses, so its read
commands should resolve them. `bag erc8004 show` / `bag erc8004 resolve` exist, but **their exact flags weren't
verified**; run `bag erc8004 --help` first.

4.3 **[HUMAN]** Optionally, scaffold a thin Studio seller that fronts Elitr. Pick one (`bag init <name> --rails b402`,
or ask the `/bnbagent-studio` skill), choose BSC testnet, `evm-local` wallet and the X402 face. In
`app/agent/src/sellerCore.ts`, have `runWork` either call our flow analyst's logic (it is deterministic) or proxy
to the public analyst `/signal`. Then run:
```
bag doctor
bag platform login          # GitHub login; also requests the tBNB/U faucet grant
bag platform credit
bag deploy prepare --provider bnb
bag deploy --provider bnb   # starts the 48h trial clock, which cannot be reset
bag deploy verify --provider bnb   # registers/updates ERC-8004 endpoint (testnet registry)
```
Points to keep in mind:
- Use a **fresh, testnet-only wallet**: on the managed trial its key is uploaded to the operator.
- Time the deploy so the 48 h window covers recording the demo video.
- After the trial expires, the link is gone. Don't submit it as the deployed link.
- Funding: claim tBNB and U from https://t.me/bnbchain_official_bot (up to 0.3 tBNB/day).

4.4 Honest fallback, and the default plan: host the three Elitr services ourselves (any VPS or container host)
and keep identity and reputation on **BSC mainnet** through `packages/identity`. The README should state clearly
that Studio's managed runtime only runs Studio-generated projects. Elitr uses the same ERC-8004 registries and
the same b402 (x402 V2) payment rail, and in this setup Studio is optional.

---

## 5. Environment variables (packages/identity)

| Var | Required | Meaning |
| --- | --- | --- |
| `ERC8004_CHAIN_ID` | no (56) | 56 = BSC mainnet, 97 = BSC testnet |
| `ERC8004_RPC_URL` | no | Defaults to `BSC_RPC_URL` on chain 56, otherwise a public RPC |
| `ERC8004_IDENTITY_REGISTRY` | no | Overrides the canonical address |
| `ERC8004_REPUTATION_REGISTRY` | no | Overrides the canonical address |
| `ERC8004_AGENT_ID_ANALYST` / `_ANALYST_FLOW` / `_EXECUTION` | after minting | Token ids |
| `ERC8004_POST_FEEDBACK` | to post | `1` enables `giveFeedback` |
| `ERC8004_FEEDBACK_INLINE` | no (on) | `0` sends no feedbackURI/hash |
| `ERC8004_WAIT_RECEIPT` | no (on) | `0` = don't wait for the receipt |
| `EXECUTION_PRIVATE_KEY` | to post | Trader key; signs `giveFeedback` and mints `execution` |
| `ANALYST_OWNER_PRIVATE_KEY` | CLI only | Mints `analyst` (and `analyst-flow`). Must differ from the trader key |
| `ANALYST_FLOW_OWNER_PRIVATE_KEY` | no | Separate owner for `analyst-flow` |
| `ANALYST_PUBLIC_URL` / `ANALYST_FLOW_PUBLIC_URL` / `EXECUTION_PUBLIC_URL` | CLI | Base URLs written into the registration files |

`identityFromEnv()` returns `null` unless `ERC8004_POST_FEEDBACK`, `ERC8004_CHAIN_ID` or one of the
`ERC8004_AGENT_ID_*` variables is set.

---

## 6. Verification done without spending (2026-10-04)

The test ran on an anvil fork of BSC mainnet (block ~125,645,900, RPC `bsc-rpc.publicnode.com`) using the default
anvil keys. On the fork, `anvil_setCode(addr, 0x)` was needed first, because **on real BSC mainnet the well-known
anvil accounts #0–#2 carry an EIP-7702 delegation (`0xef0100…`) to a sweeper contract**. That contract takes
any NFT minted to them inside `onERC721Received`, which makes `register` revert. This is one more reason
never to fund those keys.

1. The CLI minted `analyst` (owner anvil #1), `analyst-flow` (another key) and `execution` (anvil #0, https URI).
   The mint ids matched the simulated ids, and the embedded `registrations` entry was correct.
2. The trader (anvil #0) posted 3 feedbacks through `identityFromEnv().postFeedback`. Each returned a `txHash` and
   a 1-based `feedbackIndex`. `getSummary` and `readFeedback` read them back. The `NewFeedback` event's
   `feedbackURI` decoded to the spec's feedback file.
3. When the trader tried to rate its own `execution` identity, the call reverted at simulation, so nothing was sent.
4. The CLI refused to mint an analyst identity with the trader key.

anvil was stopped afterwards, and no real chain was written to.
