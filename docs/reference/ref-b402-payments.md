Title: B402 Payments - Binance Web3 API

URL Source: https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments

Published Time: Thu, 01 Oct 2026 09:02:41 GMT

Markdown Content:
Binance Web3 API

* * *

## Get B402 Supported Configurations V2[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#get-b402-supported-configurations-v2)

Return the live x402 V2 payment kinds available to the authenticated Developer Portal project. Use the result to construct HTTP 402 payment requirements. Copy the selected `extra` object verbatim and refresh cached configuration periodically.

POST
/api/v2/b402/supported

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

### Get B402 Supported Configurations V2 ›Request Body[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#get-b402-supported-configurations-v2/request-body)

`body`

​object·required

### Get B402 Supported Configurations V2 ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#get-b402-supported-configurations-v2/responses)

Supported configurations returned, or a B402 business error envelope.

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
|  | type = object |
|  | type = object |

**Properties for Variant 1:**

`status`

​string

Example:OK

`type`

​string

Example:GENERAL

`code`

​string

Example:000000000

`errorData`

​string | null

Example:null

​object

`subData`

​object | null

Example:null

`params`

​object | null

Example:null

* * *

## Verify B402 Payment V2[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#verify-b402-payment-v2)

Validate an x402 V2 payment authorization off-chain without spending funds or broadcasting a transaction. Portal identity is resolved from the authenticated API Key project; omit `merchantId`. A validation failure is returned as HTTP 200 with `data.isValid=false`.

POST
/api/v2/b402/verify

https://web3.binance.com/build

### Verify B402 Payment V2 ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#verify-b402-payment-v2/authorization)

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

### Verify B402 Payment V2 ›Request Body[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#verify-b402-payment-v2/request-body)

​object·required

`x402Version`

​integer·enum·required

Enum values:

2

​object·required

`x402Version`

​integer·enum·required

Enum values:

2

​object·required

`url`

​string·uri·required

Example:https://merchant.example.com/weather

`description`

​string

Example:Premium weather report

`mimeType`

​string

Example:application/json

​object·required

`scheme`

​string·enum·required

Enum values:

exact

upto

`network`

​string·required

Example:eip155:56

`amount`

​string·pattern: `^[0-9]+$`·required

Example:1000000

`asset`

​string·required

Example:0x1111111111111111111111111111111111111111

`payTo`

​string·required

Example:0x2222222222222222222222222222222222222222

`maxTimeoutSeconds`

​integer·required

Example:300

​object·required

`name`

​string·required

Example:Token Name

`version`

​string·required

Example:1

`assetTransferMethod`

​string·enum·required

Enum values:

eip3009

permit2-exact

permit2-upto

`signerAddress`

​string·required

Example:0x3333333333333333333333333333333333333333

`spenderAddress`

​string | null

Example:0x4444444444444444444444444444444444444444

​object·required

`signature`

​string·required

Example:0xabcdef...

​object

`from`

​string·required

Example:0x5555555555555555555555555555555555555555

`to`

​string·required

Example:0x2222222222222222222222222222222222222222

`value`

​string·required

Example:1000000

`validAfter`

​string·required

Example:0

`validBefore`

​string·required

Example:1780000000

`nonce`

​string·required

Example:0x0000000000000000000000000000000000000000000000000000000000000001

​object

​object·required

`token`

​string·required

Example:0x1111111111111111111111111111111111111111

`amount`

​string·required

Example:1000000

`from`

​string·required

Example:0x5555555555555555555555555555555555555555

`spender`

​string·required

Example:0x4444444444444444444444444444444444444444

`nonce`

​string·required

Example:123456789

`deadline`

​string·required

Example:1780000000

​object·required

`to`

​string·required

Example:0x2222222222222222222222222222222222222222

`validAfter`

​string·required

Example:0

`facilitator`

​string | null

Example:0x3333333333333333333333333333333333333333

​object

​object

​object·required

Example:{"input":{"type":"http","method":"GET"}}

​object·required

Example:{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"input":{"type":"object","properties":{"type":{"const":"http"},"method":{"enum":["GET"]}},"required":["type","method"]}},"required":["input"]}

`routeTemplate`

​string

Example:/v1/weather/:city

`description`

​string

Example:Hourly weather forecast by city

​object·required

`scheme`

​string·enum·required

Enum values:

exact

upto

`network`

​string·required

Example:eip155:56

`amount`

​string·pattern: `^[0-9]+$`·required

Example:1000000

`asset`

​string·required

Example:0x1111111111111111111111111111111111111111

`payTo`

​string·required

Example:0x2222222222222222222222222222222222222222

`maxTimeoutSeconds`

​integer·required

Example:300

​object·required

`name`

​string·required

Example:Token Name

`version`

​string·required

Example:1

`assetTransferMethod`

​string·enum·required

Enum values:

eip3009

permit2-exact

permit2-upto

`signerAddress`

​string·required

Example:0x3333333333333333333333333333333333333333

`spenderAddress`

​string | null

Example:0x4444444444444444444444444444444444444444

### Verify B402 Payment V2 ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#verify-b402-payment-v2/responses)

Verification result, or a B402 business error envelope.

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
|  | type = object |
|  | type = object |

**Properties for Variant 1:**

`status`

​string

Example:OK

`type`

​string

Example:GENERAL

`code`

​string

Example:000000000

`errorData`

​string | null

Example:null

​object

`subData`

​object | null

Example:null

`params`

​object | null

Example:null

* * *

## Settle B402 Payment V2[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#settle-b402-payment-v2)

Submit a verified x402 V2 authorization on-chain. This operation can move real funds and is irreversible. For `permit2-upto`, provide `settleAmount` in atomic units. Business failure is returned as HTTP 200 with `data.success=false`; reconcile any non-empty transaction hash before retrying.

POST
/api/v2/b402/settle

https://web3.binance.com/build

### Settle B402 Payment V2 ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#settle-b402-payment-v2/authorization)

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

### Settle B402 Payment V2 ›Request Body[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#settle-b402-payment-v2/request-body)

​object·required

`x402Version`

​integer·enum·required

Enum values:

2

​object·required

`x402Version`

​integer·enum·required

Enum values:

2

​object·required

`url`

​string·uri·required

Example:https://merchant.example.com/weather

`description`

​string

Example:Premium weather report

`mimeType`

​string

Example:application/json

​object·required

`scheme`

​string·enum·required

Enum values:

exact

upto

`network`

​string·required

Example:eip155:56

`amount`

​string·pattern: `^[0-9]+$`·required

Example:1000000

`asset`

​string·required

Example:0x1111111111111111111111111111111111111111

`payTo`

​string·required

Example:0x2222222222222222222222222222222222222222

`maxTimeoutSeconds`

​integer·required

Example:300

​object·required

`name`

​string·required

Example:Token Name

`version`

​string·required

Example:1

`assetTransferMethod`

​string·enum·required

Enum values:

eip3009

permit2-exact

permit2-upto

`signerAddress`

​string·required

Example:0x3333333333333333333333333333333333333333

`spenderAddress`

​string | null

Example:0x4444444444444444444444444444444444444444

​object·required

`signature`

​string·required

Example:0xabcdef...

​object

`from`

​string·required

Example:0x5555555555555555555555555555555555555555

`to`

​string·required

Example:0x2222222222222222222222222222222222222222

`value`

​string·required

Example:1000000

`validAfter`

​string·required

Example:0

`validBefore`

​string·required

Example:1780000000

`nonce`

​string·required

Example:0x0000000000000000000000000000000000000000000000000000000000000001

​object

​object·required

`token`

​string·required

Example:0x1111111111111111111111111111111111111111

`amount`

​string·required

Example:1000000

`from`

​string·required

Example:0x5555555555555555555555555555555555555555

`spender`

​string·required

Example:0x4444444444444444444444444444444444444444

`nonce`

​string·required

Example:123456789

`deadline`

​string·required

Example:1780000000

​object·required

`to`

​string·required

Example:0x2222222222222222222222222222222222222222

`validAfter`

​string·required

Example:0

`facilitator`

​string | null

Example:0x3333333333333333333333333333333333333333

​object

​object

​object·required

Example:{"input":{"type":"http","method":"GET"}}

​object·required

Example:{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"input":{"type":"object","properties":{"type":{"const":"http"},"method":{"enum":["GET"]}},"required":["type","method"]}},"required":["input"]}

`routeTemplate`

​string

Example:/v1/weather/:city

`description`

​string

Example:Hourly weather forecast by city

​object·required

`scheme`

​string·enum·required

Enum values:

exact

upto

`network`

​string·required

Example:eip155:56

`amount`

​string·pattern: `^[0-9]+$`·required

Example:1000000

`asset`

​string·required

Example:0x1111111111111111111111111111111111111111

`payTo`

​string·required

Example:0x2222222222222222222222222222222222222222

`maxTimeoutSeconds`

​integer·required

Example:300

​object·required

`name`

​string·required

Example:Token Name

`version`

​string·required

Example:1

`assetTransferMethod`

​string·enum·required

Enum values:

eip3009

permit2-exact

permit2-upto

`signerAddress`

​string·required

Example:0x3333333333333333333333333333333333333333

`spenderAddress`

​string | null

Example:0x4444444444444444444444444444444444444444

`settleAmount`

​string·pattern: `^[0-9]+$`

Example:750000

### Settle B402 Payment V2 ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#settle-b402-payment-v2/responses)

Settlement result, or a B402 business error envelope.

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
|  | type = object |
|  | type = object |

**Properties for Variant 1:**

`status`

​string

Example:OK

`type`

​string

Example:GENERAL

`code`

​string

Example:000000000

`errorData`

​string | null

Example:null

​object

`subData`

​object | null

Example:null

`params`

​object | null

Example:null

* * *

## Get B402 Supported Configurations V1[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#get-b402-supported-configurations-v1)

Legacy V1 compatibility endpoint. New integrations should use V2. V1 returns `x402Version=1`, method-specific `facilitatorAddress`, and V1 signer-map semantics.

POST
/api/v1/b402/supported

https://web3.binance.com/build

### Get B402 Supported Configurations V1 ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#get-b402-supported-configurations-v1/authorization)

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

### Get B402 Supported Configurations V1 ›Request Body[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#get-b402-supported-configurations-v1/request-body)

`body`

​object·required

### Get B402 Supported Configurations V1 ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#get-b402-supported-configurations-v1/responses)

Legacy supported configurations or a B402 business error envelope.

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
|  | type = object |
|  | type = object |

**Properties for Variant 1:**

`status`

​string

Example:OK

`type`

​string

Example:GENERAL

`code`

​string

Example:000000000

`errorData`

​string | null

Example:null

​object

`subData`

​object | null

Example:null

`params`

​object | null

Example:null

* * *

## Verify B402 Payment V1[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#verify-b402-payment-v1)

Legacy V1 off-chain verification endpoint. New integrations should use V2. Portal identity is resolved from the API Key project, so `merchantId` is omitted from the external request.

POST
/api/v1/b402/verify

https://web3.binance.com/build

### Verify B402 Payment V1 ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#verify-b402-payment-v1/authorization)

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

### Verify B402 Payment V1 ›Request Body[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#verify-b402-payment-v1/request-body)

​object·required

`x402Version`

​integer·enum·required

Enum values:

1

​object·required

`x402Version`

​integer·enum·required

Enum values:

1

`scheme`

​string·enum·required

Enum values:

exact

Example:exact

`network`

​string·required

Example:eip155:56

​object·required

`signature`

​string·required

Example:0xabcdef...

​object

`from`

​string·required

Example:0x5555555555555555555555555555555555555555

`to`

​string·required

Example:0x2222222222222222222222222222222222222222

`value`

​string·required

Example:1000000

`validAfter`

​string·required

Example:0

`validBefore`

​string·required

Example:1780000000

`nonce`

​string·required

Example:0x0000000000000000000000000000000000000000000000000000000000000001

​object

​object·required

`token`

​string·required

Example:0x1111111111111111111111111111111111111111

`amount`

​string·required

Example:1000000

`from`

​string·required

Example:0x5555555555555555555555555555555555555555

`spender`

​string·required

Example:0x4444444444444444444444444444444444444444

`nonce`

​string·required

Example:123456789

`deadline`

​string·required

Example:1780000000

​object·required

`to`

​string·required

Example:0x2222222222222222222222222222222222222222

`validAfter`

​string·required

Example:0

`facilitator`

​string | null

Example:0x3333333333333333333333333333333333333333

​object·required

`scheme`

​string·enum·required

Enum values:

exact

Example:exact

`network`

​string·required

Example:eip155:56

`amount`

​string·required

Example:1000000

`payTo`

​string·required

Example:0x2222222222222222222222222222222222222222

`asset`

​string·required

Example:0x1111111111111111111111111111111111111111

`maxTimeoutSeconds`

​integer·required

Example:300

`resource`

​string·uri

Example:https://merchant.example.com/weather

`description`

​string

Example:Premium weather report

`mimeType`

​string

Example:application/json

​object

Example:{"type":"object"}

​object

`name`

​string

Example:Token Name

`version`

​string

Example:1

`assetTransferMethod`

​string·enum

Enum values:

eip3009

permit2-exact

permit2-upto

`facilitatorAddress`

​string

Example:0x3333333333333333333333333333333333333333

### Verify B402 Payment V1 ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#verify-b402-payment-v1/responses)

Legacy verification result or a B402 business error envelope.

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
|  | type = object |
|  | type = object |

**Properties for Variant 1:**

`status`

​string

Example:OK

`type`

​string

Example:GENERAL

`code`

​string

Example:000000000

`errorData`

​string | null

Example:null

​object

`subData`

​object | null

Example:null

`params`

​object | null

Example:null

* * *

## Settle B402 Payment V1[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#settle-b402-payment-v1)

Legacy V1 on-chain settlement endpoint. New integrations should use V2. This operation can move real funds and is irreversible. V1 additionally returns `confirmations` in the settlement result.

POST
/api/v1/b402/settle

https://web3.binance.com/build

### Settle B402 Payment V1 ›Authorization[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#settle-b402-payment-v1/authorization)

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

### Settle B402 Payment V1 ›Request Body[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#settle-b402-payment-v1/request-body)

​object·required

`x402Version`

​integer·enum·required

Enum values:

1

​object·required

`x402Version`

​integer·enum·required

Enum values:

1

`scheme`

​string·enum·required

Enum values:

exact

Example:exact

`network`

​string·required

Example:eip155:56

​object·required

`signature`

​string·required

Example:0xabcdef...

​object

`from`

​string·required

Example:0x5555555555555555555555555555555555555555

`to`

​string·required

Example:0x2222222222222222222222222222222222222222

`value`

​string·required

Example:1000000

`validAfter`

​string·required

Example:0

`validBefore`

​string·required

Example:1780000000

`nonce`

​string·required

Example:0x0000000000000000000000000000000000000000000000000000000000000001

​object

​object·required

`token`

​string·required

Example:0x1111111111111111111111111111111111111111

`amount`

​string·required

Example:1000000

`from`

​string·required

Example:0x5555555555555555555555555555555555555555

`spender`

​string·required

Example:0x4444444444444444444444444444444444444444

`nonce`

​string·required

Example:123456789

`deadline`

​string·required

Example:1780000000

​object·required

`to`

​string·required

Example:0x2222222222222222222222222222222222222222

`validAfter`

​string·required

Example:0

`facilitator`

​string | null

Example:0x3333333333333333333333333333333333333333

​object·required

`scheme`

​string·enum·required

Enum values:

exact

Example:exact

`network`

​string·required

Example:eip155:56

`amount`

​string·required

Example:1000000

`payTo`

​string·required

Example:0x2222222222222222222222222222222222222222

`asset`

​string·required

Example:0x1111111111111111111111111111111111111111

`maxTimeoutSeconds`

​integer·required

Example:300

`resource`

​string·uri

Example:https://merchant.example.com/weather

`description`

​string

Example:Premium weather report

`mimeType`

​string

Example:application/json

​object

Example:{"type":"object"}

​object

`name`

​string

Example:Token Name

`version`

​string

Example:1

`assetTransferMethod`

​string·enum

Enum values:

eip3009

permit2-exact

permit2-upto

`facilitatorAddress`

​string

Example:0x3333333333333333333333333333333333333333

`settleAmount`

​string·pattern: `^[0-9]+$`

Example:750000

### Settle B402 Payment V1 ›Responses[](https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/b402-payments#settle-b402-payment-v1/responses)

Legacy settlement result or a B402 business error envelope.

oneOf

Exactly one variant **must match**.

#### Decision Table

| Variant | Matching Criteria |
| --- | --- |
|  | type = object |
|  | type = object |

**Properties for Variant 1:**

`status`

​string

Example:OK

`type`

​string

Example:GENERAL

`code`

​string

Example:000000000

`errorData`

​string | null

Example:null

​object

`subData`

​object | null

Example:null

`params`

​object | null

Example:null

* * *
