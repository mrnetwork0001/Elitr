import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  getAddress,
  http,
  keccak256,
  parseEventLogs,
  stringToHex,
  zeroHash,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc, bscTestnet } from "viem/chains";
import type { AgentId, AnalystId } from "@elitr/shared";
import { identityRegistryAbi, reputationRegistryAbi } from "./abi.js";
import { AGENT_ID_ENV, isConfigured, loadConfig, type IdentityConfig } from "./config.js";
import { buildRegistrationFile, toDataUri, type RegistrationOpts } from "./registration.js";

export interface PostFeedbackParams {
  analystId: AnalystId;
  erc8004AgentId: string;
  value: number; // 0-100; rounded to an integer on-chain
  tag: string; // tag1, e.g. "accuracy"
  signalId: string;
  detail?: Record<string, unknown>;
  tag2?: string; // optional; default ""
  endpoint?: string; // optional; e.g. the analyst's /signal URL
}

export interface PostFeedbackResult {
  txHash?: string;
  feedbackIndex?: string; // 1-based per (agentId, client)
  skipped?: string; // set when posting is disabled; nothing was sent
}

export interface Identity {
  agentIdOf(subject: AgentId): string | undefined;
  postFeedback(p: PostFeedbackParams): Promise<PostFeedbackResult>;
  readonly config: Readonly<Omit<IdentityConfig, "executionKey">>;
  /** Address that signs giveFeedback (the trader), if EXECUTION_PRIVATE_KEY is set. */
  readonly clientAddress?: Address;
  /** True when ERC8004_POST_FEEDBACK=1 and a trader key is present. */
  readonly canPost: boolean;
}

export function chainFor(chainId: number, rpcUrl: string): Chain {
  if (chainId === 56) return bsc;
  if (chainId === 97) return bscTestnet;
  return defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

export function publicClientFor(cfg: IdentityConfig): PublicClient {
  return createPublicClient({ chain: chainFor(cfg.chainId, cfg.rpcUrl), transport: http(cfg.rpcUrl) }) as PublicClient;
}

/**
 * Convert a 0-100 score into (int128 value, uint8 valueDecimals). Always rounds to an integer with
 * valueDecimals = 0 (the spec's `starred` example) so on-chain getSummary() averages stay uniform;
 * the exact figure is kept in the off-chain feedback file (`elitr.exactValue`).
 */
export function toFixedPoint(value: number): { value: bigint; valueDecimals: number } {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`feedback value must be within 0..100, got ${value}`);
  return { value: BigInt(Math.round(value)), valueDecimals: 0 };
}

/** Off-chain feedback file per spec ("Off-Chain Feedback File Structure"); MUST fields first. */
export function buildFeedbackFile(
  cfg: Pick<IdentityConfig, "chainId" | "identityRegistry">,
  clientAddress: Address,
  p: PostFeedbackParams,
  createdAt = new Date(),
): Record<string, unknown> {
  const fp = toFixedPoint(p.value);
  return {
    agentRegistry: `eip155:${cfg.chainId}:${cfg.identityRegistry}`,
    agentId: Number(BigInt(p.erc8004AgentId)),
    clientAddress: `eip155:${cfg.chainId}:${clientAddress}`,
    createdAt: createdAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
    value: Number(fp.value),
    valueDecimals: fp.valueDecimals,
    tag1: p.tag,
    ...(p.tag2 ? { tag2: p.tag2 } : {}),
    ...(p.endpoint ? { endpoint: p.endpoint } : {}),
    elitr: { analystId: p.analystId, signalId: p.signalId, exactValue: p.value, ...(p.detail ?? {}) },
  };
}

export interface GiveFeedbackArgs {
  agentId: bigint;
  value: bigint;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  endpoint: string;
  feedbackURI: string;
  feedbackHash: Hex;
}

/** Build the exact giveFeedback() arguments (and the feedback file). Pure; exported for tests. */
export function giveFeedbackArgs(
  cfg: Pick<IdentityConfig, "chainId" | "identityRegistry" | "inlineFeedbackFile">,
  clientAddress: Address,
  p: PostFeedbackParams,
  createdAt = new Date(),
): { args: GiveFeedbackArgs; file: Record<string, unknown>; data: Hex } {
  if (!/^\d+$/.test(p.erc8004AgentId)) throw new Error(`erc8004AgentId must be a decimal token id, got "${p.erc8004AgentId}"`);
  const fp = toFixedPoint(p.value);
  const file = buildFeedbackFile(cfg, clientAddress, p, createdAt);
  const json = JSON.stringify(file);
  const args: GiveFeedbackArgs = {
    agentId: BigInt(p.erc8004AgentId),
    value: fp.value,
    valueDecimals: fp.valueDecimals,
    tag1: p.tag,
    tag2: p.tag2 ?? "",
    endpoint: p.endpoint ?? "",
    feedbackURI: cfg.inlineFeedbackFile ? toDataUri(file) : "",
    // keccak256 of the bytes the URI resolves to (the JSON), so anyone can verify integrity.
    feedbackHash: cfg.inlineFeedbackFile ? keccak256(stringToHex(json)) : zeroHash,
  };
  const data = encodeFunctionData({
    abi: reputationRegistryAbi,
    functionName: "giveFeedback",
    args: [args.agentId, args.value, args.valueDecimals, args.tag1, args.tag2, args.endpoint, args.feedbackURI, args.feedbackHash],
  });
  return { args, file, data };
}

/** Returns null when no ERC-8004 env is set at all. Throws on malformed config. */
export function identityFromEnv(env: NodeJS.ProcessEnv = process.env): Identity | null {
  if (!isConfigured(env)) return null;
  const cfg = loadConfig(env);
  return createIdentity(cfg);
}

export function createIdentity(cfg: IdentityConfig): Identity {
  const chain = chainFor(cfg.chainId, cfg.rpcUrl);
  const transport = http(cfg.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const account = cfg.executionKey ? privateKeyToAccount(cfg.executionKey) : undefined;
  const wallet = account ? createWalletClient({ chain, transport, account }) : undefined;
  const { executionKey: _omit, ...publicCfg } = cfg;
  // Serialize writes from this process so concurrent scorings don't race on the nonce.
  let queue: Promise<unknown> = Promise.resolve();

  async function send(p: PostFeedbackParams): Promise<PostFeedbackResult> {
    if (!account || !wallet) throw new Error("EXECUTION_PRIVATE_KEY is not set");
    const { args } = giveFeedbackArgs(cfg, account.address, p);
    const { request } = await publicClient.simulateContract({
      account,
      address: cfg.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: "giveFeedback",
      args: [args.agentId, args.value, args.valueDecimals, args.tag1, args.tag2, args.endpoint, args.feedbackURI, args.feedbackHash],
    });
    const txHash = await wallet.writeContract(request);
    if (!cfg.waitForReceipt) return { txHash };
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
    if (receipt.status !== "success") throw new Error(`giveFeedback reverted (tx ${txHash})`);
    const [ev] = parseEventLogs({ abi: reputationRegistryAbi, eventName: "NewFeedback", logs: receipt.logs });
    return { txHash, feedbackIndex: ev ? ev.args.feedbackIndex.toString() : undefined };
  }

  return {
    config: publicCfg,
    clientAddress: account?.address,
    canPost: cfg.postFeedback && !!account,
    agentIdOf: (subject) => cfg.agentIds[subject],
    postFeedback(p) {
      if (!cfg.postFeedback) return Promise.resolve({ skipped: "ERC8004_POST_FEEDBACK is not 1" });
      const run = queue.then(() => send(p));
      queue = run.catch(() => undefined);
      return run;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Registration (mint an ERC-8004 identity NFT). Used by the CLI; never called by the agents.

export interface RegisterAgentOpts {
  subject: AgentId;
  privateKey: Hex; // owner of the new identity; becomes agentWallet by default
  config: IdentityConfig;
  /** Explicit agentURI (https:// or ipfs://). If omitted, a base64 data: URI of the registration file is used. */
  uri?: string;
  registration?: RegistrationOpts; // used when uri is omitted
  broadcast?: boolean; // false = simulate only (default)
  /** Refuse if the owner equals this address (e.g. the trader for analyst identities). */
  forbidOwner?: Address;
}

export interface RegisterAgentResult {
  owner: Address;
  agentURI: string;
  registrationFile?: object;
  simulatedAgentId: string;
  estimatedGas?: string;
  agentId?: string;
  txHash?: string;
  setUriTxHash?: string;
}

export async function registerAgent(o: RegisterAgentOpts): Promise<RegisterAgentResult> {
  const cfg = o.config;
  const chain = chainFor(cfg.chainId, cfg.rpcUrl);
  const transport = http(cfg.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const account = privateKeyToAccount(o.privateKey);
  if (o.forbidOwner && getAddress(o.forbidOwner) === account.address) {
    throw new Error(
      `refusing: ${o.subject} identity would be owned by ${account.address}, the trader's address - ` +
        `the trader could then never rate it (giveFeedback reverts "Self-feedback not allowed"). Use a different owner key.`,
    );
  }
  const simulate = (uri: string) =>
    publicClient.simulateContract({
      account,
      address: cfg.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "register",
      args: [uri],
    });

  let file: object | undefined;
  let agentURI: string;
  const regOpts = (agentId?: bigint): RegistrationOpts => ({
    ...(o.registration ?? { baseUrl: "http://localhost" }),
    ...(agentId !== undefined ? { agentId, chainId: cfg.chainId, identityRegistry: cfg.identityRegistry } : {}),
  });
  if (o.uri) {
    agentURI = o.uri;
  } else {
    // Predict the id (sequential mint), then embed `registrations` so one tx is usually enough.
    const probe = await simulate(toDataUri(buildRegistrationFile(o.subject, regOpts())));
    file = buildRegistrationFile(o.subject, regOpts(probe.result));
    agentURI = toDataUri(file);
  }
  const sim = await simulate(agentURI);
  const estimatedGas = await publicClient
    .estimateContractGas({ account, address: cfg.identityRegistry, abi: identityRegistryAbi, functionName: "register", args: [agentURI] })
    .then((g) => g.toString())
    .catch(() => undefined);
  const out: RegisterAgentResult = {
    owner: account.address,
    agentURI,
    registrationFile: file,
    simulatedAgentId: sim.result.toString(),
    estimatedGas,
  };
  if (!o.broadcast) return out;

  const wallet = createWalletClient({ chain, transport, account });
  const txHash = await wallet.writeContract(sim.request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error(`register reverted (tx ${txHash})`);
  const [ev] = parseEventLogs({ abi: identityRegistryAbi, eventName: "Registered", logs: receipt.logs });
  if (!ev) throw new Error(`no Registered event in ${txHash}`);
  out.txHash = txHash;
  out.agentId = ev.args.agentId.toString();

  // Someone minted in between: fix the embedded registrations entry.
  if (!o.uri && ev.args.agentId !== sim.result) {
    file = buildRegistrationFile(o.subject, regOpts(ev.args.agentId));
    out.registrationFile = file;
    out.agentURI = toDataUri(file);
    out.setUriTxHash = await setAgentUri({ config: cfg, privateKey: o.privateKey, agentId: out.agentId, uri: out.agentURI });
  }
  return out;
}

export async function setAgentUri(o: { config: IdentityConfig; privateKey: Hex; agentId: string; uri: string }): Promise<Hex> {
  const chain = chainFor(o.config.chainId, o.config.rpcUrl);
  const transport = http(o.config.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const account = privateKeyToAccount(o.privateKey);
  const { request } = await publicClient.simulateContract({
    account,
    address: o.config.identityRegistry,
    abi: identityRegistryAbi,
    functionName: "setAgentURI",
    args: [BigInt(o.agentId), o.uri],
  });
  const hash = await createWalletClient({ chain, transport, account }).writeContract(request);
  const r = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (r.status !== "success") throw new Error(`setAgentURI reverted (tx ${hash})`);
  return hash;
}

// ---------------------------------------------------------------------------------------------
// Read helpers (free).

export async function readAgent(cfg: IdentityConfig, agentId: string) {
  const c = publicClientFor(cfg);
  const id = BigInt(agentId);
  const [owner, uri, wallet] = await Promise.all([
    c.readContract({ address: cfg.identityRegistry, abi: identityRegistryAbi, functionName: "ownerOf", args: [id] }),
    c.readContract({ address: cfg.identityRegistry, abi: identityRegistryAbi, functionName: "tokenURI", args: [id] }),
    c.readContract({ address: cfg.identityRegistry, abi: identityRegistryAbi, functionName: "getAgentWallet", args: [id] }),
  ]);
  return { agentId, owner, agentWallet: wallet, agentURI: uri };
}

export async function readFeedbackSummary(cfg: IdentityConfig, agentId: string, clients: Address[], tag1 = "", tag2 = "") {
  const c = publicClientFor(cfg);
  const id = BigInt(agentId);
  const allClients = clients.length
    ? clients
    : ((await c.readContract({ address: cfg.reputationRegistry, abi: reputationRegistryAbi, functionName: "getClients", args: [id] })) as Address[]);
  if (!allClients.length) return { count: "0", summaryValue: "0", summaryValueDecimals: 0, clients: [] as Address[] };
  const [count, summaryValue, summaryValueDecimals] = await c.readContract({
    address: cfg.reputationRegistry,
    abi: reputationRegistryAbi,
    functionName: "getSummary",
    args: [id, allClients, tag1, tag2],
  });
  return { count: count.toString(), summaryValue: summaryValue.toString(), summaryValueDecimals, clients: allClients };
}

export { AGENT_ID_ENV };
