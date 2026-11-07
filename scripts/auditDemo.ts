// Phase 6 §8: deterministic local-only scenario with receipt and state evidence.
import assert from "node:assert/strict";
import fs from "node:fs";
import { network } from "hardhat";
import type { ContractTransactionResponse, TransactionReceipt, Interface } from "ethers";
const { ethers, networkName } = await network.getOrCreate();
const chainId = (await ethers.provider.getNetwork()).chainId;
assert.equal(chainId, 31337n, "Audit demo is restricted to local chain 31337");
assert.ok(["hardhatMainnet", "localhost"].includes(networkName), "Local network only");
const [admin, issuer, investorA, investorB, unapproved] = await ethers.getSigners();
const receipts: object[] = [], checks: object[] = [];
function check(label: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, label);
  checks.push({ label, actual, expected });
}
function record(label: string, receipt: TransactionReceipt) {
  receipts.push({ label, hash: receipt.hash, status: receipt.status, block: receipt.blockNumber,
    gasUsed: receipt.gasUsed, fee: receipt.fee,
    logs: receipt.logs.map(l => ({ address: l.address, topics: l.topics, data: l.data, index: l.index })) });
}
async function send(label: string, pending: Promise<ContractTransactionResponse>) {
  const receipt = await (await pending).wait();
  assert.ok(receipt); assert.equal(receipt.status, 1, label);
  record(label, receipt); return receipt;
}
async function rejected(label: string, simulate: () => Promise<unknown>, submit: () => Promise<ContractTransactionResponse>, expectedError: string, abi: Interface) {
  let reason = "";
  try { await simulate(); } catch (error: any) {
    reason = error.revert?.name ?? (error.data ? abi.parseError(error.data)?.name : undefined) ?? "";
  }
  check(`${label}: simulated reason`, reason, expectedError);
  let hash: string | undefined;
  try { hash = (await submit()).hash; } catch (error: any) { hash = error.transactionHash; if (!hash) throw error; }
  const receipt = await ethers.provider.waitForTransaction(hash!, 1, 30_000);
  assert.ok(receipt); check(`${label}: mined receipt status`, receipt.status, 0); record(label, receipt);
}
const factory = await ethers.deployContract("AssetFactory", [admin.address]);
await send("Deploy factory", Promise.resolve(factory.deploymentTransaction()!));
await send("Authorise issuer", factory.authorizeIssuer(issuer.address));
check("Issuer authorised", await factory.authorisedIssuers(issuer.address), true);
const price = ethers.parseEther("0.001");
await send("Create CPT", factory.connect(issuer).createAsset("Campus Property Token", "CPT", "Simulated campus property units", 0, 10_000n, price));
const cpt = await factory.getAsset(0n);
const token = await ethers.getContractAt("AssetToken", cpt.tokenContract, issuer);
const sale = await ethers.getContractAt("AssetSale", cpt.saleContract, issuer);
check("Registry token-to-sale", await factory.tokenToSale(cpt.tokenContract), cpt.saleContract);
check("CPT supply", await token.totalSupply(), 10_000n);
check("CPT issuer role", await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), issuer.address), true);
check("Factory has no token admin", await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), await factory.getAddress()), false);
await send("Whitelist sale", token.setWhitelisted(cpt.saleContract, true));
await send("Approve 5000 CPT", token.approve(cpt.saleContract, 5_000n));
await send("Deposit 5000 CPT", sale.allocate(5_000n));
for (const who of [investorA, investorB]) await send(`Whitelist ${who.address}`, token.setWhitelisted(who.address, true));
await send("Investor A buys 100 CPT", sale.connect(investorA).buyTokens(100n, { value: ethers.parseEther("0.1") }));
await send("Investor B buys 50 CPT", sale.connect(investorB).buyTokens(50n, { value: ethers.parseEther("0.05") }));
const attackerBefore = await ethers.provider.getBalance(unapproved.address);
await rejected("Unapproved purchase", () => sale.connect(unapproved).buyTokens.staticCall(1n, { value: price }),
  () => sale.connect(unapproved).buyTokens(1n, { value: price, gasLimit: 150_000n }), "InvestorNotWhitelisted", sale.interface);
const failedPurchase = receipts.at(-1) as { fee: bigint };
check("Failed purchase costs gas only", attackerBefore - await ethers.provider.getBalance(unapproved.address), failedPurchase.fee);
check("No attacker tokens", await token.balanceOf(unapproved.address), 0n);
check("Inventory after failed purchase", await sale.availableTokens(), 4_850n);
check("Proceeds after failed purchase", await sale.unclaimedProceeds(), ethers.parseEther("0.15"));
await send("Investor A transfers 20 CPT to B", token.connect(investorA).transfer(investorB.address, 20n));
await rejected("Unapproved transfer", () => token.connect(investorA).transfer.staticCall(unapproved.address, 1n),
  () => token.connect(investorA).transfer(unapproved.address, 1n, { gasLimit: 150_000n }), "RecipientNotWhitelisted", token.interface);
const issuerBefore = await ethers.provider.getBalance(issuer.address);
const withdrawal = await send("Withdraw 0.15 ETH", sale.withdrawProceeds());
check("Issuer receives exact proceeds net of fee", await ethers.provider.getBalance(issuer.address) - issuerBefore + withdrawal.fee, ethers.parseEther("0.15"));
check("No unclaimed proceeds", await sale.unclaimedProceeds(), 0n);
check("Sale ETH empty", await ethers.provider.getBalance(cpt.saleContract), 0n);
await send("Close CPT offering", sale.closeSale());
await rejected("Purchase after closure", () => sale.connect(investorA).buyTokens.staticCall(1n, { value: price }),
  () => sale.connect(investorA).buyTokens(1n, { value: price, gasLimit: 150_000n }), "SaleIsClosed", sale.interface);
await send("Recover 4850 CPT", sale.recoverUnsoldTokens());
const finalCpt = { issuer: await token.balanceOf(issuer.address), investorA: await token.balanceOf(investorA.address),
  investorB: await token.balanceOf(investorB.address), sale: await sale.availableTokens(), totalSupply: await token.totalSupply() };
check("Final CPT balances and supply", finalCpt, { issuer: 9_850n, investorA: 80n, investorB: 70n, sale: 0n, totalSupply: 10_000n });
await send("Create independent DLT", factory.connect(issuer).createAsset("Digital Licensing Token", "DLT", "Simulated digital licensing units", 1, 5_000n, ethers.parseEther("0.002")));
const dlt = await factory.getAsset(1n);
const digital = await ethers.getContractAt("AssetToken", dlt.tokenContract);
const digitalSale = await ethers.getContractAt("AssetSale", dlt.saleContract);
check("Two assets registered", await factory.getAssetCount(), 2n);
check("DLT supply", await digital.totalSupply(), 5_000n);
check("DLT price", await digitalSale.pricePerToken(), ethers.parseEther("0.002"));
check("DLT issuer balance", await digital.balanceOf(issuer.address), 5_000n);
for (const who of [investorA, investorB]) {
  check(`DLT eligibility ${who.address}`, await digital.isWhitelisted(who.address), false);
  check(`DLT balance ${who.address}`, await digital.balanceOf(who.address), 0n);
}
check("DLT sale remains open", await digitalSale.saleClosed(), false);
check("DLT inventory independent", await digitalSale.availableTokens(), 0n);
check("DLT proceeds independent", await digitalSale.unclaimedProceeds(), 0n);
const purchaseLogs = await sale.queryFilter(sale.filters.Purchased());
check("Two genuine CPT purchase events", purchaseLogs.map(e => [e.args.buyer, e.args.quantity, e.args.paid]),
  [[investorA.address, 100n, ethers.parseEther("0.1")], [investorB.address, 50n, ethers.parseEther("0.05")]]);
const result = { scenario: "Phase 6 exact local lifecycle", networkName, chainId, factory: await factory.getAddress(),
  actors: { admin: admin.address, issuer: issuer.address, investorA: investorA.address, investorB: investorB.address, unapproved: unapproved.address },
  contracts: { CPT: { token: cpt.tokenContract, sale: cpt.saleContract }, DLT: { token: dlt.tokenContract, sale: dlt.saleContract } }, finalCpt, checks, receipts };
fs.mkdirSync("docs/audit", { recursive: true });
fs.writeFileSync("docs/audit/final-demo.json", JSON.stringify(result, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2) + "\n");
console.log(`Phase 6 lifecycle passed: ${checks.length} checks, ${receipts.length} mined transactions (3 expected reverts).`);
console.log("CPT issuer 9850 / A 80 / B 70 / sale 0; supply 10000. Proceeds 0.15 ETH withdrawn. DLT isolated.");
