// Additive deployment for subscription requirements §§3,16. Existing asset deployment is retained.
import hre, { network } from "hardhat";
import fs from "node:fs";

const { ethers, networkConfig, networkName } = await network.getOrCreate();
const chain = await ethers.provider.getNetwork();
if (chain.chainId !== 31337n)
  throw new Error(
    "This academic mock-currency setup is restricted to local chain 31337.",
  );
const [admin, , ...investors] = await ethers.getSigners();
const file = "frontend/src/config/addresses.json";
const record = JSON.parse(fs.readFileSync(file, "utf8"));
const code = await ethers.provider.getCode(record.AssetFactory);
if (
  record.chainId !== 31337 ||
  code === "0x" ||
  ethers.keccak256(code) !== record.runtimeCodeHash ||
  (await ethers.provider.getBlock(record.deployBlock))?.hash !==
    record.deployBlockHash
)
  throw new Error(
    "Run deploy:local first: asset deployment does not match this local chain.",
  );
const assetFactory = await ethers.getContractAt(
  "AssetFactory",
  record.AssetFactory,
);
if ((await assetFactory.admin()) !== admin.address)
  throw new Error("First local signer must be platform admin.");
if (
  record.SubscriptionFactory &&
  (await ethers.provider.getCode(record.SubscriptionFactory)) !== "0x"
)
  throw new Error(
    "Subscriptions are already configured. Preserve the existing registry; reset only for a new demo.",
  );
const usd = await ethers.deployContract("MockUSD", [admin.address]);
await usd.waitForDeployment();
const factory = await ethers.deployContract("SubscriptionFactory", [
  record.AssetFactory,
  await usd.getAddress(),
]);
const receipt = await factory.deploymentTransaction()!.wait();
for (const investor of investors.slice(0, 4))
  await (
    await usd.mint(investor.address, ethers.parseUnits("10000", 6))
  ).wait();
const extension = {
  SubscriptionFactory: await factory.getAddress(),
  MockUSD: await usd.getAddress(),
  subscriptionFactoryCodeHash: ethers.keccak256(
    await ethers.provider.getCode(await factory.getAddress()),
  ),
  mockUSDCodeHash: ethers.keccak256(
    await ethers.provider.getCode(await usd.getAddress()),
  ),
  subscriptionDeployBlock: receipt!.blockNumber,
};
if (networkConfig.type === "http") {
  fs.writeFileSync(
    file,
    JSON.stringify({ ...record, ...extension }, null, 2) + "\n",
  );
  fs.mkdirSync("deployments", { recursive: true });
  const abis = Object.fromEntries(
    await Promise.all(
      ["MockUSD", "SubscriptionFactory", "SubscriptionOffering"].map(
        async (name) => [name, (await hre.artifacts.readArtifact(name)).abi],
      ),
    ),
  );
  fs.writeFileSync(
    `deployments/subscription-${networkName}.json`,
    JSON.stringify(
      { ...record, ...extension, transaction: receipt!.hash, abis },
      null,
      2,
    ) + "\n",
  );
  await import("./syncFrontend.mjs");
}
console.log(
  JSON.stringify(
    {
      ...extension,
      note: "Simulated currency, no backing. Local accounts 2–5 received 10,000 mUSD each.",
    },
    null,
    2,
  ),
);
