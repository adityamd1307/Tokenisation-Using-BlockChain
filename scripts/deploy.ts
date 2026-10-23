// Deploys the AssetFactory (spec-v1 §4; Phase 3 §3.1) with the first signer as platform admin.
// Usage: npx hardhat run scripts/deploy.ts --network hardhatMainnet   (in-process, throwaway)
//        npx hardhat run scripts/deploy.ts --network sepolia
// On persistent (HTTP) networks the address is written to frontend/src/config/addresses.json (spec-v1 §7).

import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

const { ethers, networkName, networkConfig } = await network.getOrCreate();
const [admin] = await ethers.getSigners();
const { chainId } = await ethers.provider.getNetwork();

console.log(`Network: ${networkName} (chain ${chainId})`);
console.log(`Admin:   ${admin.address}`);

const factory = await ethers.deployContract("AssetFactory", [admin.address]);
await factory.waitForDeployment();
const factoryAddress = await factory.getAddress();
const deployBlock = (await factory.deploymentTransaction()?.wait())?.blockNumber ?? null;
console.log(`AssetFactory deployed to: ${factoryAddress}`);

if (networkConfig.type === "http") {
  const file = path.join("frontend", "src", "config", "addresses.json");
  const addresses = {
    note: "Populated by scripts/deploy.ts after deployment. Do not edit by hand.",
    network: networkName,
    chainId: Number(chainId),
    AssetFactory: factoryAddress,
    admin: admin.address,
    deployBlock,
  };
  fs.writeFileSync(file, JSON.stringify(addresses, null, 2) + "\n");
  console.log(`Wrote ${file}`);
} else {
  console.log("In-process network: addresses.json not updated (the deployment ends with this script).");
}
