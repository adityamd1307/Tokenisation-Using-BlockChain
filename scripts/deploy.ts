// Deploys the main AssetFactory (spec-v1 §4; Phase 3 §3.1; Phase 5 Task 5.2 and D11).
// The first signer is Wallet A, the platform admin. The factory is left empty for the live Task 5.1 demo;
// scripts/replay.ts runs the scripted demo on its own factory instead.
// Usage: npm run deploy:local (persistent node); npm run deploy:ephemeral (throwaway)
//        npm run deploy:sepolia (production profile, AUD-012; SEPOLIA_KEY_A..D from env or keystore, D12)
// On persistent (HTTP) networks this writes frontend/src/config/addresses.json (spec-v1 §7) and
// deployments/<network>.json with the address, chain ID and ABIs (D18), then syncs the frontend ABIs.

import hre, { network } from "hardhat";
import path from "node:path";
import { CONTRACT_NAMES, deployMainFactory, writeDeploymentOutputs } from "./lib/phase5.ts";

const { ethers, networkName, networkConfig } = await network.getOrCreate();
const [admin] = await ethers.getSigners();
const { chainId } = await ethers.provider.getNetwork();
if (networkName === "sepolia" && chainId !== 11155111n)
  throw new Error(`TESTNET_RPC_URL is on chain ${chainId}, not Sepolia (11155111).`);

console.log(`Network: ${networkName} (chain ${chainId})`);
console.log(`Admin (Wallet A): ${admin.address}`);

const record = await deployMainFactory(ethers, admin, networkName);
console.log(`AssetFactory deployed to: ${record.AssetFactory}`);
console.log(`Deployment tx: ${record.deployTx} (block ${record.deployBlock})`);

if (networkConfig.type === "http") {
  const abis = Object.fromEntries(
    await Promise.all(CONTRACT_NAMES.map(async (name) => [name, (await hre.artifacts.readArtifact(name)).abi])),
  ) as Record<(typeof CONTRACT_NAMES)[number], unknown[]>;
  const written = writeDeploymentOutputs(record, abis, {
    frontendConfig: path.join("frontend", "src", "config", "addresses.json"),
    recordsDir: "deployments",
  });
  console.log(`Wrote ${written.frontendConfig}`);
  console.log(`Wrote ${written.record}`);
  await import("./syncFrontend.mjs");
} else {
  console.log("In-process network: no files written (the deployment ends with this script).");
}
