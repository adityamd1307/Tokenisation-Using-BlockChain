import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const RealWorld = 0n;
const Digital = 1n;
const CPT_SUPPLY = 10_000n;
const CPT_PRICE = ethers.parseEther("0.001");
const DLP_SUPPLY = 5_000n;
const DLP_PRICE = ethers.parseEther("0.002");

// spec-v1 §9: index 0 = admin, 1 = issuer, 2 = investor.
async function deployFactory() {
  const [admin, issuer, investor, otherIssuer, outsider] = await ethers.getSigners();
  const factory = await ethers.deployContract("AssetFactory", [admin.address]);
  await factory.waitForDeployment();
  return { factory, admin, issuer, investor, otherIssuer, outsider };
}

async function authorisedFactory() {
  const state = await deployFactory();
  await state.factory.authorizeIssuer(state.issuer.address);
  await state.factory.authorizeIssuer(state.otherIssuer.address);
  return state;
}

async function attach(factory: Awaited<ReturnType<typeof deployFactory>>["factory"], assetId: bigint) {
  const asset = await factory.getAsset(assetId);
  return {
    asset,
    token: await ethers.getContractAt("AssetToken", asset.tokenContract),
    sale: await ethers.getContractAt("AssetSale", asset.saleContract),
  };
}

async function withCampusPropertyFund() {
  const state = await authorisedFactory();
  await state.factory.connect(state.issuer).createAsset(
    "Campus Property Token", "CPT", "Fictional campus real estate fund", RealWorld, CPT_SUPPLY, CPT_PRICE,
  );
  return { ...state, ...(await attach(state.factory, 0n)) };
}

describe("AssetFactory — Phase 3", function () {
  describe("deployment", function () {
    it("deploys with correct admin address and an empty registry", async function () {
      const { factory, admin } = await networkHelpers.loadFixture(deployFactory);
      expect(await factory.admin()).to.equal(admin.address);
      expect(await factory.getAssetCount()).to.equal(0n);
    });

    it("rejects a zero admin", async function () {
      const { factory } = await networkHelpers.loadFixture(deployFactory);
      await expect(ethers.deployContract("AssetFactory", [ethers.ZeroAddress]))
        .to.be.revertedWithCustomError(factory, "InvalidAdmin");
    });
  });

  // Phase 3 §3.1 authorizeIssuer / revokeIssuer; spec-v1 §5 revert conditions.
  describe("issuer authorisation", function () {
    it("admin can authorise an issuer", async function () {
      const { factory, issuer } = await networkHelpers.loadFixture(deployFactory);
      await expect(factory.authorizeIssuer(issuer.address))
        .to.emit(factory, "IssuerAuthorised").withArgs(issuer.address);
      expect(await factory.authorisedIssuers(issuer.address)).to.equal(true);
    });

    it("authorising an already-authorised issuer or the zero address reverts", async function () {
      const { factory, issuer } = await networkHelpers.loadFixture(authorisedFactory);
      await expect(factory.authorizeIssuer(issuer.address))
        .to.be.revertedWithCustomError(factory, "IssuerAlreadyAuthorised").withArgs(issuer.address);
      await expect(factory.authorizeIssuer(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(factory, "InvalidIssuer");
    });

    it("admin can revoke an issuer", async function () {
      const { factory, issuer } = await networkHelpers.loadFixture(authorisedFactory);
      await expect(factory.revokeIssuer(issuer.address))
        .to.emit(factory, "IssuerRevoked").withArgs(issuer.address);
      expect(await factory.authorisedIssuers(issuer.address)).to.equal(false);
    });

    it("revoking an address that is not authorised reverts", async function () {
      const { factory, outsider } = await networkHelpers.loadFixture(authorisedFactory);
      await expect(factory.revokeIssuer(outsider.address))
        .to.be.revertedWithCustomError(factory, "IssuerNotAuthorised").withArgs(outsider.address);
    });

    it("non-admin cannot authorise or revoke an issuer", async function () {
      const { factory, issuer, outsider } = await networkHelpers.loadFixture(authorisedFactory);
      await expect(factory.connect(outsider).authorizeIssuer(outsider.address))
        .to.be.revertedWithCustomError(factory, "NotAdmin");
      await expect(factory.connect(issuer).authorizeIssuer(outsider.address))
        .to.be.revertedWithCustomError(factory, "NotAdmin");
      await expect(factory.connect(outsider).revokeIssuer(issuer.address))
        .to.be.revertedWithCustomError(factory, "NotAdmin");
      expect(await factory.authorisedIssuers(outsider.address)).to.equal(false);
      expect(await factory.authorisedIssuers(issuer.address)).to.equal(true);
    });
  });

  // Phase 3 §3.1 createAsset, §3.5 test table.
  describe("asset creation", function () {
    it("authorised issuer can create an asset (deploys AssetToken + AssetSale)", async function () {
      const { factory, issuer } = await networkHelpers.loadFixture(authorisedFactory);
      const tx = factory.connect(issuer).createAsset(
        "Campus Property Token", "CPT", "Fictional campus real estate fund", RealWorld, CPT_SUPPLY, CPT_PRICE,
      );
      await expect(tx).to.emit(factory, "AssetCreated");

      const { asset, token, sale } = await attach(factory, 0n);
      await expect(tx).to.emit(factory, "AssetCreated")
        .withArgs(0n, asset.tokenContract, asset.saleContract, issuer.address);
      expect(await ethers.provider.getCode(asset.tokenContract)).to.not.equal("0x");
      expect(await ethers.provider.getCode(asset.saleContract)).to.not.equal("0x");

      expect(await token.name()).to.equal("Campus Property Token");
      expect(await token.symbol()).to.equal("CPT");
      expect(await token.totalSupply()).to.equal(CPT_SUPPLY);
      expect(await token.balanceOf(issuer.address)).to.equal(CPT_SUPPLY);
      expect(await token.balanceOf(await factory.getAddress())).to.equal(0n);
      expect(await token.issuer()).to.equal(issuer.address);
      expect(await token.hasRole(await token.COMPLIANCE_ROLE(), issuer.address)).to.equal(true);
      expect(await token.hasRole(await token.COMPLIANCE_ROLE(), await factory.getAddress())).to.equal(false);
      expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), await factory.getAddress())).to.equal(false);

      expect(await sale.assetToken()).to.equal(asset.tokenContract);
      expect(await sale.issuer()).to.equal(issuer.address);
      expect(await sale.pricePerToken()).to.equal(CPT_PRICE);
    });

    it("created asset is recorded in the registry with full metadata and tokenToSale", async function () {
      const { factory, issuer, asset } = await networkHelpers.loadFixture(withCampusPropertyFund);
      expect(await factory.getAssetCount()).to.equal(1n);
      expect(asset.assetId).to.equal(0n);
      expect(asset.name).to.equal("Campus Property Token");
      expect(asset.symbol).to.equal("CPT");
      expect(asset.description).to.equal("Fictional campus real estate fund");
      expect(asset.assetType).to.equal(RealWorld);
      expect(asset.totalSupply).to.equal(CPT_SUPPLY);
      expect(asset.issuerAddress).to.equal(issuer.address);
      expect(asset.unitPriceWei).to.equal(CPT_PRICE);
      expect(await factory.tokenToSale(asset.tokenContract)).to.equal(asset.saleContract);
    });

    it("issuer creates two different assets that are registered independently", async function () {
      const { factory, issuer, investor } = await networkHelpers.loadFixture(withCampusPropertyFund);
      await expect(factory.connect(issuer).createAsset(
        "Digital Licensing Revenue Pool", "DLP", "Fictional licensing revenue pool", Digital, DLP_SUPPLY, DLP_PRICE,
      )).to.emit(factory, "AssetCreated");

      expect(await factory.getAssetCount()).to.equal(2n);
      const cpt = await attach(factory, 0n);
      const dlp = await attach(factory, 1n);
      expect(dlp.asset.assetId).to.equal(1n);
      expect(dlp.asset.assetType).to.equal(Digital);
      expect(dlp.asset.tokenContract).to.not.equal(cpt.asset.tokenContract);
      expect(dlp.asset.saleContract).to.not.equal(cpt.asset.saleContract);
      expect(await dlp.token.totalSupply()).to.equal(DLP_SUPPLY);
      expect(await dlp.sale.pricePerToken()).to.equal(DLP_PRICE);
      expect(await cpt.token.totalSupply()).to.equal(CPT_SUPPLY);
      expect(await cpt.sale.pricePerToken()).to.equal(CPT_PRICE);

      await cpt.token.connect(issuer).setWhitelisted(investor.address, true);
      expect(await cpt.token.isWhitelisted(investor.address)).to.equal(true);
      expect(await dlp.token.isWhitelisted(investor.address)).to.equal(false);
    });

    it("unauthorised address, including the admin, cannot create an asset", async function () {
      const { factory, admin, outsider } = await networkHelpers.loadFixture(authorisedFactory);
      for (const caller of [outsider, admin]) {
        await expect(factory.connect(caller).createAsset("X", "X", "", RealWorld, 1n, 1n))
          .to.be.revertedWithCustomError(factory, "IssuerNotAuthorised").withArgs(caller.address);
      }
      expect(await factory.getAssetCount()).to.equal(0n);
    });

    it("createAsset with unitPriceWei == 0 reverts", async function () {
      const { factory, issuer } = await networkHelpers.loadFixture(authorisedFactory);
      await expect(factory.connect(issuer).createAsset("X", "X", "", RealWorld, 1n, 0n))
        .to.be.revertedWithCustomError(factory, "InvalidPrice");
    });

    it("createAsset with totalSupply == 0 reverts", async function () {
      const { factory, issuer } = await networkHelpers.loadFixture(authorisedFactory);
      await expect(factory.connect(issuer).createAsset("X", "X", "", RealWorld, 0n, 1n))
        .to.be.revertedWithCustomError(factory, "InvalidSupply");
    });

    it("getAsset reverts for an ID that was never assigned", async function () {
      const { factory } = await networkHelpers.loadFixture(withCampusPropertyFund);
      await expect(factory.getAsset(1n))
        .to.be.revertedWithCustomError(factory, "AssetNotFound").withArgs(1n);
    });

    it("rejects an out-of-range assetType", async function () {
      const { factory, issuer } = await networkHelpers.loadFixture(authorisedFactory);
      await expect(factory.connect(issuer).createAsset("X", "X", "", 2n, 1n, 1n)).to.revert(ethers);
    });
  });

  // spec-v1 §5 note on deauthorisation scope.
  describe("revocation scope", function () {
    it("revoked issuer cannot create new assets but existing contracts keep operating", async function () {
      const { factory, issuer, investor, token, sale } = await networkHelpers.loadFixture(withCampusPropertyFund);
      await factory.revokeIssuer(issuer.address);
      await expect(factory.connect(issuer).createAsset("X", "X", "", RealWorld, 1n, 1n))
        .to.be.revertedWithCustomError(factory, "IssuerNotAuthorised");

      const saleAddress = await sale.getAddress();
      await token.connect(issuer).setWhitelisted(saleAddress, true);
      await token.connect(issuer).setWhitelisted(investor.address, true);
      await token.connect(issuer).approve(saleAddress, 10n);
      await sale.connect(issuer).allocate(10n);
      await sale.connect(investor).buyTokens(10n, { value: 10n * CPT_PRICE });
      await expect(sale.connect(issuer).withdrawProceeds())
        .to.changeEtherBalances(ethers, [issuer, sale], [10n * CPT_PRICE, -10n * CPT_PRICE]);
    });
  });

  // spec-v1 invariant 7: X can only act on contracts X deployed.
  describe("issuer isolation", function () {
    it("issuer A cannot whitelist investors on issuer B's token", async function () {
      const { factory, otherIssuer, investor, token } = await networkHelpers.loadFixture(withCampusPropertyFund);
      await factory.connect(otherIssuer).createAsset("Other", "OTH", "", Digital, 100n, 1n);
      await expect(token.connect(otherIssuer).setWhitelisted(investor.address, true))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(otherIssuer.address, await token.COMPLIANCE_ROLE());
    });

    it("issuer A cannot allocate, withdraw, close or recover on issuer B's sale", async function () {
      const { otherIssuer, sale } = await networkHelpers.loadFixture(withCampusPropertyFund);
      await expect(sale.connect(otherIssuer).allocate(1n)).to.be.revertedWithCustomError(sale, "NotIssuer");
      await expect(sale.connect(otherIssuer).withdrawProceeds()).to.be.revertedWithCustomError(sale, "NotIssuer");
      await expect(sale.connect(otherIssuer).closeSale()).to.be.revertedWithCustomError(sale, "NotIssuer");
      await expect(sale.connect(otherIssuer).recoverUnsoldTokens()).to.be.revertedWithCustomError(sale, "NotIssuer");
    });
  });
});
