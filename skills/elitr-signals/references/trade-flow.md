# Acting on a signal: buying NVDAB / TSLAB with the Agentic Wallet

Source of truth: `binance-agentic-wallet` skill — `SKILL.md` (Build the Command, Common Token
Addresses, US stock resolution), `references/market-order.md`, `references/security.md`. Background:
Agentic Wallet docs, "Tokenized Securities" use case (`/agentic-wallet/use-cases/trading/tokenized-securities`):
"Research and trade tokenized stocks (bStock and Ondo)".

## Preconditions

- The user explicitly asked to trade **and** stated a budget (in USDT). Never exceed it.
- `baw wallet status --json` → `CONNECTED`.
- `baw wallet balance --binanceChainId 56 --json` → enough USDT for the budget **and** some BNB for gas
  (x402 payments are gasless; swaps are not).
- `baw wallet settings --json` → `quotaLeft` (trading daily limit, USD) ≥ budget. The token scope
  setting ("Limited" vs all tokens) can block a bStock; that is changed only in the Binance App.

## 1. Resolve the contract (never guess)

```bash
curl -sS --max-time 25 -H 'Accept-Encoding: identity' -H 'User-Agent: binance-web3/1.1 (Skill)' \
  'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai?type=3'
```

`type=3` = bStock (`…B`), `type=1` = Ondo (`…on`), `type=2` = xStocks-style (`…x`). Find the entry
with `symbol` = `NVDAB` / `TSLAB`, `chainId` = `56`. It must equal:

| Symbol | Contract (BSC) |
|---|---|
| NVDAB | `0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436` |
| TSLAB | `0x5b1910eAaD6450E50f816082Aa078C41F10C292f` |

If it does not match or is missing, stop and tell the user. Never substitute the Ondo version
(`NVDAon`) for a bStock, or vice versa, without asking. The `binance-tokenized-securities-info`
skill v1.1 only knows `type=1` (Ondo), so do not rely on it to resolve a bStock.

## 2. Security pre-check

Follow agentic-wallet `references/security.md` §1: bStocks are not in the skill's trusted token table,
so run the `query-token-audit` audit on the target contract (chain 56), present hit risk items, and
let the user decide. If the audit is unavailable, say so and require explicit acknowledgment.

## 3. Quote → confirm → swap

```bash
baw market-order quote --binanceChainId 56 --fromTokenQty <budget> \
  --fromToken 0x55d398326f99059fF775485246999027B3197955 --toToken <bStock address> --json
```

Show: spend (USDT + address), expected NVDAB/TSLAB amount, slippage, the signal that motivated it,
and the risk notice from SKILL.md. Disclose defaults if not set: slippage `auto`, MEV protection
`true`; `gasLevel` defaults to `HIGH` in `baw` 1.9.0 `--help` (the skill reference says `MEDIUM`) —
pass `--gasLevel MEDIUM` explicitly if the user cares. Only on a clear "yes":

```bash
baw market-order swap --binanceChainId 56 --fromTokenQty <budget> \
  --fromToken 0x55d398326f99059fF775485246999027B3197955 --toToken <bStock address> --json
```

## 4. Poll to a terminal state (mandatory)

`success:true` + `orderId` only means *submitted*. Poll
`baw market-order list --orderId <orderId> --json` until `status` is `FINISHED` (report `txHash` and
amount received, link `https://bscscan.com/tx/<txHash>`) or `FAILED` (say it failed). Still `PENDING`
after ~30 s → say it is still processing.

## Market hours and halts

bStocks follow the underlying exchange session; outside trading hours quotes fail (Binance Trading
API error `40369 BSTOCK_INVALID_TRADING_TIME`; `40370 BSTOCK_INVALID_TRADING_PAIR` for a non-whitelisted
counter token). Relay the `baw` error verbatim and offer to try again in market hours. Do not convert
it into a limit order unless the user asks; if the user gives a price condition, use `limit-order`
and never fall back to an immediate market order (agentic-wallet SKILL.md rule 7).

## Minimum order size

The Binance Trading API documents a minimum for Ondo quotes (`40375 ONDO_FROM_USD_AMOUNT_TOO_SMALL`,
e.g. "Minimum order amount is 20 USD"). No bStock minimum is documented. If a small budget is
rejected, relay the error and let the user decide whether to raise it; never raise it yourself.

## Selling

Same flow with `--fromToken <bStock>` and `--toToken` USDT, quantity in bStock units, after
confirmation.
