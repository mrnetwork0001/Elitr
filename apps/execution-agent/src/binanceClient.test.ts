import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { BinanceApiError, BinanceWeb3Client } from "@elitr/binance";

test("a request the API never answers is rejected with a timeout error", async () => {
  const hung: ServerResponse[] = [];
  const server = createServer((_req, res) => hung.push(res)); // never responds
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const seen: unknown[] = [];
  const client = new BinanceWeb3Client({ apiKey: "k", apiSecret: "s", baseUrl: `http://127.0.0.1:${port}`, timeoutMs: 300, onResponse: (i) => seen.push(i) });

  const t0 = Date.now();
  await assert.rejects(client.call("GET", "/api/v1/dex/market/rwa/tokens"), (e: unknown) => {
    assert.ok(e instanceof BinanceApiError);
    assert.equal(e.code, "timeout");
    assert.match(e.message, /timeout after 300 ms/);
    return true;
  });
  assert.ok(Date.now() - t0 < 2_000);
  assert.deepEqual((seen[0] as any)?.code, "timeout");

  // A per-call timeout overrides the client default.
  const t1 = Date.now();
  await assert.rejects(client.raw("POST", "/x", { body: {}, timeoutMs: 100 }), /timeout after 100 ms/);
  assert.ok(Date.now() - t1 < 1_000);

  for (const r of hung) r.destroy();
  await new Promise<void>((r) => server.close(() => r()));
});
