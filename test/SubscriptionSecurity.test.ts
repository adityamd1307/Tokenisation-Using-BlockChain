import { expect } from "chai";
import { network } from "hardhat";
const { ethers, networkHelpers: h } = await network.create();
const U = (n: number) => BigInt(n) * 1_000_000n;
async function fixture() {
  const [admin, issuer, a, b, other] = await ethers.getSigners();
  const token = await ethers.deployContract("CallbackAssetToken", [
    issuer.address,
  ]);
  const usd = await ethers.deployContract("AdversarialUSD");
  const start = BigInt(await h.time.latest()) + 50n,
    end = start + 180n;
  const config = {
    assetToken: await token.getAddress(),
    paymentToken: await usd.getAddress(),
    issuer: issuer.address,
    supply: 1000n,
    price: U(2),
    softCap: U(1000),
    start,
    end,
  };
  const o = await ethers.deployContract("SubscriptionOffering", [config]),
    at = await o.getAddress();
  await token.connect(issuer).setWhitelisted(at, true);
  await token.connect(issuer).approve(at, 1000);
  await o.connect(issuer).depositOfferingTokens(1000);
  for (const who of [a, b]) {
    await token.connect(issuer).setWhitelisted(who.address, true);
    await usd.mint(who.address, U(10000));
    await usd.connect(who).approve(at, U(10000));
  }
  return { admin, issuer, a, b, other, token, usd, start, end, config, o, at };
}
async function finalized() {
  const f = await fixture();
  await h.time.increaseTo(f.start);
  await f.o.connect(f.a).commit(U(2000));
  await f.o.connect(f.b).commit(U(2000));
  await h.time.increaseTo(f.end);
  await f.o.finalizeOffering();
  await f.o.connect(f.a).settleSubscription();
  return f;
}
describe("Subscription milestone 7 — adversarial transfers and escrow", () => {
  for (const mode of [1, 2, 3])
    it(`rejects incompatible incoming transfers (mode ${mode}) atomically`, async () => {
      const f = await h.loadFixture(fixture);
      await f.usd.configure(mode, ethers.ZeroAddress, "0x");
      await h.time.increaseTo(f.start);
      await expect(f.o.connect(f.a).commit(U(2000))).to.revert(ethers);
      expect(await f.o.totalCommitments()).to.equal(0n);
      expect(await f.o.subscriberCount()).to.equal(0n);
      expect(await f.usd.balanceOf(f.a.address)).to.equal(U(10000));
      expect(await f.usd.balanceOf(f.at)).to.equal(0n);
    });
  for (const mode of [1, 2, 3])
    it(`failed refund transfers preserve the credit and all balances (mode ${mode})`, async () => {
      const f = await h.loadFixture(finalized);
      await f.usd.configure(mode, ethers.ZeroAddress, "0x");
      await expect(f.o.connect(f.a).withdrawRefund()).to.revert(ethers);
      expect((await f.o.entitlements(f.a.address)).refund).to.equal(U(1000));
      expect(await f.o.refundsPaid()).to.equal(0n);
      expect(await f.usd.balanceOf(f.at)).to.equal(U(4000));
      await f.usd.configure(0, ethers.ZeroAddress, "0x");
      await f.o.connect(f.a).withdrawRefund();
    });
  it("supports no-return standard transfers through SafeERC20 with exact balance deltas", async () => {
    const f = await h.loadFixture(fixture);
    await f.usd.configure(5, ethers.ZeroAddress, "0x");
    await h.time.increaseTo(f.start);
    await f.o.connect(f.a).commit(U(1000));
    await h.time.increaseTo(f.end);
    await f.o.finalizeOffering();
    await f.o.connect(f.a).settleSubscription();
    await f.o.connect(f.issuer).withdrawProceeds();
    expect(await f.usd.balanceOf(f.issuer.address)).to.equal(U(1000));
  });
  it("blocks callbacks during commitments with the reentrancy guard", async () => {
    const f = await h.loadFixture(fixture);
    await f.usd.configure(
      4,
      f.at,
      f.o.interface.encodeFunctionData("commit", [U(2)]),
    );
    await h.time.increaseTo(f.start);
    await f.o.connect(f.a).commit(U(2000));
    expect(await f.usd.callbackSucceeded()).to.equal(false);
    expect((await f.usd.callbackResult()).slice(0, 10)).to.equal(
      f.o.interface.getError("ReentrancyGuardReentrantCall")!.selector,
    );
    expect(await f.o.totalCommitments()).to.equal(U(2000));
  });
  for (const operation of [
    "withdrawRefund",
    "withdrawProceeds",
    "settleSubscription",
    "claimTokens",
    "recoverUnsoldTokens",
    "finalizeOffering",
  ])
    it(`rejects cross-function ${operation} callbacks during a refund`, async () => {
      const f = await h.loadFixture(finalized);
      await f.usd.configure(
        4,
        f.at,
        new ethers.Interface(f.o.interface.fragments).encodeFunctionData(
          operation,
        ),
      );
      await f.o.connect(f.a).withdrawRefund();
      expect(await f.usd.callbackSucceeded()).to.equal(false);
      // onlyIssuer may reject before the guard; both paths preserve liabilities.
      expect(await f.usd.balanceOf(f.at)).to.equal(
        await f.o.paymentLiabilities(),
      );
      expect(await f.o.refundsPaid()).to.equal(U(1000));
    });
  it("guards issuer withdrawals and rolls back accounting if transfers fail", async () => {
    const f = await h.loadFixture(finalized);
    await f.usd.configure(2, ethers.ZeroAddress, "0x");
    await expect(f.o.connect(f.issuer).withdrawProceeds()).to.revert(ethers);
    expect(await f.o.proceedsWithdrawn()).to.equal(0n);
    await f.usd.configure(
      4,
      f.at,
      f.o.interface.encodeFunctionData("withdrawRefund"),
    );
    await f.o.connect(f.issuer).withdrawProceeds();
    expect(await f.usd.callbackSucceeded()).to.equal(false);
    expect(await f.usd.balanceOf(f.at)).to.equal(
      await f.o.paymentLiabilities(),
    );
  });
  it("blocks asset callbacks during claims and recovery without double delivery", async () => {
    const f = await h.loadFixture(finalized);
    await f.token.configure(
      f.at,
      f.o.interface.encodeFunctionData("claimTokens"),
    );
    await f.o.connect(f.a).claimTokens();
    expect(await f.token.callbackSucceeded()).to.equal(false);
    expect(await f.token.balanceOf(f.a.address)).to.equal(500n);
    // An unsolicited asset donation is unencumbered, but reserved inventory remains.
    await f.token.connect(f.issuer).transfer(f.at, 10);
    await f.o.connect(f.issuer).recoverUnsoldTokens();
    expect(await f.token.callbackSucceeded()).to.equal(false);
    expect(await f.token.balanceOf(f.at)).to.equal(500n);
  });
  it("detects insufficient payment reserves and prevents selective payouts", async () => {
    const f = await h.loadFixture(finalized);
    await f.usd.destroy(f.at, 1);
    await expect(
      f.o.connect(f.a).withdrawRefund(),
    ).to.be.revertedWithCustomError(f.o, "Insolvent");
    await expect(
      f.o.connect(f.issuer).withdrawProceeds(),
    ).to.be.revertedWithCustomError(f.o, "Insolvent");
    expect((await f.o.entitlements(f.a.address)).refund).to.equal(U(1000));
    expect(await f.o.proceedsWithdrawn()).to.equal(0n);
  });
  it("supports contract investors without redirecting their refund or token ownership", async () => {
    const f = await h.loadFixture(fixture),
      actor = await ethers.deployContract("SubscriptionActor"),
      addr = await actor.getAddress();
    await f.token.connect(f.issuer).setWhitelisted(addr, true);
    await f.usd.mint(addr, U(4000));
    await actor.execute(
      await f.usd.getAddress(),
      f.usd.interface.encodeFunctionData("approve", [f.at, U(4000)]),
    );
    await h.time.increaseTo(f.start);
    await actor.execute(
      f.at,
      f.o.interface.encodeFunctionData("commit", [U(4000)]),
    );
    await h.time.increaseTo(f.end);
    await f.o.finalizeOffering();
    await f.o.settleFor(addr);
    await actor.execute(
      f.at,
      f.o.interface.encodeFunctionData("withdrawRefund"),
    );
    await actor.execute(f.at, f.o.interface.encodeFunctionData("claimTokens"));
    expect(await f.usd.balanceOf(addr)).to.equal(U(2000));
    expect(await f.token.balanceOf(addr)).to.equal(1000n);
  });
  it("does not double pledge inventory across direct and multiple subscription escrows", async () => {
    const f = await h.loadFixture(fixture);
    const direct = await ethers.deployContract("AssetSale", [
      await f.token.getAddress(),
      1,
      f.issuer.address,
    ]);
    const d = await direct.getAddress();
    await f.token.connect(f.issuer).setWhitelisted(d, true);
    await f.token.connect(f.issuer).approve(d, 9000);
    await direct.connect(f.issuer).allocate(9000);
    const second = await ethers.deployContract("SubscriptionOffering", [
        f.config,
      ]),
      s = await second.getAddress();
    await f.token.connect(f.issuer).setWhitelisted(s, true);
    await f.token.connect(f.issuer).approve(s, 1000);
    await expect(
      second.connect(f.issuer).depositOfferingTokens(1000),
    ).to.revert(ethers);
    expect(await f.token.balanceOf(f.at)).to.equal(1000n);
    expect(await f.token.balanceOf(d)).to.equal(9000n);
    await h.time.increaseTo(f.start);
    await f.o.connect(f.a).commit(U(2000));
    expect(await second.totalCommitments()).to.equal(0n);
    expect(await f.usd.balanceOf(s)).to.equal(0n);
  });
  it("documents inherited privileged seizure: finalisation fails safely and stablecoins refund", async () => {
    const f = await h.loadFixture(fixture);
    await h.time.increaseTo(f.start);
    await f.o.connect(f.a).commit(U(2000));
    await f.token.connect(f.issuer).setWhitelisted(f.at, false);
    await f.token
      .connect(f.issuer)
      .forcedTransfer(f.at, f.issuer.address, 1000);
    await h.time.increaseTo(f.end);
    await f.o.finalizeOffering();
    expect(await f.o.successful()).to.equal(false);
    await f.o.connect(f.a).settleSubscription();
    await f.o.connect(f.a).withdrawRefund();
    expect(await f.usd.balanceOf(f.a.address)).to.equal(U(10000));
  });
});
