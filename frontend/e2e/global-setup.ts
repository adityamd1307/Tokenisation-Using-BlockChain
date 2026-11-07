// Makes every e2e run start from the freshly seeded chain: the first run snapshots
// it, later runs revert to that snapshot (and re-snapshot, since a revert uses it up).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const RPC = "http://127.0.0.1:8545";
// Outside test-results/, which Playwright empties at the start of each run.
const file = ".e2e-chain-snapshot.json";
async function rpc(method: string, params: unknown[] = []) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

export default async function globalSetup() {
  if (existsSync(file)) {
    const { id } = JSON.parse(readFileSync(file, "utf8"));
    if (!(await rpc("evm_revert", [id])))
      throw new Error(
        "Could not revert to the seeded snapshot. Restart the node, deploy and seed again.",
      );
  }
  writeFileSync(file, JSON.stringify({ id: await rpc("evm_snapshot") }));
}
