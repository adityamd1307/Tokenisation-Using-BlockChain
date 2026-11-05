import { expect } from "chai";
import { network } from "hardhat";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CONTRACT_NAMES,
  SCENARIO7_GAS_LIMIT,
  STEP_TITLES,
  checkFunding,
  deployMainFactory,
  runReplay,
  writeDeploymentOutputs,
  type DeploymentRecord,
  type ReplayResult,
} from "../scripts/lib/phase5.ts";

// Phase 5 (phase5-requirements.md): the deploy script (Task 5.2, D11, D18) and the scripted
// Task 5.1 replay (D11, D13, D17), run on the in-process network with Hardhat accounts 0-3 as Wallets A-D.
const { ethers } = await network.create();
const [A, B, C, D] = await ethers.getSigners();
const wallets = { A, B, C, D };

describe("Phase 5 deploy script (Task 5.2, D11, D18)", function () {
  let record: DeploymentRecord;
  let nonceBefore: number;

  before(async function () {
    nonceBefore = await ethers.provider.getTransactionCount(A.address);
    record = await deployMainFactory(ethers, A, "test");
  });

  it("deploys the main factory with Wallet A as admin and leaves it empty (D11)", async function () {
    const factory = await ethers.getContractAt("AssetFactory", record.AssetFactory);
    expect(await ethers.provider.getTransactionCount(A.address)).to.equal(nonceBefore + 1); // one transaction: the deployment
    expect(await factory.admin()).to.equal(A.address);
    expect(await factory.getAssetCount()).to.equal(0n);
    for (const w of [B, C, D]) expect(await factory.authorisedIssuers(w.address)).to.equal(false);
  });

  it("records the address, chain ID, deployment block and runtime code hash of the chain it deployed to", async function () {
    expect(record.chainId).to.equal(31337);
    expect(record.admin).to.equal(A.address);
    const receipt = await ethers.provider.getTransactionReceipt(record.deployTx);
    expect(receipt?.contractAddress).to.equal(record.AssetFactory);
    expect(receipt?.blockNumber).to.equal(record.deployBlock);
    expect((await ethers.provider.getBlock(record.deployBlock))?.hash).to.equal(record.deployBlockHash);
    expect(ethers.keccak256(await ethers.provider.getCode(record.AssetFactory))).to.equal(record.runtimeCodeHash);
  });

  it("writes addresses.json for the frontend and deployments/<network>.json with all three ABIs (D18)", function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phase5-deploy-"));
    try {
      const abis = Object.fromEntries(CONTRACT_NAMES.map((n) => [n, [{ type: "function", name: `${n}Marker` }]])) as never;
      const written = writeDeploymentOutputs(record, abis, {
        frontendConfig: path.join(dir, "frontend", "addresses.json"),
        recordsDir: path.join(dir, "deployments"),
      });
      const frontend = JSON.parse(fs.readFileSync(written.frontendConfig, "utf8"));
      expect(frontend).to.include({
        chainId: 31337, AssetFactory: record.AssetFactory, deployBlock: record.deployBlock,
        deployBlockHash: record.deployBlockHash, runtimeCodeHash: record.runtimeCodeHash,
      });
      expect(frontend).to.not.have.property("abis");
      expect(written.record).to.equal(path.join(dir, "deployments", "test.json"));
      const saved = JSON.parse(fs.readFileSync(written.record, "utf8"));
      expect(saved).to.include({ network: "test", chainId: 31337, AssetFactory: record.AssetFactory, admin: A.address });
      expect(Object.keys(saved.abis)).to.have.members([...CONTRACT_NAMES]);
      expect(saved.abis.AssetSale[0].name).to.equal("AssetSaleMarker");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Phase 5 Task 5.1 replay (D11, D13, D17)", function () {
  let mainFactory: string;
  let result: ReplayResult;

  before(async function () {
    mainFactory = (await deployMainFactory(ethers, A, "test")).AssetFactory;
    result = await runReplay(ethers, wallets, "test");
  });

  it("covers all twelve Task 5.1 steps, in order", function () {
    const steps = [...result.txs.map((t) => t.step), ...result.checks.map((c) => c.step)];
    expect([...new Set(steps)].filter((s) => s > 0).sort((x, y) => x - y)).to.deep.equal(Object.keys(STEP_TITLES).map(Number));
    const txSteps = result.txs.map((t) => t.step);
    expect(txSteps).to.deep.equal([...txSteps].sort((x, y) => x - y));
  });

  it("ends with C holding 80 CPT, D holding 20 CPT, and the 0.1 ETH proceeds withdrawn by B", async function () {
    const cpt = await ethers.getContractAt("AssetToken", result.cpt.token);
    const sale = await ethers.getContractAt("AssetSale", result.cpt.sale);
    expect(await cpt.balanceOf(C.address)).to.equal(80n);
    expect(await cpt.balanceOf(D.address)).to.equal(20n);
    expect(await sale.unclaimedProceeds()).to.equal(0n);
    expect(await ethers.provider.getBalance(result.cpt.sale)).to.equal(0n);
    const withdrawn = await sale.queryFilter(sale.filters.ProceedsWithdrawn());
    expect(withdrawn.map((e) => e.args.amount)).to.deep.equal([ethers.parseEther("0.1")]);
    const withdrawTx = result.txs.find((t) => t.label === "sale.withdrawProceeds()");
    expect(withdrawTx?.wallet).to.equal("B");
    expect((await ethers.provider.getTransactionReceipt(withdrawTx!.hash))?.from).to.equal(B.address);
  });

  it("scenario 7 is a mined transfer from C to D with a status-0 receipt and no balance change (D13)", async function () {
    expect(result.scenario7.simulatedError).to.equal("RecipientNotWhitelisted");
    const receipt = await ethers.provider.getTransactionReceipt(result.scenario7.hash);
    expect(receipt?.status).to.equal(0);
    expect(receipt?.from).to.equal(C.address);
    expect(receipt?.to).to.equal(result.cpt.token);
    const tx = await ethers.provider.getTransaction(result.scenario7.hash);
    expect(tx?.gasLimit).to.equal(SCENARIO7_GAS_LIMIT);
    const cpt = await ethers.getContractAt("AssetToken", result.cpt.token);
    const call = cpt.interface.parseTransaction({ data: tx!.data });
    expect(call?.name).to.equal("transfer");
    expect(call?.args[0]).to.equal(D.address);
    expect(call?.args[1]).to.equal(20n);
    const at = { blockTag: receipt!.blockNumber };
    expect(await cpt.balanceOf(C.address, at)).to.equal(100n);
    expect(await cpt.balanceOf(D.address, at)).to.equal(0n);
    expect(await cpt.whitelist(D.address, at)).to.equal(false);
  });

  it("creates DLP as a separate asset: C holds 10 DLP, D holds none, supplies unchanged (D17)", async function () {
    const cpt = await ethers.getContractAt("AssetToken", result.cpt.token);
    const dlp = await ethers.getContractAt("AssetToken", result.dlp.token);
    expect(result.dlp.token).to.not.equal(result.cpt.token);
    expect(await dlp.symbol()).to.equal("DLP");
    expect(await dlp.balanceOf(C.address)).to.equal(10n);
    expect(await dlp.balanceOf(D.address)).to.equal(0n);
    expect(await cpt.balanceOf(C.address)).to.equal(80n);
    expect(await cpt.totalSupply()).to.equal(10_000n);
    expect(await dlp.totalSupply()).to.equal(5_000n);
    expect(await dlp.whitelist(D.address)).to.equal(false);
  });

  it("runs on its own factory and leaves the main factory empty (D11)", async function () {
    expect(result.factory).to.not.equal(mainFactory);
    const main = await ethers.getContractAt("AssetFactory", mainFactory);
    expect(await main.getAssetCount()).to.equal(0n);
    expect(await main.authorisedIssuers(B.address)).to.equal(false);
    const replay = await ethers.getContractAt("AssetFactory", result.factory);
    expect(await replay.getAssetCount()).to.equal(2n);
  });
});

describe("Phase 5 replay guards", function () {
  it("refuses to start, sending nothing, when a wallet cannot pay for its part", async function () {
    const empty = ethers.Wallet.createRandom().connect(ethers.provider);
    const nonces = await Promise.all([A, B, C].map((w) => ethers.provider.getTransactionCount(w.address)));
    let error: Error | undefined;
    try {
      await checkFunding(ethers, { A, B, C: empty as never, D });
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.match(/C needs .* ETH more.*Nothing was sent/);
    expect(await Promise.all([A, B, C].map((w) => ethers.provider.getTransactionCount(w.address)))).to.deep.equal(nonces);
  });

  it("refuses to run with fewer than four distinct wallets (D12)", async function () {
    let error: Error | undefined;
    try {
      await runReplay(ethers, { A, B, C, D: C }, "test");
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.match(/four distinct wallets/);
  });
});
