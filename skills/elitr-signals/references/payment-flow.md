# Paying for an Elitr signal with the Agentic Wallet (x402 / b402)

Source of truth for the `baw` commands: the `binance-agentic-wallet` skill,
`references/x402-payment.md` (skill v1.12.0, requires `baw` ≥ 1.10.0). Read it before building commands.
`x402` and `b402` are the same flow here: b402 is Binance's facilitator for x402 V2.

## Commands (exact syntax)

```bash
# 1. Preview - accepts the base64 PAYMENT-REQUIRED header value or the raw JSON body (auto-detected)
baw x402-payment preview --paymentRequirements '<base64-or-json>' --json

# 2. Sign - only after the user confirmed the amount/payee shown from preview
baw x402-payment sign --paymentId <paymentId> --selectedIndex <index> --json

# 3. Replay the SAME request with the returned header
curl -sS -D - -H "PAYMENT-SIGNATURE: <paymentHeaderValue>" "<base>/signal?symbol=NVDAB"
#   or: node <skill-dir>/scripts/replay.mjs "<url>" "<paymentHeaderValue>"
```

Tip: pass the base64 header (from `scripts/decode-402.mjs`) rather than JSON to avoid shell quoting.

## Preview result → what to do

`data.paymentId` plus `data.options[]` (pre-sorted, 1-based `index`). Per option: `status`,
`reasons[]`, `assetTransferMethod`, `tokenSymbol`, `tokenAddress`, `amount` (human units), `amountUsd`,
`payTo`, `userWalletAddress`, `currentBalance`, `needApproveFirst`, `originalAccept`.

For an Elitr 402 there are two options, USDT (`permit2-exact`, shown as `permit2`,
`needApproveFirst: true` on first use, approve gas sponsored) and U (`eip3009`, no approve). The
order is **not stable** between previews of the same 402 (observed: U moved from index 2 to index 1
after the wallet received U), so choose by `tokenAddress` and pass that option's `index` to `sign`.
Both routes have settled on mainnet with baw 1.10.0: USDT approve
`0x62c332337eb1eb24fd2589dfe9c5afea30c9024d12ec5624cd7744724f1cc822` + settle
`0x559b481ee017167040751bac274f5daf62d0bc97c75bac295ef03a9b338659b9`; U settle
`0xd2535021423ae6d30b4bbc6fde8f2b58fc0bc22dba7831c7d97c7eed78ca2e4e` (3.5 s from sign to signal).

| `status` / `reason` | Meaning for an Elitr signal | Action |
|---|---|---|
| `READY_TO_SIGN` | Payable now | Confirm with user → `sign` |
| `ACTION_REQUIRED` / `INSUFFICIENT_BALANCE` | Not enough of the price token on BSC | Offer top-up swap (separately confirmed), then preview again |
| `NOT_SIGNABLE` / `UNSUPPORTED_METHOD` | Agentic Wallet did not accept that option's `assetTransferMethod`. Documented set: `eip3009`, `permit2`, `spl-transfer`. Elitr's 402 always carries two accepts: USDT `permit2-exact` (shown by preview as `permit2`, proven to sign) and U `eip3009`. | Pick the other option from the same preview (by `tokenAddress`, not index), confirm it with the user, then `sign`. Only if both options are refused, stop and tell the user. |
| `NOT_SIGNABLE` / `UNSUPPORTED_NETWORK` | Not BSC/Base/Solana | Stop (Elitr is always `eip155:56`) |
| `NOT_SIGNABLE` / `INVALID_ACCEPT_STRUCTURE` | Malformed 402 | Stop, report |
| `NOT_SIGNABLE` / `NO_WALLET_ON_CHAIN` | No BSC address in this Agentic Wallet | Stop, report |
| `NOT_SIGNABLE` / `BLOCKED_BY_SECURITY_CHECK` | Binance flagged the payment | Stop, relay verbatim |
| `NOT_SIGNABLE` / `BLOCKED_DAILY_LIMIT_REACHED` | x402 daily limit used up | Raise it in the Binance App (Agentic Wallet → Settings) or wait for reset |

`baw wallet settings --json` shows `x402DailyLimit`, `x402QuotaUsed`, `x402QuotaLeft` (USD); this
quota is independent from the trading `dailyLimit`.

## Sign result

`data.paymentHeaderName` (always `PAYMENT-SIGNATURE` for x402 V2), `data.paymentHeaderValue`,
`data.approveTxHash` (non-null only when a Permit2 approve was dispatched; on BSC its gas is
sponsored), `data.binanceChainId`, `data.signatureExpiresAt` (unix seconds).

- `approveTxHash` non-null → wait for `baw wallet tx-history --tx <hash> --binanceChainId 56 --json`
  to confirm, then replay.
- Replay right away. The signature is single-use and expires at `signatureExpiresAt`; after that,
  restart from `preview`. The agentic-wallet campaign notes describe it as short-lived (~30 s), so
  ask for consent **before** `sign`, never between `sign` and replay.

## Transfer methods (b402 on BSC)

From the b402 "Supported Payment Methods" page:

| Method | Tokens | Approval |
|---|---|---|
| `eip3009` | U `0xcE24439F2D9C6a2289F741120FE202248B666666`, USD1 `0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d` | none (gasless signature) |
| `permit2-exact` | any configured ERC-20 incl. USDT `0x55d398326f99059fF775485246999027B3197955`, USDC `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` | one-time ERC-20 approve to canonical Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`); the b402 Permit2 proxy `spenderAddress` is `0x3038f7ac3b4D1a3fe886BdCB5cD01e9f6BDd8633` |

All four are 18 decimals on BSC: `10000000000000000` = 0.01. The Agentic Wallet lists its Permit2
method as `permit2`; it maps b402's `permit2-exact` to it without any configuration.

## Guardrails (from the agentic-wallet skill)

1. Confirm before `sign`.
2. Confirm before switching to a different option, token or network.
3. Pay only for the resource the user named; never substitute another analyst silently.
4. On network/unknown replay errors retry at most once automatically, then ask.
