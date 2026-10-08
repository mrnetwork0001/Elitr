import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodeEventTopics, erc20Abi, parseUnits, toHex, type TransactionReceipt } from "viem";
import { ReputationBook } from "@elitr/reputation";
import { ASSETS, EventHub, loadRiskConfig, USDT_BSC, type AgentEvent } from "@elitr/shared";
import { ExecutionAgent, operatorBuyCap, type AgentDeps } from "./cycle.js";
import { StateStore, writeKillFile } from "./state.js";

const dir = mkdtempSync(join(tmpdir(), "elitr-cycle-"));
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
let n = 0;
const OWNER = "0xc742AdA2872a042dD36D2E706907b4036968960C" as const;
const NVDAB = ASSETS.NVDAB;

function makeAgent(over: Partial<AgentDeps> = {}, env: Record<string, string> = {}) {
  const d = join(dir, `a${n++}`);
  const hub = new EventHub("execution");
  const events: AgentEvent[] = [];
  const emit = hub.emit.bind(hub);
  hub.emit = (p) => {
    const e = emit(p);
    events.push(e);
    return e;
  };
  const agent = new ExecutionAgent({
    hub,
    store: new StateStore(join(d, "state.json")),
    risk: loadRiskConfig(env),
    pc: {} as any,
    account: null,
    binance: null,
    book: new ReputationBook(join(d, "rep.json")),
    identity: null,
    cfg: { analysts: [], live: true, mevProtection: true, tradeUsd: 2, minBnbForGas: 0.001, postFeedback: false, controlAuth: true },
    killFile: join(d, "kill-switch"),
    ...over,
  });
  return { agent, events, dir: d };
}

/** A receipt whose only content is ERC-20 Transfer logs. */
function receipt(hash: `0x${string}`, status: "success" | "reverted", transfers: { token: string; from: string; to: string; value: bigint }[]): TransactionReceipt {
  const logs = transfers.map((t) => ({
    address: t.token,
    topics: encodeEventTopics({ abi: erc20Abi, eventName: "Transfer", args: { from: t.from as `0x${string}`, to: t.to as `0x${string}` } }),
    data: toHex(t.value, { size: 32 }),
  }));
  return { transactionHash: hash, status, from: OWNER, gasUsed: 400_000n, effectiveGasPrice: 50_000_000n, logs } as unknown as TransactionReceipt;
}

test("operator buy caps: daily spend, position, portfolio (unknown values fail closed)", () => {
  const cfg = loadRiskConfig({});
  assert.equal(operatorBuyCap({ usd: 5, dailySpendUsd: 0, positionUsd: 0, portfolioUsd: 0 }, cfg), null);
  assert.equal(operatorBuyCap({ usd: 5, dailySpendUsd: 21, positionUsd: 0, portfolioUsd: 0 }, cfg)?.rule, "maxDailySpendUsd");
  assert.equal(operatorBuyCap({ usd: 5, dailySpendUsd: 20, positionUsd: 0, portfolioUsd: 0 }, cfg), null); // exactly at the cap
  assert.equal(operatorBuyCap({ usd: 5, dailySpendUsd: 0, positionUsd: 20.01, portfolioUsd: 20.01 }, cfg)?.rule, "maxPositionUsd");
  assert.equal(operatorBuyCap({ usd: 5, dailySpendUsd: 0, positionUsd: null, portfolioUsd: 0 }, cfg)?.rule, "maxPositionUsd");
  assert.equal(operatorBuyCap({ usd: 5, dailySpendUsd: 0, positionUsd: 10, portfolioUsd: 46 }, cfg)?.rule, "maxPortfolioUsd");
  assert.equal(operatorBuyCap({ usd: 5, dailySpendUsd: 0, positionUsd: 10, portfolioUsd: null }, cfg)?.rule, "maxPortfolioUsd");
});

test("live sell adopts an untracked wallet surplus into the ledger at the mark, visibly", () => {
  const { agent, events } = makeAgent();
  const store = agent.d.store;
  store.recordFill({ ts: 1, mode: "live", symbol: "NVDAB", side: "buy", qtyWei: parseUnits("0.01", 18), decimals: 18, usd: 2, txHash: "0x1" });
  const adopt = (wallet: bigint) => (agent as any).adoptUntracked(NVDAB, wallet) as bigint;

  // Wallet <= ledger: nothing happens.
  assert.equal(adopt(parseUnits("0.01", 18)), parseUnits("0.01", 18));
  assert.equal(adopt(parseUnits("0.004", 18)), parseUnits("0.01", 18));
  assert.equal(events.length, 0);

  // Surplus but no mark: reported, not adopted.
  assert.equal(adopt(parseUnits("0.015", 18)), parseUnits("0.01", 18));
  assert.match((events.at(-1) as any).message, /no mark price/);
  assert.equal((events.at(-1) as any).where, "ledger.reconcile:NVDAB");

  agent.marks.set("NVDAB", { price: 200, source: "test" });
  assert.equal(adopt(parseUnits("0.015", 18)), parseUnits("0.015", 18));
  const pos = store.get().ledgers.live.positions.NVDAB;
  assert.equal(pos.qtyWei, parseUnits("0.015", 18).toString());
  assert.ok(Math.abs(pos.costUsd - 3) < 1e-9); // 2 + 0.005 × 200
  const fill = store.get().ledgers.live.fills.at(-1)!;
  assert.equal(fill.txHash, "reconciled");
  assert.equal(fill.side, "buy");
  assert.ok(events.some((e) => e.type === "error" && e.where === "ledger.reconcile:NVDAB" && /adopted as a buy at mark 200/.test(e.message)));
  assert.ok(events.some((e) => e.type === "trade.filled" && e.txHash === "reconciled" && e.mode === "live"));
  assert.deepEqual(store.get().ledgers.paper.positions, {}); // paper untouched
});

test("reconcilePending books a confirmed swap left behind, drops reverted/stale ones, leaves fresh ones", async () => {
  const h = (c: string) => `0x${c.repeat(64)}` as `0x${string}`;
  const hashes = { ok: h("a"), rev: h("b"), fresh: h("c"), stale: h("d"), dup: h("e") };
  const receipts: Record<string, TransactionReceipt> = {
    [hashes.ok]: receipt(hashes.ok, "success", [
      { token: USDT_BSC.address, from: OWNER, to: "0x000000000000000000000000000000000000dEaD", value: parseUnits("2", 18) },
      { token: NVDAB.address, from: "0x000000000000000000000000000000000000dEaD", to: OWNER, value: parseUnits("0.008", 18) },
    ]),
    [hashes.rev]: receipt(hashes.rev, "reverted", []),
    [hashes.dup]: receipt(hashes.dup, "success", [{ token: NVDAB.address, from: "0x000000000000000000000000000000000000dEaD", to: OWNER, value: parseUnits("1", 18) }]),
  };
  const pc = {
    getTransactionReceipt: async ({ hash }: { hash: string }) => {
      if (!receipts[hash]) throw new Error("TransactionReceiptNotFoundError");
      return receipts[hash];
    },
  } as any;
  const { agent, events } = makeAgent({ pc });
  const store = agent.d.store;
  const now = Date.now();
  const base = { side: "buy" as const, symbol: "NVDAB", label: "NVDAB", amountIn: parseUnits("2", 18).toString() };
  store.setPending({ ...base, txHash: hashes.ok, at: now - 60_000 });
  store.setPending({ ...base, txHash: hashes.rev, at: now - 60_000 });
  store.setPending({ ...base, txHash: hashes.fresh, at: now - 60_000 });
  store.setPending({ ...base, txHash: hashes.stale, at: now - 11 * 60_000 });
  store.setPending({ ...base, txHash: hashes.dup, at: now - 60_000 });
  store.recordFill({ ts: 1, mode: "live", symbol: "NVDAB", side: "buy", qtyWei: parseUnits("1", 18), decimals: 18, usd: 200, txHash: hashes.dup }); // already booked

  await agent.reconcilePending();

  const s = store.get();
  assert.deepEqual(s.pending.map((p) => p.txHash), [hashes.fresh]); // only the one still inside the grace period
  assert.equal(s.ledgers.live.positions.NVDAB.qtyWei, parseUnits("1.008", 18).toString());
  assert.ok(Math.abs(s.ledgers.live.positions.NVDAB.costUsd - 202) < 1e-9);
  assert.equal(s.ledgers.live.fills.filter((f) => f.txHash === hashes.dup).length, 1); // not booked twice
  assert.equal(s.trades.length, 1);
  assert.equal(s.trades[0].txHash, hashes.ok);
  assert.equal(s.trades[0].amountInUsdt, "2");
  assert.equal(s.trades[0].amountOut, "0.008");
  assert.equal(s.dailySpendUsd, 2);
  assert.ok(s.ledgers.live.gasBnb > 0); // gas accounted for every receipt found
  const filled = events.find((e) => e.type === "trade.filled" && e.txHash === hashes.ok) as any;
  assert.equal(filled?.mode, "live");
  assert.ok(Math.abs(filled.priceUsd - 250) < 1e-9);
  assert.ok(events.some((e) => e.type === "tx.confirmed" && e.txHash === hashes.ok && /0.008 NVDAB/.test(e.amountOut)));
  assert.ok(events.some((e) => e.type === "error" && /reverted on-chain/.test(e.message) && e.message.includes(hashes.rev)));
  assert.ok(events.some((e) => e.type === "error" && /no receipt 11 min/.test(e.message) && e.message.includes(hashes.stale)));
  assert.ok(events.some((e) => e.type === "error" && /already booked/.test(e.message) && e.message.includes(hashes.dup)));

  // Idempotent: a second pass finds nothing new.
  const before = JSON.stringify(store.get());
  await agent.reconcilePending();
  assert.equal(JSON.stringify(store.get()), before);
});

test("kill switch persists to a file, is restored at startup and reset only when not set by env", () => {
  const a = makeAgent();
  assert.equal(a.agent.killed, false);
  a.agent.engageKill("POST /kill");
  assert.equal(a.agent.killSwitch, true);
  assert.ok(existsSync(a.agent.killFile));
  assert.match((a.events.at(-1) as any).detail, /engaged via POST \/kill.*survives restarts/);

  // "Restart" on the same data dir.
  const b = makeAgent({ killFile: a.agent.killFile });
  assert.equal(b.agent.killSwitch, false);
  assert.equal(b.agent.killed, true); // file alone counts, before restore runs
  b.agent.restorePersistedKill();
  assert.equal(b.agent.killSwitch, true);
  assert.match((b.events.at(-1) as any).detail, /kill switch persisted from \d{4}-.* \(POST \/kill\); reset with POST \/kill\/reset/);

  const r = b.agent.resetKill("POST /kill/reset");
  assert.equal(r.ok, true);
  assert.equal(b.agent.killSwitch, false);
  assert.equal(b.agent.killed, false);
  assert.equal(existsSync(a.agent.killFile), false);
  assert.equal((b.events.at(-1) as any).rule, "killSwitchReset");

  // A file dropped by an operator while running is honoured and aborts sends.
  const live = makeAgent({ killFile: a.agent.killFile, binance: {} as any, account: { address: OWNER } as any });
  const txd = (live.agent as any).txDeps();
  assert.equal(txd.store, live.agent.d.store);
  assert.equal(txd.abort(), false);
  writeKillFile("operator", a.agent.killFile);
  assert.equal(txd.abort(), true);
  assert.equal(b.agent.killed, true);

  // KILL_SWITCH env cannot be reset at runtime.
  const c = makeAgent({}, { KILL_SWITCH: "1" });
  c.agent.restorePersistedKill();
  assert.equal(c.agent.killSwitch, true);
  assert.match((c.events.at(-1) as any).detail, /KILL_SWITCH env is set/);
  assert.equal(c.agent.resetKill("POST /kill/reset").ok, false);
  assert.equal(c.agent.killed, true);
});
