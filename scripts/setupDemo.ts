// Phase 3 completion demo (phase3-requirements.md §3.3 and completion criteria):
// register an issuer, create CPT and DLP, whitelist the sale and an investor,
// fund the sale, execute a purchase, then print the updated balances.
// Usage: npx hardhat run scripts/setupDemo.ts --network hardhatMainnet
// Signers follow spec-v1 §9: index 0 = admin, 1 = issuer, 2 = investor.

import { network } from "hardhat";

const RealWorld = 0n;
const Digital = 1n;

const { ethers, networkName } = await network.getOrCreate();
const signers = await ethers.getSigners();
if (signers.length < 3) {
  throw new Error(`setupDemo needs 3 signers (admin, issuer, investor); ${networkName} has ${signers.length}.`);
}
const [admin, issuer, investor] = signers;
const fmt = (wei: bigint) => `${ethers.formatEther(wei)} ETH`;

console.log(`Network: ${networkName}`);
console.log(`Admin ${admin.address} | Issuer ${issuer.address} | Investor ${investor.address}\n`);

const factory = await ethers.deployContract("AssetFactory", [admin.address]);
await factory.waitForDeployment();
console.log(`1. AssetFactory deployed: ${await factory.getAddress()}`);

await (await factory.authorizeIssuer(issuer.address)).wait();
console.log(`2. Issuer authorised: ${await factory.authorisedIssuers(issuer.address)}`);

const asIssuer = factory.connect(issuer);
await (await asIssuer.createAsset(
  "Campus Property Token", "CPT", "Fictional campus real estate fund", RealWorld, 10_000n, ethers.parseEther("0.001"),
)).wait();
await (await asIssuer.createAsset(
  "Digital Licensing Revenue Pool", "DLP", "Fictional digital licensing revenue pool", Digital, 5_000n, ethers.parseEther("0.002"),
)).wait();
console.log(`3. Assets registered: ${await factory.getAssetCount()}`);

const cpt = await factory.getAsset(0n);
const token = await ethers.getContractAt("AssetToken", cpt.tokenContract, issuer);
const sale = await ethers.getContractAt("AssetSale", cpt.saleContract, issuer);
for (const id of [0n, 1n]) {
  const a = await factory.getAsset(id);
  console.log(`   #${a.assetId} ${a.symbol}: token ${a.tokenContract}, sale ${a.saleContract}, ${a.totalSupply} units @ ${fmt(a.unitPriceWei)}`);
}

await (await token.setWhitelisted(cpt.saleContract, true)).wait();
await (await token.setWhitelisted(investor.address, true)).wait();
console.log("4. CPT sale contract and investor whitelisted");

await (await token.approve(cpt.saleContract, 5_000n)).wait();
await (await sale.allocate(5_000n)).wait();
console.log(`5. Sale funded: ${await sale.availableTokens()} CPT available`);

const quantity = 100n;
const cost = quantity * (await sale.pricePerToken());
await (await sale.connect(investor).buyTokens(quantity, { value: cost })).wait();
console.log(`6. Investor bought ${quantity} CPT for ${fmt(cost)}`);

console.log("\nBalances:");
console.log(`   Issuer CPT:          ${await token.balanceOf(issuer.address)}`);
console.log(`   Sale inventory CPT:  ${await sale.availableTokens()}`);
console.log(`   Investor CPT:        ${await token.balanceOf(investor.address)}`);
console.log(`   Total supply CPT:    ${await token.totalSupply()}`);
console.log(`   Sale ETH balance:    ${fmt(await ethers.provider.getBalance(cpt.saleContract))}`);
console.log(`   Unclaimed proceeds:  ${fmt(await sale.unclaimedProceeds())}`);
