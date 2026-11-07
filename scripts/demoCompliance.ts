// Enhancement C §11; assertions and receipts, ephemeral local chain only.
import { network } from "hardhat";
import assert from "node:assert/strict";
import fs from "node:fs";
const { ethers, networkHelpers: h, networkName } = await network.getOrCreate();
if (networkName !== "hardhatMainnet")
  throw new Error(
    "Use the isolated hardhatMainnet network for this time-travel demo.",
  );
const [admin, issuer, attestor, d, e, f, g] = await ethers.getSigners();
const records: { action: string; hash: string; gas: string }[] = [],
  checks: string[] = [];
async function tx(action: string, p: Promise<any>) {
  const r = await (await p).wait();
  assert.equal(r.status, 1);
  records.push({ action, hash: r.hash, gas: r.gasUsed.toString() });
}
async function reject(action: string, p: () => Promise<any>) {
  await assert.rejects(p);
  checks.push(action);
}
const factory = await ethers.deployContract("RegulatedAssetFactory", [
  admin.address,
]);
await factory.waitForDeployment();
await tx("Authorize issuer", factory.authorizeIssuer(issuer.address));
await tx(
  "Create regulated CPT",
  factory
    .connect(issuer)
    .createRegulatedAsset({
      name: "Campus Property Token",
      symbol: "CPT",
      description: "Academic simulation",
      assetType: 0,
      supply: 10000,
      price: ethers.parseEther("0.001"),
      maximum: 500,
      accredited: true,
    }),
);
const a = await factory.getAsset(0),
  m = await factory.modules(0);
const token = await ethers.getContractAt(
    "RegulatedAssetToken",
    a.tokenContract,
  ),
  registry = await ethers.getContractAt(
    "IdentityRegistryLite",
    m.identityRegistry,
  ),
  policy = await ethers.getContractAt("ComplianceLite", m.compliance);
await tx(
  "Trust attestor",
  registry.grantRole(await registry.TRUSTED_ATTESTOR_ROLE(), attestor.address),
);
await tx(
  "Allow Singapore",
  policy.connect(issuer).setCountryAllowed(702, true),
);
const now = await h.time.latest();
const data = (
  who: string,
  country = 702,
  accredited = true,
  validUntil = now + 10000,
) => ({
  identityId: ethers.id(`synthetic-demo:${who}`),
  country,
  kycApproved: true,
  accredited,
  validUntil,
});
for (const [who, country, accredited, expiry] of [
  [d, 702, true, now + 10000],
  [e, 702, false, now + 10000],
  [f, 702, true, now + 100],
  [g, 356, true, now + 10000],
] as const)
  await tx(
    `Register ${who.address}`,
    registry
      .connect(attestor)
      .registerIdentity(
        who.address,
        data(who.address, country, accredited, expiry),
      ),
  );
await h.time.increaseTo(now + 100); // Registrations must be future-dated; let F expire on chain.
await tx(
  "Transfer 100 CPT to D",
  token.connect(issuer).transfer(d.address, 100),
);
assert.equal(await token.balanceOf(d.address), 100n);
await reject("E lacks accreditation", () =>
  token.connect(issuer).transfer(e.address, 100),
);
await reject("F credential expired", () =>
  token.connect(issuer).transfer(f.address, 100),
);
await reject("G country restricted", () =>
  token.connect(issuer).transfer(g.address, 100),
);
await tx("Increase D to 450", token.connect(issuer).transfer(d.address, 350));
await reject("D cannot exceed 500", () =>
  token.connect(issuer).transfer(d.address, 100),
);
await tx(
  "D reaches exactly 500",
  token.connect(issuer).transfer(d.address, 50),
);
assert.equal(await token.balanceOf(d.address), 500n);
await tx("Revoke D", registry.revokeIdentity(d.address));
await reject("Revoked D cannot send", () =>
  token.connect(d).transfer(issuer.address, 1),
);
await reject("Revoked D cannot receive", () =>
  token.connect(issuer).transfer(d.address, 1),
);
await tx(
  "Renew D",
  registry.connect(attestor).updateIdentity(d.address, data(d.address)),
);
await tx(
  "D returns inventory to make claim capacity",
  token.connect(d).transfer(issuer.address, 500),
);
await tx(
  "Renew F for offering",
  registry.connect(attestor).updateIdentity(f.address, data(f.address)),
);
const usd = await ethers.deployContract("MockUSD", [admin.address]);
await usd.waitForDeployment();
const sf = await ethers.deployContract("SubscriptionFactory", [
  await factory.getAddress(),
  await usd.getAddress(),
]);
await sf.waitForDeployment();
await tx(
  "Bind subscription factory",
  factory.setSubscriptionFactory(await sf.getAddress()),
);
const start = (await h.time.latest()) + 100,
  end = start + 100,
  U = (v: number) => BigInt(v) * 1000000n;
await tx(
  "Create subscription",
  sf.connect(issuer).createOffering(0, 1000, U(2), U(1200), start, end),
);
const at = await sf.offeringAt(0),
  o = await ethers.getContractAt("SubscriptionOffering", at);
await tx(
  "Authorize exact escrow",
  token.connect(issuer).registerSubscriptionEscrow(at),
);
await tx("Approve inventory", token.connect(issuer).approve(at, 1000));
await tx("Deposit inventory", o.connect(issuer).depositOfferingTokens(1000));
for (const who of [d, f]) {
  await tx("Mint mock USD", usd.mint(who.address, U(2000)));
  await tx("Approve mock USD", usd.connect(who).approve(at, U(2000)));
}
await h.time.increaseTo(start);
for (const who of [d, f])
  await tx("Commit 2000 mUSD", o.connect(who).commit(U(2000)));
await h.time.increaseTo(end);
await tx("Finalize offering", o.finalizeOffering());
for (const who of [d, f])
  await tx("Settle subscription", o.connect(who).settleSubscription());
await tx("D compliant claim", o.connect(d).claimTokens());
assert.equal(await token.balanceOf(d.address), 500n);
await tx("Revoke F after commitment", registry.revokeIdentity(f.address));
await reject("Invalid F cannot claim", () => o.connect(f).claimTokens());
await tx("Invalid F still receives refund", o.connect(f).withdrawRefund());
assert.equal(await usd.balanceOf(f.address), U(1000));
assert.equal(await o.reservedTokens(), 500n);
assert.equal(await o.recoverableTokens(), 0n);
await reject("Issuer cannot recover F reserved allocation", () =>
  o.connect(issuer).recoverUnsoldTokens(),
);
await tx(
  "Restore F credential",
  registry.connect(attestor).updateIdentity(f.address, data(f.address)),
);
await tx("F delayed claim", o.connect(f).claimTokens());
assert.equal(await token.balanceOf(f.address), 500n);
const result = {
  network: networkName,
  description:
    "Synthetic identity and mock money only; expected failures are estimates, not mined receipts",
  contracts: {
    factory: await factory.getAddress(),
    token: a.tokenContract,
    registry: m.identityRegistry,
    policy: m.compliance,
    offering: at,
  },
  checks,
  records,
  balances: {
    D: (await token.balanceOf(d.address)).toString(),
    F: (await token.balanceOf(f.address)).toString(),
    issuer: (await token.balanceOf(issuer.address)).toString(),
    reserved: (await o.reservedTokens()).toString(),
  },
};
fs.mkdirSync("docs/evidence/compliance", { recursive: true });
fs.writeFileSync(
  "docs/evidence/compliance/demo.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
