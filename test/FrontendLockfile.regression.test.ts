import { expect } from "chai";
import { readFileSync } from "node:fs";

type LockEntry = { optionalDependencies?: Record<string, string> };

// AUD-011: `npm ci` refuses to install unless every optional dependency named in
// the lockfile has its own entry. Missing platform binaries for esbuild and rollup
// make `npm ci` fail with EUSAGE on Windows and Linux.
describe("AUD-011 frontend lockfile portability", function () {
  it("records every optional dependency, so npm ci works on every platform", function () {
    const lock = JSON.parse(readFileSync("frontend/package-lock.json", "utf8"));
    const packages: Record<string, LockEntry> = lock.packages;
    const missing: string[] = [];
    for (const [path, entry] of Object.entries(packages)) {
      for (const dep of Object.keys(entry.optionalDependencies ?? {})) {
        // npm resolves a dependency from the nearest node_modules, then the top level.
        const nested = `${path ? `${path}/` : ""}node_modules/${dep}`;
        if (!packages[nested] && !packages[`node_modules/${dep}`]) missing.push(`${path} -> ${dep}`);
      }
    }
    expect(missing).to.deep.equal([]);
  });
});
