Title: RWA Data - Binance Web3 API

URL Source: https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data

Published Time: Thu, 01 Oct 2026 09:02:41 GMT

Markdown Content:
## Get RWA Token Issuance Platforms[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-token-issuance-platforms)

Return the list of supported RWA token issuance platforms and their basic info.

GET
/api/v1/dex/market/rwa/platforms

https://web3.binance.com/build

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with millisecond precision, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64 encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds. Default 5000, max 60000.

Example:5000

`X-OC-NONCE`

​string

Unique request identifier to prevent replay attacks. Falls back to X-OC-SIGN when omitted.

Example:unique-nonce-string

### Get RWA Token Issuance Platforms › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-token-issuance-platforms/query-parameters)

`platformId`

​string·enum

Platform identifier (ondo=Ondo Finance, bstock=bStocks). Optional. If not specified, returns all platforms; when specified, returns only that platform.

Enum values:

ondo

bstock

Example:ondo

### Get RWA Token Issuance Platforms ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-token-issuance-platforms/responses)

RWA token issuance platform list returned successfully.

`code`

​integer·int32

Business status code. 0 indicates success.

Example:0

`msg`

​string

Status message.

Example:success

​object[]

List of RWA token issuance platforms.

`platformId`

​string

Unique platform identifier. Examples: ondo=Ondo Finance, bstock=bStocks.

Example:ondo

`tickerCount`

​integer·int32

Number of underlying assets corresponding to the RWA tokens.

Example:264

​object[]

RWA token distribution across chains.

`binanceChainId`

​string

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana).

Example:56

`tokenCount`

​integer·int32

Number of RWA tokens on this chain (the same underlying asset deployed on different chains is counted separately).

Example:264

`website`

​string | null

Platform official website. Null when unavailable.

Example:https://ondo.finance

`logoUrl`

​string | null

Platform logo URL. Null when unavailable.

Example:https://static.onchainos.com/images/protocols/ondo.png

`timestamp`

​integer·int64

Server response time, Unix millisecond timestamp.

Example:1748601600000

`success`

​boolean

Whether the request was successful.

Example:true

* * *

## Get RWA Token Price[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-token-price)

Batch query RWA token prices, including on-chain price and underlying reference price.

GET
/api/v1/dex/market/rwa/price

https://web3.binance.com/build

### Get RWA Token Price ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-token-price/authorization)

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with millisecond precision, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64 encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds. Default 5000, max 60000.

Example:5000

`X-OC-NONCE`

​string

Unique request identifier to prevent replay attacks. Falls back to X-OC-SIGN when omitted.

Example:unique-nonce-string

### Get RWA Token Price › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-token-price/query-parameters)

`binanceChainId`

​string·required

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana).

Example:56

`tokenContractAddresses`

​string·required

Comma-separated token contract addresses. Maximum 100 per request.

Example:0x8755c5c39b1aa9053a83ac731242a2cf4d04b0fe

### Get RWA Token Price ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-token-price/responses)

Quote data returned successfully.

`code`

​integer·int32

Business status code. 0 indicates success.

Example:0

`msg`

​string

Status message.

Example:success

​object[]

List of token price data.

`binanceChainId`

​string

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana).

Example:56

`tokenContractAddress`

​string

Token contract address.

Example:0x8755c5c39b1aa9053a83ac731242a2cf4d04b0fe

`platformId`

​string

Unique platform identifier.

Example:ondo

`tokenPrice`

​string

On-chain token price (USD).

Example:61.746364

`referencePrice`

​string

Underlying reference price (USD). A per-share converted price derived from the on-chain token price, not an official quote from the traditional stock market.

Example:61.746364

`tokenPriceUpdatedAt`

​integer·int64

Token price last updated time, Unix millisecond timestamp.

Example:1748000000000

`timestamp`

​integer·int64

Server response time, Unix millisecond timestamp.

Example:1748601600000

`success`

​boolean

Whether the request was successful.

Example:true

* * *

## Search RWA Token[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#search-rwa-token)

Search RWA tokens by keyword or contract address.

GET
/api/v1/dex/market/rwa/search

https://web3.binance.com/build

### Search RWA Token ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#search-rwa-token/authorization)

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with millisecond precision, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64 encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds. Default 5000, max 60000.

Example:5000

`X-OC-NONCE`

​string

Unique request identifier to prevent replay attacks. Falls back to X-OC-SIGN when omitted.

Example:unique-nonce-string

### Search RWA Token › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#search-rwa-token/query-parameters)

`keyword`

​string·required

Search keyword (ticker, company name, or contract address). Case-insensitive.

Example:NVDA

`platformId`

​string·enum

Platform filter (ondo=Ondo Finance, bstock=bStocks). Optional. If not specified, returns results from all platforms.

Enum values:

ondo

bstock

Example:ondo

### Search RWA Token ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#search-rwa-token/responses)

Ticker lookup results returned successfully.

`code`

​integer·int32

Business status code. 0 indicates success.

Example:0

`msg`

​string

Status message.

Example:success

​object[]

List of matched tickers and their tokenized assets.

`ticker`

​string

Matched stock ticker symbol.

Example:NVDA

`companyName`

​string

Company English name.

Example:NVIDIA Corporation

​object[]

Tokenized assets for this ticker across platforms and chains.

`platformId`

​string

Unique platform identifier.

Example:ondo

`binanceChainId`

​string

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana).

Example:56

`tokenContractAddress`

​string

Token contract address.

Example:0xa9ee28c80f960b889dfbd1902055218cba016f75

`tokenSymbol`

​string

Token symbol.

Example:NVDAon

`assetType`

​integer·enum·int32

Asset type. 1=Stock, 2=Pre-IPO, 3=ETF.

Enum values:

1

2

3

Example:1

`timestamp`

​integer·int64

Server response time, Unix millisecond timestamp.

Example:1748601600000

`success`

​boolean

Whether the request was successful.

Example:true

* * *

## Get RWA Underlying Info[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-underlying-info)

Get the underlying company information for an RWA token.

GET
/api/v1/dex/market/rwa/underlying-profile

https://web3.binance.com/build

### Get RWA Underlying Info ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-underlying-info/authorization)

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with millisecond precision, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64 encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds. Default 5000, max 60000.

Example:5000

`X-OC-NONCE`

​string

Unique request identifier to prevent replay attacks. Falls back to X-OC-SIGN when omitted.

Example:unique-nonce-string

### Get RWA Underlying Info › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-underlying-info/query-parameters)

`binanceChainId`

​string·required

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana).

Example:56

`tokenContractAddress`

​string·required

Token contract address.

Example:0x8755c5c39b1aa9053a83ac731242a2cf4d04b0fe

### Get RWA Underlying Info ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-underlying-info/responses)

Token detail returned successfully.

`code`

​integer·int32

Business status code. 0 indicates success.

Example:0

`msg`

​string

Status message.

Example:success

​object

Underlying company information and protections.

Underlying company information and protections.

`binanceChainId`

​string

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana).

Example:56

`tokenContractAddress`

​string

Token contract address.

Example:0x8755c5c39b1aa9053a83ac731242a2cf4d04b0fe

`platformId`

​string

Unique platform identifier.

Example:ondo

`underlyingTicker`

​string

Underlying asset ticker symbol.

Example:SEDG

`underlyingFullName`

​string

Underlying asset full name.

Example:SolarEdge Technologies, Inc.

`assetType`

​integer·enum·int32

Asset type. 1=Stock, 2=Pre-IPO, 3=ETF.

Enum values:

1

2

3

Example:1

​object

Investor protection mechanisms, keyed by mechanism type. Each entry includes whether it is supported and a related proof/report link. Known keys: dailyAttestationReport, monthlyAttestationReport, collateralReport. New keys may be added per platform.

Investor protection mechanisms, keyed by mechanism type. Each entry includes whether it is supported and a related proof/report link. Known keys: dailyAttestationReport, monthlyAttestationReport, collateralReport. New keys may be added per platform.

`supported`

​boolean

Whether this protection is supported.

`url`

​string | null

URL to related report or proof.

`companyInfo`

​object | null

Underlying company information; for ETF type, returns fund company info (e.g. Invesco, iShares).

`timestamp`

​integer·int64

Server response time, Unix millisecond timestamp.

Example:1748601600000

`success`

​boolean

Whether the request was successful.

Example:true

* * *

## Get RWA Token List[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-token-list)

Get the list of RWA tokens with underlying asset info. Supports filtering by platform and sector tab.

GET
/api/v1/dex/market/rwa/tokens

https://web3.binance.com/build

### Get RWA Token List ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-token-list/authorization)

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with millisecond precision, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64 encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds. Default 5000, max 60000.

Example:5000

`X-OC-NONCE`

​string

Unique request identifier to prevent replay attacks. Falls back to X-OC-SIGN when omitted.

Example:unique-nonce-string

### Get RWA Token List › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-token-list/query-parameters)

`binanceChainId`

​string

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana). Optional. If not specified, returns data from all chains.

Example:56

`platformId`

​string·enum

Platform filter (ondo=Ondo Finance, bstock=bStocks). Optional. If not specified, returns all platforms.

Enum values:

ondo

bstock

Example:ondo

`tabId`

​integer·int32

Sector tab filter. Optional. If not specified, returns all sectors. Enum: 1=Serenity Call, 2=SpaceX (SpaceX-related and commercial spaceflight concept stocks), 3=Upcoming Earnings, 4=AI Chips, 5=Storage, 6=Energy, 7=Precious Metals, 8=China ADR (Chinese companies listed in the US), 9=Magnificent 7 (the seven largest US tech giants: Apple, Microsoft, Alphabet, Amazon, Nvidia, Meta, Tesla), 10=Crypto, 11=ETF, 12=Tech Leaders, 13=Buffett Portfolio.

Example:9

### Get RWA Token List ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-token-list/responses)

RWA token list returned successfully.

`code`

​integer·int32

Business status code. 0 indicates success.

Example:0

`msg`

​string

Status message.

Example:success

​object[]

List of RWA tokenized assets.

`binanceChainId`

​string

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana).

Example:56

`tokenContractAddress`

​string

Token contract address.

Example:0x8755c5c39b1aa9053a83ac731242a2cf4d04b0fe

`platformId`

​string

Unique platform identifier.

Example:ondo

`assetType`

​integer·enum·int32

Asset type. 1=Stock, 2=Pre-IPO, 3=ETF.

Enum values:

1

2

3

Example:1

`tokenName`

​string

Token full name.

Example:SolarEdge Technologies (Ondo Tokenized)

`tokenSymbol`

​string

Token symbol.

Example:SEDGon

`tokenLogoUrl`

​string

Token logo URL.

Example:https://static.onchainos.com/images/web3-data/public/token/logos/7ac70d12b753405fb9ec408f1d1ab81e.png

`decimals`

​string

Token decimals.

Example:18

`underlyingTicker`

​string

Underlying asset ticker symbol.

Example:SEDG

`underlyingName`

​string

Underlying company English name.

Example:NVIDIA Corporation

`underlyingNameZh`

​string | null

Underlying company Chinese name. Falls back to English if unavailable.

Example:英伟达

​object

Market status information.

Market status information.

`openState`

​boolean

Whether the underlying market is currently tradable.

Example:false

`marketStatus`

​string·enum

Current market status: premarket, regular (normal hours), postmarket, overnight, closed, or pause (trading halt/circuit breaker).

Enum values:

premarket

regular

postmarket

overnight

closed

pause

Example:closed

`reasonCode`

​string | null·enum

Reason code when the market is not tradable (returned when openState=false). Market-level: MARKET_CLOSED (closed), MARKET_PAUSED (whole market paused), MARKET_MAINTENANCE (system maintenance). Asset-level: ASSET_PAUSED (single asset paused, incl. corporate actions — see reasonMsg), ASSET_LIMITED (single asset restricted but not paused, e.g. earnings window). Others: TRADING (normal), UNSUPPORTED (not supported).

Enum values:

TRADING

MARKET_CLOSED

MARKET_PAUSED

MARKET_MAINTENANCE

ASSET_PAUSED

ASSET_LIMITED

UNSUPPORTED

Example:MARKET_CLOSED

`reasonMsg`

​string | null

Human-readable reason when the market is not tradable. Common case e.g. "Weekend or Holiday". For ASSET_PAUSED (corporate actions): cash_dividend, stock_dividend, stock_split, merger, acquisition, spinoff, maintenance, corporate action. For ASSET_LIMITED: earnings.

Example:Weekend or Holiday

`nextOpenTime`

​integer | null·int64

Expected next market open time, Unix millisecond timestamp.

Example:1779111060000

`nextCloseTime`

​integer | null·int64

Expected next market close time, Unix millisecond timestamp.

Example:null

`tokenPrice`

​string

On-chain token price (USD).

Example:61.746364

`referencePrice`

​string

Underlying reference price (USD). A per-share converted price derived from the on-chain token price, not an official quote from the traditional stock market.

Example:61.746364

`volume24H`

​string

24-hour trading volume (USD).

Example:894138582.57

`marketCap`

​string

Market capitalization (USD).

Example:3055506468

`peRatioTTM`

​string | null

Price-to-Earnings ratio (TTM). Null when unavailable.

Example:null

`timestamp`

​integer·int64

Server response time, Unix millisecond timestamp.

Example:1748601600000

`success`

​boolean

Whether the request was successful.

Example:true

* * *

## Get RWA Underlying Market Data[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-underlying-market-data)

Get market data for the underlying asset of an RWA token.

GET
/api/v1/dex/market/rwa/underlying-market

https://web3.binance.com/build

### Get RWA Underlying Market Data ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-underlying-market-data/authorization)

This is a signed endpoint and a **signature** must be included in the request headers.

Learn more about how to generate a valid **signature** in the [Authentication](https://web3.binance.com/en/dev-docs/authentication).

`X-OC-APIKEY`

​string·required

API Key issued by Binance Web3 API for authentication.

Example:your-api-key-here

`X-OC-TIMESTAMP`

​string·required

Current UTC time in ISO 8601 format with millisecond precision, e.g. 2026-05-11T10:08:57.715Z.

Example:2026-05-11T10:08:57.715Z

`X-OC-SIGN`

​string·required

Request signature (Base64 encoded).

Example:Base64EncodedSignature==

`X-OC-RECV-WINDOW`

​integer·int64

Allowed time deviation in milliseconds. Default 5000, max 60000.

Example:5000

`X-OC-NONCE`

​string

Unique request identifier to prevent replay attacks. Falls back to X-OC-SIGN when omitted.

Example:unique-nonce-string

### Get RWA Underlying Market Data › Query Parameters[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-underlying-market-data/query-parameters)

`binanceChainId`

​string·required

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana).

Example:56

`tokenContractAddress`

​string·required

Token contract address.

Example:0x8755c5c39b1aa9053a83ac731242a2cf4d04b0fe

### Get RWA Underlying Market Data ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data#get-rwa-underlying-market-data/responses)

Underlying market data returned successfully.

`code`

​integer·int32

Business status code. 0 indicates success.

Example:0

`msg`

​string

Status message.

Example:success

​object

Underlying market data for the RWA token.

Underlying market data for the RWA token.

`binanceChainId`

​string

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana).

Example:56

`tokenContractAddress`

​string

Token contract address.

Example:0x8755c5c39b1aa9053a83ac731242a2cf4d04b0fe

`platformId`

​string

Unique platform identifier.

Example:ondo

`assetType`

​integer·enum·int32

Asset type. 1=Stock, 2=Pre-IPO, 3=ETF.

Enum values:

1

2

3

Example:1

​object

Market status information.

Market status information.

`openState`

​boolean

Whether the underlying market is currently tradable.

Example:true

`marketStatus`

​string·enum

Current market status: premarket, regular (normal hours), postmarket, overnight, closed, or pause (trading halt/circuit breaker).

Enum values:

premarket

regular

postmarket

overnight

closed

pause

Example:regular

`reasonCode`

​string | null·enum

Reason code when the market is not tradable (returned when openState=false). Market-level: MARKET_CLOSED (closed), MARKET_PAUSED (whole market paused), MARKET_MAINTENANCE (system maintenance). Asset-level: ASSET_PAUSED (single asset paused, incl. corporate actions — see reasonMsg), ASSET_LIMITED (single asset restricted but not paused, e.g. earnings window). Others: TRADING (normal), UNSUPPORTED (not supported).

Enum values:

TRADING

MARKET_CLOSED

MARKET_PAUSED

MARKET_MAINTENANCE

ASSET_PAUSED

ASSET_LIMITED

UNSUPPORTED

Example:null

`reasonMsg`

​string | null

Human-readable reason when the market is not tradable. Common case e.g. "Weekend or Holiday". For ASSET_PAUSED (corporate actions): cash_dividend, stock_dividend, stock_split, merger, acquisition, spinoff, maintenance, corporate action. For ASSET_LIMITED: earnings.

Example:null

`nextOpenTime`

​integer | null·int64

Expected next market open time, Unix millisecond timestamp.

Example:null

`nextCloseTime`

​integer | null·int64

Expected next market close time, Unix millisecond timestamp.

Example:1779134340000

​object

Underlying asset market data. Fields vary by asset type.

Underlying asset market data. Fields vary by asset type.

`referencePrice`

​string

Underlying reference price (USD). A per-share converted price derived from the on-chain token price, not an official quote from the traditional stock market.

Example:61.746364

`high52W`

​string

52-week high price. Applicable to Stock and ETF only.

Example:63.53

`low52W`

​string

52-week low price. Applicable to Stock and ETF only.

Example:13.73

`avgDailyVolume1Y`

​string

1-year average daily volume. Applicable to Stock and ETF only.

Example:4243226

`marketCap`

​string

Market capitalization (USD) for Stock/ETF, or implied total valuation for Pre-IPO.

Example:3055506468

`turnoverRate`

​string

Turnover rate. "23.81" means 23.81%. Applicable to Stock and ETF only.

Example:23.81

`amplitude`

​string | null

Price amplitude (intraday). "3.05" means 3.05%, i.e. (intraday high − low) / previous close. Applicable to Stock and ETF only.

Example:3.05

`peRatioTTM`

​string | null

Price-to-Earnings ratio (TTM = Trailing Twelve Months, based on earnings of the most recent 12 months). Applicable to Stock only.

Example:28.5

`pbRatio`

​string | null

Price-to-Book ratio. Applicable to Stock only.

Example:7.15

`dividendYield`

​string | null

Dividend yield. "0.85" means 0.85%. Applicable to Stock and ETF only.

Example:0.85

`latestDividend`

​string | null

Latest dividend amount (USD). Applicable to Stock and ETF only.

Example:0.25

`timestamp`

​integer·int64

Server response time, Unix millisecond timestamp.

Example:1748601600000

`success`

​boolean

Whether the request was successful.

Example:true

* * *
