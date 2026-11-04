import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const PRICE = ethers.parseEther("0.001");
const SUPPLY = 10_000n;

// spec-v1 §9: index 0 = admin, 1 = issuer, 2 = investor.
async function fundedSale() {
  const [admin, issuer, investor, investorC, outsider, otherIssuer] = await ethers.getSigners();
  const factory = await ethers.deployContract("AssetFactory", [admin.address]);
  await factory.authorizeIssuer(issuer.address);
  await factory.connect(issuer).createAsset("Campus Property Token", "CPT", "", 0n, SUPPLY, PRICE);
  const asset = await factory.getAsset(0n);
  const token = await ethers.getContractAt("AssetToken", asset.tokenContract, issuer);
  const sale = await ethers.getContractAt("AssetSale", asset.saleContract, issuer);
  await token.setWhitelisted(asset.saleContract, true);
  await token.approve(asset.saleContract, 5_000n);
  await sale.allocate(5_000n);
  await token.setWhitelisted(investor.address, true);
  await token.setWhitelisted(investorC.address, true);
  await sale.connect(investor).buyTokens(100n, { value: 100n * PRICE });
  return { factory, token, sale, admin, issuer, investor, investorC, outsider, otherIssuer };
}

describe("AssetToken — D5 pause and forced transfer (spec-v1 §5 D5 functions)", function () {
  describe("pause / unpause", function () {
    it("the issuer pauses and unpauses, emitting OpenZeppelin's Paused and Unpaused", async function () {
      const { token, issuer } = await networkHelpers.loadFixture(fundedSale);
      await expect(token.pause()).to.emit(token, "Paused").withArgs(issuer.address);
      expect(await token.paused()).to.equal(true);
      await expect(token.unpause()).to.emit(token, "Unpaused").withArgs(issuer.address);
      expect(await token.paused()).to.equal(false);
    });

    it("rejects pause and unpause from an account without DEFAULT_ADMIN_ROLE", async function () {
      const { token, outsider } = await networkHelpers.loadFixture(fundedSale);
      const adminRole = await token.DEFAULT_ADMIN_ROLE();
      await expect(token.connect(outsider).pause())
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount").withArgs(outsider.address, adminRole);
      await token.pause();
      await expect(token.connect(outsider).unpause())
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount").withArgs(outsider.address, adminRole);
      expect(await token.paused()).to.equal(true);
    });

    it("rejects pause from a compliance-only delegate", async function () {
      const { token, outsider } = await networkHelpers.loadFixture(fundedSale);
      await token.grantRole(await token.COMPLIANCE_ROLE(), outsider.address);
      await expect(token.connect(outsider).pause())
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(outsider.address, await token.DEFAULT_ADMIN_ROLE());
    });

    it("lets a delegated DEFAULT_ADMIN_ROLE holder pause, because authority is the role", async function () {
      const { token, outsider } = await networkHelpers.loadFixture(fundedSale);
      await token.grantRole(await token.DEFAULT_ADMIN_ROLE(), outsider.address);
      await expect(token.connect(outsider).pause()).to.emit(token, "Paused").withArgs(outsider.address);
    });

    it("rejects pausing twice and unpausing when not paused", async function () {
      const { token } = await networkHelpers.loadFixture(fundedSale);
      await expect(token.unpause()).to.be.revertedWithCustomError(token, "ExpectedPause");
      await token.pause();
      await expect(token.pause()).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("does not let one issuer pause another issuer's token (invariant 7)", async function () {
      const { factory, token, otherIssuer, admin } = await networkHelpers.loadFixture(fundedSale);
      await factory.connect(admin).authorizeIssuer(otherIssuer.address);
      await factory.connect(otherIssuer).createAsset("Digital Licensing Pool", "DLP", "", 1n, 500n, PRICE);
      const second = await ethers.getContractAt("AssetToken", (await factory.getAsset(1n)).tokenContract, otherIssuer);
      await expect(second.connect((await ethers.getSigners())[1]).pause())
        .to.be.revertedWithCustomError(second, "AccessControlUnauthorizedAccount");
      await expect(token.connect(otherIssuer).pause())
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
      await second.pause();
      expect(await token.paused()).to.equal(false);
    });
  });

  describe("pause invariant (restated invariant 5)", function () {
    it("blocks transfer and transferFrom while paused and restores them after unpause", async function () {
      const { token, issuer, investor, investorC } = await networkHelpers.loadFixture(fundedSale);
      await token.connect(investor).approve(issuer.address, 10n);
      await token.pause();
      await expect(token.connect(investor).transfer(investorC.address, 1n))
        .to.be.revertedWithCustomError(token, "EnforcedPause");
      await expect(token.transferFrom(investor.address, investorC.address, 1n))
        .to.be.revertedWithCustomError(token, "EnforcedPause");
      await expect(token.transfer(investorC.address, 1n))
        .to.be.revertedWithCustomError(token, "EnforcedPause");
      expect(await token.balanceOf(investor.address)).to.equal(100n);
      expect(await token.allowance(investor.address, issuer.address)).to.equal(10n);
      await token.unpause();
      await token.connect(investor).transfer(investorC.address, 1n);
      await token.transferFrom(investor.address, investorC.address, 1n);
      expect(await token.balanceOf(investorC.address)).to.equal(2n);
    });

    it("blocks AssetSale allocate, buyTokens and recoverUnsoldTokens while paused", async function () {
      const { token, sale, investor } = await networkHelpers.loadFixture(fundedSale);
      await token.approve(await sale.getAddress(), 1n);
      await token.pause();
      await expect(sale.allocate(1n)).to.be.revertedWithCustomError(token, "EnforcedPause");
      await expect(sale.connect(investor).buyTokens(1n, { value: PRICE }))
        .to.be.revertedWithCustomError(token, "EnforcedPause");
      await sale.closeSale();
      await expect(sale.recoverUnsoldTokens()).to.be.revertedWithCustomError(token, "EnforcedPause");
      expect(await sale.availableTokens()).to.equal(4_900n);
      await token.unpause();
      await sale.recoverUnsoldTokens();
      expect(await sale.availableTokens()).to.equal(0n);
    });

    it("still allows whitelist changes and ETH withdrawal while paused", async function () {
      const { token, sale, issuer, outsider } = await networkHelpers.loadFixture(fundedSale);
      await token.pause();
      await token.setWhitelisted(outsider.address, true);
      expect(await token.isWhitelisted(outsider.address)).to.equal(true);
      await expect(sale.withdrawProceeds()).to.changeEtherBalances(ethers, [issuer, sale], [100n * PRICE, -100n * PRICE]);
    });
  });

  describe("forcedTransfer", function () {
    it("moves a revoked holder's balance to a whitelisted address with Transfer and ForcedTransfer", async function () {
      const { token, investor, investorC } = await networkHelpers.loadFixture(fundedSale);
      await token.setWhitelisted(investor.address, false);
      const tx = token.forcedTransfer(investor.address, investorC.address, 100n);
      await expect(tx).to.emit(token, "Transfer").withArgs(investor.address, investorC.address, 100n);
      await expect(tx).to.emit(token, "ForcedTransfer").withArgs(investor.address, investorC.address, 100n);
      expect(await token.balanceOf(investor.address)).to.equal(0n);
      expect(await token.balanceOf(investorC.address)).to.equal(100n);
      expect(await token.totalSupply()).to.equal(SUPPLY);
    });

    it("works while paused", async function () {
      const { token, investor, investorC } = await networkHelpers.loadFixture(fundedSale);
      await token.setWhitelisted(investor.address, false);
      await token.pause();
      await token.forcedTransfer(investor.address, investorC.address, 40n);
      expect(await token.balanceOf(investorC.address)).to.equal(40n);
      expect(await token.paused()).to.equal(true);
    });

    it("rejects callers without DEFAULT_ADMIN_ROLE, including a compliance delegate", async function () {
      const { token, investor, investorC, outsider } = await networkHelpers.loadFixture(fundedSale);
      await token.setWhitelisted(investor.address, false);
      await token.grantRole(await token.COMPLIANCE_ROLE(), outsider.address);
      await expect(token.connect(outsider).forcedTransfer(investor.address, investorC.address, 1n))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(outsider.address, await token.DEFAULT_ADMIN_ROLE());
      expect(await token.balanceOf(investor.address)).to.equal(100n);
    });

    it("rejects taking from a whitelisted holder: a live investor or the sale contract", async function () {
      const { token, sale, issuer, investor, investorC } = await networkHelpers.loadFixture(fundedSale);
      await expect(token.forcedTransfer(investor.address, investorC.address, 1n))
        .to.be.revertedWithCustomError(token, "ForcedTransferFromWhitelisted").withArgs(investor.address);
      const saleAddress = await sale.getAddress();
      await expect(token.forcedTransfer(saleAddress, issuer.address, 1n))
        .to.be.revertedWithCustomError(token, "ForcedTransferFromWhitelisted").withArgs(saleAddress);
      expect(await token.balanceOf(investor.address)).to.equal(100n);
      expect(await sale.availableTokens()).to.equal(4_900n);
    });

    it("rejects the zero address as source, so it cannot mint", async function () {
      const { token, investorC } = await networkHelpers.loadFixture(fundedSale);
      await expect(token.forcedTransfer(ethers.ZeroAddress, investorC.address, 1_000n))
        .to.be.revertedWithCustomError(token, "ForcedTransferFromZeroAddress");
      expect(await token.totalSupply()).to.equal(SUPPLY);
      expect(await token.balanceOf(investorC.address)).to.equal(0n);
    });

    it("rejects a recipient that is not whitelisted, including the zero address", async function () {
      const { token, investor, outsider } = await networkHelpers.loadFixture(fundedSale);
      await token.setWhitelisted(investor.address, false);
      await expect(token.forcedTransfer(investor.address, outsider.address, 1n))
        .to.be.revertedWithCustomError(token, "RecipientNotWhitelisted").withArgs(outsider.address);
      await expect(token.forcedTransfer(investor.address, ethers.ZeroAddress, 1n))
        .to.be.revertedWithCustomError(token, "RecipientNotWhitelisted").withArgs(ethers.ZeroAddress);
      expect(await token.totalSupply()).to.equal(SUPPLY);
    });

    it("rejects an amount above the holder's balance", async function () {
      const { token, investor, investorC } = await networkHelpers.loadFixture(fundedSale);
      await token.setWhitelisted(investor.address, false);
      await expect(token.forcedTransfer(investor.address, investorC.address, 101n))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance").withArgs(investor.address, 100n, 101n);
    });

    it("does not let one issuer force-transfer on another issuer's token (invariant 7)", async function () {
      const { token, investor, investorC, otherIssuer } = await networkHelpers.loadFixture(fundedSale);
      await token.setWhitelisted(investor.address, false);
      await expect(token.connect(otherIssuer).forcedTransfer(investor.address, investorC.address, 1n))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("recovers a lost-key holding: revoke, then force-transfer to a new wallet", async function () {
      const { token, investor, outsider } = await networkHelpers.loadFixture(fundedSale);
      const lost = investor;
      const replacement = outsider;
      await token.setWhitelisted(lost.address, false);
      await token.setWhitelisted(replacement.address, true);
      await token.forcedTransfer(lost.address, replacement.address, await token.balanceOf(lost.address));
      expect(await token.balanceOf(lost.address)).to.equal(0n);
      expect(await token.balanceOf(replacement.address)).to.equal(100n);
      await expect(token.connect(lost).transfer(replacement.address, 0n))
        .to.be.revertedWithCustomError(token, "SenderNotWhitelisted").withArgs(lost.address);
    });
  });

  describe("forced-transfer invariant (restated invariant 6)", function () {
    it("only succeeds from a non-zero revoked address to a whitelisted one, and never changes totalSupply", async function () {
      const { token, sale, issuer, investor, investorC, outsider } = await networkHelpers.loadFixture(fundedSale);
      const accounts = [issuer.address, investor.address, investorC.address, outsider.address, await sale.getAddress(), ethers.ZeroAddress];
      await token.setWhitelisted(investor.address, false);
      for (const from of accounts) {
        for (const to of accounts) {
          const eligible = from !== ethers.ZeroAddress && !(await token.isWhitelisted(from)) && (await token.isWhitelisted(to));
          const balance = from === ethers.ZeroAddress ? 0n : await token.balanceOf(from);
          const amount = balance > 0n ? 1n : 0n;
          const tx = token.forcedTransfer(from, to, amount);
          if (eligible) await expect(tx).to.emit(token, "ForcedTransfer").withArgs(from, to, amount);
          else await expect(tx).to.revert(ethers);
          expect(await token.totalSupply()).to.equal(SUPPLY);
        }
      }
    });
  });
});
