import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizationId, b402ConfigFromEnv, priceUsd, type PaymentPayload } from "./b402.js";

const base = {
  BINANCE_WEB3_API_KEY: "k",
  BINANCE_WEB3_API_SECRET: "s",
  ANALYST_PAY_TO: "0x66A4c73e7C02858B49F15fBC24589A76B97C0F5a",
  ANALYST_PAYMENT_ASSET: "0x55d398326f99059fF775485246999027B3197955",
  ANALYST_PAYMENT_METHOD: "permit2-exact",
};
const U = "0xcE24439F2D9C6a2289F741120FE202248B666666";

test("no alternate configured → single option", () => {
  const { config, problems } = b402ConfigFromEnv(base);
  assert.deepEqual(problems, []);
  assert.deepEqual(config?.alternates, []);
});

test("alternate defaults to eip3009", () => {
  const { config } = b402ConfigFromEnv({ ...base, ANALYST_PAYMENT_ALT_ASSET: U });
  assert.deepEqual(config?.alternates, [{ asset: U, method: "eip3009", tokenName: undefined }]);
});

test("invalid or duplicate alternates are reported, not guessed", () => {
  assert.match(b402ConfigFromEnv({ ...base, ANALYST_PAYMENT_ALT_ASSET: "0x123" }).problems.join(), /ALT_ASSET is not an EVM address/);
  const dup = b402ConfigFromEnv({ ...base, ANALYST_PAYMENT_ALT_ASSET: base.ANALYST_PAYMENT_ASSET, ANALYST_PAYMENT_ALT_METHOD: "permit2-exact" });
  assert.match(dup.problems.join(), /duplicates the primary/);
});

test("U is priced as an 18-decimal dollar stablecoin", () => {
  assert.equal(priceUsd(U, "10000000000000000"), 0.01);
});

test("replay key does not depend on key order inside the signed payload", () => {
  const accepted = { scheme: "exact", network: "eip155:56", amount: "1", asset: "0xa", payTo: "0xb", maxTimeoutSeconds: 300, extra: {} };
  const p1: PaymentPayload = { x402Version: 2, accepted, payload: { signature: "0xsig", authorization: { from: "0x1", to: "0x2", value: "1", nonce: "0x9" } } };
  const p2: PaymentPayload = { x402Version: 2, accepted, payload: { authorization: { nonce: "0x9", value: "1", to: "0x2", from: "0x1" }, signature: "0xsig" } };
  assert.notEqual(JSON.stringify(p1.payload), JSON.stringify(p2.payload));
  assert.equal(authorizationId(p1), authorizationId(p2));
  assert.match(authorizationId(p1), /^[0-9a-f]{64}$/);
  const p3: PaymentPayload = { ...p1, payload: { ...p1.payload, signature: "0xother" } };
  assert.notEqual(authorizationId(p1), authorizationId(p3));
});
