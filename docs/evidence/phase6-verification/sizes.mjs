// Runtime bytecode sizes of the three production contracts vs EIP-170. Usage: node sizes.mjs <repoRoot>
import fs from "node:fs";
import path from "node:path";
const root = process.argv[2];
for (const c of ["AssetFactory", "AssetToken", "AssetSale"]) {
  const a = JSON.parse(fs.readFileSync(path.join(root, "artifacts/contracts", `${c}.sol`, `${c}.json`), "utf8"));
  const bytes = (a.deployedBytecode.length - 2) / 2;
  console.log(`${c}: ${bytes} bytes (${24576 - bytes} below EIP-170)`);
}
