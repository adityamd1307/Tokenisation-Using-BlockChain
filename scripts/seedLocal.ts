// Explicit development fixture; never runs on application mount or on a public network.
import { network } from "hardhat";
import fs from "node:fs";
const { ethers, networkName } = await network.getOrCreate();
const chain = await ethers.provider.getNetwork();
if (chain.chainId !== 31337n || networkName !== "localhost")
  throw new Error("This fixture is restricted to localhost chain 31337.");
const config = JSON.parse(
  fs.readFileSync("frontend/src/config/addresses.json", "utf8"),
);
const [admin, issuer, investor1, investor2, unapproved] =
  await ethers.getSigners();
const factory = await ethers.getContractAt(
  "AssetFactory",
  config.AssetFactory,
  admin,
);
if ((await factory.getAssetCount()) !== 0n)
  throw new Error(
    "Fixture requires an empty registry. Existing assets were not modified.",
  );
await (await factory.authorizeIssuer(issuer.address)).wait();
for (const [name, symbol, description, category, supply, price] of [
  [
    "Campus Property Token",
    "CPT",
    "Simulated ownership units in a campus property fund.",
    0,
    10000n,
    "0.001",
  ],
  [
    "Digital Licensing Token",
    "DLT",
    "Simulated units in a digital licensing portfolio.",
    1,
    5000n,
    "0.002",
  ],
] as const) {
  await (
    await factory
      .connect(issuer)
      .createAsset(
        name,
        symbol,
        description,
        category,
        supply,
        ethers.parseEther(price),
      )
  ).wait();
}
for (const id of [0n, 1n]) {
  const asset = await factory.getAsset(id);
  const token = await ethers.getContractAt(
    "AssetToken",
    asset.tokenContract,
    issuer,
  );
  const sale = await ethers.getContractAt(
    "AssetSale",
    asset.saleContract,
    issuer,
  );
  for (const account of [
    asset.saleContract,
    investor1.address,
    ...(id === 0n ? [investor2.address] : []),
  ])
    await (await token.setWhitelisted(account, true)).wait();
  const inventory = id === 0n ? 5000n : 2000n;
  await (await token.approve(asset.saleContract, inventory)).wait();
  await (await sale.allocate(inventory)).wait();
  console.log(
    `${asset.name}: ${inventory} ${asset.symbol} available at ${ethers.formatEther(asset.unitPriceWei)} ETH`,
  );
}
console.log(
  JSON.stringify(
    {
      admin: admin.address,
      issuer: issuer.address,
      investor1: investor1.address,
      investor2: investor2.address,
      unapproved: unapproved.address,
    },
    null,
    2,
  ),
);
