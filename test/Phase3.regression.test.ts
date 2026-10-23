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
  // AUD-005 (audit-1 F-04): spec-v1 §6 invariant 1 as literally written.
  describe("AUD-005 invariant 1 through a revocation", function () {
    it("every address with a non-zero balance is whitelisted, even after an investor is revoked", async function () {
      const { token, sale, issuer, investor } = await networkHelpers.loadFixture(fundedSale);
      await sale.connect(investor).buyTokens(10n, { value: 10n * PRICE });
      await token.setWhitelisted(investor.address, false);
      for (const holder of [issuer.address, investor.address, await sale.getAddress()]) {
        if ((await token.balanceOf(holder)) > 0n) {
          expect(await token.isWhitelisted(holder), `holder ${holder}`).to.equal(true);
        }
      }
    });
  });
});
