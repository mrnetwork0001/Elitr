// One-time operator step: approve USDT to Permit2 (b402 signal payments), USDT (buys) and each traded
// token (sells) to the Trading API's spender, so signal purchases and swap dry-runs — and therefore
// paper fills — can pass. Every approve is simulated via the Transaction API first; nothing is
// broadcast without --yes.
//
//   pnpm --filter @elitr/execution-agent approve                 # plan + simulate only
//   pnpm --filter @elitr/execution-agent approve --yes           # also sign + broadcast
//   options: --vendor=LiquidMesh (skip the quote-based vendor lookup, e.g. while the market is closed)
//            --usd=N (allowance size in USD per token; default: USDT 30 days of RISK_MAX_DAILY_SPEND_USD,
//                     tokens 2 × RISK_MAX_POSITION_USD at the pool price)
import "./env.js";
import { formatUnits, parseUnits } from "viem";
import { EventHub, TRADED_ASSETS, USDT_BSC, loadRiskConfig, type Side, type TokenizedStock } from "@elitr/shared";
import { makeBinance } from "./cycle.js";
import { poolPrice } from "./prices.js";
import { approveTxFor, errMsg, legs, quoteSwap, sendTx, simulateTx, type TxDeps } from "./trade.js";
import { B402_PERMIT2_ADDRESS } from "@bnb-chain/b402/client";
import { approveCalldata, erc20Allowance, loadAccount, makePublicClient, toBig, type Address } from "./wallet.js";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const yes = args.includes("--yes");
const vendorOverride = flag("vendor");
const usdOverride = flag("usd") != null ? Number(flag("usd")) : undefined;
if (usdOverride != null && !(usdOverride > 0)) throw new Error(`--usd must be positive, got ${flag("usd")}`);

const env = process.env;
const risk = loadRiskConfig(env);
const acct = loadAccount(env);
const bin = makeBinance();
const fail = (msg: string) => {
  console.error(`[approve] ${msg}`);
  process.exit(1);
};
if ("error" in acct) fail(`${acct.error} — needed to sign approvals`);
if (!bin.client) fail(`${bin.error} — needed to resolve the spender and simulate (Transaction API)`);
const account = "account" in acct ? acct.account : fail("unreachable");
const binance = bin.client!;
const pc = makePublicClient(env.BSC_RPC_URL);
const hub = new EventHub("execution"); // console only — not written to the dashboard event log
const txd: TxDeps = { hub, binance, pc, account, live: yes, mevProtection: env.EXECUTION_MEV_PROTECTION !== "0" };
const tradeUsd = Number(env.EXECUTION_TRADE_USD ?? risk.maxTradeUsd);

interface Job {
  side: Side; // which trade direction this allowance enables
  asset: TokenizedStock; // the pair it is quoted against
  token: { symbol: string; address: Address; decimals: number };
  amount: bigint;
  quoteAmount: bigint;
}

async function plan(): Promise<Job[]> {
  const jobs: Job[] = [];
  // USDT is approved once per vendor spender; quoting against the first asset finds it.
  const usdtUsd = usdOverride ?? risk.maxDailySpendUsd * 30;
  jobs.push({
    side: "buy",
    asset: TRADED_ASSETS[0],
    token: legs("buy", TRADED_ASSETS[0]).from,
    amount: parseUnits(usdtUsd.toFixed(6), USDT_BSC.decimals),
    quoteAmount: parseUnits(tradeUsd.toFixed(6), USDT_BSC.decimals),
  });
  for (const a of TRADED_ASSETS) {
    const px = await poolPrice(pc, a.symbol);
    const usd = usdOverride ?? risk.maxPositionUsd * 2;
    jobs.push({
      side: "sell",
      asset: a,
      token: legs("sell", a).from,
      amount: parseUnits((usd / px.price).toFixed(a.decimals > 8 ? 8 : a.decimals), a.decimals),
      quoteAmount: parseUnits((tradeUsd / px.price).toFixed(8), a.decimals),
    });
  }
  return jobs;
}

async function run(j: Job): Promise<void> {
  const tag = `${j.token.symbol} (${j.side} ${j.asset.symbol})`;
  let vendor = vendorOverride;
  let expectSpender: Address | undefined;
  if (!vendor) {
    const q = await quoteSwap(binance, j.side, j.asset, account.address, j.quoteAmount);
    if (!q.route) {
      console.log(`  ${tag}: cannot discover the SWAP vendor — ${q.detail}. Re-run when the market is open, or pass --vendor=<name>.`);
      return;
    }
    vendor = q.route.vendorName;
    expectSpender = (q.route.approveTarget as Address | null) ?? undefined;
  }
  const ap = await approveTxFor(binance, j.token.address, j.amount, vendor, expectSpender);
  const have = await erc20Allowance(pc, j.token.address, account.address, ap.spender);
  const amt = `${formatUnits(j.amount, j.token.decimals)} ${j.token.symbol}`;
  console.log(`  ${tag}: vendor ${vendor}, spender ${ap.spender}, current allowance ${formatUnits(have, j.token.decimals)}`);
  if (have >= j.amount) {
    console.log(`    already ≥ ${amt} — nothing to do`);
    return;
  }
  console.log(`    plan: ${j.token.address}.approve(${ap.spender}, ${amt})`);
  const sim = await simulateTx(txd, `${j.token.symbol}:approve`, { to: j.token.address, data: ap.data, value: 0n }, j.side);
  if (!sim.ok) {
    console.log(`    simulation FAILED: ${sim.failReason} — not sending`);
    return;
  }
  console.log(`    simulation OK${sim.gasUsed ? ` (gas ~${sim.gasUsed})` : ""}`);
  if (!yes) {
    console.log("    not sent (dry run; pass --yes to broadcast)");
    return;
  }
  const { txHash } = await sendTx(
    txd,
    `${j.token.symbol}:approve`,
    { to: j.token.address, data: ap.data, value: 0n, gas: toBig(ap.gasLimit, "approve.gasLimit"), gasPrice: toBig(ap.gasPrice, "approve.gasPrice") },
    j.side,
  );
  console.log(`    confirmed: ${txHash}`);
}

// b402 pays analysts in USDT via Permit2: approve 30 days of the signal budget to the canonical Permit2 contract.
async function permit2(): Promise<void> {
  const amount = parseUnits((usdOverride ?? risk.maxDailyDataUsd * 30).toFixed(6), USDT_BSC.decimals);
  const amt = `${formatUnits(amount, USDT_BSC.decimals)} USDT`;
  const have = await erc20Allowance(pc, USDT_BSC.address as Address, account.address, B402_PERMIT2_ADDRESS as Address);
  console.log(`  USDT (b402 signal payments): spender Permit2 ${B402_PERMIT2_ADDRESS}, current allowance ${formatUnits(have, USDT_BSC.decimals)}`);
  if (have >= amount) {
    console.log(`    already ≥ ${amt} — nothing to do`);
    return;
  }
  const data = approveCalldata(B402_PERMIT2_ADDRESS as Address, amount);
  console.log(`    plan: ${USDT_BSC.address}.approve(${B402_PERMIT2_ADDRESS}, ${amt})`);
  const sim = await simulateTx(txd, "USDT:approve-permit2", { to: USDT_BSC.address as Address, data, value: 0n });
  if (!sim.ok) {
    console.log(`    simulation FAILED: ${sim.failReason} — not sending`);
    return;
  }
  console.log(`    simulation OK${sim.gasUsed ? ` (gas ~${sim.gasUsed})` : ""}`);
  if (!yes) {
    console.log("    not sent (dry run; pass --yes to broadcast)");
    return;
  }
  const [gas, gasPrice] = await Promise.all([pc.estimateGas({ account: account.address, to: USDT_BSC.address as Address, data }), pc.getGasPrice()]);
  const { txHash } = await sendTx(txd, "USDT:approve-permit2", { to: USDT_BSC.address as Address, data, value: 0n, gas: (gas * 12n) / 10n, gasPrice });
  console.log(`    confirmed: ${txHash}`);
}

console.log(`[approve] wallet ${account.address} — ${yes ? "WILL BROADCAST approvals that simulate OK" : "dry run (simulate only)"}`);
try {
  await permit2();
} catch (e) {
  console.log(`  USDT (b402 signal payments): error — ${errMsg(e)}`);
}
const jobs = await plan();
for (const j of jobs) {
  try {
    await run(j);
  } catch (e) {
    console.log(`  ${j.token.symbol} (${j.side} ${j.asset.symbol}): error — ${errMsg(e)}`);
  }
}
