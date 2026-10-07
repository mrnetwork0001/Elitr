import { createHmac } from "node:crypto";

// Binance Web3 API request signing.
// Spec: https://web3.binance.com/en/dev-docs/authentication (docs/reference/binance-web3-llms-full.txt)
//   preHash   = timestamp + METHOD + requestPath(+ "?" + rawQuery) + body
//   signature = Base64(HMAC-SHA256(secretKey, preHash))
// requestPath MUST include the /build prefix, exactly as sent on the wire.

export function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return "";
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export function sign(secret: string, timestamp: string, method: string, pathWithQuery: string, body: string): string {
  const preHash = `${timestamp}${method.toUpperCase()}${pathWithQuery}${body}`;
  return createHmac("sha256", secret).update(preHash, "utf8").digest("base64");
}
