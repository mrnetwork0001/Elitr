import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  parseEventLogs,
  type Hex,
  type PrivateKeyAccount,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";
import { BSC_CHAIN_ID, USDT_BSC, type TokenizedStock } from "@elitr/shared";

export type Address = `0x${string}`;

export function makePublicClient(rpcUrl = process.env.BSC_RPC_URL || "https://bsc-dataseed.bnbchain.org"): PublicClient {
  return createPublicClient({ chain: bsc, transport: http(rpcUrl, { timeout: 15_000 }) }) as PublicClient;
}

/** The agent's hot wallet, or a reason why it is unavailable. Never logs the key. */
export function loadAccount(env = process.env): { account: PrivateKeyAccount } | { error: string } {
  const pk = env.EXECUTION_PRIVATE_KEY?.trim();
  if (!pk) return { error: "EXECUTION_PRIVATE_KEY is not set" };
  try {
    return { account: privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex) };
  } catch (e) {
    return { error: `EXECUTION_PRIVATE_KEY is invalid: ${(e as Error).message}` };
  }
}

export function erc20Balance(pc: PublicClient, token: Address, owner: Address): Promise<bigint> {
  return pc.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
}

export function erc20Allowance(pc: PublicClient, token: Address, owner: Address, spender: Address): Promise<bigint> {
  return pc.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, spender] });
}

export interface Balances {
  bnb: string; // human units
  usdt: string;
  nvdab: string; // kept for older dashboard builds; same as tokens.NVDAB
  tokens: Record<string, string>; // human units per traded symbol
  raw: { bnb: bigint; usdt: bigint; tokens: Record<string, bigint> };
  readAt: number;
}

export async function readBalances(pc: PublicClient, owner: Address, assets: TokenizedStock[]): Promise<Balances> {
  const [bnb, usdt, ...toks] = await Promise.all([
    pc.getBalance({ address: owner }),
    erc20Balance(pc, USDT_BSC.address, owner),
    ...assets.map((a) => erc20Balance(pc, a.address, owner)),
  ]);
  const tokens: Record<string, string> = {};
  const rawTokens: Record<string, bigint> = {};
  assets.forEach((a, i) => {
    rawTokens[a.symbol] = toks[i];
    tokens[a.symbol] = formatUnits(toks[i], a.decimals);
  });
  return {
    bnb: formatUnits(bnb, 18),
    usdt: formatUnits(usdt, USDT_BSC.decimals),
    nvdab: tokens.NVDAB ?? "0",
    tokens,
    raw: { bnb, usdt, tokens: rawTokens },
    readAt: Date.now(),
  };
}

/** USDT held by the asset's primary PancakeSwap v3 pool — a real, on-chain liquidity floor. */
export async function poolUsdtLiquidity(pc: PublicClient, asset: TokenizedStock): Promise<number> {
  if (!asset.primaryPool) throw new Error(`${asset.symbol} has no primaryPool configured`);
  const bal = await erc20Balance(pc, USDT_BSC.address, asset.primaryPool);
  return Number(formatUnits(bal, USDT_BSC.decimals));
}

export function approveCalldata(spender: Address, amount: bigint): Hex {
  return encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] });
}

export interface UnsignedTx {
  to: Address;
  data: Hex;
  value: bigint;
  gas: bigint;
  gasPrice: bigint;
  maxPriorityFeePerGas?: bigint;
}

/**
 * Sign locally (key never leaves the process). Field mapping per Trading API integration flow
 * (docs/reference/binance-web3-llms-full.txt "Step 4 — Sign Locally"): when the API returns
 * maxPriorityFeePerGas, gasPrice is used as maxFeePerGas (type-2); otherwise legacy gasPrice.
 */
export async function signTx(pc: PublicClient, account: PrivateKeyAccount, tx: UnsignedTx): Promise<{ raw: Hex; nonce: number }> {
  const nonce = await pc.getTransactionCount({ address: account.address, blockTag: "pending" });
  const base = { chainId: BSC_CHAIN_ID, nonce, to: tx.to, data: tx.data, value: tx.value, gas: tx.gas };
  const raw = tx.maxPriorityFeePerGas
    ? await account.signTransaction({
        ...base,
        type: "eip1559",
        maxFeePerGas: tx.gasPrice,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      })
    : await account.signTransaction({ ...base, type: "legacy", gasPrice: tx.gasPrice });
  return { raw, nonce };
}

/** Sum ERC-20 Transfer amounts in a receipt for token from/to an address. */
export function transferredIn(receipt: TransactionReceipt, token: Address, to: Address): bigint {
  return parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs })
    .filter((l) => l.address.toLowerCase() === token.toLowerCase() && l.args.to.toLowerCase() === to.toLowerCase())
    .reduce((s, l) => s + l.args.value, 0n);
}

export function transferredOut(receipt: TransactionReceipt, token: Address, from: Address): bigint {
  return parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs })
    .filter((l) => l.address.toLowerCase() === token.toLowerCase() && l.args.from.toLowerCase() === from.toLowerCase())
    .reduce((s, l) => s + l.args.value, 0n);
}

/** Parse an API integer string (decimal or 0x-hex) to bigint; throws on anything else. */
export function toBig(v: unknown, field: string): bigint {
  if (typeof v === "number" && Number.isInteger(v)) return BigInt(v);
  if (typeof v === "string" && /^(0x[0-9a-fA-F]+|\d+)$/.test(v)) return BigInt(v);
  throw new Error(`expected integer for ${field}, got ${JSON.stringify(v)}`);
}
