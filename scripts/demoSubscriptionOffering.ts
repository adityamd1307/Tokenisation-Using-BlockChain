import { network } from "hardhat";
import assert from "node:assert/strict";
import fs from "node:fs";

const {
  ethers,
  networkHelpers: helpers,
  networkName,
} = await network.getOrCreate();
if (networkName !== "hardhatMainnet")
  throw new Error(
    "Automated time-travel demo runs only on the ephemeral Hardhat network.",
  );
const [admin, issuer, a, b, c, outsider] = await ethers.getSigners();
const USD = (x: number) => ethers.parseUnits(String(x), 6);
const records: { action: string; hash: string; gas: string }[] = [];
async function tx(action: string, pending: Promise<any>) {
  const r = await (await pending).wait();
  assert.equal(r.status, 1);
  records.push({ action, hash: r.hash, gas: r.gasUsed.toString() });
}
async function rejects(action: string, call: () => Promise<any>) {
  await assert.rejects(call);
  checks.push(action);
}
const checks: string[] = [];
const usd = await ethers.deployContract("MockUSD", [admin.address]);
await usd.waitForDeployment();
const factory = await ethers.deployContract("AssetFactory", [admin.address]);
await factory.waitForDeployment();
await tx("Authorise issuer", factory.authorizeIssuer(issuer.address));
await tx(
  "Create CPT",
  factory
    .connect(issuer)
    .createAsset(
      "Campus Property Token",
      "CPT",
      "Simulated academic asset",
      0,
      10000n,
      ethers.parseEther("0.001"),
    ),
);
const asset = await factory.getAsset(0),
  token = await ethers.getContractAt("AssetToken", asset.tokenContract);
const registry = await ethers.deployContract("SubscriptionFactory", [
  await factory.getAddress(),
  await usd.getAddress(),
]);
await registry.waitForDeployment();
for (const who of [a, b, c, outsider])
  await tx("Mint demo mUSD", usd.mint(who.address, USD(10000)));
for (const who of [a, b, c])
  await tx(
    "Whitelist investor",
    token.connect(issuer).setWhitelisted(who.address, true),
  );
async function create() {
  const start = BigInt(await helpers.time.latest()) + 40n,
    end = start + 180n;
  await tx(
    "Create offering",
    registry
      .connect(issuer)
      .createOffering(0, 1000, USD(2), USD(1200), start, end),
  );
  const o = await ethers.getContractAt(
    "SubscriptionOffering",
    await registry.offeringAt((await registry.offeringCount()) - 1n),
  );
  const at = await o.getAddress();
  await tx("Whitelist escrow", token.connect(issuer).setWhitelisted(at, true));
  await tx("Approve inventory", token.connect(issuer).approve(at, 1000));
  await tx("Deposit inventory", o.connect(issuer).depositOfferingTokens(1000));
  for (const who of [a, b, c, outsider])
    await tx("Approve mUSD", usd.connect(who).approve(at, USD(10000)));
  await helpers.time.increaseTo(start);
  return { o, at, end };
}
const { o, at, end } = await create();
await rejects("Unapproved commitment rejected", () =>
  o.connect(outsider).commit.staticCall(USD(2)),
);
for (const [who, amount] of [
  [a, 1800],
  [b, 1400],
  [c, 800],
] as const)
  await tx("Commit mUSD", o.connect(who).commit(USD(amount)));
assert.equal(await o.totalCommitments(), USD(4000));
await helpers.time.increaseTo(end);
await rejects("Post-deadline commitment rejected", () =>
  o.connect(a).commit.staticCall(USD(2)),
);
await tx("Finalise successful offering", o.finalizeOffering());
assert.equal(await o.successful(), true);
await rejects("Premature proceeds rejected", () =>
  o.connect(issuer).withdrawProceeds.staticCall(),
);
const allocations = [];
for (const [who, allocation, accepted] of [
  [a, 450n, 900],
  [b, 350n, 700],
  [c, 200n, 400],
] as const) {
  const entitlement = await o.allocationOf(who.address);
  assert.deepEqual(
    [...entitlement],
    [allocation, USD(accepted), USD(accepted)],
  );
  await tx("Settle allocation", o.connect(who).settleSubscription());
  await tx("Withdraw refund", o.connect(who).withdrawRefund());
  await tx("Claim allocation", o.connect(who).claimTokens());
  assert.equal(await token.balanceOf(who.address), allocation);
  assert.equal(await usd.balanceOf(who.address), USD(10000 - accepted));
  allocations.push({
    investor: who.address,
    commitment: await o.commitments(who.address),
    allocation: await token.balanceOf(who.address),
    accepted: entitlement.accepted,
    refund: entitlement.refund,
    finalMUSD: await usd.balanceOf(who.address),
  });
}
await rejects("Double claim rejected", () =>
  o.connect(a).claimTokens.staticCall(),
);
await rejects("Double refund rejected", () =>
  o.connect(a).withdrawRefund.staticCall(),
);
await rejects("Unauthorised proceeds rejected", () =>
  o.connect(a).withdrawProceeds.staticCall(),
);
await tx("Withdraw accepted proceeds", o.connect(issuer).withdrawProceeds());
assert.equal(await usd.balanceOf(issuer.address), USD(2000));
assert.equal(await usd.balanceOf(at), 0n);
assert.equal(await token.totalSupply(), 10000n);
assert.equal(await o.totalAllocated(), 1000n);
const success = {
  address: at,
  demand: await o.totalCommitments(),
  guaranteedFunding: await o.guaranteedAcceptedFunding(),
  accepted: await o.recognizedProceeds(),
  refundsPaid: await o.refundsPaid(),
  proceedsWithdrawn: await o.proceedsWithdrawn(),
  paymentBalance: await usd.balanceOf(at),
  tokenBalance: await token.balanceOf(at),
  allocations,
};
const failed = await create();
const before = await usd.balanceOf(a.address);
await tx("Commit 700 to second offering", failed.o.connect(a).commit(USD(700)));
await helpers.time.increaseTo(failed.end);
await tx("Finalise failed offering", failed.o.finalizeOffering());
assert.equal(await failed.o.successful(), false);
await tx(
  "Settle failed subscription",
  failed.o.connect(a).settleSubscription(),
);
await tx("Withdraw full refund", failed.o.connect(a).withdrawRefund());
assert.equal(await usd.balanceOf(a.address), before);
await rejects("Failed offering proceeds rejected", () =>
  failed.o.connect(issuer).withdrawProceeds.staticCall(),
);
await tx(
  "Recover failed inventory",
  failed.o.connect(issuer).recoverUnsoldTokens(),
);
const failure = {
  address: failed.at,
  demand: await failed.o.totalCommitments(),
  refundsPaid: await failed.o.refundsPaid(),
  accepted: await failed.o.recognizedProceeds(),
  allocated: await failed.o.totalAllocated(),
  paymentBalance: await usd.balanceOf(failed.at),
  tokenBalance: await token.balanceOf(failed.at),
  issuerCPT: await token.balanceOf(issuer.address),
};
assert.equal(failure.issuerCPT, 9000n);
assert.equal(failure.allocated, 0n);
assert.equal(failure.paymentBalance, 0n);
checks.push(
  "Actual allocation and payment balances match the specification",
  "Total supply remains 10,000 CPT",
  "Refund/proceeds conservation",
  "Failure restores the complete 700 mUSD commitment",
);
const result = {
  network: networkName,
  units: "mUSD base units (6 decimals); CPT whole units",
  success,
  failure,
  checks,
  transactions: records,
};
const json = JSON.stringify(
  result,
  (_, v) => (typeof v === "bigint" ? v.toString() : v),
  2,
);
fs.mkdirSync("docs/evidence/subscription", { recursive: true });
fs.writeFileSync("docs/evidence/subscription/demo.json", json + "\n");
console.log(json);
