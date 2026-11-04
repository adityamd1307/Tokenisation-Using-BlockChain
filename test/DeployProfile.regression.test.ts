import { expect } from "chai";
import hre from "hardhat";
import { readFileSync } from "node:fs";

const scripts: Record<string, string> = JSON.parse(readFileSync("package.json", "utf8")).scripts;

// `hardhat run`, `test` and `compile` use the "default" profile unless --build-profile is given.
function profileOf(command: string): string {
  return /--build-profile[ =](\S+)/.exec(command)?.[1] ?? "default";
}

function expectOptimised(profileName: string, context: string) {
  const profile = hre.config.solidity.profiles[profileName];
  expect(profile, `${context}: build profile "${profileName}" exists`).to.not.equal(undefined);
  const compilers = [...profile.compilers, ...Object.values(profile.overrides)];
  expect(compilers.length).to.be.greaterThan(0);
  for (const compiler of compilers) {
    expect(compiler.settings?.optimizer?.enabled, `${context}: "${profileName}" solc ${compiler.version} optimizer`).to.equal(true);
  }
}

// AUD-012: AssetFactory embeds the AssetToken and AssetSale creation code. Unoptimised,
// it is exactly 24576 bytes, the EIP-170 limit, so any further change makes it
// undeployable.
describe("AUD-012 Sepolia deployment build profile", function () {
  it("deploy:sepolia builds with a profile that enables the optimizer for every compiler", function () {
    expectOptimised(profileOf(scripts["deploy:sepolia"]), "deploy:sepolia");
  });
});

// AUD-014: AUD-012 fixed only the Sepolia path. Tests, local deploys, the demo seed
// and the integration test (which deploys straight from artifacts/) still built the
// 24576-byte factory.
describe("AUD-014 every Hardhat build path", function () {
  it("every npm script that compiles through hardhat run, test or compile uses an optimised profile", function () {
    const building = Object.entries(scripts).flatMap(([name, script]) =>
      script
        .split("&&")
        .filter((command) => /\bhardhat\b[^&]*\b(run|test|compile)\b/.test(command))
        .map((command) => [name, command.trim()] as const),
    );
    expect(building.map(([name]) => name)).to.include.members(["test", "compile", "deploy:local", "deploy:sepolia"]);
    for (const [name, command] of building) expectOptimised(profileOf(command), `npm run ${name}`);
  });
});
