// Deploy script — Phase 3 will implement this fully.
// Usage: hardhat run scripts/deploy.ts --network hardhatMainnet
//        hardhat run scripts/deploy.ts --network sepolia

import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [admin, issuer] = await hre.network.provider.request({
    method: "eth_accounts",
    params: [],
  }) as string[];

  console.log("Deploying with admin:", admin);
  console.log("Network:", hre.network.name);

  // TODO (Phase 3): deploy AssetFactory, create demo assets, write addresses to config
  // const factory = await hre.ethers.deployContract("AssetFactory", [admin]);
  // await factory.waitForDeployment();
  // console.log("AssetFactory deployed to:", await factory.getAddress());

  // const addresses = { AssetFactory: await factory.getAddress() };
  // fs.writeFileSync(
  //   path.join("frontend", "src", "config", "addresses.json"),
  //   JSON.stringify(addresses, null, 2)
  // );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
