import { expect } from "chai";
import hre from "hardhat";
import { readFileSync } from "node:fs";

// AUD-012: AssetFactory embeds the AssetToken and AssetSale creation code. Unoptimised,
// it is exactly 24576 bytes, the EIP-170 limit, so any further change makes it
// undeployable. `hardhat run` uses the "default" profile unless --build-profile is given.
describe("AUD-012 Sepolia deployment build profile", function () {
  it("deploy:sepolia builds with a profile that enables the optimizer for every compiler", function () {
    const script: string = JSON.parse(readFileSync("package.json", "utf8")).scripts["deploy:sepolia"];
    const profileName = /--build-profile[ =](\S+)/.exec(script)?.[1] ?? "default";
    const profile = hre.config.solidity.profiles[profileName];
    expect(profile, `build profile "${profileName}" exists`).to.not.equal(undefined);
    const compilers = [...profile.compilers, ...Object.values(profile.overrides)];
    expect(compilers.length).to.be.greaterThan(0);
    for (const compiler of compilers) {
      expect(compiler.settings?.optimizer?.enabled, `"${profileName}" solc ${compiler.version} optimizer`).to.equal(true);
    }
  });
});
