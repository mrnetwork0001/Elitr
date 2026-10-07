import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, keccak256, stringToHex, toFunctionSelector, zeroHash } from "viem";
import { reputationRegistryAbi } from "./abi.js";
import { KNOWN_REGISTRIES, loadConfig, isConfigured, ownerKeyFor } from "./config.js";
import { giveFeedbackArgs, identityFromEnv, toFixedPoint } from "./identity.js";
import { buildRegistrationFile, fromDataUri, REGISTRATION_TYPE, baseUrlFromEnv } from "./registration.js";

const ANVIL0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const CLIENT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;

test("registration file follows ERC-8004 registration-v1", () => {
  const f = buildRegistrationFile("analyst", { baseUrl: "https://a.example/" });
  assert.equal(f.type, REGISTRATION_TYPE);
  for (const k of ["name", "description", "image", "services", "x402Support", "active", "registrations", "supportedTrust"]) {
    assert.ok(k in f, `missing ${k}`);
  }
  assert.deepEqual(f.supportedTrust, ["reputation"]);
  assert.equal(f.x402Support, true);
  assert.deepEqual(f.registrations, []);
  const names = f.services.map((s) => s.name);
  assert.deepEqual(names, ["web", "x402", "info", "registration"]);
  assert.equal(f.services.find((s) => s.name === "x402")!.endpoint, "https://a.example/signal");
  assert.equal(f.services.find((s) => s.name === "info")!.endpoint, "https://a.example/info");
  for (const s of f.services) assert.ok(s.name && s.endpoint);
});

test("registration file fills registrations once minted", () => {
  const f = buildRegistrationFile("execution", {
    baseUrl: "http://localhost:4002",
    agentId: 42n,
    chainId: 56,
    identityRegistry: KNOWN_REGISTRIES[56]!.identity,
  });
  assert.equal(f.x402Support, false);
  assert.deepEqual(f.registrations, [{ agentId: 42, agentRegistry: `eip155:56:${KNOWN_REGISTRIES[56]!.identity}` }]);
  assert.ok(f.services.some((s) => s.name === "events"));
  assert.throws(() => buildRegistrationFile("analyst", { baseUrl: "ftp://x" }));
});

test("env parsing: defaults, null when unconfigured, errors on garbage", () => {
  assert.equal(identityFromEnv({}), null);
  assert.equal(isConfigured({ ERC8004_AGENT_ID_ANALYST: "3" }), true);
  const cfg = loadConfig({ ERC8004_AGENT_ID_ANALYST: "3", ERC8004_AGENT_ID_ANALYST_FLOW: " 7 ", BSC_RPC_URL: "http://rpc.example" });
  assert.equal(cfg.chainId, 56);
  assert.equal(cfg.rpcUrl, "http://rpc.example");
  assert.equal(cfg.identityRegistry, KNOWN_REGISTRIES[56]!.identity);
  assert.equal(cfg.reputationRegistry, KNOWN_REGISTRIES[56]!.reputation);
  assert.deepEqual(cfg.agentIds, { analyst: "3", "analyst-flow": "7" });
  assert.equal(cfg.postFeedback, false);
  assert.equal(cfg.inlineFeedbackFile, true);

  const t = loadConfig({ ERC8004_CHAIN_ID: "97" });
  assert.equal(t.identityRegistry, KNOWN_REGISTRIES[97]!.identity);
  assert.throws(() => loadConfig({ ERC8004_CHAIN_ID: "1" }), /ERC8004_RPC_URL|ERC8004_IDENTITY_REGISTRY/);
  assert.throws(() => loadConfig({ ERC8004_AGENT_ID_EXECUTION: "abc" }), /non-negative integer/);
  assert.throws(() => loadConfig({ ERC8004_IDENTITY_REGISTRY: "0x123" }), /valid address/);
  assert.throws(() => loadConfig({ EXECUTION_PRIVATE_KEY: "0xdead" }), /private key/);

  const id = identityFromEnv({ ERC8004_POST_FEEDBACK: "1", EXECUTION_PRIVATE_KEY: ANVIL0, ERC8004_AGENT_ID_EXECUTION: "9" })!;
  assert.ok(id);
  assert.equal(id.canPost, true);
  assert.equal(id.clientAddress, CLIENT);
  assert.equal(id.agentIdOf("execution"), "9");
  assert.equal(id.agentIdOf("analyst"), undefined);
  assert.ok(!("executionKey" in id.config));

  assert.equal(ownerKeyFor("analyst-flow", { ANALYST_OWNER_PRIVATE_KEY: ANVIL0 }).envName, "ANALYST_OWNER_PRIVATE_KEY");
  assert.equal(baseUrlFromEnv("analyst-flow", {}), "http://localhost:4003");
});

test("postFeedback is a no-op when ERC8004_POST_FEEDBACK is off", async () => {
  const id = identityFromEnv({ ERC8004_AGENT_ID_ANALYST: "1" })!;
  const r = await id.postFeedback({ analystId: "analyst", erc8004AgentId: "1", value: 80, tag: "accuracy", signalId: "s" });
  assert.ok(r.skipped);
  assert.equal(r.txHash, undefined);
});

test("value fixed-point conversion", () => {
  assert.deepEqual(toFixedPoint(87), { value: 87n, valueDecimals: 0 });
  assert.deepEqual(toFixedPoint(66.67), { value: 67n, valueDecimals: 0 });
  assert.deepEqual(toFixedPoint(0), { value: 0n, valueDecimals: 0 });
  assert.throws(() => toFixedPoint(101));
  assert.throws(() => toFixedPoint(-1));
  assert.throws(() => toFixedPoint(Number.NaN));
});

test("giveFeedback ABI encoding matches the ERC-8004 signature", () => {
  const sel = toFunctionSelector("giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)");
  const cfg = { chainId: 56, identityRegistry: KNOWN_REGISTRIES[56]!.identity, inlineFeedbackFile: true };
  const at = new Date("2026-10-04T12:00:00.000Z");
  const { args, file, data } = giveFeedbackArgs(
    cfg,
    CLIENT,
    { analystId: "analyst", erc8004AgentId: "12", value: 72.5, tag: "accuracy", signalId: "sig-1", detail: { hits: 29, samples: 40 } },
    at,
  );
  assert.equal(data.slice(0, 10), sel);
  const decoded = decodeFunctionData({ abi: reputationRegistryAbi, data });
  assert.equal(decoded.functionName, "giveFeedback");
  assert.deepEqual(decoded.args, [12n, 73n, 0, "accuracy", "", "", args.feedbackURI, args.feedbackHash]);
  // Off-chain file: MUST fields present, URI is a data: URI of exactly the hashed JSON.
  assert.deepEqual(fromDataUri(args.feedbackURI), file);
  assert.equal(args.feedbackHash, keccak256(stringToHex(JSON.stringify(file))));
  for (const k of ["agentRegistry", "agentId", "clientAddress", "createdAt", "value", "valueDecimals"]) assert.ok(k in file, k);
  assert.equal((file.elitr as { exactValue: number }).exactValue, 72.5);
  assert.equal(file.createdAt, "2026-10-04T12:00:00Z");
  assert.equal(file.clientAddress, `eip155:56:${CLIENT}`);

  const noFile = giveFeedbackArgs({ ...cfg, inlineFeedbackFile: false }, CLIENT, {
    analystId: "analyst-flow",
    erc8004AgentId: "3",
    value: 100,
    tag: "accuracy",
    signalId: "x",
  });
  assert.equal(noFile.args.feedbackURI, "");
  assert.equal(noFile.args.feedbackHash, zeroHash);
  assert.throws(() => giveFeedbackArgs(cfg, CLIENT, { analystId: "analyst", erc8004AgentId: "0x1", value: 1, tag: "t", signalId: "s" }));
});
