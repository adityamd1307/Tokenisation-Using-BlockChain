// Phase 4 §3.4: compiled artifacts are the only ABI source.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const destination = path.join(root, "frontend/src/config/abi");
fs.mkdirSync(destination, { recursive: true });
for (const name of ["AssetFactory", "AssetToken", "AssetSale"]) {
  const artifact = JSON.parse(
    fs.readFileSync(
      path.join(root, `artifacts/contracts/${name}.sol/${name}.json`),
      "utf8",
    ),
  );
  fs.writeFileSync(
    path.join(destination, `${name}.json`),
    JSON.stringify(artifact.abi, null, 2) + "\n",
  );
}
console.log("Synced all three frontend ABIs from compiled artifacts.");
