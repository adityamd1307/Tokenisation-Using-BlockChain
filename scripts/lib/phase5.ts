// Phase 5: main-factory deployment and the scripted Task 5.1 replay.
// Authority: docs/spec/phase5-requirements.md (Task 5.1, Task 5.2, decisions D11, D12, D13, D17, D18).
// Both functions take the network's ethers object and signers, so the same code runs on Sepolia,
// on a local node and on the in-process network used by test/Phase5.scripts.test.ts.

import type { HardhatEthers, HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/types";
import type { ContractTransactionResponse, TransactionReceipt } from "ethers";
import fs from "node:fs";
import path from "node:path";

export const CONTRACT_NAMES = ["AssetFactory", "AssetToken", "AssetSale"] as const;
const NOTE = "Populated by scripts/deploy.ts after deployment. Do not edit by hand.";

// ---------------------------------------------------------------------------------------------
// Task 5.2 and D11: deploy the main factory with Wallet A as platform admin, and nothing else.
// ---------------------------------------------------------------------------------------------

export interface DeploymentRecord {
  network: string;
  chainId: number;
  AssetFactory: string;
  admin: string;
  deployTx: string;
  deployBlock: number;
  deployBlockHash: string;
  runtimeCodeHash: string;
}

export async function deployMainFactory(
  ethers: HardhatEthers,
  admin: HardhatEthersSigner,
  networkName: string,
): Promise<DeploymentRecord> {
  const factory = await ethers.deployContract("AssetFactory", [admin.address], admin);
  const tx = factory.deploymentTransaction();
  const receipt = await tx?.wait();
  if (!tx || !receipt || receipt.status !== 1) throw new Error("AssetFactory deployment did not succeed.");
  const address = await factory.getAddress();
  const block = await ethers.provider.getBlock(receipt.blockNumber);
  if (!block?.hash) throw new Error(`Could not read deployment block ${receipt.blockNumber}.`);
  const { chainId } = await ethers.provider.getNetwork();
  return {
    network: networkName,
    chainId: Number(chainId),
    AssetFactory: address,
    admin: admin.address,
    deployTx: tx.hash,
    deployBlock: receipt.blockNumber,
    deployBlockHash: block.hash,
    runtimeCodeHash: ethers.keccak256(await ethers.provider.getCode(address)),
  };
}

// D18: addresses.json keeps the latest deployment (the frontend reads it, spec-v1 §7);
// deployments/<network>.json is the lasting record with the address, chain ID and ABIs (Task 5.2).
export function writeDeploymentOutputs(
  record: DeploymentRecord,
  abis: Record<(typeof CONTRACT_NAMES)[number], unknown[]>,
  paths: { frontendConfig: string; recordsDir: string },
): { frontendConfig: string; record: string } {
  const frontend = {
    note: NOTE,
    network: record.network,
    chainId: record.chainId,
    AssetFactory: record.AssetFactory,
    admin: record.admin,
    deployBlock: record.deployBlock,
    deployBlockHash: record.deployBlockHash,
    runtimeCodeHash: record.runtimeCodeHash,
  };
  fs.mkdirSync(path.dirname(paths.frontendConfig), { recursive: true });
  fs.writeFileSync(paths.frontendConfig, JSON.stringify(frontend, null, 2) + "\n");
  fs.mkdirSync(paths.recordsDir, { recursive: true });
  const file = path.join(paths.recordsDir, `${record.network}.json`);
  fs.writeFileSync(file, JSON.stringify({ note: NOTE, ...record, abis }, null, 2) + "\n");
  return { frontendConfig: paths.frontendConfig, record: file };
}

// ---------------------------------------------------------------------------------------------
// D11 and D13: the twelve Task 5.1 steps on a fresh factory, with Wallets A-D.
// ---------------------------------------------------------------------------------------------

export type WalletName = "A" | "B" | "C" | "D";
export type Wallets = Record<WalletName, HardhatEthersSigner>;

export interface TxRecord {
  step: number;
  label: string;
  wallet: WalletName;
  hash: string;
  status: number;
  blockNumber: number;
  gasUsed: bigint;
  fee: bigint;
  valueWei: bigint;
}
export interface CheckRecord {
  step: number;
  description: string;
  value: string;
}
export interface ReplayResult {
  network: string;
  chainId: number;
  factory: string;
  cpt: { token: string; sale: string };
  dlp: { token: string; sale: string };
  scenario7: { simulatedError: string; hash: string };
  txs: TxRecord[];
  checks: CheckRecord[];
}

// Task 5.1 and spec-v1 §2: CPT, 10,000 units at 0.001 ETH; deposit 5,000; C buys 100 for 0.1 ETH; 20 to D.
// D17: DLP, 5,000 units at 0.002 ETH; deposit 1,000; C buys 10 for 0.02 ETH.
export const PLAN = {
  cpt: { name: "Campus Property Token", symbol: "CPT", description: "Fictional campus real estate fund", type: 0n, supply: 10_000n, priceEth: "0.001", deposit: 5_000n, buy: 100n, transfer: 20n },
  dlp: { name: "Digital Licensing Revenue Pool", symbol: "DLP", description: "Fictional digital licensing revenue pool", type: 1n, supply: 5_000n, priceEth: "0.002", deposit: 1_000n, buy: 10n },
} as const;

// D13: a fixed gas limit so that gas estimation does not stop the failing transfer from being sent.
// An ERC-20 transfer through AssetToken uses well under this (see the replay's recorded gasUsed).
export const SCENARIO7_GAS_LIMIT = 100_000n;

export const STEP_TITLES: Record<number, string> = {
  1: "Wallet A authorises Wallet B as an asset issuer",
  2: "Wallet B creates Campus Property Token with 10,000 units",
  3: "Wallet B approves the sale contract and deposits 5,000 units",
  4: "Wallet B whitelists Wallet C",
  5: "Wallet C purchases 100 CPT for 0.1 testnet ETH",
  6: "Portfolio dashboard displays Wallet C's 100 CPT",
  7: "Wallet C tries transferring 20 CPT to Wallet D; transaction fails",
  8: "Wallet B whitelists Wallet D",
  9: "Wallet C transfers 20 CPT to Wallet D successfully",
  10: "Portfolio and event history show 80 CPT for C and 20 CPT for D",
  11: "Wallet B withdraws the ETH proceeds",
  12: "Wallet B creates a second asset and verifies separate balances",
};

export async function runReplay(
  ethers: HardhatEthers,
  wallets: Wallets,
  networkName: string,
  log: (line: string) => void = () => {},
): Promise<ReplayResult> {
  const { A, B, C, D } = wallets;
  const addresses = [A, B, C, D].map((w) => w.address.toLowerCase());
  if (new Set(addresses).size !== 4) throw new Error("The replay needs four distinct wallets A-D (D12).");
  const nameOf = (signer: HardhatEthersSigner): WalletName =>
    (["A", "B", "C", "D"] as const)[addresses.indexOf(signer.address.toLowerCase())];

  const txs: TxRecord[] = [];
  const checks: CheckRecord[] = [];
  let step = 0;

  const record = (label: string, signer: HardhatEthersSigner, receipt: TransactionReceipt, valueWei: bigint) => {
    const entry: TxRecord = {
      step, label, wallet: nameOf(signer), hash: receipt.hash, status: receipt.status ?? -1,
      blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed, fee: receipt.fee, valueWei,
    };
    txs.push(entry);
    log(`  [${entry.status === 1 ? "ok" : "REVERTED"}] ${label} (${entry.wallet}) ${entry.hash} gas ${entry.gasUsed}`);
    return entry;
  };
  const send = async (label: string, signer: HardhatEthersSigner, pending: Promise<ContractTransactionResponse>, valueWei = 0n) => {
    const tx = await pending;
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`Step ${step} "${label}" did not succeed.`);
    return record(label, signer, receipt, valueWei);
  };
  const check = (description: string, actual: bigint | string | boolean, expected: bigint | string | boolean) => {
    const norm = (v: bigint | string | boolean) => (typeof v === "string" ? v.toLowerCase() : v);
    if (norm(actual) !== norm(expected))
      throw new Error(`Step ${step} check failed: ${description}: expected ${expected}, got ${actual}.`);
    checks.push({ step, description, value: String(actual) });
    log(`  [check] ${description} = ${actual}`);
  };
  const begin = (n: number) => {
    step = n;
    log(`Step ${n}: ${STEP_TITLES[n]}`);
  };

  // D11: the replay uses its own factory, never the main one the live demo uses.
  step = 0;
  log("Step 0: Wallet A deploys a separate replay factory (D11)");
  const factory = await ethers.deployContract("AssetFactory", [A.address], A);
  const deployReceipt = await factory.deploymentTransaction()?.wait();
  if (!deployReceipt || deployReceipt.status !== 1) throw new Error("Replay factory deployment did not succeed.");
  record("deploy replay AssetFactory", A, deployReceipt, 0n);
  const factoryAddress = await factory.getAddress();
  const fromBlock = deployReceipt.blockNumber;

  begin(1);
  await send("factory.authorizeIssuer(B)", A, factory.connect(A).authorizeIssuer(B.address));
  check("factory.authorisedIssuers(B)", await factory.authorisedIssuers(B.address), true);

  begin(2);
  const cptPrice = ethers.parseEther(PLAN.cpt.priceEth);
  await send("factory.createAsset(CPT)", B, factory.connect(B).createAsset(
    PLAN.cpt.name, PLAN.cpt.symbol, PLAN.cpt.description, PLAN.cpt.type, PLAN.cpt.supply, cptPrice));
  const cptId = (await factory.getAssetCount()) - 1n;
  const cptAsset = await factory.getAsset(cptId);
  const cpt = await ethers.getContractAt("AssetToken", cptAsset.tokenContract, B);
  const cptSale = await ethers.getContractAt("AssetSale", cptAsset.saleContract, B);
  check("CPT symbol", await cpt.symbol(), PLAN.cpt.symbol);
  check("CPT balance of B", await cpt.balanceOf(B.address), PLAN.cpt.supply);

  begin(3);
  // Phase 3 §3.3: the sale contract must be whitelisted before it can hold CPT.
  await send("CPT.setWhitelisted(sale, true)", B, cpt.setWhitelisted(cptAsset.saleContract, true));
  await send("CPT.approve(sale, 5000)", B, cpt.approve(cptAsset.saleContract, PLAN.cpt.deposit));
  await send("sale.allocate(5000)", B, cptSale.allocate(PLAN.cpt.deposit));
  check("CPT sale inventory", await cptSale.availableTokens(), PLAN.cpt.deposit);

  begin(4);
  await send("CPT.setWhitelisted(C, true)", B, cpt.setWhitelisted(C.address, true));
  check("CPT.whitelist(C)", await cpt.whitelist(C.address), true);
  check("CPT.whitelist(D)", await cpt.whitelist(D.address), false);

  begin(5);
  const cptCost = PLAN.cpt.buy * cptPrice;
  check("cost of 100 CPT", ethers.formatEther(cptCost), "0.1");
  await send("sale.buyTokens(100) paying 0.1 ETH", C, cptSale.connect(C).buyTokens(PLAN.cpt.buy, { value: cptCost }), cptCost);

  begin(6);
  // The portfolio reads balanceOf; the dashboard itself is checked in the live MetaMask demo.
  check("CPT balance of C", await cpt.balanceOf(C.address), PLAN.cpt.buy);

  begin(7);
  // D13: show the contract's reason by simulation, then send the same transfer with a fixed gas limit
  // so a reverted transaction is recorded on chain. The frontend blocks this before signing.
  let simulatedError = "";
  try {
    await cpt.connect(C).transfer.staticCall(D.address, PLAN.cpt.transfer);
  } catch (error: any) {
    simulatedError = error?.revert?.name ?? (error?.data ? cpt.interface.parseError(error.data)?.name : undefined) ?? "";
  }
  check("simulated revert reason", simulatedError, "RecipientNotWhitelisted");
  let revertHash: string | undefined;
  try {
    revertHash = (await cpt.connect(C).transfer(D.address, PLAN.cpt.transfer, { gasLimit: SCENARIO7_GAS_LIMIT })).hash;
  } catch (error: any) {
    // The in-process network mines the failing transaction, then throws with its hash.
    revertHash = error?.transactionHash;
    if (!revertHash) throw error;
  }
  const revertReceipt = await ethers.provider.waitForTransaction(revertHash, 1, 600_000);
  if (!revertReceipt) throw new Error(`No receipt for the scenario 7 transaction ${revertHash}.`);
  record("CPT.transfer(D, 20) with fixed gas limit (expected to revert)", C, revertReceipt, 0n);
  check("scenario 7 receipt status", BigInt(revertReceipt.status ?? -1), 0n);
  check("CPT balance of C after the failed transfer", await cpt.balanceOf(C.address), PLAN.cpt.buy);
  check("CPT balance of D after the failed transfer", await cpt.balanceOf(D.address), 0n);

  begin(8);
  await send("CPT.setWhitelisted(D, true)", B, cpt.setWhitelisted(D.address, true));
  check("CPT.whitelist(D)", await cpt.whitelist(D.address), true);

  begin(9);
  await send("CPT.transfer(D, 20)", C, cpt.connect(C).transfer(D.address, PLAN.cpt.transfer));

  begin(10);
  check("CPT balance of C", await cpt.balanceOf(C.address), PLAN.cpt.buy - PLAN.cpt.transfer);
  check("CPT balance of D", await cpt.balanceOf(D.address), PLAN.cpt.transfer);
  // The history view is built from these logs (frontend/src/services/history.ts).
  const purchases = await cptSale.queryFilter(cptSale.filters.Purchased(C.address), fromBlock);
  check("Purchased(C) events", BigInt(purchases.length), 1n);
  check("Purchased(C) quantity", purchases[0].args.quantity, PLAN.cpt.buy);
  const toD = await cpt.queryFilter(cpt.filters.Transfer(C.address, D.address), fromBlock);
  check("Transfer(C -> D) events", BigInt(toD.length), 1n);
  check("Transfer(C -> D) value", toD[0].args.value, PLAN.cpt.transfer);

  begin(11);
  check("CPT unclaimed proceeds before withdrawal", await cptSale.unclaimedProceeds(), cptCost);
  const bBefore = await ethers.provider.getBalance(B.address);
  const withdrawal = await send("sale.withdrawProceeds()", B, cptSale.withdrawProceeds());
  const bAfter = await ethers.provider.getBalance(B.address);
  check("B's ETH gain net of the withdrawal fee", bAfter - bBefore + withdrawal.fee, cptCost);
  check("CPT unclaimed proceeds after withdrawal", await cptSale.unclaimedProceeds(), 0n);
  check("CPT sale ETH balance after withdrawal", await ethers.provider.getBalance(cptAsset.saleContract), 0n);

  begin(12);
  const dlpPrice = ethers.parseEther(PLAN.dlp.priceEth);
  await send("factory.createAsset(DLP)", B, factory.connect(B).createAsset(
    PLAN.dlp.name, PLAN.dlp.symbol, PLAN.dlp.description, PLAN.dlp.type, PLAN.dlp.supply, dlpPrice));
  const dlpAsset = await factory.getAsset(cptId + 1n);
  const dlp = await ethers.getContractAt("AssetToken", dlpAsset.tokenContract, B);
  const dlpSale = await ethers.getContractAt("AssetSale", dlpAsset.saleContract, B);
  check("DLP symbol", await dlp.symbol(), PLAN.dlp.symbol);
  check("registered assets", await factory.getAssetCount(), 2n);
  await send("DLP.setWhitelisted(sale, true)", B, dlp.setWhitelisted(dlpAsset.saleContract, true));
  await send("DLP.setWhitelisted(C, true)", B, dlp.setWhitelisted(C.address, true));
  await send("DLP.approve(sale, 1000)", B, dlp.approve(dlpAsset.saleContract, PLAN.dlp.deposit));
  await send("DLP sale.allocate(1000)", B, dlpSale.allocate(PLAN.dlp.deposit));
  const dlpCost = PLAN.dlp.buy * dlpPrice;
  check("cost of 10 DLP", ethers.formatEther(dlpCost), "0.02");
  await send("DLP sale.buyTokens(10) paying 0.02 ETH", C, dlpSale.connect(C).buyTokens(PLAN.dlp.buy, { value: dlpCost }), dlpCost);
  check("CPT balance of C", await cpt.balanceOf(C.address), PLAN.cpt.buy - PLAN.cpt.transfer);
  check("DLP balance of C", await dlp.balanceOf(C.address), PLAN.dlp.buy);
  check("CPT balance of D", await cpt.balanceOf(D.address), PLAN.cpt.transfer);
  check("DLP balance of D", await dlp.balanceOf(D.address), 0n);
  check("DLP balance of B", await dlp.balanceOf(B.address), PLAN.dlp.supply - PLAN.dlp.deposit);
  check("CPT total supply", await cpt.totalSupply(), PLAN.cpt.supply);
  check("DLP total supply", await dlp.totalSupply(), PLAN.dlp.supply);
  check("DLP whitelist is separate: D not approved for DLP", await dlp.whitelist(D.address), false);

  const { chainId } = await ethers.provider.getNetwork();
  return {
    network: networkName,
    chainId: Number(chainId),
    factory: factoryAddress,
    cpt: { token: cptAsset.tokenContract, sale: cptAsset.saleContract },
    dlp: { token: dlpAsset.tokenContract, sale: dlpAsset.saleContract },
    scenario7: { simulatedError, hash: revertReceipt.hash },
    txs,
    checks,
  };
}

// Gas each wallet spends in one replay, measured on the in-process network (optimised build,
// 5 November 2026): A 3,018,538; B 4,500,345; C 265,618; D 0. Budgets add about 25%; C's also covers
// scenario 7's fixed gas limit, which a node reserves up front. C's ETH payments (0.1 + 0.02) are added from PLAN.
export const REPLAY_GAS_BUDGET: Record<WalletName, bigint> = { A: 3_800_000n, B: 5_700_000n, C: 400_000n, D: 0n };

export function replayValueByWallet(ethers: HardhatEthers): Record<WalletName, bigint> {
  const c = PLAN.cpt.buy * ethers.parseEther(PLAN.cpt.priceEth) + PLAN.dlp.buy * ethers.parseEther(PLAN.dlp.priceEth);
  return { A: 0n, B: 0n, C: c, D: 0n };
}

// Refuses to start a replay that would run out of ETH part-way, leaving half the steps on chain.
export async function checkFunding(ethers: HardhatEthers, wallets: Wallets, log: (line: string) => void = () => {}) {
  const fees = await ethers.provider.getFeeData();
  const perGas = fees.maxFeePerGas ?? fees.gasPrice;
  if (perGas === null) throw new Error("The RPC returned no fee data.");
  const values = replayValueByWallet(ethers);
  const short: string[] = [];
  log(`Funding check at ${ethers.formatUnits(perGas, "gwei")} gwei max fee per gas:`);
  for (const name of ["A", "B", "C", "D"] as const) {
    const need = REPLAY_GAS_BUDGET[name] * perGas + values[name];
    const have = await ethers.provider.getBalance(wallets[name].address);
    log(`  ${name}: has ${ethers.formatEther(have)} ETH, needs up to ${ethers.formatEther(need)} ETH`);
    if (have < need) short.push(`${name} needs ${ethers.formatEther(need - have)} ETH more`);
  }
  if (short.length) throw new Error(`Not enough ETH to run the whole replay: ${short.join("; ")}. Nothing was sent.`);
}

// Totals per wallet, for the funding estimate (work plan step 5).
export function totalsByWallet(txs: TxRecord[]) {
  const totals: Record<WalletName, { gasUsed: bigint; fee: bigint; valueWei: bigint; txCount: number }> = {
    A: { gasUsed: 0n, fee: 0n, valueWei: 0n, txCount: 0 },
    B: { gasUsed: 0n, fee: 0n, valueWei: 0n, txCount: 0 },
    C: { gasUsed: 0n, fee: 0n, valueWei: 0n, txCount: 0 },
    D: { gasUsed: 0n, fee: 0n, valueWei: 0n, txCount: 0 },
  };
  for (const tx of txs) {
    const t = totals[tx.wallet];
    t.gasUsed += tx.gasUsed;
    t.fee += tx.fee;
    t.valueWei += tx.valueWei;
    t.txCount += 1;
  }
  return totals;
}

export const toJson = (value: unknown) =>
  JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v), 2) + "\n";
