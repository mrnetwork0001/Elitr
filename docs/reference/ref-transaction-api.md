Title: Transaction API - Binance Web3 API

URL Source: https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api

Published Time: Thu, 01 Oct 2026 09:02:41 GMT

Markdown Content:
## Get Transaction Supported Chains[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-transaction-supported-chains)

Return the blockchain networks supported by the Transaction service for gas estimation, simulation, and broadcasting. The list is dynamically configured server-side and may change over time.

GET
/api/v1/dex/pre-transaction/supported/chain

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

### Get Transaction Supported Chains ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-transaction-supported-chains/responses)

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

Unique chain identifier (follows EIP-155 chainId for EVM chains; e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana, "CT_195"=Tron).

Example:1

`name`

​string

Full chain name.

Example:Ethereum

`shortName`

​string

Short chain name / ticker.

Example:ETH

`logoUrl`

​string

Chain logo image URL.

Example:https://onchainos.bnbstatic.com/image/admin_mgs_image_upload/20250228/b549e557-76ca-4873-88ef-3a107cf2c9fe.png

`timestamp`

​integer·int64

Server response timestamp in milliseconds.

Example:1748601600000

`success`

​boolean

Convenience flag derived from `code == 0`.

Example:true

* * *

## Get Gas Price[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-gas-price)

Query the current network gas price for the specified chain. The response shape varies by chain family:

*   EVM chains return both `evmLegacyGasPrice` (legacy gasPrice) and `eip1559GasPrice` (baseFee + priority/max fees) when EIP-1559 is supported.
*   Solana returns `solanaGasPrice` (compute-unit prices and Jito tips). - Tron ("CT_195") returns an empty `data` object because Tron has no on-chain gas-price concept; use the gas-limit endpoint instead.

Fields not applicable to the chain family are returned as `null`.

GET
/api/v1/dex/pre-transaction/gas-price

https://web3.binance.com/build

### Get Gas Price ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-gas-price/authorization)

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

### Get Gas Price › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-gas-price/query-parameters)

`binanceChainId`

​string·required

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana, "CT_195"=Tron).

Example:1

### Get Gas Price ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-gas-price/responses)

Current gas price for the specified chain.

`code`

​integer·int32

Business status code. 0 indicates success.

Example:0

`msg`

​string

Example:success

​object

Gas price details. Populated fields depend on chain family.

Gas price details. Populated fields depend on chain family.

`evmLegacyGasPrice`

​object | null

Legacy EVM gas price tiers (wei, integer string). Null on non-EVM chains.

`eip1559GasPrice`

​object | null

EIP-1559 fee structure (wei, integer strings). Null on chains that don't support EIP-1559 or non-EVM chains.

`solanaGasPrice`

​object | null

Solana compute-unit prices and Jito tips. Null on non-Solana chains.

`timestamp`

​integer·int64

Example:1748601600000

`success`

​boolean

Example:true

* * *

## Get Latest Block Height[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-latest-block-height)

Return the latest block height that the Binance Web3 node has synced to for the specified chain. Callers can use this to monitor node sync progress for risk control and detect when the node lags behind the canonical chain head.

GET
/api/v1/dex/pre-transaction/block-height

https://web3.binance.com/build

### Get Latest Block Height ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-latest-block-height/authorization)

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

### Get Latest Block Height › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-latest-block-height/query-parameters)

`binanceChainId`

​string·required

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana, "CT_195"=Tron).

Example:1

### Get Latest Block Height ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-latest-block-height/responses)

Latest block height for the specified chain.

`code`

​integer·int32

Business status code. 0 indicates success; any non-zero value indicates a business error.

Example:0

`msg`

​string

Status description message.

Example:success

​object

Latest block height info.

Latest block height info.

`binanceChainId`

​string

The chain identifier echoed back from the request.

Example:1

`blockHeight`

​integer·int64

Latest block height (slot for Solana) tracked by the Binance Web3 node. Represented as a 64-bit integer.

Example:21000000

`timestamp`

​integer·int64

Server response timestamp in milliseconds.

Example:1748601600000

`success`

​boolean

Convenience flag derived from `code == 0`.

Example:true

* * *

## Get Gas Limit[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-gas-limit)

Estimate the gas limit (or compute-unit ceiling on Solana) for an unsigned transaction. Provide either `evmTx` for EVM chains, `solTx` for Solana, or `tronTx` for Tron ("CT_195"), matching the value of `binanceChainId`. On Tron the response carries energy/bandwidth fields instead of a single gas limit; `gasLimit` is the fee limit (in sun) and the energy/bandwidth fields describe resource consumption and pricing.

POST
/api/v1/dex/pre-transaction/gas-limit

https://web3.binance.com/build

### Get Gas Limit ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-gas-limit/authorization)

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

### Get Gas Limit ›Request Body[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-gas-limit/request-body)

`binanceChainId`

​string·required

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana, "CT_195"=Tron). Provide `evmTx` for EVM chains, `solTx` for Solana, or `tronTx` for Tron — exactly one must be present. Note: `evmTx`, `solTx`, and `tronTx` are marked required in this schema for rendering purposes only; in practice supply exactly one matching `binanceChainId`.

Example:1

​object·required

EVM transaction payload. Required when `binanceChainId` belongs to an EVM chain.

Example:{"from":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","to":"0xdAC17F958D2ee523a2206206994597C13D831ec7","value":"0","data":"0xa9059cbb000000000000000000000000d8dA6BF26964aF9D7eEd9e03E53415D37aA960450000000000000000000000000000000000000000000000000000000000f4240"}

EVM transaction payload. Required when `binanceChainId` belongs to an EVM chain.

`from`

​string·required

Sender address.

Example:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

`to`

​string·required

Destination address (contract or EOA).

Example:0xdAC17F958D2ee523a2206206994597C13D831ec7

`value`

​string·required

Native token amount in wei (integer string). Use "0" for ERC-20 transfers.

Example:0

`data`

​string·required

ABI-encoded calldata (hex). Optional when no contract call is involved.

Example:0xa9059cbb000000000000000000000000d8dA6BF26964aF9D7eEd9e03E53415D37aA960450000000000000000000000000000000000000000000000000000000000f4240

​object·required

Solana transaction payload. Required when `binanceChainId=CT_501`.

Example:{"base64Tx":"AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAECAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEAAA=="}

Solana transaction payload. Required when `binanceChainId=CT_501`.

`base64Tx`

​string·required

Base64-encoded unsigned Solana transaction.

Example:AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAECAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEAAA==

​object·required

Tron transaction payload. Required when `binanceChainId=CT_195`.

Tron transaction payload. Required when `binanceChainId=CT_195`.

`from`

​string·required

Sender address (base58check).

Example:TJRabPrwbZy45sbavfcjinPJC18kjpRTv8

`txType`

​string·enum·required

Tron contract type. `TRIGGER_SMART_CONTRACT` requires `triggerSmartContractParams`; `TRANSFER_CONTRACT` requires `transferContractParams`.

Enum values:

TRIGGER_SMART_CONTRACT

TRANSFER_CONTRACT

Example:TRIGGER_SMART_CONTRACT

​object

Required when `txType=TRIGGER_SMART_CONTRACT`.

Required when `txType=TRIGGER_SMART_CONTRACT`.

`contractAddress`

​string·required

Smart-contract address (base58check).

Example:TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t

`data`

​string·required

ABI-encoded calldata (hex, no `0x` prefix).

Example:a9059cbb000000000000000000000000d8dA6BF26964aF9D7eEd9e03E53415D37aA960450000000000000000000000000000000000000000000000000000000000f4240

`callValue`

​integer·int64·required

Amount of TRX (in sun) to attach as `call_value`.

Example:0

`feeLimitSun`

​integer | null·int64

Optional max fee the caller is willing to pay (in sun). If omitted, server default applies.

Example:100000000

​object

Required when `txType=TRANSFER_CONTRACT`.

Required when `txType=TRANSFER_CONTRACT`.

`toAddress`

​string·required

Recipient address (base58check).

Example:TJRabPrwbZy45sbavfcjinPJC18kjpRTv8

`amount`

​integer·int64·min: 1·required

TRX amount in sun (1 TRX = 1_000_000 sun).

Example:1000000

### Get Gas Limit ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-gas-limit/responses)

Estimated gas limit.

`code`

​integer·int32

Example:0

`msg`

​string

Example:success

​object

Estimated gas limit. On Tron, the response additionally carries energy/bandwidth fields; non-applicable fields are returned as `null`.

Estimated gas limit. On Tron, the response additionally carries energy/bandwidth fields; non-applicable fields are returned as `null`.

`gasLimit`

​string

Estimated gas limit (EVM), compute-unit ceiling (Solana), or fee limit in sun (Tron), as an integer string.

Example:21000

`energyRequired`

​string | null

Energy consumed by the Tron transaction (integer string). Null on non-Tron chains.

Example:15000

`bandwidthRequired`

​string | null

Bandwidth consumed by the Tron transaction (integer string). Null on non-Tron chains.

Example:268

`freeEnergy`

​string | null

Free energy available to the account on Tron (integer string). Null on non-Tron chains.

Example:14145

`freeBandwidth`

​string | null

Free bandwidth available to the account on Tron (integer string). Null on non-Tron chains.

Example:600

`energyFee`

​string | null

Unit price of energy on Tron (sun per energy, integer string). Null on non-Tron chains.

Example:210

`bandwidthFee`

​string | null

Unit price of bandwidth on Tron (sun per byte, integer string). Null on non-Tron chains.

Example:1000

`timestamp`

​integer·int64

Example:1748601600000

`success`

​boolean

Example:true

* * *

## Simulate Transactions[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#simulate-transactions)

Simulate transaction execution off-chain to predict its outcome before broadcasting. The response includes the predicted execution status, balance changes per affected account/token, and ERC-20 allowance changes (EVM chains). Provide either `evmTx` (EVM chains), `solTx` (Solana), or `tronTx` (Tron "CT_195") matching `binanceChainId`. On Tron, `allowanceChanges` is returned as an empty array. Note: Metis (chainId 1088) is not supported by this endpoint.

POST
/api/v1/dex/pre-transaction/simulate

https://web3.binance.com/build

### Simulate Transactions ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#simulate-transactions/authorization)

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

### Simulate Transactions ›Request Body[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#simulate-transactions/request-body)

`binanceChainId`

​string·required

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana, "CT_195"=Tron). Provide `evmTx` for EVM chains, `solTx` for Solana, or `tronTx` for Tron — exactly one must be present. Note: `evmTx`, `solTx`, and `tronTx` are marked required in this schema for rendering purposes only; in practice supply exactly one matching `binanceChainId`.

Example:1

​object·required

EVM transaction payload. Required when `binanceChainId` belongs to an EVM chain.

Example:{"from":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","to":"0xdAC17F958D2ee523a2206206994597C13D831ec7","value":"0","data":"0xa9059cbb000000000000000000000000d8dA6BF26964aF9D7eEd9e03E53415D37aA960450000000000000000000000000000000000000000000000000000000000f4240"}

EVM transaction payload. Required when `binanceChainId` belongs to an EVM chain.

`from`

​string·required

Sender address.

Example:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

`to`

​string·required

Destination address (contract or EOA).

Example:0xdAC17F958D2ee523a2206206994597C13D831ec7

`value`

​string·required

Native token amount in wei (integer string).

Example:0

`data`

​string·required

ABI-encoded calldata (hex). Optional.

Example:0xa9059cbb...

​object·required

Solana transaction payload. Required when `binanceChainId=CT_501`.

Example:{"base64Tx":"AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAECAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEAAA=="}

Solana transaction payload. Required when `binanceChainId=CT_501`.

`base64Tx`

​string·required

Base64-encoded unsigned Solana transaction.

Example:AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAECAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEAAA==

`address`

​string

Owner / fee-payer Solana address used to attribute balance changes.

Example:9Wzo3FQbtaJWQ7AsxLNMy5rgPVVQVGcG2v8CpfrChZNd

​object·required

Tron transaction payload. Required when `binanceChainId=CT_195`.

Tron transaction payload. Required when `binanceChainId=CT_195`.

`from`

​string·required

Sender address (base58check), also used to attribute balance changes.

Example:TJRabPrwbZy45sbavfcjinPJC18kjpRTv8

`txType`

​string·enum·required

Tron contract type. `TRIGGER_SMART_CONTRACT` requires `triggerSmartContractParams`; `TRANSFER_CONTRACT` requires `transferContractParams`.

Enum values:

TRIGGER_SMART_CONTRACT

TRANSFER_CONTRACT

Example:TRIGGER_SMART_CONTRACT

​object

Required when `txType=TRIGGER_SMART_CONTRACT`.

Required when `txType=TRIGGER_SMART_CONTRACT`.

`contractAddress`

​string·required

Smart-contract address (base58check).

Example:TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t

`data`

​string·required

ABI-encoded calldata (hex, no `0x` prefix).

Example:a9059cbb000000000000000000000000d8dA6BF26964aF9D7eEd9e03E53415D37aA960450000000000000000000000000000000000000000000000000000000000f4240

`callValue`

​integer·int64·required

Amount of TRX (in sun) to attach as `call_value`.

Example:0

`feeLimitSun`

​integer | null·int64

Optional max fee the caller is willing to pay (in sun). If omitted, server default applies.

Example:100000000

​object

Required when `txType=TRANSFER_CONTRACT`.

Required when `txType=TRANSFER_CONTRACT`.

`toAddress`

​string·required

Recipient address (base58check).

Example:TJRabPrwbZy45sbavfcjinPJC18kjpRTv8

`amount`

​integer·int64·min: 1·required

TRX amount in sun (1 TRX = 1_000_000 sun).

Example:1000000

### Simulate Transactions ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#simulate-transactions/responses)

Simulation result.

`code`

​integer·int32

Example:0

`msg`

​string

Example:success

​object

`status`

​string

Predicted execution status.

Example:SUCCESS

`failReason`

​string | null

Failure reason when `status=FAILED`; otherwise null.

Example:execution reverted: ERC20InsufficientBalance

​object[]

Predicted balance changes for the simulated transaction.

`contractAddress`

​string

Token contract address. Empty / native marker for the chain's native asset.

Example:0xdAC17F958D2ee523a2206206994597C13D831ec7

`tokenType`

​string

Token standard.

Example:ERC20

`change`

​string

Signed balance delta in the smallest token unit (integer string). Negative for outflows, positive for inflows.

Example:-1000000

`owner`

​string

Address whose balance is changing.

Example:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

​object[]

Predicted ERC-20 allowance changes (EVM chains only).

`tokenAddress`

​string

ERC-20 token contract address.

Example:0xdAC17F958D2ee523a2206206994597C13D831ec7

`owner`

​string

Token owner address.

Example:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

`spender`

​string

Spender address whose allowance is changing.

Example:0x1111111254EEB25477B68fb85Ed929f73A960582

`preAmount`

​string

Allowance before the transaction (smallest unit, integer string).

Example:0

`postAmount`

​string

Allowance after the transaction (smallest unit, integer string).

Example:1000000

`timestamp`

​integer·int64

Example:1748601600000

`success`

​boolean

Example:true

* * *

## Broadcast Transactions[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#broadcast-transactions)

Broadcast a client-signed transaction to the chain via the Binance Web3 API relay. Returns the transaction hash and an internal `orderId` you can use to track on-chain status via the post-transaction service. Optional MEV protection (EVM chains only) routes the transaction through a private mempool to mitigate front-running and sandwich attacks. Tron and Solana do not support MEV protection; the flag is ignored on these chains.

POST
/api/v1/dex/pre-transaction/broadcast-transaction

https://web3.binance.com/build

### Broadcast Transactions ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#broadcast-transactions/authorization)

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

### Broadcast Transactions ›Request Body[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#broadcast-transactions/request-body)

`binanceChainId`

​string·required

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana, "CT_195"=Tron).

Example:1

`signedTransaction`

​string·required

Client-signed raw transaction. Format depends on `binanceChainId`:

*   **EVM chains**: hex-encoded RLP transaction (e.g. `0xf86c...`).
*   **Solana (`CT_501`)**: base64-encoded signed transaction.
*   **Tron (`CT_195`)**: JSON string of the signed transaction returned by a Tron signer, containing `raw_data` (with `contract[].parameter.value.owner_address`) and a `signature` array. Example: `{"raw_data":{"contract":[{"type":"TriggerSmartContract","parameter":{"value":{"owner_address":"T...","contract_address":"T...","data":"<calldata hex>","call_value":0}}}]},"signature":["..."]}`.

Note for Tron: `signedTransaction` is NOT the calldata hex passed to `simulate` / `getGasLimit` under `tronTx.triggerSmartContractParams.data`. The signer is extracted from `raw_data.contract[0].parameter.value.owner_address` and must match `address`; passing calldata hex here will be rejected with `code=40001, invalid signedTransaction: failed to parse Tron signedTransaction: syntax error`.

Example:0xf86c808504a817c80082520894d8da6bf26964af9d7eed9e03e53415d37aa96045880de0b6b3a76400008025a0...

`address`

​string·required

Sender wallet address. Used for status attribution and signature verification. On Tron and Solana the address is case-sensitive base58check.

Example:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

`enableMevProtection`

​boolean

When true, route the transaction through a private mempool for MEV protection.

Example:false

### Broadcast Transactions ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#broadcast-transactions/responses)

Transaction submitted successfully.

`code`

​integer·int32

Example:0

`msg`

​string

Example:success

​object

`orderId`

​string

Internal order identifier. Use this to query on-chain status via the post-transaction service.

Example:1812345678901234567

`txHash`

​string

On-chain transaction hash. EVM chains return a hex hash; Tron returns a base58check hash; Solana returns a base58 hash.

Example:0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890

`timestamp`

​integer·int64

Example:1748601600000

`success`

​boolean

Example:true

* * *

## Get Broadcast Orders[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-broadcast-orders)

Look up broadcast orders previously submitted via `/pre-transaction/broadcast-transaction`. Filter by `txStatus` or `orderId`, paginate with `cursor`.

GET
/api/v1/dex/post-transaction/orders

https://web3.binance.com/build

### Get Broadcast Orders ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-broadcast-orders/authorization)

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

### Get Broadcast Orders › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-broadcast-orders/query-parameters)

`address`

​string·required

Sender wallet address whose orders to list.

Example:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

`binanceChainId`

​string·required

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana).

Example:1

`txStatus`

​string

Optional filter on transaction status (server-defined string, e.g. "pending", "success", "fail").

Example:success

`orderId`

​string

Optional filter to fetch a single order by its internal order ID.

Example:1812345678901234567

`cursor`

​string

Pagination cursor returned by the previous page. Omit on the first request.

Example:eyJ0aW1lIjoxNzQ4NjAwMDAwMDAwLCJpZCI6MTIzfQ==

`limit`

​integer·int32

Page size. Defaults to 20.

Example:20

Default:20

### Get Broadcast Orders ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/transaction-api#get-broadcast-orders/responses)

Orders returned successfully.

`code`

​integer·int32

Example:0

`msg`

​string

Example:success

​object

`cursor`

​string

Cursor for the next page. Empty string when no more pages.

Example:eyJ0aW1lIjoxNzQ4NTk5MDAwMDAwLCJpZCI6Nzh9

​object[]

Order list.

`orderId`

​string

Internal order identifier.

Example:1812345678901234567

`binanceChainId`

​string

Chain identifier.

Example:1

`address`

​string

Sender wallet address.

Example:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

`txHash`

​string | null

On-chain transaction hash. Null while the order is pending.

Example:0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890

`txStatus`

​string

Transaction status (server-defined string, e.g. "pending", "success", "fail").

Example:success

`failReason`

​string | null

Failure reason. Populated when the transaction failed; null otherwise.

Example:execution reverted: insufficient liquidity

`timestamp`

​integer·int64

Example:1748601600000

`success`

​boolean

Example:true

* * *
