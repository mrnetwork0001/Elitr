Title: General Data - Binance Web3 API

URL Source: https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/general-data

Published Time: Thu, 01 Oct 2026 09:02:41 GMT

Markdown Content:
Search
Language
Documentation
API Reference
WebSocket Reference
SDKs & Tools
Agent Native
Market API
General Data
Get Supported Chains
GET
Get Token Price
POST
Get Token Trading Info
POST
Get Candles
GET
Search Token
GET
Get Token Basic Info
POST
Get Token Advanced Info
GET
Get Hot Token List
GET
Get Holders Ranking
GET
Get Top Traders
GET
Get Top Liquidity Pools
GET
Get Token Trades
GET
Get Token Dev Info
GET
Address Portfolio
Get Portfolio Supported Chains
GET
Get Address Portfolio Overview
GET
Get Address Recent PnL
GET
Get Address PnL for Specific Token
GET
Get DEX Trade History
GET
Get Leaderboard
GET
Get Tracked Trades
GET
RWA Data
Get RWA Token Issuance Platforms
GET
Get RWA Token Price
GET
Search RWA Token
GET
Get RWA Underlying Info
GET
Get RWA Token List
GET
Get RWA Underlying Market Data
GET
DeFi API
DeFi Data
Get DeFi Positions
POST
List DeFi Protocols
POST
Get Protocol Detail
POST
List DeFi Investments
POST
Get Investment Detail
POST
DeFi Transaction
Build DeFi Deposit Transaction
POST
Build DeFi Redeem Transaction
POST
Build LP Add Transaction
POST
Calculate LP Add Paired Amounts
POST
Build LP Remove Transaction
POST
Build DeFi Claim Transaction
POST
Trading API
Get Aggregator Supported Chains
GET
Get ERC-20 Approve Transaction
GET
Get Aggregated Quote
GET
Build Swap Transaction
GET
Quote and Build Swap Transaction (Flash API)
GET
Build Solana Swap Instructions
GET
Get Transaction Status
GET
Submit RFQ Order
POST
Get RFQ Order Status
GET
Transaction API
Get Transaction Supported Chains
GET
Get Gas Price
GET
Get Latest Block Height
GET
Get Gas Limit
POST
Simulate Transactions
POST
Broadcast Transactions
POST
Get Broadcast Orders
GET
Wallet API
Get Wallet Supported Chains
GET
Get All Token Balances by Address
GET
Get Token Balances by Address
POST
Get Transactions by Address
GET
Get Transaction Detail by Hash
GET
B402 Payments
Get B402 Supported Configurations V2
POST
Verify B402 Payment V2
POST
Settle B402 Payment V2
POST
Get B402 Supported Configurations V1
POST
Verify B402 Payment V1
POST
Settle B402 Payment V1
POST
WebSocket Authentication
Get WebSocket Auth Token
GET
Schemas
Binance Web3 API
General Data
Endpoint
https://web3.binance.com/build
Download schema
Get Supported Chains

Return the list of blockchains supported by the market service.

GET
/api/v1/dex/market/supported/chain
https://web3.binance.com/build
Get Supported Chains ›
Authorization
This is a signed endpoint and a signature must be included in the request headers.Learn more about how to generate a valid signature in the Authentication.
Get Supported Chains ›
Headers
X-OC-APIKEY​string · required

API Key issued by Binance Web3 API for authentication.

Example: your-api-key-here
X-OC-TIMESTAMP​string · required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example: 2026-05-11T10:08:57.715Z
X-OC-SIGN​string · required

Request signature (Base64-encoded).

Example: Base64EncodedSignature==
X-OC-RECV-WINDOW​integer · int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example: 5000
X-OC-NONCE​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example: unique-nonce-string
Get Supported Chains ›
Responses
200
401
403
404

Supported chains returned successfully.

code​integer · int32

Business status code. 0 indicates success.

Example: 0
msg​string
Example: success
data​object[]

List of supported blockchain networks.

binanceChainId​string

Unique chain identifier.

Example: 1
name​string

Full chain name.

Example: Ethereum
shortName​string

Short chain name.

Example: ETH
logoUrl​string

Chain logo image URL.

Example: https://onchainos.bnbstatic.com/image/admin_mgs_image_upload/20250228/b549e557-76ca-4873-88ef-3a107cf2c9fe.png
caseSensitive​boolean

Whether addresses on this chain are case-sensitive.

Example: false
nativeTokenSymbol​string

Symbol of the chain's native asset.

Example: ETH
nativeTokenDecimals​integer · int32

Native token decimals.

Example: 18
timestamp​integer · int64
Example: 1748601600000
success​boolean
Example: true
GET/api/v1/dex/market/supported/chain
Loading…
curl --request GET \
  --url https://web3.binance.com/build/api/v1/dex/market/supported/chain \
  --header 'X-OC-APIKEY: <string>' \
  --header 'X-OC-SIGN: <string>' \
  --header 'X-OC-TIMESTAMP: <string>'
Example Responses
200
401
403
404
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "binanceChainId": "1",
      "name": "Ethereum",
      "shortName": "ETH",
      "logoUrl": "https://onchainos.bnbstatic.com/image/admin_mgs_image_upload/20250228/b549e557-76ca-4873-88ef-3a107cf2c9fe.png",
      "caseSensitive": false,
      "nativeTokenSymbol": "ETH",
      "nativeTokenDecimals": 18
    }
  ],
  "timestamp": 1748601600000,
  "success": true
}
json
application/json
Get Token Price

Get the latest price for tokens. Supports batch queries, up to 100 tokens per request.

POST
/api/v1/dex/market/price
https://web3.binance.com/build
Get Token Price ›
Authorization
This is a signed endpoint and a signature must be included in the request headers.Learn more about how to generate a valid signature in the Authentication.
Get Token Price ›
Headers
X-OC-APIKEY​string · required

API Key issued by Binance Web3 API for authentication.

Example: your-api-key-here
X-OC-TIMESTAMP​string · required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example: 2026-05-11T10:08:57.715Z
X-OC-SIGN​string · required

Request signature (Base64-encoded).

Example: Base64EncodedSignature==
X-OC-RECV-WINDOW​integer · int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example: 5000
X-OC-NONCE​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example: unique-nonce-string
Get Token Price ›
Request Body
​object
binanceChainId​string · required

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana).

Example: 1
tokenContractAddress​string · required

Token contract address.

Example: 0xdac17f958d2ee523a2206206994597c13d831ec7
Get Token Price ›
Responses
200
201
401
403
404

Token prices returned successfully.

code​integer · int32
Example: 0
msg​string
Example: success
data​object[]

One price entry per requested token.

binanceChainId​string

Unique chain identifier.

Example: 1
tokenContractAddress​string

Token contract address.

Example: 0xdac17f958d2ee523a2206206994597c13d831ec7
price​string

Latest USD price of the token.

Example: 1.0002
time​integer · int64

Token price observation time, Unix millisecond timestamp.

Example: 1748601600000
timestamp​integer · int64
Example: 1748601600000
success​boolean
Example: true
POST/api/v1/dex/market/price
Loading…
curl --request POST \
  --url https://web3.binance.com/build/api/v1/dex/market/price \
  --header 'Content-Type: application/json' \
  --header 'X-OC-APIKEY: <string>' \
  --header 'X-OC-SIGN: <string>' \
  --header 'X-OC-TIMESTAMP: <string>' \
  --data '
[
  {
    "binanceChainId": "1",
    "tokenContractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7"
  },
  {
    "binanceChainId": "56",
    "tokenContractAddress": "0x55d398326f99059ff775485246999027b3197955"
  }
]
'
Example Request Body
[
  {
    "binanceChainId": "1",
    "tokenContractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7"
  },
  {
    "binanceChainId": "56",
    "tokenContractAddress": "0x55d398326f99059ff775485246999027b3197955"
  }
]
json
application/json
EVM tokens
Solana token
Example Responses
200
201
401
403
404
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "binanceChainId": "1",
      "tokenContractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7",
      "price": "1.0002",
      "time": 1748601600000
    }
  ],
  "timestamp": 1748601600000,
  "success": true
}
json
application/json
Get Token Trading Info

Get token price and trading data (volume, transactions, market cap, holders, etc.). Supports batch queries for up to 100 tokens.

POST
/api/v1/dex/market/price-info
https://web3.binance.com/build
Get Token Trading Info ›
Authorization
This is a signed endpoint and a signature must be included in the request headers.Learn more about how to generate a valid signature in the Authentication.
Get Token Trading Info ›
Headers
X-OC-APIKEY​string · required

API Key issued by Binance Web3 API for authentication.

Example: your-api-key-here
X-OC-TIMESTAMP​string · required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example: 2026-05-11T10:08:57.715Z
X-OC-SIGN​string · required

Request signature (Base64-encoded).

Example: Base64EncodedSignature==
X-OC-RECV-WINDOW​integer · int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example: 5000
X-OC-NONCE​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example: unique-nonce-string
Get Token Trading Info ›
Request Body
​object
binanceChainId​string · required

Unique chain identifier.

Example: 1
tokenContractAddress​string · required

Token contract address.

Example: 0xdac17f958d2ee523a2206206994597c13d831ec7
Get Token Trading Info ›
Responses
200
201
401
403
404

Price info returned successfully.

code​integer · int32
Example: 0
msg​string
Example: success
data​object[]

Price info entry per requested token.

binanceChainId​string

Chain unique identifier.

Example: 1
tokenContractAddress​string

Token contract address.

Example: 0xdac17f958d2ee523a2206206994597c13d831ec7
price​string

Latest token price, denominated in USD.

Example: 1.0002
time​integer · int64

Token price observation time, Unix millisecond timestamp.

Example: 1748601600000
marketCap​string

Token market cap, denominated in USD.

Example: 83500000.00
priceChange5M​string

5-minute price change percentage. "0.12" means a 0.12% increase.

Example: 0.12
priceChange1H​string

1-hour price change percentage. "1.05" means a 1.05% increase.

Example: 1.05
priceChange4H​string

4-hour price change percentage. "2.30" means a 2.30% increase.

Example: 2.30
priceChange24H​string

24-hour price change percentage. "-0.85" means a 0.85% decrease.

Example: -0.85
volume5M​string

Trading volume in the last 5 minutes, denominated in USD.

Example: 12500.50
volume1H​string

Trading volume in the last 1 hour, denominated in USD.

Example: 120000.30
volume4H​string

Trading volume in the last 4 hours, denominated in USD.

Example: 550000.20
volume24H​string

Trading volume in the last 24 hours, denominated in USD.

Example: 1250000.50
buyVolume5M​string

Buy volume in the last 5 minutes, denominated in USD.

Example: 6800.00
buyVolume1H​string

Buy volume in the last 1 hour, denominated in USD.

Example: 65000.00
buyVolume4H​string

Buy volume in the last 4 hours, denominated in USD.

Example: 300000.00
buyVolume24H​string

Buy volume in the last 24 hours, denominated in USD.

Example: 680000.30
sellVolume5M​string

Sell volume in the last 5 minutes, denominated in USD.

Example: 5700.00
sellVolume1H​string

Sell volume in the last 1 hour, denominated in USD.

Example: 55000.00
sellVolume4H​string

Sell volume in the last 4 hours, denominated in USD.

Example: 250000.00
sellVolume24H​string

Sell volume in the last 24 hours, denominated in USD.

Example: 570000.20
txs5M​integer · int64

Number of transactions in the last 5 minutes.

Example: 60
txs1H​integer · int64

Number of transactions in the last 1 hour.

Example: 720
txs4H​integer · int64

Number of transactions in the last 4 hours.

Example: 2880
txs24H​integer · int64

Number of transactions in the last 24 hours.

Example: 1523
buyTxs5M​integer · int64

Number of buy transactions in the last 5 minutes.

Example: 33
buyTxs1H​integer · int64

Number of buy transactions in the last 1 hour.

Example: 380
buyTxs4H​integer · int64

Number of buy transactions in the last 4 hours.

Example: 1500
buyTxs24H​integer · int64

Number of buy transactions in the last 24 hours.

Example: 812
sellTxs5M​integer · int64

Number of sell transactions in the last 5 minutes.

Example: 27
sellTxs1H​integer · int64

Number of sell transactions in the last 1 hour.

Example: 340
sellTxs4H​integer · int64

Number of sell transactions in the last 4 hours.

Example: 1380
sellTxs24H​integer · int64

Number of sell transactions in the last 24 hours.

Example: 711
maxPrice​string

24-hour high price, denominated in USD.

Example: 1.0023
minPrice​string

24-hour low price, denominated in USD.

Example: 0.9987
circSupply​string

Current circulating supply of the token.

Example: 83000000000
liquidity​string

Token liquidity, denominated in USD.

Example: 1250000.50
holders​integer · int64

Number of holding addresses.

Example: 45832
bnVolume5M​string

Trading volume from Binance MPC wallets via Binance Web3 DEX in the last 5 minutes, denominated in USD.

Example: 0
bnVolume1H​string

Trading volume from Binance MPC wallets via Binance Web3 DEX in the last 1 hour, denominated in USD.

Example: 0
bnVolume4H​string

Trading volume from Binance MPC wallets via Binance Web3 DEX in the last 4 hours, denominated in USD.

Example: 0
bnVolume24H​string

Trading volume from Binance MPC wallets via Binance Web3 DEX in the last 24 hours, denominated in USD.

Example: 35000.80
bnBuyVolume5M​string

Buy volume from Binance MPC wallets via Binance Web3 DEX in the last 5 minutes, denominated in USD.

Example: 0
bnBuyVolume1H​string

Buy volume from Binance MPC wallets via Binance Web3 DEX in the last 1 hour, denominated in USD.

Example: 0
bnBuyVolume4H​string

Buy volume from Binance MPC wallets via Binance Web3 DEX in the last 4 hours, denominated in USD.

Example: 0
bnBuyVolume24H​string

Buy volume from Binance MPC wallets via Binance Web3 DEX in the last 24 hours, denominated in USD.

Example: 20000.50
bnSellVolume5M​string

Sell volume from Binance MPC wallets via Binance Web3 DEX in the last 5 minutes, denominated in USD.

Example: 0
bnSellVolume1H​string

Sell volume from Binance MPC wallets via Binance Web3 DEX in the last 1 hour, denominated in USD.

Example: 0
bnSellVolume4H​string

Sell volume from Binance MPC wallets via Binance Web3 DEX in the last 4 hours, denominated in USD.

Example: 0
bnSellVolume24H​string

Sell volume from Binance MPC wallets via Binance Web3 DEX in the last 24 hours, denominated in USD.

Example: 15000.30
bnTxs5M​integer · int64

Number of transactions from Binance MPC wallets via Binance Web3 DEX in the last 5 minutes.

Example: 0
bnTxs1H​integer · int64

Number of transactions from Binance MPC wallets via Binance Web3 DEX in the last 1 hour.

Example: 0
bnTxs4H​integer · int64

Number of transactions from Binance MPC wallets via Binance Web3 DEX in the last 4 hours.

Example: 0
bnTxs24H​integer · int64

Number of transactions from Binance MPC wallets via Binance Web3 DEX in the last 24 hours.

Example: 156
bnBuyTxs5M​integer · int64

Number of buy transactions from Binance MPC wallets via Binance Web3 DEX in the last 5 minutes.

Example: 0
bnBuyTxs1H​integer · int64

Number of buy transactions from Binance MPC wallets via Binance Web3 DEX in the last 1 hour.

Example: 0
bnBuyTxs4H​integer · int64

Number of buy transactions from Binance MPC wallets via Binance Web3 DEX in the last 4 hours.

Example: 0
bnBuyTxs24H​integer · int64

Number of buy transactions from Binance MPC wallets via Binance Web3 DEX in the last 24 hours.

Example: 89
bnSellTxs5M​integer · int64

Number of sell transactions from Binance MPC wallets via Binance Web3 DEX in the last 5 minutes.

Example: 0
bnSellTxs1H​integer · int64

Number of sell transactions from Binance MPC wallets via Binance Web3 DEX in the last 1 hour.

Example: 0
bnSellTxs4H​integer · int64

Number of sell transactions from Binance MPC wallets via Binance Web3 DEX in the last 4 hours.

Example: 0
bnSellTxs24H​integer · int64

Number of sell transactions from Binance MPC wallets via Binance Web3 DEX in the last 24 hours.

Example: 67
timestamp​integer · int64
Example: 1748601600000
success​boolean
Example: true
POST/api/v1/dex/market/price-info
Loading…
curl --request POST \
  --url https://web3.binance.com/build/api/v1/dex/market/price-info \
  --header 'Content-Type: application/json' \
  --header 'X-OC-APIKEY: <string>' \
  --header 'X-OC-SIGN: <string>' \
  --header 'X-OC-TIMESTAMP: <string>' \
  --data '
[
  {
    "binanceChainId": "1",
    "tokenContractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7"
  }
]
'
Example Request Body
[
  {
    "binanceChainId": "1",
    "tokenContractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7"
  }
]
json
Example Responses
200
201
401
403
404
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "binanceChainId": "1",
      "tokenContractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7",
      "price": "1.0002",
      "time": 1748601600000,
      "marketCap": "83500000.00",
      "priceChange5M": "0.12",
      "priceChange1H": "1.05",
      "priceChange4H": "2.30",
      "priceChange24H": "-0.85",
      "volume5M": "12500.50",
      "volume1H": "120000.30",
      "volume4H": "550000.20",
      "volume24H": "1250000.50",
      "buyVolume5M": "6800.00",
      "buyVolume1H": "65000.00",
      "buyVolume4H": "300000.00",
      "buyVolume24H": "680000.30",
      "sellVolume5M": "5700.00",
      "sellVolume1H": "55000.00",
      "sellVolume4H": "250000.00",
      "sellVolume24H": "570000.20",
      "txs5M": 60,
      "txs1H": 720,
      "txs4H": 2880,
      "txs24H": 1523,
      "buyTxs5M": 33,
      "buyTxs1H": 380,
      "buyTxs4H": 1500,
      "buyTxs24H": 812,
      "sellTxs5M": 27,
      "sellTxs1H": 340,
      "sellTxs4H": 1380,
      "sellTxs24H": 711,
      "maxPrice": "1.0023",
      "minPrice": "0.9987",
      "circSupply": "83000000000",
      "liquidity": "1250000.50",
      "holders": 45832,
      "bnVolume5M": "0",
      "bnVolume1H": "0",
      "bnVolume4H": "0",
      "bnVolume24H": "35000.80",
      "bnBuyVolume5M": "0",
      "bnBuyVolume1H": "0",
      "bnBuyVolume4H": "0",
      "bnBuyVolume24H": "20000.50",
      "bnSellVolume5M": "0",
      "bnSellVolume1H": "0",
      "bnSellVolume4H": "0",
      "bnSellVolume24H": "15000.30",
      "bnTxs5M": 0,
      "bnTxs1H": 0,
      "bnTxs4H": 0,
      "bnTxs24H": 156,
      "bnBuyTxs5M": 0,
      "bnBuyTxs1H": 0,
      "bnBuyTxs4H": 0,
      "bnBuyTxs24H": 89,
      "bnSellTxs5M": 0,
      "bnSellTxs1H": 0,
      "bnSellTxs4H": 0,
      "bnSellTxs24H": 67
    }
  ],
  "timestamp": 1748601600000,
  "success": true
}
json
application/json
Get Candles

Return candlestick (K-line) data for a token.

GET
/api/v1/dex/market/candles
https://web3.binance.com/build
Get Candles ›
Authorization
This is a signed endpoint and a signature must be included in the request headers.Learn more about how to generate a valid signature in the Authentication.
Get Candles ›
Headers
X-OC-APIKEY​string · required

API Key issued by Binance Web3 API for authentication.

Example: your-api-key-here
X-OC-TIMESTAMP​string · required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example: 2026-05-11T10:08:57.715Z
X-OC-SIGN​string · required

Request signature (Base64-encoded).

Example: Base64EncodedSignature==
X-OC-RECV-WINDOW​integer · int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example: 5000
X-OC-NONCE​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example: unique-nonce-string
Get Candles ›
Query Parameters
binanceChainId​string · required

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana).

Example: 1
tokenContractAddress​string · required

Token contract address.

Example: 0xdac17f958d2ee523a2206206994597c13d831ec7
bar​string · enum

Candlestick time granularity, default "1m" (1 minute). Available values: 1s (1 second), 5s (5 seconds), 30s (30 seconds), 1m (1 minute), 3m (3 minutes), 5m (5 minutes), 15m (15 minutes), 30m (30 minutes), 1h (1 hour), 2h (2 hours), 4h (4 hours), 6h (6 hours), 8h (8 hours), 12h (12 hours), 1d (1 day), 3d (3 days), 1w (1 week), 1M (1 month).

Enum values:
1s
5s
30s
1m
3m
5m
15m
30m
show 10 more
Example: 1m
Default: 1m
after​integer · int64

End time for the query, Unix millisecond timestamp. Returns candles earlier than this time (exclusive).

Example: 1748600000000
before​integer · int64

Start time for the query, Unix millisecond timestamp. Returns candles later than this time (exclusive).

Example: 1748000000000
limit​integer · int32

Number of candles to return. Defaults to 100.

Example: 100
Default: 100
Get Candles ›
Responses
200
401
403
404

Candle data returned successfully.

code​integer · int32
Example: 0
msg​string
Example: success
data​array[]

Candlestick data list. Each record contains 7 values in order: open, high, low, close, volume, timestamp (ms), tradeCount.

Example: [[1.0001,1.0023,0.9987,1.001,125000.5,1748600000000,42],[1.001,1.0035,1.0001,1.0028,187500.3,1748600060000,38]]
timestamp​integer · int64
Example: 1748601600000
success​boolean
Example: true
GET/api/v1/dex/market/candles
Loading…
curl --request GET \
  --url 'https://web3.binance.com/build/api/v1/dex/market/candles?binanceChainId=%3Cstring%3E&tokenContractAddress=%3Cstring%3E' \
  --header 'X-OC-APIKEY: <string>' \
  --header 'X-OC-SIGN: <string>' \
  --header 'X-OC-TIMESTAMP: <string>'
Example Responses
200
401
403
404
{
  "code": 0,
  "msg": "success",
  "data": [
    [
      1.0001,
      1.0023,
      0.9987,
      1.001,
      125000.5,
      1748600000000,
      42
    ],
    [
      1.001,
      1.0035,
      1.0001,
      1.0028,
      187500.3,
      1748600060000,
      38
    ]
  ],
  "timestamp": 1748601600000,
  "success": true
}
json
application/json
Search Token

Search tokens by symbol or contract address.

GET
/api/v1/dex/market/token/search
https://web3.binance.com/build
Search Token ›
Authorization
This is a signed endpoint and a signature must be included in the request headers.Learn more about how to generate a valid signature in the Authentication.
Search Token ›
Headers
X-OC-APIKEY​string · required

API Key issued by Binance Web3 API for authentication.

Example: your-api-key-here
X-OC-TIMESTAMP​string · required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example: 2026-05-11T10:08:57.715Z
X-OC-SIGN​string · required

Request signature (Base64-encoded).

Example: Base64EncodedSignature==
X-OC-RECV-WINDOW​integer · int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example: 5000
X-OC-NONCE​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example: unique-nonce-string
Search Token ›
Query Parameters
chains​string · required

List of chain IDs to search, comma-separated.

Example: 1,56,CT_501
search​string · required

Search keyword. Can be a token address or token symbol.

Example: USDT
Search Token ›
Responses
200
401
403
404

Search results returned successfully.

code​integer · int32
Example: 0
msg​string
Example: success
data​object[]

Matching tokens.

binanceChainId​string

Chain identifier.

Example: 1
tokenName​string

Token full name.

Example: Tether USD
tokenSymbol​string

Token symbol.

Example: USDT
tokenLogoUrl​string | null

Token logo link. Null when no logo is available.

Example: https://static.onchainos.com/tokens/usdt.png
tokenContractAddress​string

Token contract address.

Example: 0xdac17f958d2ee523a2206206994597c13d831ec7
decimals​integer · int32

Token decimals.

Example: 6
explorerUrl​string

Block explorer link for the token.

Example: https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7
change​string | null

24-hour price change. "-5.23" means a 5.23% decrease. Null when no data.

Example: -5.23
holders​string

Number of holder addresses.

Example: 45832
liquidity​string

Token liquidity, denominated in USD.

Example: 1250000.50
marketCap​string

Token market cap, denominated in USD.

Example: 83500000.00
price​string

Latest token price, denominated in USD.

Example: 1.0001
tagList​object
isRecognized​boolean | null

True indicates the token is listed on major centralized exchanges or widely recognized by the community.

Example: true
timestamp​integer · int64
Example: 1748601600000
success​boolean
Example: true
GET/api/v1/dex/market/token/search
Loading…
curl --request GET \
  --url 'https://web3.binance.com/build/api/v1/dex/market/token/search?chains=%3Cstring%3E&search=%3Cstring%3E' \
  --header 'X-OC-APIKEY: <string>' \
  --header 'X-OC-SIGN: <string>' \
  --header 'X-OC-TIMESTAMP: <string>'
Example Responses
200
401
403
404
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "binanceChainId": "1",
      "tokenName": "Tether USD",
      "tokenSymbol": "USDT",
      "tokenLogoUrl": "https://static.onchainos.com/tokens/usdt.png",
      "tokenContractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7",
      "decimals": 6,
      "explorerUrl": "https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7",
      "change": "-5.23",
      "holders": "45832",
      "liquidity": "1250000.50",
      "marketCap": "83500000.00",
      "price": "1.0001",
      "tagList": {
        "isRecognized": true
      }
    }
  ],
  "timestamp": 1748601600000,
  "success": true
}
json
application/json
Get Token Basic Info

Return basic metadata for a token: name, symbol, logo, decimals, creator address, creation time, and tag info.

POST
/api/v1/dex/market/token/basic-info
https://web3.binance.com/build
Get Token Basic Info ›
Authorization
This is a signed endpoint and a signature must be included in the request headers.Learn more about how to generate a valid signature in the Authentication.
Get Token Basic Info ›
Headers
X-OC-APIKEY​string · required

API Key issued by Binance Web3 API for authentication.

Example: your-api-key-here
X-OC-TIMESTAMP​string · required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example: 2026-05-11T10:08:57.715Z
X-OC-SIGN​string · required

Request signature (Base64-encoded).

Example: Base64EncodedSignature==
X-OC-RECV-WINDOW​integer · int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example: 5000
X-OC-NONCE​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example: unique-nonce-string
Get Token Basic Info ›
Query Parameters
binanceChainId​string · required

Unique chain identifier.

Example: 1
tokenContractAddress​string · required

Token contract address.

Example: 0xdac17f958d2ee523a2206206994597c13d831ec7
Get Token Basic Info ›
Responses
200
201
401
403
404

Token basic info returned successfully.

code​integer · int32
Example: 0
msg​string
Example: success
data​object
binanceChainId​string

Unique identifier of the chain.

Example: 1
tokenContractAddress​string

Token contract address.

Example: 0xdac17f958d2ee523a2206206994597c13d831ec7
tokenName​string

Token full name.

Example: Tether USD
tokenSymbol​string

Token symbol.

Example: USDT
tokenLogoUrl​string | null

Token logo link. Null when no logo is available.

Example: https://static.onchainos.com/tokens/usdt.png
decimals​integer · int32

Token decimals.

Example: 6
creatorAddress​string

Token creator wallet address.

Example: 0x21a31ee1afc51d94c2efccaa2092ad1028285549
createTime​integer · int64

Token creation time, Unix millisecond timestamp.

Example: 1716892020000
tagList​object
isRecognized​boolean | null

True indicates the token is listed on major centralized exchanges or widely recognized by the community.

Example: true
timestamp​integer · int64
Example: 1748601600000
success​boolean
Example: true
POST/api/v1/dex/market/token/basic-info
Loading…
curl --request POST \
  --url 'https://web3.binance.com/build/api/v1/dex/market/token/basic-info?binanceChainId=%3Cstring%3E&tokenContractAddress=%3Cstring%3E' \
  --header 'X-OC-APIKEY: <string>' \
  --header 'X-OC-SIGN: <string>' \
  --header 'X-OC-TIMESTAMP: <string>'
Example Responses
200
201
401
403
404
{
  "code": 0,
  "msg": "success",
  "data": {
    "binanceChainId": "1",
    "tokenContractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "tokenName": "Tether USD",
    "tokenSymbol": "USDT",
    "tokenLogoUrl": "https://static.onchainos.com/tokens/usdt.png",
    "decimals": 6,
    "creatorAddress": "0x21a31ee1afc51d94c2efccaa2092ad1028285549",
    "createTime": 1716892020000,
    "tagList": {
      "isRecognized": true
    }
  },
  "timestamp": 1748601600000,
  "success": true
}
json
application/json
Get Token Advanced Info

Return comprehensive metrics for a token, including creator and launch info, holding percentages by address type (smart money, KOL, sniper, bundler, fresh wallet, etc.), and token tags.

GET
/api/v1/dex/market/token/advanced-info
https://web3.binance.com/build
Get Token Advanced Info ›
Authorization
This is a signed endpoint and a signature must be included in the request headers.Learn more about how to generate a valid signature in the Authentication.
Get Token Advanced Info ›
Headers
X-OC-APIKEY​string · required

API Key issued by Binance Web3 API for authentication.

Example: your-api-key-here
X-OC-TIMESTAMP​string · required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example: 2026-05-11T10:08:57.715Z
X-OC-SIGN​string · required

Request signature (Base64-encoded).

Example: Base64EncodedSignature==
X-OC-RECV-WINDOW​integer · int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example: 5000
X-OC-NONCE​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example: unique-nonce-string
Get Token Advanced Info ›
Query Parameters
binanceChainId​string · required

Unique chain identifier.

Example: 1
tokenContractAddress​string · required

Token contract address.

Example: 0x6982508145454ce325ddbe47a25d4ec3d2311933
Get Token Advanced Info ›
Responses
200
401
403
404

Advanced token info returned successfully.

code​integer · int32
Example: 0
msg​string
Example: success
data​object
binanceChainId​string

Unique chain identifier.

Example: 1
tokenContractAddress​string

Token contract address.

Example: 0x6982508145454ce325ddbe47a25d4ec3d2311933
isInternal​integer · int32

Whether the token is internal to the platform. 0 = no, 1 = yes.

Example: 0
protocolId​integer | null · int32

Protocol ID the token belongs to. Null when no protocol is associated.

Example: 1
progress​string | null

Token launch progress for inner-market tokens, range 0–100.

Example: 75
createTime​integer · int64

Token creation time, Unix millisecond timestamp.

Example: 1714000000000
creatorAddress​string

Token creator wallet address.

Example: 0x21a31ee1afc51d94c2efccaa2092ad1028285549
devCreatedTokenCount​integer · int64

Total tokens the developer has ever created.

Example: 15
devMigratedTokenCount​integer · int64

Total tokens the developer has successfully launched (migrated).

Example: 8
devMigratedTokenPercent​string

Developer launch success rate. "53.5" means 53.5%.

Example: 53.5
top10HoldingPercent​string

Top 10 addresses combined holding percentage. "40.08" means 40.08%.

Example: 40.08
devHoldingPercent​string

Developer holding percentage. "5.23" means 5.23%.

Example: 5.23
smartMoneyHoldingPercent​string

Smart money holding percentage. "2.15" means 2.15%.

Example: 2.15
kolHoldingPercent​string

KOL holding percentage. "1.5" means 1.5%.

Example: 1.5
bundlerHoldingPercent​string

Bundler holding percentage. "12.3" means 12.3%.

Example: 12.3
proHoldingPercent​string

Professional holder percentage. "4.2" means 4.2%.

Example: 4.2
freshWalletHoldingPercent​string

Fresh wallet holding percentage. "3.8" means 3.8%.

Example: 3.8
sniperHoldingPercent​string

Sniper holding percentage. "3.1" means 3.1%.

Example: 3.1
insiderHoldingPercent​string

Insider holding percentage. "2.5" means 2.5%.

Example: 2.5
holders​integer · int64

Number of holding addresses.

Example: 45832
bnHolderCount​integer · int64

Number of Binance MPC wallets holding this token.

Example: 1203
bnTraderCount7D​integer · int64

Number of Binance MPC wallets that traded via Binance Web3 DEX in the last 7 days.

Example: 250
tokenTags​string[]

Token tags. Returns tags matched by the token. Possible values:

alpha — Binance Alpha
tge — Binance TGE
communityRecognized — Highly recognized by community
devSellAll — Developer sold entire holding
devSell — Developer sold partial holding
devBuy — Developer bought tokens
smartMoneyBuy — Smart money buying
smartMoneySell — Smart money selling
devRemoveLiquidity — Developer removed liquidity
devAddLiquidity — Developer added liquidity
devBurnToken — Developer burned tokens
dexScreenerPaid — DexScreener paid
volumeSurge — Volume surge
volumePlunge — Volume plunge
lowLiquidity — Low liquidity
washTrading — Wash trading detected
devWashTrading — Developer wash trading detected
insiderWashTrading — Insider wash trading detected
Enum values:
alpha
tge
communityRecognized
devSellAll
devSell
devBuy
smartMoneyBuy
smartMoneySell
show 10 more
timestamp​integer · int64
Example: 1748601600000
success​boolean
Example: true
GET/api/v1/dex/market/token/advanced-info
Loading…
curl --request GET \
  --url 'https://web3.binance.com/build/api/v1/dex/market/token/advanced-info?binanceChainId=%3Cstring%3E&tokenContractAddress=%3Cstring%3E' \
  --header 'X-OC-APIKEY: <string>' \
  --header 'X-OC-SIGN: <string>' \
  --header 'X-OC-TIMESTAMP: <string>'
Example Responses
200
401
403
404
{
  "code": 0,
  "msg": "success",
  "data": {
    "binanceChainId": "1",
    "tokenContractAddress": "0x6982508145454ce325ddbe47a25d4ec3d2311933",
    "isInternal": 0,
    "protocolId": 1,
    "progress": "75",
    "createTime": 1714000000000,
    "creatorAddress": "0x21a31ee1afc51d94c2efccaa2092ad1028285549",
    "devCreatedTokenCount": 15,
    "devMigratedTokenCount": 8,
    "devMigratedTokenPercent": "53.5",
    "top10HoldingPercent": "40.08",
    "devHoldingPercent": "5.23",
    "smartMoneyHoldingPercent": "2.15",
    "kolHoldingPercent": "1.5",
    "bundlerHoldingPercent": "12.3",
    "proHoldingPercent": "4.2",
    "freshWalletHoldingPercent": "3.8",
    "sniperHoldingPercent": "3.1",
    "insiderHoldingPercent": "2.5",
    "holders": 45832,
    "bnHolderCount": 1203,
    "bnTraderCount7D": 250,
    "tokenTags": [
      "Alpha"
    ]
  },
  "timestamp": 1748601600000,
  "success": true
}
json
application/json
Get Hot Token List

Get hot token ranking list. Supports sorting by volume, price change, market cap, etc., with filters for holding distribution, developer behavior, liquidity, and more.

GET
/api/v1/dex/market/token/hot-token
https://web3.binance.com/build
Get Hot Token List ›
Authorization
This is a signed endpoint and a signature must be included in the request headers.Learn more about how to generate a valid signature in the Authentication.
Get Hot Token List ›
Headers
X-OC-APIKEY​string · required

API Key issued by Binance Web3 API for authentication.

Example: your-api-key-here
X-OC-TIMESTAMP​string · required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example: 2026-05-11T10:08:57.715Z
X-OC-SIGN​string · required

Request signature (Base64-encoded).

Example: Base64EncodedSignature==
X-OC-RECV-WINDOW​integer · int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example: 5000
X-OC-NONCE​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example: unique-nonce-string
Get Hot Token List ›
Query Parameters
binanceChainId​string · required

Chain identifier. Single value only.

Example: 1
rankBy​integer · enum · int32

Ranking field. 1=price, 2=price change, 3=transactions, 4=volume, 5=market cap, 6=liquidity, 7=creation time, 8=holders, 9=Binance MPC wallet holders, 10=net inflow.

Enum values:
1
2
3
4
5
6
7
8
show 2 more
Example: 4
rankingTimeFrame​integer · enum · int32

Data time range. 1=1 min, 2=5 min, 3=1 hour, 4=4 hours, 5=24 hours. Default 1 hour.

Enum values:
1
2
3
4
5
Example: 3
Default: 3
priceChangePercentMin​string

Minimum price change filter. "5" means 5%.

Example: 5
priceChangePercentMax​string

Maximum price change filter. "100" means 100%.

Example: 100
volumeMin​string

Minimum volume filter, denominated in USD.

Example: 10000
volumeMax​string

Maximum volume filter, denominated in USD.

Example: 1000000
txsMin​string

Minimum transaction count.

Example: 100
txsMax​string

Maximum transaction count.

Example: 10000
marketCapMin​string

Minimum market cap filter, denominated in USD.

Example: 100000
marketCapMax​string

Maximum market cap filter, denominated in USD.

Example: 100000000
liquidityMin​string

Minimum liquidity filter, denominated in USD.

Example: 10000
liquidityMax​string

Maximum liquidity filter, denominated in USD.

Example: 10000000
devHoldingPercentMin​string

Minimum developer holding percentage filter. "5" means 5%.

Example: 0
devHoldingPercentMax​string

Maximum developer holding percentage filter. "5" means 5%.

Example: 10
inflowUsdMin​string

Minimum net inflow filter, denominated in USD.

Example: 0
inflowUsdMax​string

Maximum net inflow filter, denominated in USD.

Example: 1000000
holdersMin​string

Minimum holder count.

Example: 100
holdersMax​string

Maximum holder count.

Example: 100000
bnHolderCountMin​string

Minimum Binance MPC wallet holders.

Example: 0
bnHolderCountMax​string

Maximum Binance MPC wallet holders.

Example: 10000
top10HoldingPercentMin​string

Minimum top-10 holding percentage. "5" means 5%.

Example: 0
top10HoldingPercentMax​string

Maximum top-10 holding percentage. "5" means 5%.

Example: 100
sniperHoldingPercentMin​string

Minimum sniper holding percentage. "5" means 5%.

Example: 0
sniperHoldingPercentMax​string

Maximum sniper holding percentage. "5" means 5%.

Example: 100
smartMoneyHoldingPercentMin​string

Minimum smart-money holding percentage. "5" means 5%.

Example: 0
smartMoneyHoldingPercentMax​string

Maximum smart-money holding percentage. "5" means 5%.

Example: 100
kolHoldingPercentMin​string

Minimum KOL holding percentage. "5" means 5%.

Example: 0
kolHoldingPercentMax​string

Maximum KOL holding percentage. "5" means 5%.

Example: 100
proHoldingPercentMin​string

Minimum pro-trader holding percentage. "5" means 5%.

Example: 0
proHoldingPercentMax​string

Maximum pro-trader holding percentage. "5" means 5%.

Example: 100
freshWalletHoldingPercentMin​string

Minimum fresh-wallet holding percentage. "5" means 5%.

Example: 0
freshWalletHoldingPercentMax​string

Maximum fresh-wallet holding percentage. "5" means 5%.

Example: 100
insiderHoldingPercentMin​string

Minimum insider holding percentage. "5" means 5%.

Example: 0
insiderHoldingPercentMax​string

Maximum insider holding percentage. "5" means 5%.

Example: 100
bundlerHoldingPercentMin​string

Minimum bundler holding percentage. "5" means 5%.

Example: 0
bundlerHoldingPercentMax​string

Maximum bundler holding percentage. "5" means 5%.

Example: 100
devCreatedTokenCountMin​string

Minimum developer-created token count.

Example: 0
devCreatedTokenCountMax​string

Maximum developer-created token count.

Example: 100
devMigratedTokenCountMin​string

Minimum developer-migrated token count.

Example: 0
devMigratedTokenCountMax​string

Maximum developer-migrated token count.

Example: 100
devMigratedTokenPercentMin​string

Minimum developer-migrated token percentage. "5" means 5%.

Example: 0
devMigratedTokenPercentMax​string

Maximum developer-migrated token percentage. "5" means 5%.

Example: 100
isDevSoldAll​boolean

When set to true, returns only tokens where the developer has sold all holdings. Not filtered when omitted or false.

Example: false
isDevBurned​boolean

When set to true, returns only tokens where the developer has burned tokens. Not filtered when omitted or false.

Example: false
isMint​boolean

When set to true, excludes tokens with minting capability. Default false.

Example: false
Default: false
isFreeze​boolean

When set to true, excludes tokens with freeze capability. Default false.

Example: false
Default: false
isHideWashTradingTokens​boolean

When set to true, excludes tokens with wash trading behavior. Default true.

Example: true
Default: true
isHideDevWashTradingTokens​boolean

When set to true, excludes tokens where the developer has wash trading behavior. Default true.

Example: true
Default: true
isHideInternalWashTradingTokens​boolean

When set to true, excludes tokens where insiders have wash trading behavior. Default true.

Example: true
Default: true
pageId​integer · int32

Pagination identifier. Do not pass on the first request; pass the page value from the previous response to get the next page.

Example: 1
Default: 1
size​integer · int32 · max: 100

Page size. Maximum 100. Defaults to 100.

Example: 100
Default: 100
Get Hot Token List ›
Responses
200
401
403
404

Hot token list returned successfully.

code​integer · int32
Example: 0
msg​string
Example: success
data​object
page​integer | null · int32

Current page number. Null when no more data is available.

Example: 1
items​object[]

Hot token list.

binanceChainId​string

Unique identifier of the chain.

Example: 1
tokenSymbol​string

Token symbol.

Example: PEPE
tokenLogoUrl​string | null

Token logo URL.

Example: https://static.onchainos.com/tokens/pepe.png
tokenContractAddress​string

Token contract address.

Example: 0x6982508145454ce325ddbe47a25d4ec3d2311933
marketCap​string

Market cap, denominated in USD.

Example: 5830000.50
volume​string

Trading volume within the specified time, denominated in USD.

Example: 1250000.30
change​string

Price change percentage within the specified time. "-5.23" means a 5.23% decrease.

Example: 12.5
uniqueTraders​string

Number of unique trading addresses.

Example: 2341
buyTxs​string

Buy transaction count.

Example: 1523
sellTxs​string

Sell transaction count.

Example: 987
txs​string

Total transaction count.

Example: 2510
liquidity​string

Liquidity, denominated in USD.

Example: 680000.00
price​string

Token price, denominated in USD.

Example: 0.00000702
holders​string

Holder count.

Example: 45832
inflowUsd​string

Net inflow, denominated in USD. Positive means net inflow, negative means net outflow.

Example: 125000.50
devHoldingPercent​string

Developer holding percentage. "5.23" means 5.23%.

Example: 5.5
bnHolderCount​string

Number of Binance MPC wallets holding this token.

Example: 1203
top10HoldingPercent​string

Top 10 addresses holding percentage. "35.2" means 35.2%.

Example: 35.2
sniperHoldingPercent​string

Sniper holding percentage. "8.3" means 8.3%.

Example: 8.3
proHoldingPercent​string

Professional holder percentage. "12.1" means 12.1%.

Example: 12.1
freshWalletHoldingPercent​string

Fresh wallet holding percentage. "3.5" means 3.5%.

Example: 3.5
smartMoneyHoldingPercent​string

Smart money holding percentage. "1.52" means 1.52%.

Example: 1.52
kolHoldingPercent​string

KOL holding percentage. "6.5" means 6.5%.

Example: 6.5
insiderHoldingPercent​string

Insider holding percentage. "2.8" means 2.8%.

Example: 2.8
bundlerHoldingPercent​string

Bundler holding percentage. "6.2" means 6.2%.

Example: 6.2
devCreatedTokenCount​string

Developer-created token count.

Example: 3
devMigratedTokenCount​string

Developer-migrated token count.

Example: 1
devMigratedTokenPercent​string

Developer migrated token percentage. "33.3" means 33.3%.

Example: 33.3
tokenTags​string[]

Token tags.

Enum values:
alpha
tge
communityRecognized
devSellAll
devSell
devBuy
smartMoneyBuy
smartMoneySell
show 10 more
timestamp​integer · int64
Example: 1748601600000
success​boolean
Example: true
GET/api/v1/dex/market/token/hot-token
Loading…
curl --request GET \
  --url 'https://web3.binance.com/build/api/v1/dex/market/token/hot-token?binanceChainId=%3Cstring%3E' \
  --header 'X-OC-APIKEY: <string>' \
  --header 'X-OC-SIGN: <string>' \
  --header 'X-OC-TIMESTAMP: <string>'
Example Responses
200
401
403
404
{
  "code": 0,
  "msg": "success",
  "data": {
    "page": 1,
    "items": [
      {
        "binanceChainId": "1",
        "tokenSymbol": "PEPE",
        "tokenLogoUrl": "https://static.onchainos.com/tokens/pepe.png",
        "tokenContractAddress": "0x6982508145454ce325ddbe47a25d4ec3d2311933",
        "marketCap": "5830000.50",
        "volume": "1250000.30",
        "change": "12.5",
        "uniqueTraders": "2341",
        "buyTxs": "1523",
        "sellTxs": "987",
        "txs": "2510",
        "liquidity": "680000.00",
        "price": "0.00000702",
        "holders": "45832",
        "inflowUsd": "125000.50",
        "devHoldingPercent": "5.5",
        "bnHolderCount": "1203",
        "top10HoldingPercent": "35.2",
        "sniperHoldingPercent": "8.3",
        "proHoldingPercent": "12.1",
        "freshWalletHoldingPercent": "3.5",
        "smartMoneyHoldingPercent": "1.52",
        "kolHoldingPercent": "6.5",
        "insiderHoldingPercent": "2.8",
        "bundlerHoldingPercent": "6.2",
        "devCreatedTokenCount": "3",
        "devMigratedTokenCount": "1",
        "devMigratedTokenPercent": "33.3",
        "tokenTags": [
          "Alpha"
        ]
      }
    ]
  },
  "timestamp": 1748601600000,
  "success": true
}
json
application/json
Get Holders Ranking

Return the holders ranking list for a token, including holding amount, holding percentage, native-token balance, average buy/sell price, realized PnL, and funding source. Up to 100 records. Pagination is not supported.

GET
/api/v1/dex/market/token/holder
https://web3.binance.com/build
Get Holders Ranking ›
Authorization
This is a signed endpoint and a signature must be included in the request headers.Learn more about how to generate a valid signature in the Authentication.
Get Holders Ranking ›
Headers
X-OC-APIKEY​string · required

API Key issued by Binance Web3 API for authentication.

Example: your-api-key-here
X-OC-TIMESTAMP​string · required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example: 2026-05-11T10:08:57.715Z
X-OC-SIGN​string · required

Request signature (Base64-encoded).

Example: Base64EncodedSignature==
X-OC-RECV-WINDOW​integer · int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example: 5000
X-OC-NONCE​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example: unique-nonce-string
Get Holders Ranking ›
Query Parameters
binanceChainId​string · required

Unique chain identifier.

Example: 1
tokenContractAddress​string · required

Token contract address.

Example: 0x6982508145454ce325ddbe47a25d4ec3d2311933
tagFilter​integer · enum · int32

Address tag filter, single selection only. Returns all holder addresses (by holding amount descending) when omitted; returns addresses matching the specified tag when provided. Mapping: 1=KOL, 2=Developer, 3=Smart Money, 4=Insider, 5=Sniper, 6=Bundler.

Enum values:
1
2
3
4
5
6
Example: 1
Get Holders Ranking ›
Responses
200
401
403
404

Holders ranking returned successfully.

code​integer · int32
Example: 0
msg​string
Example: success
data​object[]

Holder list.

holderWalletAddress​string

Holder wallet address.

Example: 0x28c6c06298d514db089934071355e5743bf21d60
holdAmount​string

Current holding amount.

Example: 18580000
holdingPercent​string

Holding percentage. "5.23" means 5.23%.

Example: 5.23
nativeTokenSymbol​string

Native token symbol.

Example: ETH
nativeTokenBalance​string

Native token balance of the address.

Example: 12.5
boughtAmount​string

Total buy amount.

Example: 18580000
avgBuyPrice​string

Average buy price, denominated in USD.

Example: 0.000105
soldAmount​string

Cumulative sold amount (token units).

Example: 15000000
avgSellPrice​string

Average sell price, denominated in USD.

Example: 0.000195
maxHoldAmount​string

Maximum historical holding amount.

Example: 30000000
lastTradeTime​integer · int64

Time of the holder's last trade of this token, Unix millisecond timestamp.

Example: 1716892020000
realizedPnlUsd​string

Realized PnL, denominated in USD. Positive means profit, negative means loss.

Example: 1277.84
fundingSource​string | null

Funding source address, i.e., the originator of the first inbound native-token transfer. Null when no inbound transfer is recorded.

Example: 0x28c6c06298d514db089934071355e5743bf21d60
fundingSourceLabel​object | null

Funding source label (e.g. exchange tag). Null when unknown.

fundingSourceHash​string | null

Transaction hash of the first inbound native-token transfer.

Example: 0x3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b
fundingSourceTime​integer | null · int64

Time of the first native token inbound transfer, Unix millisecond timestamp.

Example: 1714000000000
fundingSourceAmount​string | null

Amount of the first native token inbound transfer. e.g. 0.5 means 0.5 ETH.

Example: 0.5
timestamp​integer · int64
Example: 1748601600000
success​boolean
Example: true
GET/api/v1/dex/market/token/holder
Loading…
curl --request GET \
  --url 'https://web3.binance.com/build/api/v1/dex/market/token/holder?binanceChainId=%3Cstring%3E&tokenContractAddress=%3Cstring%3E' \
  --header 'X-OC-APIKEY: <string>' \
  --header 'X-OC-SIGN: <string>' \
  --header 'X-OC-TIMESTAMP: <string>'
Example Responses
200
401
403
404
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "holderWalletAddress": "0x28c6c06298d514db089934071355e5743bf21d60",
      "holdAmount": "18580000",
      "holdingPercent": "5.23",
      "nativeTokenSymbol": "ETH",
      "nativeTokenBalance": "12.5",
      "boughtAmount": "18580000",
      "avgBuyPrice": "0.000105",
      "soldAmount": "15000000",
      "avgSellPrice": "0.000195",
      "maxHoldAmount": "30000000",
      "lastTradeTime": 1716892020000,
      "realizedPnlUsd": "1277.84",
      "fundingSource": "0x28c6c06298d514db089934071355e5743bf21d60",
      "fundingSourceLabel": {
        "tagName": "cex",
        "tagValue": "Binance"
      },
      "fundingSourceHash": "0x3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
      "fundingSourceTime": 1714000000000,
      "fundingSourceAmount": "0.5"
    }
  ],
  "timestamp": 1748601600000,
  "success": true
}
json
application/json
Get Top Traders

Return the top profit-making addresses for a token, ranked by realized PnL descending. Includes holding amount, average buy/sell price, realized PnL, and funding source. Up to 100 records. Pagination is not supported.

GET
/api/v1/dex/market/token/top-trader
https://web3.binance.com/build
Get Top Traders ›
Authorization
This is a signed endpoint and a signature must be included in the request headers.Learn more about how to generate a valid signature in the Authentication.
Get Top Traders ›
Headers
X-OC-APIKEY​string · required

API Key issued by Binance Web3 API for authentication.

Example: your-api-key-here
X-OC-TIMESTAMP​string · required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example: 2026-05-11T10:08:57.715Z
X-OC-SIGN​string · required

Request signature (Base64-encoded).

Example: Base64EncodedSignature==
X-OC-RECV-WINDOW​integer · int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example: 5000
X-OC-NONCE​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example: unique-nonce-string
Get Top Traders ›
Query Parameters
binanceChainId​string · required

Unique chain identifier.

Example: 1
tokenContractAddress​string · required

Token contract address.

Example: 0x6982508145454ce325ddbe47a25d4ec3d2311933
tagFilter​integer · enum · int32

Address tag filter, single selection only. Returns all top profit addresses (by realized PnL descending) when omitted; returns addresses matching the specified tag when provided. Mapping: 1=KOL, 2=Developer, 3=Smart Money, 4=Insider, 5=Sniper, 6=Bundler, 7=Whale Holder.

Enum values:
1
2
3
4
5
6
7
Example: 1
Get Top Traders ›
Responses
200
401
403
404

Top traders returned successfully.

code​integer · int32
Example: 0
msg​string
Example: success
data​object[]

Top profit-making address list.

holderWalletAddress​string

Trader wallet address.

Example: 0x28c6c06298d514db089934071355e5743bf21d60
holdAmount​string

Current holding amount.

Example: 18580000
holdingPercent​string

Current holding percentage. "3.5" means 3.5%.

Example: 3.5
boughtAmount​string

Total bought amount (token units).

Example: 25000000
avgBuyPrice​string

Average buy price, denominated in USD.

Example: 0.000105
soldAmount​string

Total sold amount (token units).

Example: 20000000
avgSellPrice​string

Average sell price, denominated in USD.

Example: 0.000195
maxHoldAmount​string

Maximum historical holding amount.

Example: 30000000
lastTradeTime​integer · int64

Time of the holder's last trade of this token, Unix millisecond timestamp.

Example: 1716892020000
realizedPnlUsd​string

Realized PnL, denominated in USD. Positive means profit, negative means loss.

Example: 1800.30
fundingSource​string | null

Funding source address, i.e., the originator of the first inbound native-token transfer. Null when no inbound transfer is recorded.

Example: 0x21a31ee1afc51d94c2efccaa2092ad1028285549
fundingSourceLabel​object | null

Funding source label (e.g. exchange tag). Null when unknown.

fundingSourceHash​string | null

Transaction hash of the first inbound native-token transfer.

Example: 0x3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b
fundingSourceTime​integer | null · int64

Time of the first native token inbound transfer, Unix millisecond timestamp.

Example: 1714000000000
fundingSourceAmount​string | null

Amount of the first native token inbound transfer. e.g. 0.5 means 0.5 ETH.

Example: 0.5
timestamp​integer · int64
Example: 1748601600000
success​boolean
Example: true
GET/api/v1/dex/market/token/top-trader
Loading…
curl --request GET \
  --url 'https://web3.binance.com/build/api/v1/dex/market/token/top-trader?binanceChainId=%3Cstring%3E&tokenContractAddress=%3Cstring%3E' \
  --header 'X-OC-APIKEY: <string>' \
  --header 'X-OC-SIGN: <string>' \
  --header 'X-OC-TIMESTAMP: <string>'
Example Responses
200
401
403
404
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "holderWalletAddress": "0x28c6c06298d514db089934071355e5743bf21d60",
      "holdAmount": "18580000",
      "holdingPercent": "3.5",
      "boughtAmount": "25000000",
      "avgBuyPrice": "0.000105",
      "soldAmount": "20000000",
      "avgSellPrice": "0.000195",
      "maxHoldAmount": "30000000",
      "lastTradeTime": 1716892020000,
      "realizedPnlUsd": "1800.30",
      "fundingSource": "0x21a31ee1afc51d94c2efccaa2092ad1028285549",
      "fundingSourceLabel": {
        "tagName": "cex",
        "tagValue": "Binance"
      },
      "fundingSourceHash": "0x3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
      "fundingSourceTime": 1714000000000,
      "fundingSourceAmount": "0.5"
    }
  ],
  "timestamp": 1748601600000,
  "success": true
}
json
application/json
Get Top Liquidity Pools

Return the top liquidity pools for a token, including pool name, protocol, liquidity in USD, pool address, and per-token composition.

GET
/api/v1/dex/market/token/top-liquidity
https://web3.binance.com/build
Get Top Liquidity Pools ›
Authorization
This is a signed endpoint and a signature must be included in the request headers.Learn more about how to generate a valid signature in the Authentication.
Get Top Liquidity Pools ›
Headers
X-OC-APIKEY​string · required

API Key issued by Binance Web3 API for authentication.

Example: your-api-key-here
X-OC-TIMESTAMP​string · required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example: 2026-05-11T10:08:57.715Z
X-OC-SIGN​string · required

Request signature (Base64-encoded).

Example: Base64EncodedSignature==
X-OC-RECV-WINDOW​integer · int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example: 5000
X-OC-NONCE​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example: unique-nonce-string
Get Top Liquidity Pools ›
Query Parameters
binanceChainId​string · required

Unique chain identifier.

Example: 1
tokenContractAddress​string · required

Token contract address.

Example: 0x6982508145454ce325ddbe47a25d4ec3d2311933
Get Top Liquidity Pools ›
Responses
200
401
403
404

Top liquidity pools returned successfully.

code​integer · int32
Example: 0
msg​string
Example: success
data​object[]

Liquidity pool list.

pool​string

Pool name, e.g. "PEPE/WETH".

Example: PEPE/WETH
protocolName​string | null

DEX protocol name. Null when unknown.

Example: Uniswap V3
protocolLogoUrl​string | null

Protocol logo link. Null when no logo.

Example: https://static.onchainos.com/protocols/uniswap.png
liquidityUsd​string

Pool liquidity, denominated in USD.

Example: 680000.00
poolAddress​string

Pool contract address.

Example: 0x11950d141ecb863f01007add7d1a342041227b58
liquidityAmount​object[]

Detailed information for each token in the pool.

tokenAmount​string

Token amount in the pool.

Example: 1500000000
tokenSymbol​string

Token symbol.

Example: PEPE
tokenName​string

Token full name.

Example: Pepe
tokenContractAddress​string

Token contract address.

Example: 0x6982508145454ce325ddbe47a25d4ec3d2311933
tokenLogoUrl​string | null

Token logo link. Null when no logo.

Example: https://static.onchainos.com/tokens/pepe.png
timestamp​integer · int64
Example: 1748601600000
success​boolean
Example: true
GET/api/v1/dex/market/token/top-liquidity
Loading…
curl --request GET \
  --url 'https://web3.binance.com/build/api/v1/dex/market/token/top-liquidity?binanceChainId=%3Cstring%3E&tokenContractAddress=%3Cstring%3E' \
  --header 'X-OC-APIKEY: <string>' \
  --header 'X-OC-SIGN: <string>' \
  --header 'X-OC-TIMESTAMP: <string>'
Example Responses
200
401
403
404
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "pool": "PEPE/WETH",
      "protocolName": "Uniswap V3",
      "protocolLogoUrl": "https://static.onchainos.com/protocols/uniswap.png",
      "liquidityUsd": "680000.00",
      "poolAddress": "0x11950d141ecb863f01007add7d1a342041227b58",
      "liquidityAmount": [
        {
          "tokenAmount": "1500000000",
          "tokenSymbol": "PEPE",
          "tokenName": "Pepe",
          "tokenContractAddress": "0x6982508145454ce325ddbe47a25d4ec3d2311933",
          "tokenLogoUrl": "https://static.onchainos.com/tokens/pepe.png"
        }
      ]
    }
  ],
  "timestamp": 1748601600000,
  "success": true
}
json
application/json
Get Token Trades

Return on-chain trade history for a token. Supports tag filtering and wallet address filtering.

GET
/api/v1/dex/market/trades
https://web3.binance.com/build
Get Token Trades ›
Authorization
This is a signed endpoint and a signature must be included in the request headers.Learn more about how to generate a valid signature in the Authentication.
Get Token Trades ›
Headers
X-OC-APIKEY​string · required

API Key issued by Binance Web3 API for authentication.

Example: your-api-key-here
X-OC-TIMESTAMP​string · required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example: 2026-05-11T10:08:57.715Z
X-OC-SIGN​string · required

Request signature (Base64-encoded).

Example: Base64EncodedSignature==
X-OC-RECV-WINDOW​integer · int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example: 5000
X-OC-NONCE​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example: unique-nonce-string
Get Token Trades ›
Query Parameters
binanceChainId​string · required

Unique chain identifier.

Example: 1
tokenContractAddress​string · required

Token contract address.

Example: 0x6982508145454ce325ddbe47a25d4ec3d2311933
cursor​string

Pagination cursor. Do not pass on the first request; pass the cursor value from the previous response to get the next page.

Example: eyJ0aW1lIjoxNzQ4NjAwMDAwMDAwLCJpZCI6MTIzfQ==
limit​integer · int32 · min: 1 · max: 500

Number of results per page, maximum 500, defaults to 100.

Example: 100
Default: 100
tagFilter​integer · enum · int32

Address tag filter, single selection only. Returns all trades with pagination when omitted; returns only the latest 100 trades for the specified tag's addresses when provided (cursor and limit are ignored). Mapping: 1=KOL, 2=Developer, 3=Smart Money, 4=Insider, 5=Sniper, 6=Bundler, 7=Whale Holder.

Enum values:
1
2
3
4
5
6
7
Example: 1
walletAddressFilter​string

Filter by specific wallet addresses. Separate multiple addresses with commas. Up to 2 addresses.

Example: 0x28c6c06298d514db089934071355e5743bf21d60
Get Token Trades ›
Responses
200
401
403
404

Trade history returned successfully.

code​integer · int32
Example: 0
msg​string
Example: success
data​object
cursor​string

Cursor for the next page. Empty string when no more data.

Example: eyJ0aW1lIjoxNzQ4NTk5MDAwMDAwLCJpZCI6Nzh9
trades​object[]

Trades sorted by trade time (descending).

binanceChainId​string

Chain identifier.

Example: 1
tokenContractAddress​string

Token contract address.

Example: 0x6982508145454ce325ddbe47a25d4ec3d2311933
txHash​string

On-chain transaction hash.

Example: 0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890
userAddress​string

Trader wallet address.

Example: 0x28c6c06298d514db089934071355e5743bf21d60
dexName​string

Name of the DEX protocol where the trade was executed.

Example: Uniswap V3
type​string · enum

Trade direction relative to the queried token. "buy" or "sell".

Enum values:
buy
sell
Example: buy
price​string

Trade price, denominated in USD.

Example: 0.00000702
volume​string

Trade amount, denominated in USD.

Example: 1500.50
time​integer · int64

Trade time, Unix millisecond timestamp.

Example: 1748601600000
changedTokenInfo​object[]

Token details involved in this trade. [0] = queried token; [1] = paired token.

amount​string

Token amount traded.

Example: 1500000
tokenSymbol​string

Token symbol.

Example: PEPE
tokenContractAddress​string

Token contract address.

Example: 0x6982508145454ce325ddbe47a25d4ec3d2311933
timestamp​integer · int64
Example: 1748601600000
success​boolean
Example: true
GET/api/v1/dex/market/trades
Loading…
curl --request GET \
  --url 'https://web3.binance.com/build/api/v1/dex/market/trades?binanceChainId=%3Cstring%3E&tokenContractAddress=%3Cstring%3E' \
  --header 'X-OC-APIKEY: <string>' \
  --header 'X-OC-SIGN: <string>' \
  --header 'X-OC-TIMESTAMP: <string>'
Example Responses
200
401
403
404
{
  "code": 0,
  "msg": "success",
  "data": {
    "cursor": "eyJ0aW1lIjoxNzQ4NTk5MDAwMDAwLCJpZCI6Nzh9",
    "trades": [
      {
        "binanceChainId": "1",
        "tokenContractAddress": "0x6982508145454ce325ddbe47a25d4ec3d2311933",
        "txHash": "0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890",
        "userAddress": "0x28c6c06298d514db089934071355e5743bf21d60",
        "dexName": "Uniswap V3",
        "type": "buy",
        "price": "0.00000702",
        "volume": "1500.50",
        "time": 1748601600000,
        "changedTokenInfo": [
          {
            "amount": "1500000",
            "tokenSymbol": "PEPE",
            "tokenContractAddress": "0x6982508145454ce325ddbe47a25d4ec3d2311933"
          }
        ]
      }
    ]
  },
  "timestamp": 1748601600000,
  "success": true
}
json
application/json
Get Token Dev Info

Return developer profile for a token, including historical token launch stats, current holding percentage, and initial funding source.

GET
/api/v1/dex/market/memepump/tokenDevInfo
https://web3.binance.com/build
Get Token Dev Info ›
Authorization
This is a signed endpoint and a signature must be included in the request headers.Learn more about how to generate a valid signature in the Authentication.
Get Token Dev Info ›
Headers
X-OC-APIKEY​string · required

API Key issued by Binance Web3 API for authentication.

Example: your-api-key-here
X-OC-TIMESTAMP​string · required

Current UTC time in ISO 8601 format with milliseconds, e.g. 2026-05-11T10:08:57.715Z.

Example: 2026-05-11T10:08:57.715Z
X-OC-SIGN​string · required

Request signature (Base64-encoded).

Example: Base64EncodedSignature==
X-OC-RECV-WINDOW​integer · int64

Allowed time deviation in milliseconds (default: 5000, max: 60000).

Example: 5000
X-OC-NONCE​string

Unique request identifier for anti-replay; falls back to X-OC-SIGN if omitted.

Example: unique-nonce-string
Get Token Dev Info ›
Query Parameters
binanceChainId​string · required

Unique chain identifier (e.g. "1"=Ethereum, "56"=BSC, "CT_501"=Solana).

Example: CT_501
tokenContractAddress​string · required

Token contract address. EVM chains accept lowercase 42-character hex addresses; Solana accepts base58 addresses (case-sensitive).

Example: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
Get Token Dev Info ›
Responses
200
401
403
404

Token dev info returned successfully.

code​integer · int32

Business status code. 0 indicates success.

Example: 0
msg​string
Example: success
data​object

Token developer information.

Token developer information.
devLaunchedInfo​object

Historical token launch summary for this developer.

Historical token launch summary for this developer.
totalToken​string

Total number of tokens launched by this developer via launch platforms.

Example: 5
migratedCount​string

Number of tokens successfully migrated to external DEX by this developer.

Example: 1
devHoldingInfo​object

Developer's current holding information for this token.

Developer's current holding information for this token.
devHoldingPercent​string

Developer's current holding percentage for this token. No percent sign included. Empty string means fully sold.

Example: 2.5
devAddress​string

Developer (creator) wallet address.

Example: 0x382bb369d343125bfb2117af9c149795c6c65c50
fundingSource​string

Funding source address — the originator of the first inbound native-token transfer. Empty string when no inbound transfer is recorded.

Example: 0x28c6c06298d514db089934071355e5743bf21d60
fundingSourceLabel​string

Funding source name (e.g. exchange name). Empty string when unknown.

Example: Binance
fundingSourceHash​string

Transaction hash of the first inbound native-token transfer.

Example: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
fundingSourceTime​string

Timestamp of the first inbound native-token transfer, Unix millisecond timestamp.

Example: 1777117516000
fundingSourceAmount​string

Amount of the first inbound native-token transfer (native token units).

Example: 1.5
devBalance​string

Developer wallet's native token balance (e.g. SOL). Empty string when unavailable.

Example: 10.5
timestamp​integer · int64
Example: 1748601600000
success​boolean
Example: true
GET/api/v1/dex/market/memepump/tokenDevInfo
Loading…
curl --request GET \
  --url 'https://web3.binance.com/build/api/v1/dex/market/memepump/tokenDevInfo?binanceChainId=%3Cstring%3E&tokenContractAddress=%3Cstring%3E' \
  --header 'X-OC-APIKEY: <string>' \
  --header 'X-OC-SIGN: <string>' \
  --header 'X-OC-TIMESTAMP: <string>'
Example Responses
200
401
403
404
{
  "code": 0,
  "msg": "success",
  "data": {
    "devLaunchedInfo": {
      "totalToken": "5",
      "migratedCount": "1"
    },
    "devHoldingInfo": {
      "devHoldingPercent": "2.5",
      "devAddress": "0x382bb369d343125bfb2117af9c149795c6c65c50",
      "fundingSource": "0x28c6c06298d514db089934071355e5743bf21d60",
      "fundingSourceLabel": "Binance",
      "fundingSourceHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "fundingSourceTime": "1777117516000",
      "fundingSourceAmount": "1.5",
      "devBalance": "10.5"
    }
  },
  "timestamp": 1748601600000,
  "success": true
}
json
application/json
Resources
Announcements
Terms
Privacy
Support
24/7 Chat Support
Support Center
Product Feedback
Fees
Agent Native
llms.txt
llms-full.txt
Agent Native

© 2026 Binance. All rights reserved.
