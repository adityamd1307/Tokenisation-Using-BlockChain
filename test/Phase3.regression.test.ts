import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const PRICE = ethers.parseEther("0.001");

// spec-v1 §9: index 0 = admin, 1 = issuer, 2 = investor.
async function fundedSale() {
  const [admin, issuer, investor, outsider] = await ethers.getSigners();
  const factory = await ethers.deployContract("AssetFactory", [admin.address]);
  await factory.authorizeIssuer(issuer.address);
  await factory.connect(issuer).createAsset("Campus Property Token", "CPT", "", 0n, 10_000n, PRICE);
  const asset = await factory.getAsset(0n);
  const token = await ethers.getContractAt("AssetToken", asset.tokenContract, issuer);
  const sale = await ethers.getContractAt("AssetSale", asset.saleContract, issuer);
  await token.setWhitelisted(asset.saleContract, true);
  await token.approve(asset.saleContract, 5_000n);
  await sale.allocate(5_000n);
  await token.setWhitelisted(investor.address, true);
  return { factory, token, sale, admin, issuer, investor, outsider };
}

describe("Phase 3 audit-1 regressions", function () {
  // AUD-005 (audit-1 F-04): spec-v1 §6 invariant 1, restated. The literal
  // "every holder is whitelisted" contradicts Phase 2 §2.3 revocation.
  describe("AUD-005 invariant 1 through a revocation", function () {
    it("a revoked holder keeps its balance but cannot send, receive or buy until re-approved", async function () {
      const { token, sale, issuer, investor } = await networkHelpers.loadFixture(fundedSale);
      await sale.connect(investor).buyTokens(10n, { value: 10n * PRICE });
      await token.setWhitelisted(investor.address, false);

      expect(await token.balanceOf(investor.address)).to.equal(10n);
      await expect(token.connect(investor).transfer(issuer.address, 1n))
        .to.be.revertedWithCustomError(token, "SenderNotWhitelisted").withArgs(investor.address);
      await expect(token.transfer(investor.address, 1n))
        .to.be.revertedWithCustomError(token, "RecipientNotWhitelisted").withArgs(investor.address);
      await expect(sale.connect(investor).buyTokens(1n, { value: PRICE }))
        .to.be.revertedWithCustomError(sale, "InvestorNotWhitelisted").withArgs(investor.address);
      expect(await token.balanceOf(investor.address)).to.equal(10n);

      await token.setWhitelisted(investor.address, true);
      await token.connect(investor).transfer(issuer.address, 1n);
      expect(await token.balanceOf(investor.address)).to.equal(9n);
    });
  });

  // AUD-006 (audit-1 F-05), decision D6: the issuer always holds DEFAULT_ADMIN_ROLE.
  describe("AUD-006 issuer admin role cannot be removed", function () {
    it("the issuer cannot renounce DEFAULT_ADMIN_ROLE", async function () {
      const { token, issuer } = await networkHelpers.loadFixture(fundedSale);
      const admin = await token.DEFAULT_ADMIN_ROLE();
      // Behaviour first (awaited, so a non-reverting tx is mined inside this test), then the error name.
      const renounce = token.renounceRole(admin, issuer.address);
      await expect(renounce).to.revert(ethers);
      await expect(renounce).to.be.revertedWithCustomError(token, "IssuerAdminRoleLocked");
      expect(await token.hasRole(admin, issuer.address)).to.equal(true);
    });

    it("a delegated administrator cannot revoke the issuer's DEFAULT_ADMIN_ROLE but can drop its own", async function () {
      const { token, issuer, outsider } = await networkHelpers.loadFixture(fundedSale);
      const admin = await token.DEFAULT_ADMIN_ROLE();
      await token.grantRole(admin, outsider.address);
      const revoke = token.connect(outsider).revokeRole(admin, issuer.address);
      await expect(revoke).to.revert(ethers);
      await expect(revoke).to.be.revertedWithCustomError(token, "IssuerAdminRoleLocked");
      await token.connect(outsider).renounceRole(admin, outsider.address);
      expect(await token.hasRole(admin, outsider.address)).to.equal(false);
      expect(await token.hasRole(admin, issuer.address)).to.equal(true);
    });

    it("compliance stays revocable, and the issuer can always restore it and recover locked inventory", async function () {
      const { token, sale, issuer, outsider } = await networkHelpers.loadFixture(fundedSale);
      const admin = await token.DEFAULT_ADMIN_ROLE();
      const compliance = await token.COMPLIANCE_ROLE();
      const saleAddress = await sale.getAddress();
      // Audit probe P4: de-whitelist the sale, lose compliance, try to drop admin, close.
      await token.setWhitelisted(saleAddress, false);
      await token.grantRole(admin, outsider.address);
      await token.connect(outsider).revokeRole(compliance, issuer.address);
      expect(await token.hasRole(compliance, issuer.address)).to.equal(false);
      const renounce = token.renounceRole(admin, issuer.address);
      await expect(renounce).to.revert(ethers);
      await expect(renounce).to.be.revertedWithCustomError(token, "IssuerAdminRoleLocked");
      await sale.closeSale();
      await expect(sale.recoverUnsoldTokens())
        .to.be.revertedWithCustomError(token, "SenderNotWhitelisted").withArgs(saleAddress);

      // The issuer still holds admin, so it can restore compliance and recover.
      await token.grantRole(compliance, issuer.address);
      await token.setWhitelisted(saleAddress, true);
      await sale.recoverUnsoldTokens();
      expect(await token.balanceOf(issuer.address)).to.equal(10_000n);
    });
  });
});
