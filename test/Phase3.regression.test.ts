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
});
