import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { buildQuery, sign } from "./sign.js";

test("query encoding matches the doc example (space -> %20)", () => {
  assert.equal(buildQuery({ chainId: 1, symbol: "ETH USDT" }), "?chainId=1&symbol=ETH%20USDT");
  assert.equal(buildQuery({ a: undefined }), "");
});

test("signature is base64 HMAC-SHA256 over the documented preHash", () => {
  const ts = "2026-05-11T10:08:57.715Z";
  const path = "/build/api/v1/dex/market/price?chainId=1&symbol=ETH%20USDT";
  const expected = createHmac("sha256", "secret")
    .update(`${ts}GET${path}`, "utf8")
    .digest("base64");
  assert.equal(sign("secret", ts, "get", path, ""), expected);
});
