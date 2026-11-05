// Scripted Task 5.1 replay (phase5-requirements.md D11, D13, D17): all twelve steps on a fresh factory,
// with signers 0-3 as Wallets A-D. On Sepolia those are SEPOLIA_KEY_A..D (D12); in-process they are
// Hardhat accounts 0-3. Writes every transaction hash, gas figure and check to
// docs/evidence/phase5/replay-<network>-<timestamp>.json for the report.
// Usage: npm run replay:ephemeral (in-process); npm run replay:sepolia (production profile, AUD-012)

import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";
import { checkFunding, runReplay, toJson, totalsByWallet } from "./lib/phase5.ts";

const { ethers, networkName } = await network.getOrCreate();
const signers = await ethers.getSigners();
if (signers.length < 4)
  throw new Error(`The replay needs four signers (Wallets A-D); ${networkName} has ${signers.length}. Set SEPOLIA_KEY_A..D (D12).`);
const [A, B, C, D] = signers;
const { chainId } = await ethers.provider.getNetwork();
if (networkName === "sepolia" && chainId !== 11155111n)
  throw new Error(`TESTNET_RPC_URL is on chain ${chainId}, not Sepolia (11155111).`);

console.log(`Network: ${networkName} (chain ${chainId})`);
for (const [name, w] of Object.entries({ A, B, C, D })) console.log(`Wallet ${name}: ${w.address}`);

// Stop before the first transaction if a wallet cannot pay for its part of the replay.
await checkFunding(ethers, { A, B, C, D }, (line) => console.log(line));

const result = await runReplay(ethers, { A, B, C, D }, networkName, (line) => console.log(line));

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const dir = path.join("docs", "evidence", "phase5");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `replay-${networkName}-${stamp}.json`);
const wallets = Object.fromEntries(Object.entries({ A, B, C, D }).map(([k, w]) => [k, w.address]));
fs.writeFileSync(file, toJson({ generatedAt: new Date().toISOString(), wallets, ...result, totals: totalsByWallet(result.txs) }));

console.log("\nTotals per wallet (gas used, fees, ETH sent to contracts):");
for (const [name, t] of Object.entries(totalsByWallet(result.txs)))
  console.log(`  ${name}: ${t.txCount} tx, gas ${t.gasUsed}, fees ${ethers.formatEther(t.fee)} ETH, value ${ethers.formatEther(t.valueWei)} ETH`);
console.log(`\nAll 12 steps completed with ${result.checks.length} checks passing.`);
console.log(`Replay factory: ${result.factory}`);
console.log(`Scenario 7 reverted transaction: ${result.scenario7.hash} (${result.scenario7.simulatedError})`);
console.log(`Wrote ${file}`);
