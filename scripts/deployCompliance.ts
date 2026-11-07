// Enhancement C §7: explicit NEW local deployment. Does not mutate existing contracts.
import { network } from "hardhat";
import fs from "node:fs";
const { ethers, networkConfig } = await network.getOrCreate();
if (
  networkConfig.type !== "http" ||
  (await ethers.provider.getNetwork()).chainId !== 31337n
)
  throw new Error("Use a persistent local chain (localhost, 31337).");
const [admin, issuer, attestor, ...investors] = await ethers.getSigners();
const factory = await ethers.deployContract("RegulatedAssetFactory", [
  admin.address,
]);
const receipt = await factory.deploymentTransaction()!.wait();
const usd = await ethers.deployContract("MockUSD", [admin.address]);
await usd.waitForDeployment();
const sf = await ethers.deployContract("SubscriptionFactory", [
  await factory.getAddress(),
  await usd.getAddress(),
]);
const subReceipt = await sf.deploymentTransaction()!.wait();
await (await factory.setSubscriptionFactory(await sf.getAddress())).wait();
await (await factory.authorizeIssuer(issuer.address)).wait();
await (
  await factory
    .connect(issuer)
    .createRegulatedAsset({
      name: "Campus Property Token",
      symbol: "CPT",
      description: "Synthetic campus property fund",
      assetType: 0,
      supply: 10000,
      price: ethers.parseEther("0.001"),
      maximum: 500,
      accredited: true,
    })
).wait();
const a = await factory.getAsset(0),
  m = await factory.modules(0);
const registry = await ethers.getContractAt(
    "IdentityRegistryLite",
    m.identityRegistry,
  ),
  policy = await ethers.getContractAt("ComplianceLite", m.compliance);
await (
  await registry.grantRole(
    await registry.TRUSTED_ATTESTOR_ROLE(),
    attestor.address,
  )
).wait();
await (await policy.connect(issuer).setCountryAllowed(702, true)).wait();
const validUntil =
  (await ethers.provider.getBlock("latest"))!.timestamp + 86400 * 30;
for (const [index, who] of investors.slice(0, 4).entries()) {
  await (
    await registry
      .connect(attestor)
      .registerIdentity(who.address, {
        identityId: ethers.id(`synthetic-local:${who.address}`),
        country: index === 3 ? 356 : 702,
        kycApproved: index !== 2,
        accredited: index !== 1,
        validUntil,
      })
  ).wait();
  await (await usd.mint(who.address, ethers.parseUnits("10000", 6))).wait();
}
const record = {
  chainId: 31337,
  regulatedFactory: true,
  AssetFactory: await factory.getAddress(),
  deployBlock: receipt!.blockNumber,
  deployBlockHash: receipt!.blockHash,
  runtimeCodeHash: ethers.keccak256(
    await ethers.provider.getCode(await factory.getAddress()),
  ),
  SubscriptionFactory: await sf.getAddress(),
  MockUSD: await usd.getAddress(),
  subscriptionFactoryCodeHash: ethers.keccak256(
    await ethers.provider.getCode(await sf.getAddress()),
  ),
  mockUSDCodeHash: ethers.keccak256(
    await ethers.provider.getCode(await usd.getAddress()),
  ),
  subscriptionDeployBlock: subReceipt!.blockNumber,
};
fs.mkdirSync("deployments", { recursive: true });
const file = "frontend/src/config/addresses.json";
if (fs.existsSync(file))
  fs.writeFileSync(
    "deployments/pre-compliance-localhost.json",
    fs.readFileSync(file),
  );
fs.writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
fs.writeFileSync(
  "deployments/compliance-localhost.json",
  JSON.stringify(record, null, 2) + "\n",
);
await import("./syncFrontend.mjs");
console.log(
  "New local regulated registry configured. Wallets 0 admin, 1 issuer, 2 attestor, 3 approved investor, 4 non-accredited, 5 KYC denied, 6 restricted country. Previous UI configuration backed up in deployments/pre-compliance-localhost.json.",
);
