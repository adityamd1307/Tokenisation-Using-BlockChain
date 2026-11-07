import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers: helpers } = await network.create();
const USD = (n: number | bigint) => BigInt(n) * 1_000_000n;

async function fixture() {
  const [admin, issuer, a, b, c, outsider, secondIssuer] =
    await ethers.getSigners();
  const factory = await ethers.deployContract("AssetFactory", [admin.address]);
  await factory.authorizeIssuer(issuer.address);
  await factory.authorizeIssuer(secondIssuer.address);
  await factory
    .connect(issuer)
    .createAsset("Campus Property Token", "CPT", "Simulated", 0, 10_000n, 1n);
  const asset = await factory.getAsset(0);
  const token = await ethers.getContractAt("AssetToken", asset.tokenContract);
  const usd = await ethers.deployContract("MockUSD", [admin.address]);
  const registry = await ethers.deployContract("SubscriptionFactory", [
    await factory.getAddress(),
    await usd.getAddress(),
  ]);
  const start = BigInt(await helpers.time.latest()) + 100n;
  const end = start + 180n;
  const config = {
    assetToken: await token.getAddress(),
    paymentToken: await usd.getAddress(),
    issuer: issuer.address,
    supply: 1000n,
    price: USD(2),
    softCap: USD(1200),
    start,
    end,
  };
  await registry
    .connect(issuer)
    .createOffering(0, config.supply, config.price, config.softCap, start, end);
  const offering = await ethers.getContractAt(
    "SubscriptionOffering",
    await registry.offeringAt(0),
  );
  const address = await offering.getAddress();
  await token.connect(issuer).setWhitelisted(address, true);
  await token.connect(issuer).approve(address, 1000);
  for (const investor of [a, b, c]) {
    await token.connect(issuer).setWhitelisted(investor.address, true);
    await usd.mint(investor.address, USD(10_000));
    await usd.connect(investor).approve(address, USD(10_000));
  }
  return {
    admin,
    issuer,
    a,
    b,
    c,
    outsider,
    secondIssuer,
    factory,
    token,
    usd,
    registry,
    offering,
    address,
    config,
    start,
    end,
  };
}
async function funded() {
  const f = await fixture();
  await f.offering.connect(f.issuer).depositOfferingTokens(1000);
  return f;
}
async function open() {
  const f = await funded();
  await helpers.time.increaseTo(f.start);
  return f;
}
async function oversubscribed() {
  const f = await open();
  for (const [who, amount] of [
    [f.a, 1800],
    [f.b, 1400],
    [f.c, 800],
  ] as const)
    await f.offering.connect(who).commit(USD(amount));
  await helpers.time.increaseTo(f.end);
  await f.offering.connect(f.outsider).finalizeOffering();
  return f;
}
async function solvency(f: Awaited<ReturnType<typeof fixture>>) {
  const o = f.offering;
  expect(await f.usd.balanceOf(f.address)).to.be.gte(
    await o.paymentLiabilities(),
  );
  expect(await o.recognizedProceeds()).to.be.lte(await o.hardCap());
  expect(await o.totalAllocated()).to.be.lte(await o.tokenSupplyForSale());
  expect(await f.token.balanceOf(f.address)).to.be.gte(
    await o.reservedTokens(),
  );
  expect(await o.totalCommitments()).to.equal(
    (await o.paymentLiabilities()) +
      (await o.refundsPaid()) +
      (await o.proceedsWithdrawn()),
  );
}

describe("Subscription milestone 2 — currency, configuration and registry", () => {
  it("mints six-decimal simulated currency only through its owner", async () => {
    const f = await helpers.loadFixture(fixture);
    expect(await f.usd.name()).to.equal("Mock USD");
    expect(await f.usd.symbol()).to.equal("mUSD");
    expect(await f.usd.decimals()).to.equal(6n);
    expect(await f.usd.balanceOf(f.a.address)).to.equal(USD(10_000));
    await expect(
      f.usd.connect(f.a).mint(f.a.address, 1),
    ).to.be.revertedWithCustomError(f.usd, "OwnableUnauthorizedAccount");
    await expect(
      ethers.deployContract("MockUSD", [ethers.ZeroAddress]),
    ).to.revert(ethers);
  });
  it("preserves the asset registry and assigns the issuer, token, caps and immutable dates", async () => {
    const f = await helpers.loadFixture(fixture),
      o = f.offering;
    expect(await o.issuer()).to.equal(f.issuer.address);
    expect(await o.assetToken()).to.equal(await f.token.getAddress());
    expect(await o.paymentToken()).to.equal(await f.usd.getAddress());
    expect(await o.tokenSupplyForSale()).to.equal(1000n);
    expect(await o.tokenPrice()).to.equal(USD(2));
    expect(await o.softCap()).to.equal(USD(1200));
    expect(await o.hardCap()).to.equal(USD(2000));
    expect(await o.subscriptionStart()).to.equal(f.start);
    expect(await o.subscriptionEnd()).to.equal(f.end);
    expect(await f.registry.assetIdOf(f.address)).to.equal(0n);
    expect(await f.registry.isOffering(f.address)).to.equal(true);
    expect(await f.factory.getAssetCount()).to.equal(1n);
    expect(await f.token.totalSupply()).to.equal(10_000n);
  });
  for (const key of ["supply", "price", "softCap", "start", "end"] as const)
    it(`rejects zero ${key}`, async () => {
      const f = await helpers.loadFixture(fixture);
      await expect(
        ethers.deployContract("SubscriptionOffering", [
          { ...f.config, [key]: 0n },
        ]),
      ).to.revert(ethers);
    });
  it("rejects EOA/zero tokens, wrong decimals, wrong issuer, overflow and inconsistent caps/times", async () => {
    const f = await helpers.loadFixture(fixture);
    const cases = [
      { assetToken: ethers.ZeroAddress },
      { paymentToken: f.a.address },
      { issuer: ethers.ZeroAddress },
      { issuer: f.a.address },
      { paymentToken: await f.token.getAddress() },
      { supply: 10001n },
      { price: ethers.MaxUint256 },
      { softCap: USD(2001) },
      { start: BigInt(await helpers.time.latest()) },
      { end: f.start },
      { end: f.start - 1n },
    ];
    for (const c of cases)
      await expect(
        ethers.deployContract("SubscriptionOffering", [{ ...f.config, ...c }]),
      ).to.revert(ethers);
    await expect(
      ethers.deployContract("SubscriptionFactory", [
        f.a.address,
        await f.usd.getAddress(),
      ]),
    ).to.revert(ethers);
  });
  it("blocks outsiders, another authorised issuer and revoked issuers from offering this asset", async () => {
    const f = await helpers.loadFixture(fixture);
    for (const who of [f.outsider, f.secondIssuer])
      await expect(
        f.registry
          .connect(who)
          .createOffering(0, 100, USD(2), USD(10), f.start, f.end),
      ).to.be.revertedWithCustomError(f.registry, "NotAssetIssuer");
    await f.factory.revokeIssuer(f.issuer.address);
    await expect(
      f.registry
        .connect(f.issuer)
        .createOffering(0, 100, USD(2), USD(10), f.start, f.end),
    ).to.revert(ethers);
    await expect(
      f.registry
        .connect(f.issuer)
        .createOffering(99, 100, USD(2), USD(10), f.start, f.end),
    ).to.revert(ethers);
  });
});

describe("Subscription milestone 3 — escrow and time window", () => {
  it("requires issuer, whitelist, allowance, positive bounded deposits and permits partial funding", async () => {
    const f = await helpers.loadFixture(fixture),
      o = f.offering.connect(f.issuer);
    await expect(
      f.offering.connect(f.a).depositOfferingTokens(1),
    ).to.be.revertedWithCustomError(o, "NotIssuer");
    await expect(o.depositOfferingTokens(0)).to.revert(ethers);
    await expect(o.depositOfferingTokens(1001)).to.revert(ethers);
    await f.token.connect(f.issuer).setWhitelisted(f.address, false);
    await expect(o.depositOfferingTokens(1)).to.revert(ethers);
    await f.token.connect(f.issuer).setWhitelisted(f.address, true);
    await f.token.connect(f.issuer).approve(f.address, 0);
    await expect(o.depositOfferingTokens(1)).to.revert(ethers);
    await f.token.connect(f.issuer).approve(f.address, 1000);
    await o.depositOfferingTokens(300);
    await o.depositOfferingTokens(700);
    expect(await o.depositedInventory()).to.equal(1000n);
    await expect(o.depositOfferingTokens(1)).to.revert(ethers);
    expect(await f.token.balanceOf(f.issuer.address)).to.equal(9000n);
  });
  it("enforces exact start/end boundaries and rejects deposits at start", async () => {
    const f = await helpers.loadFixture(funded);
    await expect(
      f.offering.connect(f.a).commit(USD(2)),
    ).to.be.revertedWithCustomError(f.offering, "WrongStage");
    await helpers.time.setNextBlockTimestamp(f.start);
    await f.offering.connect(f.a).commit(USD(2));
    await expect(
      f.offering.connect(f.issuer).depositOfferingTokens(1),
    ).to.be.revertedWithCustomError(f.offering, "WrongStage");
    await helpers.time.increaseTo(f.end);
    await expect(
      f.offering.connect(f.a).commit(USD(2)),
    ).to.be.revertedWithCustomError(f.offering, "WrongStage");
    expect(await f.offering.state()).to.equal(2n);
  });
  it("rejects underfunded subscriptions even when donated tokens supply the balance", async () => {
    const f = await helpers.loadFixture(fixture);
    await f.token.connect(f.issuer).transfer(f.address, 1000);
    await helpers.time.increaseTo(f.start);
    await expect(
      f.offering.connect(f.a).commit(USD(2)),
    ).to.be.revertedWithCustomError(f.offering, "InventoryNotFunded");
  });
  it("checks eligibility, multiples, balances and allowances without changing accounting on failure", async () => {
    const f = await helpers.loadFixture(open),
      o = f.offering;
    await expect(
      o.connect(f.outsider).commit(USD(2)),
    ).to.be.revertedWithCustomError(o, "InvestorNotEligible");
    for (const amount of [0n, 1n, USD(3)])
      await expect(o.connect(f.a).commit(amount)).to.be.revertedWithCustomError(
        o,
        "InvalidAmount",
      );
    await f.usd.connect(f.a).approve(f.address, 0);
    await expect(o.connect(f.a).commit(USD(2))).to.revert(ethers);
    await f.usd.connect(f.a).approve(f.address, USD(20_000));
    await expect(o.connect(f.a).commit(USD(12_000))).to.revert(ethers);
    expect(await o.totalCommitments()).to.equal(0n);
    expect(await o.subscriberCount()).to.equal(0n);
  });
  it("accepts oversubscription, accumulates top-ups and counts distinct subscribers only", async () => {
    const f = await helpers.loadFixture(open),
      o = f.offering;
    await expect(o.connect(f.a).commit(USD(1800)))
      .to.emit(o, "SubscriptionCommitted")
      .withArgs(f.a.address, USD(1800), USD(1800));
    await o.connect(f.a).commit(USD(200));
    await o.connect(f.b).commit(USD(2000));
    expect(await o.totalCommitments()).to.equal(USD(4000));
    expect(await o.commitments(f.a.address)).to.equal(USD(2000));
    expect(await o.subscriberCount()).to.equal(2n);
    await solvency(f);
  });
});

describe("Subscription milestones 4–5 — allocation, settlement and independent payouts", () => {
  it("blocks early and repeated finalisation and all premature settlement/claims/refunds/recovery", async () => {
    const f = await helpers.loadFixture(open),
      o = f.offering;
    for (const call of [
      () => o.finalizeOffering(),
      () => o.settleSubscription(),
      () => o.claimTokens(),
      () => o.withdrawRefund(),
      () => o.connect(f.issuer).withdrawProceeds(),
      () => o.connect(f.issuer).recoverUnsoldTokens(),
    ])
      await expect(call()).to.revert(ethers);
    await helpers.time.increaseTo(f.end);
    await o.finalizeOffering();
    await expect(o.finalizeOffering()).to.be.revertedWithCustomError(
      o,
      "WrongStage",
    );
    expect(await o.state()).to.equal(4n);
    await o.connect(f.issuer).recoverUnsoldTokens();
    expect(await f.token.balanceOf(f.issuer.address)).to.equal(10_000n);
  });
  it("settles 1800/1400/800 into 450/350/200, protects unsettled deposits and refunds", async () => {
    const f = await helpers.loadFixture(oversubscribed),
      o = f.offering;
    expect(await o.successful()).to.equal(true);
    expect(await o.guaranteedAcceptedFunding()).to.equal(USD(1996));
    await expect(
      o.connect(f.issuer).withdrawProceeds(),
    ).to.be.revertedWithCustomError(o, "NothingDue");
    for (const [who, allocation, accepted] of [
      [f.a, 450n, 900],
      [f.b, 350n, 700],
      [f.c, 200n, 400],
    ] as const) {
      expect(await o.allocationOf(who.address)).to.deep.equal([
        allocation,
        USD(accepted),
        USD(accepted),
      ]);
      await o.connect(who).settleSubscription();
      await solvency(f);
      await o.connect(f.issuer).withdrawProceeds();
      await solvency(f);
      await o.connect(who).withdrawRefund();
      await solvency(f);
      await o.connect(who).claimTokens();
      await solvency(f);
      expect(await f.token.balanceOf(who.address)).to.equal(allocation);
      expect(await f.usd.balanceOf(who.address)).to.equal(
        USD(10_000 - accepted),
      );
    }
    expect(await f.usd.balanceOf(f.issuer.address)).to.equal(USD(2000));
    expect(await f.usd.balanceOf(f.address)).to.equal(0n);
    expect(await o.refundsPaid()).to.equal(USD(2000));
    expect(await f.token.totalSupply()).to.equal(10_000n);
  });
  it("handles 1400 mUSD undersubscription and protects unclaimed entitlements during recovery", async () => {
    const f = await helpers.loadFixture(open),
      o = f.offering;
    await o.connect(f.a).commit(USD(1000));
    await o.connect(f.b).commit(USD(400));
    await helpers.time.increaseTo(f.end);
    await o.finalizeOffering();
    expect(await o.guaranteedAcceptedFunding()).to.equal(USD(1400));
    expect(await o.recoverableTokens()).to.equal(300n);
    await o.connect(f.issuer).recoverUnsoldTokens();
    expect(await f.token.balanceOf(f.address)).to.equal(700n);
    await o.settleFor(f.a.address);
    await o.settleFor(f.b.address);
    await expect(o.connect(f.a).withdrawRefund()).to.be.revertedWithCustomError(
      o,
      "NothingDue",
    );
    await expect(
      o.connect(f.issuer).recoverUnsoldTokens(),
    ).to.be.revertedWithCustomError(o, "NothingDue");
    await o.connect(f.a).claimTokens();
    await o.connect(f.b).claimTokens();
    await solvency(f);
  });
  it("fails with 700 mUSD, refunds fully after revocation and recovers all inventory", async () => {
    const f = await helpers.loadFixture(open),
      o = f.offering;
    await o.connect(f.a).commit(USD(700));
    await helpers.time.increaseTo(f.end);
    await o.finalizeOffering();
    expect(await o.successful()).to.equal(false);
    await f.token.connect(f.issuer).setWhitelisted(f.a.address, false);
    await o.connect(f.a).settleSubscription();
    await o.connect(f.a).withdrawRefund();
    expect(await f.usd.balanceOf(f.a.address)).to.equal(USD(10_000));
    await expect(o.connect(f.a).claimTokens()).to.revert(ethers);
    await expect(o.connect(f.issuer).withdrawProceeds()).to.revert(ethers);
    await o.connect(f.issuer).recoverUnsoldTokens();
    await solvency(f);
  });
  it("preserves refunds when claims are blocked by revocation or pause, then allows reapproved claims", async () => {
    const f = await helpers.loadFixture(oversubscribed),
      o = f.offering;
    await f.token.connect(f.issuer).setWhitelisted(f.a.address, false);
    await f.token.connect(f.issuer).pause();
    await o.connect(f.a).settleSubscription();
    await expect(o.connect(f.a).claimTokens()).to.revert(ethers);
    await o.connect(f.a).withdrawRefund();
    expect((await o.entitlements(f.a.address)).allocation).to.equal(450n);
    expect((await o.entitlements(f.a.address)).claimed).to.equal(false);
    await f.token.connect(f.issuer).unpause();
    await f.token.connect(f.issuer).setWhitelisted(f.a.address, true);
    await o.connect(f.a).claimTokens();
    await solvency(f);
  });
  it("prevents repeated payouts, settlement, claiming others and unauthorised issuer actions", async () => {
    const f = await helpers.loadFixture(oversubscribed),
      o = f.offering;
    await o.settleFor(f.a.address);
    await expect(
      o.connect(f.a).settleSubscription(),
    ).to.be.revertedWithCustomError(o, "AlreadySettled");
    await expect(o.connect(f.outsider).claimTokens()).to.revert(ethers);
    await expect(o.settleFor(f.outsider.address)).to.revert(ethers);
    await expect(
      o.connect(f.a).withdrawProceeds(),
    ).to.be.revertedWithCustomError(o, "NotIssuer");
    await expect(
      o.connect(f.a).recoverUnsoldTokens(),
    ).to.be.revertedWithCustomError(o, "NotIssuer");
    await o.connect(f.a).claimTokens();
    await expect(o.connect(f.a).claimTokens()).to.be.revertedWithCustomError(
      o,
      "NothingDue",
    );
    expect((await o.entitlements(f.a.address)).refund).to.equal(USD(900));
    await o.connect(f.a).withdrawRefund();
    await expect(o.connect(f.a).withdrawRefund()).to.be.revertedWithCustomError(
      o,
      "NothingDue",
    );
    await solvency(f);
  });
  it("never credits stablecoin donations as issuer earnings", async () => {
    const f = await helpers.loadFixture(oversubscribed),
      o = f.offering;
    await f.usd.mint(f.address, USD(100));
    for (const who of [f.a, f.b, f.c]) {
      await o.settleFor(who.address);
      await o.connect(who).withdrawRefund();
    }
    await o.connect(f.issuer).withdrawProceeds();
    expect(await f.usd.balanceOf(f.address)).to.equal(USD(100));
    await expect(o.connect(f.issuer).withdrawProceeds()).to.revert(ethers);
    await solvency(f);
  });
});

describe("Subscription rounding and bounded model invariants", () => {
  async function custom(
    supply: bigint,
    price: bigint,
    soft: bigint,
    amounts: bigint[],
  ) {
    const f = await helpers.loadFixture(fixture);
    const o = await ethers.deployContract("SubscriptionOffering", [
      { ...f.config, supply, price, softCap: soft },
    ]);
    const addr = await o.getAddress();
    await f.token.connect(f.issuer).setWhitelisted(addr, true);
    await f.token.connect(f.issuer).approve(addr, supply);
    await o.connect(f.issuer).depositOfferingTokens(supply);
    for (const who of [f.a, f.b, f.c])
      await f.usd.connect(who).approve(addr, ethers.MaxUint256);
    await helpers.time.increaseTo(f.start);
    for (let i = 0; i < amounts.length; i++)
      await o.connect([f.a, f.b, f.c][i]).commit(amounts[i]);
    await helpers.time.increaseTo(f.end);
    await o.finalizeOffering();
    return { ...f, offering: o, address: addr };
  }
  it("fails when rounding makes actual accepted proceeds lower than the soft cap despite gross demand", async () => {
    const f = await custom(7n, USD(2), USD(14), [USD(6), USD(6), USD(6)]);
    expect(await f.offering.totalCommitments()).to.equal(USD(18));
    expect(await f.offering.successful()).to.equal(false);
    expect(await f.offering.allocationOf(f.a.address)).to.deep.equal([
      0n,
      0n,
      USD(6),
    ]);
  });
  it("handles more subscribers than units without underflow or false success", async () => {
    const f = await custom(2n, 1n, 1n, [1n, 1n, 1n]);
    expect(await f.offering.successful()).to.equal(false);
    expect(await f.offering.guaranteedAcceptedFunding()).to.equal(0n);
  });
  it("succeeds exactly at the soft cap and exactly at the hard cap", async () => {
    for (const amount of [USD(1200), USD(2000)]) {
      const f = await custom(1000n, USD(2), USD(1200), [amount]);
      expect(await f.offering.successful()).to.equal(true);
      expect(await f.offering.allocationOf(f.a.address)).to.deep.equal([
        amount / USD(2),
        amount,
        0n,
      ]);
    }
  });
  it("produces identical final entitlements in forward and reverse settlement and claim order", async () => {
    const f = await helpers.loadFixture(oversubscribed),
      o = f.offering;
    const snapshot = await helpers.takeSnapshot();
    async function execute(actors: (typeof f.a)[]) {
      for (const who of actors) {
        await o.connect(who).settleSubscription();
        await o.connect(who).claimTokens();
        await o.connect(who).withdrawRefund();
      }
      return Promise.all(
        [f.a, f.b, f.c].map(async (who) => [
          await f.token.balanceOf(who.address),
          await f.usd.balanceOf(who.address),
        ]),
      );
    }
    const forward = await execute([f.a, f.b, f.c]);
    await snapshot.restore();
    expect(await execute([f.c, f.b, f.a])).to.deep.equal(forward);
  });
  it("three equal subscribers receive two of seven units each; dust unlocks only after all settle", async () => {
    const f = await custom(7n, USD(2), USD(10), [USD(6), USD(6), USD(6)]),
      o = f.offering;
    expect(await o.guaranteedAcceptedFunding()).to.equal(USD(10));
    await o.settleFor(f.a.address);
    await o.settleFor(f.b.address);
    expect(await o.recoverableTokens()).to.equal(0n);
    await o.settleFor(f.c.address);
    expect(await o.totalAllocated()).to.equal(6n);
    expect(await o.recoverableTokens()).to.equal(1n);
    await o.connect(f.issuer).recoverUnsoldTokens();
    for (const who of [f.c, f.a, f.b]) {
      await o.connect(who).claimTokens();
      await o.connect(who).withdrawRefund();
    }
    expect(await o.recognizedProceeds()).to.equal(USD(12));
    await solvency(f);
  });
  it("conservatively fails when gross demand exceeds soft cap but rounded funding is not guaranteed", async () => {
    const f = await custom(7n, USD(2), USD(12), [USD(6), USD(6), USD(6)]);
    expect(await f.offering.successful()).to.equal(false);
    expect(await f.offering.allocationOf(f.a.address)).to.deep.equal([
      0n,
      0n,
      USD(6),
    ]);
  });
  it("allows zero-token subscribers a full refund without erasing others' entitlement", async () => {
    const f = await custom(7n, 1n, 5n, [1n, 1n, 100n]),
      o = f.offering;
    expect(await o.allocationOf(f.a.address)).to.deep.equal([0n, 0n, 1n]);
    await o.connect(f.a).settleSubscription();
    await o.connect(f.a).withdrawRefund();
    await expect(o.connect(f.a).claimTokens()).to.be.revertedWithCustomError(
      o,
      "NothingDue",
    );
    expect((await o.allocationOf(f.c.address))[0]).to.equal(6n);
    await solvency(f);
  });
  for (const seed of [7n, 41n, 2026n])
    it(`conserves exact accounting under seeded top-ups and payout ordering (${seed})`, async () => {
      const f = await helpers.loadFixture(open),
        o = f.offering,
        actors = [f.a, f.b, f.c];
      let s = seed;
      const random = () => {
        s = (s * 1103515245n + 12345n) % 2147483648n;
        return s;
      };
      const model = [0n, 0n, 0n];
      for (let i = 0; i < 18; i++) {
        const a = Number(random() % 3n),
          amount = ((random() % 100n) + 100n) * USD(2);
        model[a] += amount;
        await o.connect(actors[a]).commit(amount);
        await solvency(f);
      }
      await helpers.time.increaseTo(f.end);
      await o.finalizeOffering();
      const total = model.reduce((a, b) => a + b, 0n);
      const order = seed % 2n ? [2, 0, 1] : [0, 1, 2];
      for (const i of order) {
        const alloc = (model[i] * 1000n) / total,
          accepted = alloc * USD(2),
          refund = model[i] - accepted;
        expect(await o.allocationOf(actors[i].address)).to.deep.equal([
          alloc,
          accepted,
          refund,
        ]);
        await o.settleFor(actors[i].address);
        await solvency(f);
        if (i % 2) {
          await o.connect(actors[i]).claimTokens();
          await o.connect(actors[i]).withdrawRefund();
        } else {
          await o.connect(actors[i]).withdrawRefund();
          await o.connect(actors[i]).claimTokens();
        }
        await o.connect(f.issuer).withdrawProceeds();
        await solvency(f);
      }
      const expected = model.map((x) => (x * 1000n) / total);
      expect(await o.totalAllocated()).to.equal(
        expected.reduce((a, b) => a + b, 0n),
      );
      if ((await o.recoverableTokens()) > 0n)
        await o.connect(f.issuer).recoverUnsoldTokens();
      for (let i = 0; i < 3; i++)
        expect((await o.allocationOf(actors[i].address))[0]).to.equal(
          expected[i],
        );
      await solvency(f);
    });
  it("handles multiplication beyond 256 bits using full-precision mulDiv", async () => {
    const f = await helpers.loadFixture(fixture);
    const supply = 1n << 150n,
      price = 1n,
      amount = 1n << 200n;
    const token = await ethers.deployContract("AssetToken", [
      "Large",
      "L",
      supply,
      f.issuer.address,
    ]);
    const o = await ethers.deployContract("SubscriptionOffering", [
      {
        ...f.config,
        assetToken: await token.getAddress(),
        supply,
        price,
        softCap: 1n,
      },
    ]);
    const addr = await o.getAddress();
    await token.connect(f.issuer).setWhitelisted(addr, true);
    await token.connect(f.issuer).approve(addr, supply);
    await o.connect(f.issuer).depositOfferingTokens(supply);
    for (const who of [f.a, f.b]) {
      await token.connect(f.issuer).setWhitelisted(who.address, true);
      await f.usd.mint(who.address, amount);
      await f.usd.connect(who).approve(addr, amount);
    }
    await helpers.time.increaseTo(f.start);
    await o.connect(f.a).commit(amount);
    await o.connect(f.b).commit(amount);
    await helpers.time.increaseTo(f.end);
    await o.finalizeOffering();
    expect((await o.allocationOf(f.a.address))[0]).to.equal(supply / 2n);
  });
});
