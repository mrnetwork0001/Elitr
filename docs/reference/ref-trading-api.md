Title: Trading API - Binance Web3 API

URL Source: https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api

Published Time: Thu, 01 Oct 2026 09:02:41 GMT

Markdown Content:
## Get Aggregator Supported Chains[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-aggregator-supported-chains)

Return blockchain networks supported by the DEX aggregator. The supported list is dynamically configured server-side and may change over time. Pass `binanceChainId` to filter to a single chain; omit it to get the full list.

GET
/api/v1/dex/aggregator/supported/chain

https://web3.binance.com/build

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64-encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example:5000

`X-OC-NONCE`

​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example:unique-nonce-string

### Get Aggregator Supported Chains › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-aggregator-supported-chains/query-parameters)

`binanceChainId`

​string

Optional chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana). When set, only that chain is returned.

Example:56

### Get Aggregator Supported Chains ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-aggregator-supported-chains/responses)

Supported chains returned successfully.

`code`

​integer·int32

Business status code. 0 indicates success; any non-zero value indicates a business error.

Example:0

`msg`

​string

Status description message.

Example:success

​object[]

List of supported blockchain networks.

`binanceChainId`

​string

Unique chain identifier (follows EIP-155 chainId for EVM chains; e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana).

Example:56

`name`

​string

Full chain name.

Example:BNB Smart Chain

`shortName`

​string

Short chain name.

Example:BSC

`logoUrl`

​string

Chain logo image URL.

Example:https://static.onchainos.com/chains/bsc.png

`timestamp`

​integer·int64

Server response timestamp in milliseconds.

Example:1748601600000

`success`

​boolean

Convenience flag derived from `code == 0`.

Example:true

* * *

## Get ERC-20 Approve Transaction[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-erc20-approve-transaction)

Build the on-chain transaction data needed to approve the DEX router to spend a user's ERC-20 token before a swap. Calldata is encoded per the ERC-20 ABI standard (`approve()` selector + spender + amount).

GET
/api/v1/dex/aggregator/approve-transaction

https://web3.binance.com/build

### Get ERC-20 Approve Transaction ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-erc20-approve-transaction/authorization)

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64-encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example:5000

`X-OC-NONCE`

​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example:unique-nonce-string

### Get ERC-20 Approve Transaction › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-erc20-approve-transaction/query-parameters)

`binanceChainId`

​string·required

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC).

Example:1

`tokenContractAddress`

​string·required

ERC-20 token contract address to approve (0x + 40 hex chars).

Example:0xdAC17F958D2ee523a2206206994597C13D831ec7

`approveAmount`

​string·required

Approval amount in the token's smallest unit (positive integer string). Example "1000000" = 1 USDT (decimals=6).

Example:1000000

`vendor`

​string

RFQ vendor name. **Required for equity / RWA tokens (Ondo, BStock)**; pass the `vendorName` from the `/quote` response (e.g. `InchFusion`, `CowSwap`, `PcsXRfq`). When provided, the backend returns approve calldata targeting the vendor-specific spender contract (e.g. 1inch Router, PcsX Permit2, CowSwap VaultRelayer) instead of the default DEX router.

For regular (non-RWA) tokens, this parameter is optional. If omitted, the backend uses the standard DEX router. If a valid RFQ vendor is passed, the backend resolves that vendor's spender — used when buying Ondo/BStock with a stablecoin, where the from-token (e.g. USDT) itself is not an RFQ token but must be approved to the RFQ vendor's router.

Example:PcsXRfq

### Get ERC-20 Approve Transaction ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-erc20-approve-transaction/responses)

Approve transaction data returned successfully.

`code`

​integer·int32

Example:0

`msg`

​string

Example:success

​object[]

Approve transaction(s) to submit before the swap.

`data`

​string

ABI-encoded calldata for the ERC-20 `approve()` call. Selector + padded spender + padded amount.

Example:0x095ea7b3000000000000000000000000c67879f4065d3b9fe1c09ee990b891aa8e3a4c2f0000000000000000000000000000000000000000000000000000000000f4240

`dexContractAddress`

​string

DEX router contract address (the spender in the `approve()` call). Configured per chain.

Example:0xc67879F4065d3B9fe1C09EE990B891Aa8E3a4c2f

`gasLimit`

​string

Gas limit ceiling for the approve transaction (integer string, gas units).

Example:50000

`gasPrice`

​string

Gas price for the approve transaction (integer string, wei).

Example:110000000

`timestamp`

​integer·int64

Example:1748601600000

`success`

​boolean

Example:true

* * *

## Get Aggregated Quote[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-aggregated-quote)

Query multiple DEX vendors in parallel and return the priced routes sorted by `toTokenAmount` (descending). Each route carries an independent `quoteId` (TTL ~30s) that the swap endpoint consumes to construct calldata for the chosen route.

GET
/api/v1/dex/aggregator/quote

https://web3.binance.com/build

### Get Aggregated Quote ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-aggregated-quote/authorization)

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64-encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example:5000

`X-OC-NONCE`

​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example:unique-nonce-string

### Get Aggregated Quote › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-aggregated-quote/query-parameters)

`binanceChainId`

​string·required

Unique chain identifier (e.g. "56"=BSC, "1"=Ethereum, "CT_501"=Solana).

Example:56

`amount`

​string·required

Sell-token amount in the token's smallest unit (positive integer string, no decimals). Example "1000000" = 1 USDT (decimals=6).

Example:1000000

`fromTokenAddress`

​string·required

Sell-token contract address. EVM chains require 0x + 40 hex chars; non-EVM chains use the chain's native address format.

Example:0x55d398326f99059fF775485246999027B3197955

`toTokenAddress`

​string·required

Buy-token contract address. Must differ from `fromTokenAddress`.

Example:0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d

`vendor`

​string·enum

Optional vendor selector. When provided, only the specified vendor is queried through the single-vendor fast path; the request bypasses the multi-vendor dual-window, early-return, and price-check logic. Values are case-sensitive and must be one of `LiquidMesh`, `Pancake`, or `Jupiter`. The vendor must also support the requested chain. An unsupported value or unavailable vendor/chain returns `PARAM_ERROR` (40001). When omitted, the API queries all applicable vendors in parallel and returns the aggregated routes.

Enum values:

LiquidMesh

Pancake

Jupiter

Example:LiquidMesh

`userWalletAddress`

​string

User wallet address. Required when quoting RFQ routes (equity / RWA tokens such as Ondo and BStock). This address is used as the receiver in the RFQ order and must match the wallet that signs `rfq.typedDataToSign` in the subsequent `/swap` call.

Example:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

`feePercent`

​string

Custom fee (referral fee / Add Fee) percentage as a decimal string. Must be paired with `feeSource` — either both present or both absent.

**Range by chain:**`(0, 5]` for EVM chains (BSC, Ethereum, Base, etc.) and `(0, 10]` for Solana (`CT_501`) — greater than 0, up to the chain-specific maximum inclusive, max 2 decimal places. `"1.5"` means 1.5%. Values exceeding 2 decimal places are rejected with `INVALID_FEE_PERCENT` (40466).

**`four.meme` tokens are not supported** — do not pass fee parameters when either side of the pair is a `four.meme` token.

Example:1.5

`feeSource`

​string·enum

Fee deduction direction. `FROM_TOKEN` = deduct the fee from the sell token (the amount passed to the DEX is reduced to a net amount); `TO_TOKEN` = deduct the fee from the buy-token output (the user's actual received amount is reduced). Must be paired with `feePercent`.

Enum values:

FROM_TOKEN

TO_TOKEN

Example:FROM_TOKEN

### Get Aggregated Quote ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-aggregated-quote/responses)

Quote routes returned successfully.

`code`

​integer·int32

Example:0

`msg`

​string

Example:success

​object[]

One route per vendor that returned a valid quote, sorted by `toTokenAmount` descending.

`quoteId`

​string

Per-route quote identifier (UUID, no dashes). Pass to the swap endpoint to lock in this route.

Example:a1b2c3d4e5f64a8b9c0d1e2f3a4b5c6d

`vendorName`

​string

Source vendor display name. Possible values include LiquidMesh, Lifi, 1inch, Pancake, Jupiter.

Example:Lifi

`binanceChainId`

​string

Chain identifier echoed from the request.

Example:56

`fromTokenAmount`

​string

Sell amount echoed from the request (smallest unit, integer string).

Example:1000000

`toTokenAmount`

​string

Estimated buy-token amount returned by the vendor (smallest unit, integer string).

Example:998500000000000000

`tradeFee`

​string | null

Estimated network fee for this route in USD. Null when the vendor does not return one.

Example:0.12

`estimateGasFee`

​string | null

Estimated gas in the chain's smallest unit (e.g. wei). May be null on Solana.

Example:150000

`priceImpactPercent`

​string | null

Estimated price impact percentage. Null when the vendor does not return one.

Example:-0.01

`router`

​string

Routing path description, addresses joined with "--".

Example:0x55d3...--0xbb4C...--0x8AC7...

​object

Sell-token metadata.

Sell-token metadata.

`tokenContractAddress`

​string

Token contract address.

Example:0x55d398326f99059fF775485246999027B3197955

`tokenSymbol`

​string

Token ticker.

Example:USDT

`tokenUnitPrice`

​string

Token USD price (decimal string).

Example:1.0002

`decimal`

​string

Token decimals.

Example:18

`isHoneyPot`

​boolean

Whether the token is a honeypot (buyable but not sellable).

Example:false

`taxRate`

​string

Token tax rate. Range 0–1; "0.01" means 1%.

Example:0

​object

Buy-token metadata. Same shape as `fromToken`.

Buy-token metadata. Same shape as `fromToken`.

`tokenContractAddress`

​string

Token contract address.

Example:0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d

`tokenSymbol`

​string

Token ticker.

Example:BTCB

`tokenUnitPrice`

​string

Token USD price (decimal string).

Example:67000.5

`decimal`

​string

Token decimals.

Example:18

`isHoneyPot`

​boolean

Whether the token is a honeypot.

Example:false

`taxRate`

​string

Token tax rate.

Example:0

​object[]

Routing path segments. Each segment corresponds to one hop on one DEX protocol; multi-DEX hops are flattened.

​object

DEX protocol used for this segment.

DEX protocol used for this segment.

`dexName`

​string

DEX protocol name.

Example:Uniswap V3

`percent`

​string

Share of total flow routed through this DEX (2-decimal percentage string).

Example:85.99

​object

Segment's sell-token info. Same shape as the top-level `fromToken`.

Segment's sell-token info. Same shape as the top-level `fromToken`.

`tokenContractAddress`

​string

Example:0x55d398326f99059fF775485246999027B3197955

`tokenSymbol`

​string

Example:USDT

`fromTokenIndex`

​string

Sell-token index after global de-duplication (string form).

Example:0

​object

Segment's buy-token info.

Segment's buy-token info.

`tokenContractAddress`

​string

Example:0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d

`tokenSymbol`

​string

Example:BTCB

`toTokenIndex`

​string

Buy-token index after global de-duplication (string form).

Example:1

`executionMode`

​string·enum

Execution mode for this route. `SWAP` = standard on-chain swap (sign the `tx` object from `/swap` and broadcast). `RFQ` = signed order flow (sign `rfq.typedDataToSign` from `/swap` with EIP-712, submit via `POST /order/submit`, poll `GET /order/{orderId}`). Equity / RWA tokens always return `RFQ`.

Enum values:

SWAP

RFQ

Example:SWAP

`approveTarget`

​string | null

The spender contract address the backend will encode into the approve calldata for this route. To obtain that calldata, call `/approve-transaction` with `vendor=<vendorName>` (the string name, e.g. `"PcsXRfq"`) — the backend resolves the spender address internally from the vendor name. This field is provided for informational purposes only (e.g. to call ERC-20 `approve()` directly without going through `/approve-transaction`). Null when no approval is needed (e.g. native-token swap or already approved).

Example:0xc67879F4065d3B9fe1C09EE990B891Aa8E3a4c2f

`isBest`

​boolean

Whether this route has the highest `toTokenAmount` among all routes returned in this response. At most one route per response has `isBest=true`.

Example:true

`feeAmount`

​string | null

Fee amount deducted for this route (smallest unit, integer string). Only populated when the request enabled the custom fee (`feePercent` + `feeSource` both present); `null` otherwise. `FROM_TOKEN` direction = `originalFromCoinAmount × feePercent/100` (HALF_UP); `TO_TOKEN` direction = `originalToCoinAmount × feePercent/100` (HALF_DOWN).

Example:15000

`feeToken`

​string | null

Contract address of the token in which the fee is denominated. `FROM_TOKEN` direction = sell-token address; `TO_TOKEN` direction = buy-token address. `null` when the custom fee is not enabled.

Example:0x55d398326f99059fF775485246999027B3197955

`actualSwapAmount`

​string | null

Actual amount participating in the DEX swap (smallest unit, integer string). `FROM_TOKEN` direction = net amount after fee deduction (`fromTokenAmount − feeAmount`, i.e. the amountIn sent to the DEX); `TO_TOKEN` direction = original input amount (fee is taken from the output side, so the full input participates in the swap). `null` when the custom fee is not enabled.

Example:985000

`timestamp`

​integer·int64

Example:1748601600000

`success`

​boolean

Example:true

* * *

## Build Swap Transaction[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#build-swap-transaction)

Build the on-chain swap calldata for a previously quoted route. The request is matched against the cached quote by `quoteId` (TTL ~30s); if the entry has expired, `QUOTE_EXPIRED` (40401) is returned, and if the request parameters disagree with the cached quote, `SWAP_QUOTE_MISMATCH` (40462) is returned.

GET
/api/v1/dex/aggregator/swap

https://web3.binance.com/build

### Build Swap Transaction ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#build-swap-transaction/authorization)

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64-encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example:5000

`X-OC-NONCE`

​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example:unique-nonce-string

### Build Swap Transaction › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#build-swap-transaction/query-parameters)

`binanceChainId`

​string·required

Unique chain identifier (e.g. "56"=BSC, "1"=Ethereum, "CT_501"=Solana).

Example:56

`amount`

​string·required

Sell-token amount in the token's smallest unit (positive integer string, no decimals).

Example:1000000

`fromTokenAddress`

​string·required

Sell-token contract address.

Example:0x55d398326f99059fF775485246999027B3197955

`toTokenAddress`

​string·required

Buy-token contract address.

Example:0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d

`userWalletAddress`

​string·required

User wallet address (transaction sender).

Example:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

`quoteId`

​string·required

quoteId returned from `/quote` for the route to execute. TTL ~30s; expired entries return `QUOTE_EXPIRED` (40401).

Example:a1b2c3d4e5f64a8b9c0d1e2f3a4b5c6d

`slippagePercent`

​string

Maximum slippage tolerance as a percentage string. Required unless `autoSlippage=true`.

**Range by chain:**

*   EVM chains (BSC, Ethereum, Base, etc.): `0` to `100` (inclusive)
*   Solana (`CT_501`): `0` to less than `100` (i.e. `< 100`)

**Range by vendor:**

*   1inch, PancakeSwap: `0` to `50` (values above 50 are rejected)
*   LiFi, LiquidMesh: `0` to `100` (EVM) or `0` to `< 100` (Solana)
*   Jupiter (Solana): `0` to less than `100`; the value is converted to basis points (`slippageBps = ceil(slippagePercent × 100)`) and applied to the on-chain swap

`"0.5"` means 0.5% maximum slippage. When `autoSlippage=true` this field is overridden by the auto-computed value.

Example:0.5

`approveTransaction`

​string·enum

When "true", `signatureData` includes the spender address and approve calldata so the client can submit it before the swap. Defaults to false.

Enum values:

true

false

Example:false

`approveAmount`

​string

Override approve amount (smallest unit, positive integer string). Defaults to the swap amount.

Example:1000000

`gasLimit`

​string

Gas limit override (positive integer string). EVM only.

Example:200000

`gasLevel`

​string·enum

Gas price tier. Defaults to "average".

Enum values:

slow

average

fast

Example:average

`priceImpactProtectionPercent`

​string

Maximum allowed price impact percentage (0–100). Defaults to 90; set to 100 to disable.

Example:90

`autoSlippage`

​string·enum

When `"true"`, slippage is auto-derived from market data and overrides `slippagePercent`. Either `slippagePercent` or `autoSlippage=true` must be provided — omitting both returns a parameter error. Defaults to `"false"`.

Enum values:

true

false

Example:false

`maxAutoSlippagePercent`

​string

Cap on auto-derived slippage (only applies when `autoSlippage=true`).

Example:3

`computeUnitLimit`

​string

Solana only — maximum compute units the transaction may consume (analogous to EVM gasLimit). Applies only when `binanceChainId=CT_501`.

Example:1400000

`computeUnitPrice`

​string

Solana only — priority fee per compute unit (micro-lamports), analogous to EVM gasPrice. When omitted, the platform computes a value dynamically. Applies only when `binanceChainId=CT_501`.

Example:1000

`tips`

​string

Solana only — Jito tips in SOL for MEV protection. Valid range [0.000000001, 2] (minimum 1 lamport). When specified, it is recommended to set `computeUnitPrice=0`. Applies only when `binanceChainId=CT_501`.

Example:0.001

`feePercent`

​string

Custom fee (referral fee / Add Fee) percentage as a decimal string. Must be paired with exactly one of `fromTokenReferrerWalletAddress` or `toTokenReferrerWalletAddress` (the two referrer addresses are mutually exclusive).

**Range by chain:**`(0, 5]` for EVM chains (BSC, Ethereum, Base, etc.) and `(0, 10]` for Solana (`CT_501`) — greater than 0, up to the chain-specific maximum inclusive, max 2 decimal places. `"1.5"` means 1.5%. Values exceeding 2 decimal places are rejected with `INVALID_FEE_PERCENT` (40466).

**`four.meme` tokens are not supported** — do not pass fee parameters when either side of the pair is a `four.meme` token.

Example:1.5

`fromTokenReferrerWalletAddress`

​string

Wallet address that receives the fee deducted from the sell token (`FROM_TOKEN` direction). Mutually exclusive with `toTokenReferrerWalletAddress` — providing both returns `CONFLICT_REFERRER_PARAMS` (40468). Address format depends on the chain: EVM chains require `0x` + 40 hex chars; Solana (`CT_501`) requires a Base58 pubkey. An invalid format returns `INVALID_REFERRER_ADDRESS` (40467). Must be paired with `feePercent`.

Example:0xCbF2B6E6e3D7e9e4e4e4e4e4e4e4e4e4e4e4e4e4

`toTokenReferrerWalletAddress`

​string

Wallet address that receives the fee deducted from the buy-token output (`TO_TOKEN` direction). Mutually exclusive with `fromTokenReferrerWalletAddress` — providing both returns `CONFLICT_REFERRER_PARAMS` (40468). Address format depends on the chain: EVM chains require `0x` + 40 hex chars; Solana (`CT_501`) requires a Base58 pubkey. An invalid format returns `INVALID_REFERRER_ADDRESS` (40467). Must be paired with `feePercent`. On Solana, the referrer must already be activated (funded with some SOL) or the request returns `REFERRER_NOT_ACTIVATED` (40469).

Example:0xCbF2B6E6e3D7e9e4e4e4e4e4e4e4e4e4e4e4e4e4

### Build Swap Transaction ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#build-swap-transaction/responses)

Swap transaction data returned successfully.

`code`

​integer·int32

Example:0

`msg`

​string

Example:success

​object

​object

Routing result for the chosen vendor.

Routing result for the chosen vendor.

`binanceChainId`

​string

Chain identifier echoed from the request.

Example:56

`vendorName`

​string

Vendor that supplied the executed quote (e.g. LiquidMesh, Lifi, 1inch, Pancake, Jupiter).

Example:Lifi

`fromTokenAmount`

​string

Sell-token amount (smallest unit, integer string).

Example:1000000

`toTokenAmount`

​string

Estimated buy-token amount (smallest unit, integer string).

Example:998500000000000000

`tradeFee`

​string | null

Estimated network fee in USD.

Example:0.12

`estimateGasFee`

​string | null

Estimated gas in the chain's smallest unit (e.g. wei).

Example:150000

`router`

​string

Routing path description, addresses joined with "--".

Example:0x55d3...--0xbb4C...--0x8AC7...

`priceImpactPercent`

​string

Price impact percentage. Formula (received_value − sent_value) / sent_value.

Example:-0.01

​object[]

Routing path segments. Same shape as the `dexRouterList` returned by `/quote`.

​object

`dexName`

​string

Example:Uniswap V3

`percent`

​string

Example:85.99

​object

`tokenContractAddress`

​string

Example:0x55d398326f99059fF775485246999027B3197955

`tokenSymbol`

​string

Example:USDT

`fromTokenIndex`

​string

Example:0

​object

`tokenContractAddress`

​string

Example:0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d

`tokenSymbol`

​string

Example:BTCB

`toTokenIndex`

​string

Example:1

​object

Sell-token metadata.

Sell-token metadata.

`tokenContractAddress`

​string

Example:0x55d398326f99059fF775485246999027B3197955

`tokenSymbol`

​string

Example:USDT

`tokenUnitPrice`

​string

Example:1.0002

`decimal`

​string

Example:18

`isHoneyPot`

​boolean

Example:false

`taxRate`

​string

Example:0

​object

Buy-token metadata.

Buy-token metadata.

`tokenContractAddress`

​string

Example:0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d

`tokenSymbol`

​string

Example:BTCB

`tokenUnitPrice`

​string

Example:67000.5

`decimal`

​string

Example:18

`isHoneyPot`

​boolean

Example:false

`taxRate`

​string

Example:0

`feeAmount`

​string | null

Fee amount deducted for this swap (smallest unit, integer string). Only populated when the request enabled the custom fee; `null` otherwise. `FROM_TOKEN` direction = `originalFromCoinAmount × feePercent/100` (HALF_UP); `TO_TOKEN` direction = `originalToCoinAmount × feePercent/100` (HALF_DOWN).

Example:15000

`feeToken`

​string | null

Contract address of the token in which the fee is denominated. `FROM_TOKEN` direction = sell-token address; `TO_TOKEN` direction = buy-token address. `null` when the custom fee is not enabled.

Example:0x55d398326f99059fF775485246999027B3197955

`actualSwapAmount`

​string | null

Actual amount participating in the DEX swap (smallest unit, integer string). `FROM_TOKEN` direction = net amount after fee deduction (`fromTokenAmount − feeAmount`); `TO_TOKEN` direction = original input amount (fee is taken from the output side). `null` when the custom fee is not enabled.

Example:985000

​object

On-chain transaction payload to sign and submit.

On-chain transaction payload to sign and submit.

`from`

​string

User wallet address (transaction sender).

Example:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

`to`

​string

DEX router contract address (the transaction's `to` field).

Example:0x1111111254EEB25477B68fb85Ed929f73A960582

`data`

​string

ABI-encoded calldata.

Example:0x12aa3caf...

`value`

​string

Native-token amount sent with the transaction (wei). "0" for ERC-20 swaps.

Example:0

`gas`

​string

Gas limit estimate.

Example:200000

`gasPrice`

​string

Gas price (wei).

Example:5000000000

`maxPriorityFeePerGas`

​string

EIP-1559 max priority fee per gas (wei).

Example:1000000000

`minReceiveAmount`

​string

Minimum buy-token amount the user accepts at the slippage limit (smallest unit, integer string).

Example:993507500000000000

`slippagePercent`

​string

Slippage value applied to this transaction (percentage string).

Example:0.5

`signatureData`

​string[]

Auxiliary signature data. When `approveTransaction=true` was passed, this contains the spender address and approve calldata.

`computeUnitPrice`

​string | null

Solana priority fee per compute unit (micro-lamports). Echoed when supplied; computed by the platform otherwise. Null on EVM chains.

Example:1000

`computeUnitLimit`

​string | null

Solana compute-unit ceiling. Echoed when supplied; not returned otherwise. Null on EVM chains.

Example:1400000

`executionMode`

​string·enum

Execution mode for this swap. `SWAP` = sign the `tx` object and broadcast to the chain. `RFQ` = sign `rfq.typedDataToSign` with EIP-712 (`eth_signTypedData_v4`), then submit via `POST /order/submit` and poll `GET /order/{orderId}` for settlement status. Equity / RWA tokens always return `RFQ`.

Enum values:

SWAP

RFQ

Example:SWAP

`rfq`

​object | null

RFQ order payload. Present only when `executionMode=RFQ`. Contains the EIP-712 typed data to sign, the target vendor, the signing scheme, and (when requested) the approve transaction data.

`timestamp`

​integer·int64

Example:1748601600000

`success`

​boolean

Example:true

* * *

## Quote and Build Swap Transaction (Flash API)[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#quote-and-build-swap-transaction)

Combines quoting and swap-transaction construction into a single call. Unlike the two-step `/quote` + `/swap` flow, this endpoint does not require a prior `/quote` call or a `quoteId` — it returns the executable calldata / swapTransaction directly, eliminating one HTTP round-trip. Use this endpoint for latency-sensitive trading when the vendor is known upfront. The response shape is identical to `/swap`, so clients can reuse the same response parsing logic for both endpoints.

GET
/api/v1/dex/aggregator/quote-and-swap

https://web3.binance.com/build

### Quote and Build Swap Transaction (Flash API) ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#quote-and-build-swap-transaction/authorization)

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

### Quote and Build Swap Transaction (Flash API) › Headers[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#quote-and-build-swap-transaction/header-parameters)

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64-encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example:5000

`X-OC-NONCE`

​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example:unique-nonce-string

### Quote and Build Swap Transaction (Flash API) › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#quote-and-build-swap-transaction/query-parameters)

`binanceChainId`

​string·required

Unique chain identifier (e.g. "56"=BSC, "1"=Ethereum, "CT_501"=Solana).

Example:56

`amount`

​string·required

Sell-token amount in the token's smallest unit (positive integer string, no decimals).

Example:1000000

`fromTokenAddress`

​string·required

Sell-token contract address.

Example:0x55d398326f99059fF775485246999027B3197955

`toTokenAddress`

​string·required

Buy-token contract address.

Example:0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d

`userWalletAddress`

​string·required

User wallet address (transaction sender). For Solana, a Base58 system-account address with sufficient SOL for gas.

Example:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

`vendor`

​string·enum·required

Swap vendor to use for this request. **Required** — case-sensitive; must match one of the enum values. Any other value returns `PARAM_ERROR` (40001). For multi-vendor aggregation, use `/swap` with a `quoteId` instead.

Enum values:

LiquidMesh

Example:LiquidMesh

`slippagePercent`

​string

Maximum slippage tolerance as a percentage string. Required unless `autoSlippage=true`.

**Range by chain:**

*   EVM chains (BSC, Ethereum, Base, etc.): `0` to `100` (inclusive)
*   Solana (`CT_501`): `0` to less than `100` (i.e. `< 100`)

`"0.5"` means 0.5% maximum slippage. When `autoSlippage=true` this field is overridden by the auto-computed value.

Example:0.5

`excludeDexes`

​string

Comma-separated list of DEXes to exclude from routing. Pass the `dexName` values returned in the response `routerResult.dexRouterList` as-is (e.g. `"Pancakeswap V4,Pancakeswap V3"`). On EVM/Sui/Tron chains they are normalized automatically; on Solana the value is case-sensitive and must match the response exactly. Omit or leave empty to exclude nothing.

Example:Pancakeswap V4,Pancakeswap V3

`enableRFQ`

​string·enum

Whether to enable RFQ liquidity sources for routing. Default depends on the token pair: **BStock pairs default to `"true"` (RFQ enabled)**; all other tokens default to `"false"` (RFQ disabled, AMM-only routing). An explicit value always overrides the default. `"true"` may return better pricing, but the returned calldata may embed RFQ settlements with a short (~30s) deadline.

Enum values:

true

false

Example:false

`approveTransaction`

​string·enum

When "true", `signatureData` includes the spender address and approve calldata so the client can submit it before the swap. Defaults to false.

Enum values:

true

false

Example:false

`approveAmount`

​string

Override approve amount (smallest unit, positive integer string). Defaults to the swap amount.

Example:1000000

`gasLimit`

​string

Gas limit override (positive integer string). EVM only.

Example:200000

`gasLevel`

​string·enum

Gas price tier. Defaults to "average".

Enum values:

slow

average

fast

Example:average

`priceImpactProtectionPercent`

​string

Maximum allowed price impact percentage (0–100). Defaults to 90; set to 100 to disable.

Example:90

`autoSlippage`

​string·enum

When `"true"`, slippage is auto-derived from market data and overrides `slippagePercent`. Either `slippagePercent` or `autoSlippage=true` must be provided — omitting both returns a parameter error. Defaults to `"false"`.

Enum values:

true

false

Example:false

`maxAutoSlippagePercent`

​string

Cap on auto-derived slippage (only applies when `autoSlippage=true`).

Example:3

`computeUnitLimit`

​string

Solana only — maximum compute units the transaction may consume (analogous to EVM gasLimit). Applies only when `binanceChainId=CT_501`.

Example:1400000

`computeUnitPrice`

​string

Solana only — priority fee per compute unit (micro-lamports), analogous to EVM gasPrice. When omitted, the platform computes a value dynamically. Applies only when `binanceChainId=CT_501`.

Example:1000

`tips`

​string

Solana only — Jito tips in SOL for MEV protection. Valid range [0.000000001, 2] (minimum 1 lamport). When specified, it is recommended to set `computeUnitPrice=0`. Applies only when `binanceChainId=CT_501`.

Example:0.001

`feePercent`

​string

Custom fee (referral fee / Add Fee) percentage as a decimal string. Must be paired with exactly one of `fromTokenReferrerWalletAddress` or `toTokenReferrerWalletAddress` (the two referrer addresses are mutually exclusive).

**Range by chain:**`(0, 5]` for EVM chains (BSC, Ethereum, Base, etc.) and `(0, 10]` for Solana (`CT_501`) — greater than 0, up to the chain-specific maximum inclusive, max 2 decimal places. `"1.5"` means 1.5%. Values exceeding 2 decimal places are rejected with `INVALID_FEE_PERCENT` (40466).

**`four.meme` tokens are not supported** — do not pass fee parameters when either side of the pair is a `four.meme` token.

Example:1.5

`fromTokenReferrerWalletAddress`

​string

Wallet address that receives the fee deducted from the sell token (`FROM_TOKEN` direction). Mutually exclusive with `toTokenReferrerWalletAddress` — providing both returns `CONFLICT_REFERRER_PARAMS` (40468). Address format depends on the chain: EVM chains require `0x` + 40 hex chars; Solana (`CT_501`) requires a Base58 pubkey. An invalid format returns `INVALID_REFERRER_ADDRESS` (40467). Must be paired with `feePercent`.

Example:0xCbF2B6E6e3D7e9e4e4e4e4e4e4e4e4e4e4e4e4e4

`toTokenReferrerWalletAddress`

​string

Wallet address that receives the fee deducted from the buy-token output (`TO_TOKEN` direction). Mutually exclusive with `fromTokenReferrerWalletAddress` — providing both returns `CONFLICT_REFERRER_PARAMS` (40468). Address format depends on the chain: EVM chains require `0x` + 40 hex chars; Solana (`CT_501`) requires a Base58 pubkey. An invalid format returns `INVALID_REFERRER_ADDRESS` (40467). Must be paired with `feePercent`. On Solana, the referrer must already be activated (funded with some SOL) or the request returns `REFERRER_NOT_ACTIVATED` (40469).

Example:0xCbF2B6E6e3D7e9e4e4e4e4e4e4e4e4e4e4e4e4e4

### Quote and Build Swap Transaction (Flash API) ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#quote-and-build-swap-transaction/responses)

Swap transaction data returned successfully.

`code`

​integer·int32

Example:0

`msg`

​string

Example:success

​object

​object

Routing result for the chosen vendor.

Routing result for the chosen vendor.

`binanceChainId`

​string

Chain identifier echoed from the request.

Example:56

`vendorName`

​string

Vendor that supplied the executed quote (e.g. LiquidMesh, Lifi, 1inch, Pancake, Jupiter).

Example:Lifi

`fromTokenAmount`

​string

Sell-token amount (smallest unit, integer string).

Example:1000000

`toTokenAmount`

​string

Estimated buy-token amount (smallest unit, integer string).

Example:998500000000000000

`tradeFee`

​string | null

Estimated network fee in USD.

Example:0.12

`estimateGasFee`

​string | null

Estimated gas in the chain's smallest unit (e.g. wei).

Example:150000

`router`

​string

Routing path description, addresses joined with "--".

Example:0x55d3...--0xbb4C...--0x8AC7...

`priceImpactPercent`

​string

Price impact percentage. Formula (received_value − sent_value) / sent_value.

Example:-0.01

​object[]

Routing path segments. Same shape as the `dexRouterList` returned by `/quote`.

​object

`dexName`

​string

Example:Uniswap V3

`percent`

​string

Example:85.99

​object

`tokenContractAddress`

​string

Example:0x55d398326f99059fF775485246999027B3197955

`tokenSymbol`

​string

Example:USDT

`fromTokenIndex`

​string

Example:0

​object

`tokenContractAddress`

​string

Example:0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d

`tokenSymbol`

​string

Example:BTCB

`toTokenIndex`

​string

Example:1

​object

Sell-token metadata.

Sell-token metadata.

`tokenContractAddress`

​string

Example:0x55d398326f99059fF775485246999027B3197955

`tokenSymbol`

​string

Example:USDT

`tokenUnitPrice`

​string

Example:1.0002

`decimal`

​string

Example:18

`isHoneyPot`

​boolean

Example:false

`taxRate`

​string

Example:0

​object

Buy-token metadata.

Buy-token metadata.

`tokenContractAddress`

​string

Example:0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d

`tokenSymbol`

​string

Example:BTCB

`tokenUnitPrice`

​string

Example:67000.5

`decimal`

​string

Example:18

`isHoneyPot`

​boolean

Example:false

`taxRate`

​string

Example:0

`feeAmount`

​string | null

Fee amount deducted for this swap (smallest unit, integer string). Only populated when the request enabled the custom fee; `null` otherwise. `FROM_TOKEN` direction = `originalFromCoinAmount × feePercent/100` (HALF_UP); `TO_TOKEN` direction = `originalToCoinAmount × feePercent/100` (HALF_DOWN).

Example:15000

`feeToken`

​string | null

Contract address of the token in which the fee is denominated. `FROM_TOKEN` direction = sell-token address; `TO_TOKEN` direction = buy-token address. `null` when the custom fee is not enabled.

Example:0x55d398326f99059fF775485246999027B3197955

`actualSwapAmount`

​string | null

Actual amount participating in the DEX swap (smallest unit, integer string). `FROM_TOKEN` direction = net amount after fee deduction (`fromTokenAmount − feeAmount`); `TO_TOKEN` direction = original input amount (fee is taken from the output side). `null` when the custom fee is not enabled.

Example:985000

​object

On-chain transaction payload to sign and submit.

On-chain transaction payload to sign and submit.

`from`

​string

User wallet address (transaction sender).

Example:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

`to`

​string

DEX router contract address (the transaction's `to` field).

Example:0x1111111254EEB25477B68fb85Ed929f73A960582

`data`

​string

ABI-encoded calldata.

Example:0x12aa3caf...

`value`

​string

Native-token amount sent with the transaction (wei). "0" for ERC-20 swaps.

Example:0

`gas`

​string

Gas limit estimate.

Example:200000

`gasPrice`

​string

Gas price (wei).

Example:5000000000

`maxPriorityFeePerGas`

​string

EIP-1559 max priority fee per gas (wei).

Example:1000000000

`minReceiveAmount`

​string

Minimum buy-token amount the user accepts at the slippage limit (smallest unit, integer string).

Example:993507500000000000

`slippagePercent`

​string

Slippage value applied to this transaction (percentage string).

Example:0.5

`signatureData`

​string[]

Auxiliary signature data. When `approveTransaction=true` was passed, this contains the spender address and approve calldata.

`computeUnitPrice`

​string | null

Solana priority fee per compute unit (micro-lamports). Echoed when supplied; computed by the platform otherwise. Null on EVM chains.

Example:1000

`computeUnitLimit`

​string | null

Solana compute-unit ceiling. Echoed when supplied; not returned otherwise. Null on EVM chains.

Example:1400000

`executionMode`

​string·enum

Always `SWAP` for this endpoint — returns executable calldata / swapTransaction to sign and broadcast on-chain (no `RFQ` mode).

Enum values:

SWAP

Example:SWAP

`rfq`

​object | null

Always `null` for this endpoint (only `SWAP` mode is returned).

`timestamp`

​integer·int64

Example:1748601600000

`success`

​boolean

Example:true

* * *

## Build Solana Swap Instructions[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#build-solana-swap-instructions)

Solana-only counterpart to `/swap`. Shares the full quote → route → vendor `buildSwapTx` → priceImpact → minReceive → instruction-assembly pipeline; the only difference is the response: instead of returning a signed-and-serialized base64 transaction, this endpoint returns the **uncompiled** instruction list plus the address-lookup-table (ALT) address list, leaving v0-transaction compilation, signing, and submission to the caller.

Use this when the caller needs to:

*   prepend / append their own instructions (e.g. fee splitting, custom logging) before signing;

*   reuse the platform-curated route, slippage, PS-variant rewriting, ALT injection, ComputeBudget overwrite, and ATA batching while still controlling the final wire format.

Only supports `binanceChainId=CT_501` (Solana). Other chains return `CHAIN_NOT_SUPPORTED` (40411). Parameters mirror the Solana subset of `/swap` (no EVM-only `approveTransaction` / `approveAmount` / `gasLimit`). Supports the custom-fee (Add Fee / referral fee) parameters (`feePercent` + `fromTokenReferrerWalletAddress` / `toTokenReferrerWalletAddress`), with the same semantics as `/swap` — the fee instructions are injected into the returned uncompiled instruction list.

GET
/api/v1/dex/aggregator/swap-instruction

https://web3.binance.com/build

### Build Solana Swap Instructions ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#build-solana-swap-instructions/authorization)

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64-encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example:5000

`X-OC-NONCE`

​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example:unique-nonce-string

### Build Solana Swap Instructions › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#build-solana-swap-instructions/query-parameters)

`binanceChainId`

​string·enum·required

Chain identifier. Only `CT_501` (Solana) is accepted; other values return `CHAIN_NOT_SUPPORTED` (40411).

Enum values:

CT_501

Example:CT_501

`amount`

​string·required

Sell-token amount in the token's smallest unit (positive integer string, no decimals).

Example:12000000

`fromTokenAddress`

​string·required

Sell-token mint address (Solana Base58, case-sensitive).

Example:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

`toTokenAddress`

​string·required

Buy-token mint address (Solana Base58, case-sensitive).

Example:So11111111111111111111111111111111111111112

`slippagePercent`

​string·required

Maximum slippage as a percentage. Solana range 0 to less than 100. "0.5" means 0.5%.

Example:0.5

`userWalletAddress`

​string·required

User wallet address (Solana Base58); becomes the v0 transaction's `feePayer`.

Example:J5CBzXpcYn6WR2JBah8zU4Yxct985CAFGwXRcFaX2pbS

`quoteId`

​string·required

quoteId returned from `/quote` for the route to execute. TTL ~30s; expired entries return `QUOTE_EXPIRED` (40401).

Example:a1b2c3d4e5f64a8b9c0d1e2f3a4b5c6d

`priceImpactProtectionPercent`

​string

Maximum allowed price impact percentage (0–100). Defaults to 90; set to 100 to disable.

Example:90

`autoSlippage`

​string·enum

When "true", slippage is auto-derived from market data and overrides `slippagePercent`. Defaults to false.

Enum values:

true

false

Example:false

`maxAutoSlippagePercent`

​string

Cap on auto-derived slippage (only applies when `autoSlippage=true`).

Example:3

`computeUnitLimit`

​string

Maximum compute units the transaction may consume (analogous to EVM gasLimit). Defaults to the platform value when omitted.

Example:1400000

`computeUnitPrice`

​string

Priority fee per compute unit (micro-lamports). When omitted, the platform computes a value either from the `gasLevel` tier or from chain-side defaults.

Example:1000

`gasLevel`

​string·enum

Priority-fee tier; consulted only when `computeUnitPrice` is omitted. Defaults to "average".

Enum values:

slow

average

fast

Example:average

`tips`

​string

Jito tips in SOL for MEV protection. Valid range [0.000000001, 2] (minimum 1 lamport). When specified, it is recommended to set `computeUnitPrice=0`. The platform picks one of Jito's tip accounts at random per request.

Example:0.001

`feePercent`

​string

Custom fee (referral fee / Add Fee) percentage as a decimal string. Must be paired with exactly one of `fromTokenReferrerWalletAddress` or `toTokenReferrerWalletAddress` (the two referrer addresses are mutually exclusive). Same semantics as `/swap`.

**Range (Solana):**`(0, 10]` — greater than 0, up to 10 inclusive, max 2 decimal places. `"1.5"` means 1.5%. Values exceeding 2 decimal places are rejected with `INVALID_FEE_PERCENT` (40466).

**`four.meme` tokens are not supported** — do not pass fee parameters when either side of the pair is a `four.meme` token.

Example:1.5

`fromTokenReferrerWalletAddress`

​string

Wallet address that receives the fee deducted from the sell token (`FROM_TOKEN` direction). Mutually exclusive with `toTokenReferrerWalletAddress` — providing both returns `CONFLICT_REFERRER_PARAMS` (40468). Solana requires a Base58 pubkey; an invalid format returns `INVALID_REFERRER_ADDRESS` (40467). Must be paired with `feePercent`.

Example:J5CBzXpcYn6WR2JBah8zU4Yxct985CAFGwXRcFaX2pbS

`toTokenReferrerWalletAddress`

​string

Wallet address that receives the fee deducted from the buy-token output (`TO_TOKEN` direction). Mutually exclusive with `fromTokenReferrerWalletAddress` — providing both returns `CONFLICT_REFERRER_PARAMS` (40468). Solana requires a Base58 pubkey; an invalid format returns `INVALID_REFERRER_ADDRESS` (40467). Must be paired with `feePercent`. The referrer must already be activated (funded with some SOL) or the request returns `REFERRER_NOT_ACTIVATED` (40469).

Example:J5CBzXpcYn6WR2JBah8zU4Yxct985CAFGwXRcFaX2pbS

### Build Solana Swap Instructions ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#build-solana-swap-instructions/responses)

Uncompiled Solana instruction list and ALT addresses returned successfully.

`code`

​integer·int32

Example:0

`msg`

​string

Example:success

​object

`addressLookupTableAccount`

​string[]

Address Lookup Table addresses (Base58) referenced by the transaction, including the platform-injected custom ALT. The caller must fetch each ALT account (`getAccountInfo`) and pass the parsed lookup data when compiling the v0 message.

​object[]

Ordered uncompiled instructions to assemble into the v0 transaction.

`programId`

​string

Program that owns the instruction (Base58).

Example:ComputeBudget111111111111111111111111111111

`data`

​string

Instruction data, Base64-encoded. May be an empty string for instructions without data.

Example:AgY6BAA=

​object[]

Accounts referenced by the instruction, in ABI order.

`pubkey`

​string

Account public key (Base58).

Example:J5CBzXpcYn6WR2JBah8zU4Yxct985CAFGwXRcFaX2pbS

`isSigner`

​boolean

Whether the account must sign the transaction.

Example:false

`isWritable`

​boolean

Whether the account is writable.

Example:true

​object

Routing result (same shape and semantics as `/swap`'s `routerResult`).

Routing result (same shape and semantics as `/swap`'s `routerResult`).

`binanceChainId`

​string

Chain identifier (always `CT_501`).

Example:CT_501

`vendorName`

​string

Vendor that supplied the executed quote (Solana vendors include Jupiter, LiquidMesh).

Example:Jupiter

`fromTokenAmount`

​string

Sell-token amount (smallest unit, integer string).

Example:12000000

`toTokenAmount`

​string

Estimated buy-token amount (smallest unit, integer string).

Example:607402

`tradeFee`

​string | null

Estimated network fee in USD.

Example:0.12

`estimateGasFee`

​string | null

Estimated compute units for the transaction (echoes `computeUnitLimit`).

Example:1400000

`router`

​string

Routing path description, mints joined with "--".

Example:So11...112--EPjF...DT1v

`priceImpactPercent`

​string

Price impact percentage.

Example:-0.01

​object[]

Routing path segments (same shape as `/quote`'s `dexRouterList`).

​object

`dexName`

​string

Example:Raydium

`percent`

​string

Example:100

​object

`tokenContractAddress`

​string

Example:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

`tokenSymbol`

​string

Example:USDC

`fromTokenIndex`

​string

Example:0

​object

`tokenContractAddress`

​string

Example:So11111111111111111111111111111111111111112

`tokenSymbol`

​string

Example:WSOL

`toTokenIndex`

​string

Example:1

​object

Sell-token metadata.

Sell-token metadata.

`tokenContractAddress`

​string

Example:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

`tokenSymbol`

​string

Example:USDC

`decimal`

​string

Example:6

​object

Buy-token metadata.

Buy-token metadata.

`tokenContractAddress`

​string

Example:So11111111111111111111111111111111111111112

`tokenSymbol`

​string

Example:WSOL

`decimal`

​string

Example:9

`feeAmount`

​string | null

Fee amount deducted for this swap (smallest unit, integer string). Only populated when the request enabled the custom fee; `null` otherwise. `FROM_TOKEN` direction = `originalFromCoinAmount × feePercent/100` (HALF_UP); `TO_TOKEN` direction = `originalToCoinAmount × feePercent/100` (HALF_DOWN).

Example:15000

`feeToken`

​string | null

Contract address of the token in which the fee is denominated. `FROM_TOKEN` direction = sell-token address; `TO_TOKEN` direction = buy-token address. `null` when the custom fee is not enabled.

Example:So11111111111111111111111111111111111111112

`actualSwapAmount`

​string | null

Actual amount participating in the DEX swap (smallest unit, integer string). `FROM_TOKEN` direction = net amount after fee deduction (`fromTokenAmount − feeAmount`); `TO_TOKEN` direction = original input amount (fee is taken from the output side). `null` when the custom fee is not enabled.

Example:985000

​object

Transaction summary (no `data` field — replaced by `instructionLists`). Contains the fields the caller needs to display or audit before signing.

Transaction summary (no `data` field — replaced by `instructionLists`). Contains the fields the caller needs to display or audit before signing.

`from`

​string

User wallet address (transaction sender / fee payer).

Example:J5CBzXpcYn6WR2JBah8zU4Yxct985CAFGwXRcFaX2pbS

`to`

​string

Platform Router program address (the swap target program).

Example:proVF4pMXVaYqmy4NjniPh4pqKNfMmsihgd4wdkCX3u

`minReceiveAmount`

​string

Minimum buy-token amount the user accepts at the slippage limit (smallest unit, integer string).

Example:604365

`slippagePercent`

​string

Slippage value applied to this transaction (percentage string).

Example:0.5

`timestamp`

​integer·int64

Example:1748601600000

`success`

​boolean

Example:true

* * *

## Get Transaction Status[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-transaction-status)

Look up the on-chain status of a DEX swap by `binanceChainId` + `txHash`. Response semantics:

*   Transaction not found: `data` is `null` (not HTTP 404).

*   Transaction failed: `status=failed` with `errorMsg`; aggregator business fields (`txType`, `dexRouter`, `fromTokenDetails`, `toTokenDetails`) are `null`.

*   Transaction succeeded: `status=success` with full token details when an aggregator event is present.

GET
/api/v1/dex/aggregator/history

https://web3.binance.com/build

### Get Transaction Status ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-transaction-status/authorization)

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64-encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example:5000

`X-OC-NONCE`

​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example:unique-nonce-string

### Get Transaction Status › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-transaction-status/query-parameters)

`binanceChainId`

​string·required

Unique chain identifier (e.g. "56"=BSC, "1"=Ethereum, "CT_501"=Solana).

Example:56

`txHash`

​string·required

On-chain transaction hash.

Example:0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890

### Get Transaction Status ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-transaction-status/responses)

Transaction details. `data` is null when no record is found.

`code`

​integer·int32

Example:0

`msg`

​string

Example:success

`data`

​object | null

Transaction details. Null when the transaction is not found in any source table.

`timestamp`

​integer·int64

Example:1748601600000

`success`

​boolean

Example:true

* * *

## Submit RFQ Order[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#submit-rfq-order)

Submit a signed RFQ order to the backend for on-chain settlement via the corresponding vendor relayer. Only used when `executionMode=RFQ` (equity / RWA tokens such as Ondo and BStock).

**Flow**: `GET /quote` → pick an RFQ route → `GET /swap` → sign `rfq.typedDataToSign` with EIP-712 (`eth_signTypedData_v4`) → call this endpoint → poll `GET /order/{orderId}` until `FILLED` or `FAILED`.

**Idempotency**: Submitting with the same `requestId` within 30 minutes returns the original result without re-calling the vendor. Use a new UUID for each distinct order; reuse the same UUID when retrying.

POST
/api/v1/dex/aggregator/order/submit

https://web3.binance.com/build

### Submit RFQ Order ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#submit-rfq-order/authorization)

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64-encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example:5000

`X-OC-NONCE`

​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example:unique-nonce-string

### Submit RFQ Order ›Request Body[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#submit-rfq-order/request-body)

`requestId`

​string·required

Idempotency key (UUID v4). Within 30 minutes, re-submitting with the same `requestId` returns the original result without re-calling the vendor. Generate a new UUID for each new order; reuse the same UUID when retrying the same attempt.

Example:550e8400-e29b-41d4-a716-446655440000

`userSignature`

​string·required

EIP-712 signature of `rfq.typedDataToSign` from the `/swap` response. Must be a hex string with `0x` prefix (132 chars = `0x` + 65 bytes). The signing wallet must match `userWalletAddress` used in `/quote`. The backend automatically corrects Ethereum `v` values `00`/`01` to `1b`/`1c`.

Example:0x1234abcd...5678ef

`vendor`

​string·enum·required

RFQ vendor name — must match `rfq.vendor` from the `/swap` response. The backend validates this against `quoteId` to prevent misrouted submissions.

Enum values:

InchFusion

CowSwap

PcsXRfq

Example:PcsXRfq

`quoteId`

​string·required

`rfq.orderId` from the `/swap` response. The backend uses this to look up the vendor and chain context required to forward the signed order.

Example:a1b2c3d4e5f64a8b9c0d1e2f3a4b5c6d

`signingScheme`

​string

Signing scheme from `rfq.signingScheme` in the `/swap` response. Optional — when omitted the backend infers the default per vendor.

Example:EIP712

### Submit RFQ Order ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#submit-rfq-order/responses)

RFQ order submitted successfully.

`code`

​integer·int32

Example:0

`msg`

​string

Example:success

​object

Submitted order details.

Submitted order details.

`orderId`

​string

Platform-generated order ID. Use this to poll `GET /order/{orderId}` for the final settlement status.

Example:oc-o-abc123def456

`status`

​string

Initial order status after submission. Typical value: `PENDING_VENDOR` (forwarded to vendor, awaiting settlement).

Example:PENDING_VENDOR

`createdAt`

​integer·int64

Order creation timestamp (Unix epoch milliseconds).

Example:1748601600000

`timestamp`

​integer·int64

Example:1748601600000

`success`

​boolean

Example:true

* * *

## Get RFQ Order Status[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-rfq-order-status)

Query the settlement status of an RFQ order by its platform `orderId` (returned by `POST /order/submit`). Poll this endpoint until `status` reaches a terminal state: `FILLED` (settled on-chain) or `FAILED` (settlement failed).

GET
/api/v1/dex/aggregator/order/{orderId}

https://web3.binance.com/build

### Get RFQ Order Status ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-rfq-order-status/authorization)

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

### Get RFQ Order Status › Path Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-rfq-order-status/path-parameters)

`orderId`

​string·required

Platform order ID returned by `POST /order/submit`.

Example:oc-o-abc123def456

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64-encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example:5000

`X-OC-NONCE`

​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example:unique-nonce-string

### Get RFQ Order Status ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/trading-api#get-rfq-order-status/responses)

Order status returned successfully.

`code`

​integer·int32

Example:0

`msg`

​string

Example:success

​object

Order status details.

Order status details.

`orderId`

​string

Platform order ID.

Example:oc-o-abc123def456

`status`

​string

Current order status.

*   **Terminal**: `FILLED` (settled on-chain), `FAILED` (settlement failed), `EXPIRED` (vendor could not settle before the order deadline), `CANCELLED` (cancelled by the user or vendor).

*   **Intermediate**: `PENDING_VENDOR` (forwarded to vendor, awaiting settlement), `PENDING_ONCHAIN` (vendor has broadcast the on-chain transaction, awaiting block confirmation).

Example:FILLED

`txHash`

​string | null

On-chain transaction hash. Present only when `status=FILLED`.

Example:0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890

`fromAmount`

​string | null

Actual sell-token amount settled (smallest unit, integer string). Present when filled.

Example:1000000

`toAmount`

​string | null

Actual buy-token amount received (smallest unit, integer string). Present when filled.

Example:998500000000000000

`filledAt`

​integer | null·int64

Settlement timestamp (Unix epoch milliseconds). Present when filled.

Example:1748601700000

`createdAt`

​integer·int64

Order creation timestamp (Unix epoch milliseconds).

Example:1748601600000

`timestamp`

​integer·int64

Example:1748601600000

`success`

​boolean

Example:true

* * *
