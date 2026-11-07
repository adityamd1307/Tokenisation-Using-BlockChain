import { expect } from "chai";
import { network } from "hardhat";
const { ethers, networkHelpers: h } = await network.create();
const usd = (n: number) => BigInt(n) * 1_000_000n;
async function fixture() {
  const [
    admin,
    issuer,
    attestor,
    investor,
    other,
    expired,
    restricted,
    attacker,
  ] = await ethers.getSigners();
  const factory = await ethers.deployContract("RegulatedAssetFactory", [
    admin.address,
  ]);
  await factory.authorizeIssuer(issuer.address);
  await factory
    .connect(issuer)
    .createRegulatedAsset({
      name: "Campus Property Token",
      symbol: "CPT",
      description: "Synthetic",
      assetType: 0,
      supply: 10000,
      price: 1,
      maximum: 500,
      accredited: true,
    });
  const a = await factory.getAsset(0);
  const token = await ethers.getContractAt(
    "RegulatedAssetToken",
    a.tokenContract,
  );
  const sale = await ethers.getContractAt("AssetSale", a.saleContract);
  const m = await factory.modules(0);
  const registry = await ethers.getContractAt(
    "IdentityRegistryLite",
    m.identityRegistry,
  );
  const policy = await ethers.getContractAt("ComplianceLite", m.compliance);
  const role = await registry.TRUSTED_ATTESTOR_ROLE();
  await registry.grantRole(role, attestor.address);
  await policy.connect(issuer).setCountryAllowed(702, true);
  const expiry = (await h.time.latest()) + 10000;
  const data = (
    who: string,
    country = 702,
    accredited = true,
    validUntil = expiry,
  ) => ({
    identityId: ethers.id(`synthetic:${who}`),
    country,
    kycApproved: true,
    accredited,
    validUntil,
  });
  for (const who of [investor, other])
    await registry
      .connect(attestor)
      .registerIdentity(who.address, data(who.address));
  await registry
    .connect(attestor)
    .registerIdentity(
      expired.address,
      data(expired.address, 702, true, expiry - 9000),
    );
  await registry
    .connect(attestor)
    .registerIdentity(restricted.address, data(restricted.address, 356));
  const payment = await ethers.deployContract("MockUSD", [admin.address]);
  const sf = await ethers.deployContract("SubscriptionFactory", [
    await factory.getAddress(),
    await payment.getAddress(),
  ]);
  await factory.setSubscriptionFactory(await sf.getAddress());
  return {
    admin,
    issuer,
    attestor,
    investor,
    other,
    expired,
    restricted,
    attacker,
    factory,
    token,
    sale,
    registry,
    policy,
    role,
    expiry,
    data,
    payment,
    sf,
  };
}

describe("Compliance Lite identity and trusted attestors", () => {
  it("stores only synthetic metadata and verifies approved live credentials", async () => {
    const f = await h.loadFixture(fixture);
    const i = await f.registry.identity(f.investor.address);
    expect(i.identityId).eq(f.data(f.investor.address).identityId);
    expect(i.attestedBy).eq(f.attestor.address);
    expect(i.length).eq(7);
    expect(await f.registry.isVerified(f.investor.address)).eq(true);
    expect(await f.registry.identityStatus(f.attacker.address)).eq(1);
    expect(await f.registry.hasRole(f.role, f.admin.address)).eq(false);
  });
  it("rejects untrusted registration, updates, revocation and role escalation", async () => {
    const f = await h.loadFixture(fixture);
    await expect(
      f.registry
        .connect(f.attacker)
        .registerIdentity(f.attacker.address, f.data(f.attacker.address)),
    ).to.revert(ethers);
    await expect(
      f.registry
        .connect(f.admin)
        .registerIdentity(f.attacker.address, f.data(f.attacker.address)),
    ).to.revert(ethers);
    await expect(
      f.registry
        .connect(f.attacker)
        .updateIdentity(f.investor.address, f.data(f.investor.address)),
    ).to.revert(ethers);
    await expect(
      f.registry.connect(f.attacker).revokeIdentity(f.investor.address),
    ).to.revert(ethers);
    await expect(
      f.registry.connect(f.attacker).grantRole(f.role, f.attacker.address),
    ).to.revert(ethers);
  });
  it("rejects self-attestation even for a trusted attestor", async () => {
    const f = await h.loadFixture(fixture);
    await expect(
      f.registry
        .connect(f.attestor)
        .registerIdentity(f.attestor.address, f.data(f.attestor.address)),
    ).revertedWithCustomError(f.registry, "SelfAttestation");
    await f.registry.grantRole(f.role, f.investor.address);
    await expect(
      f.registry
        .connect(f.investor)
        .updateIdentity(f.investor.address, f.data(f.investor.address)),
    ).revertedWithCustomError(f.registry, "SelfAttestation");
  });
  for (const invalid of [
    "zeroWallet",
    "zeroId",
    "unsupportedCountry",
    "pastExpiry",
  ])
    it(`rejects ${invalid}`, async () => {
      const f = await h.loadFixture(fixture);
      const d = f.data(f.attacker.address);
      if (invalid === "zeroId") d.identityId = ethers.ZeroHash;
      if (invalid === "unsupportedCountry") d.country = 999;
      if (invalid === "pastExpiry") d.validUntil = await h.time.latest();
      await expect(
        f.registry
          .connect(f.attestor)
          .registerIdentity(
            invalid === "zeroWallet" ? ethers.ZeroAddress : f.attacker.address,
            d,
          ),
      ).revertedWithCustomError(f.registry, "InvalidIdentity");
    });
  it("prevents accidental overwrite, missing updates and identifier replacement", async () => {
    const f = await h.loadFixture(fixture);
    await expect(
      f.registry
        .connect(f.attestor)
        .registerIdentity(f.investor.address, f.data(f.investor.address)),
    ).revertedWithCustomError(f.registry, "AlreadyRegistered");
    await expect(
      f.registry
        .connect(f.attestor)
        .updateIdentity(f.attacker.address, f.data(f.attacker.address)),
    ).revertedWithCustomError(f.registry, "NotRegistered");
    await expect(
      f.registry
        .connect(f.attestor)
        .updateIdentity(f.investor.address, f.data(f.other.address)),
    ).revertedWithCustomError(f.registry, "InvalidIdentity");
  });
  it("invalidates at exact expiry and renews an existing record", async () => {
    const f = await h.loadFixture(fixture);
    await h.time.increaseTo(f.expiry - 9000);
    expect(await f.registry.identityStatus(f.expired.address)).eq(4);
    await f.registry
      .connect(f.attestor)
      .updateIdentity(f.expired.address, f.data(f.expired.address));
    expect(await f.registry.isVerified(f.expired.address)).eq(true);
  });
  it("supports KYC denial, revocation and re-attestation", async () => {
    const f = await h.loadFixture(fixture);
    await f.registry
      .connect(f.attestor)
      .updateIdentity(f.investor.address, {
        ...f.data(f.investor.address),
        kycApproved: false,
      });
    expect(await f.registry.identityStatus(f.investor.address)).eq(2);
    await f.registry.revokeIdentity(f.other.address);
    expect(await f.registry.identityStatus(f.other.address)).eq(3);
    await f.registry
      .connect(f.attestor)
      .updateIdentity(f.other.address, f.data(f.other.address));
    expect(await f.registry.isVerified(f.other.address)).eq(true);
  });
  it("attestor removal immediately invalidates credentials and another attestor can renew", async () => {
    const f = await h.loadFixture(fixture);
    await expect(f.registry.revokeRole(f.role, f.attestor.address))
      .emit(f.registry, "TrustedAttestorRemoved")
      .withArgs(f.attestor.address);
    expect(await f.registry.identityStatus(f.investor.address)).eq(5);
    await expect(
      f.registry
        .connect(f.attestor)
        .updateIdentity(f.investor.address, f.data(f.investor.address)),
    ).to.revert(ethers);
    await f.registry.grantRole(f.role, f.other.address);
    await f.registry
      .connect(f.other)
      .updateIdentity(f.investor.address, f.data(f.investor.address));
    expect((await f.registry.identity(f.investor.address)).attestedBy).eq(
      f.other.address,
    );
    expect(await f.registry.isVerified(f.investor.address)).eq(true);
  });
  it("locks original administration and rejects zero attestors", async () => {
    const f = await h.loadFixture(fixture);
    await expect(
      f.registry.renounceRole(ethers.ZeroHash, f.admin.address),
    ).revertedWithCustomError(f.registry, "AdministratorLocked");
    await expect(
      f.registry.revokeRole(ethers.ZeroHash, f.admin.address),
    ).revertedWithCustomError(f.registry, "AdministratorLocked");
    await expect(
      f.registry.grantRole(f.role, ethers.ZeroAddress),
    ).revertedWithCustomError(f.registry, "InvalidIdentity");
  });
});

describe("Compliance Lite token, policy and custody", () => {
  it("assigns issuer supply, immutable modules and exact sale custody without factory roles", async () => {
    const f = await h.loadFixture(fixture);
    expect(await f.token.balanceOf(f.issuer.address)).eq(10000);
    expect(await f.token.totalSupply()).eq(10000);
    expect(await f.token.decimals()).eq(0);
    expect(await f.token.operationalClass(f.issuer.address)).eq(1);
    expect(await f.token.operationalClass(await f.sale.getAddress())).eq(2);
    expect(await f.policy.token()).eq(await f.token.getAddress());
    expect(await f.policy.administrator()).eq(f.issuer.address);
    expect(
      await f.registry.hasRole(
        ethers.ZeroHash,
        await f.factory.regulatedDeployer(),
      ),
    ).eq(false);
  });
  it("transfers to eligible investors and holds exactly at the cap", async () => {
    const f = await h.loadFixture(fixture);
    await f.token.connect(f.issuer).transfer(f.investor.address, 450);
    expect(
      await f.token.transferStatus(f.issuer.address, f.investor.address, 100),
    ).eq(5);
    await expect(f.token.connect(f.issuer).transfer(f.investor.address, 100))
      .revertedWithCustomError(f.token, "TransferRestricted")
      .withArgs(5);
    await f.token.connect(f.issuer).transfer(f.investor.address, 50);
    expect(await f.token.balanceOf(f.investor.address)).eq(500);
  });
  it("allows zero and self transfers without double-counting, including after cap reduction", async () => {
    const f = await h.loadFixture(fixture);
    await f.token.connect(f.issuer).transfer(f.investor.address, 450);
    await f.policy.connect(f.issuer).setMaxWalletHolding(100);
    await f.token.connect(f.investor).transfer(f.investor.address, 450);
    await f.token.connect(f.issuer).transfer(f.investor.address, 0);
    await f.token.connect(f.investor).transfer(f.other.address, 100);
    expect(await f.token.balanceOf(f.investor.address)).eq(350);
    await expect(
      f.token.connect(f.issuer).transfer(f.investor.address, 1),
    ).to.revert(ethers);
  });
  it("enforces identities for zero transfers and both investor endpoints", async () => {
    const f = await h.loadFixture(fixture);
    await f.token.connect(f.issuer).transfer(f.investor.address, 100);
    await f.registry.revokeIdentity(f.investor.address);
    for (const amount of [0, 1]) {
      await expect(
        f.token.connect(f.investor).transfer(f.other.address, amount),
      )
        .revertedWithCustomError(f.token, "TransferRestricted")
        .withArgs(1);
      await expect(
        f.token.connect(f.issuer).transfer(f.investor.address, amount),
      )
        .revertedWithCustomError(f.token, "TransferRestricted")
        .withArgs(2);
    }
    expect(await f.token.balanceOf(f.investor.address)).eq(100);
  });
  it("checks recipient country and applies subsequent policy updates", async () => {
    const f = await h.loadFixture(fixture);
    expect(await f.registry.isVerified(f.restricted.address)).eq(true);
    await expect(f.token.connect(f.issuer).transfer(f.restricted.address, 100))
      .revertedWithCustomError(f.token, "TransferRestricted")
      .withArgs(3);
    await f.policy.connect(f.issuer).setCountryAllowed(356, true);
    await f.token.connect(f.issuer).transfer(f.restricted.address, 100);
    await f.policy.connect(f.issuer).setCountryAllowed(356, false);
    await f.token.connect(f.restricted).transfer(f.investor.address, 1); // Sender identity remains valid; recipient policies apply.
    expect(await f.token.balanceOf(f.restricted.address)).eq(99);
  });
  it("checks accreditation independently and reacts to credential updates", async () => {
    const f = await h.loadFixture(fixture);
    await f.registry
      .connect(f.attestor)
      .updateIdentity(f.other.address, f.data(f.other.address, 702, false));
    expect(await f.token.isWhitelisted(f.other.address)).eq(false);
    await expect(f.token.connect(f.issuer).transfer(f.other.address, 1))
      .revertedWithCustomError(f.token, "TransferRestricted")
      .withArgs(4);
    await f.policy.connect(f.issuer).setAccreditationRequired(false);
    await f.token.connect(f.issuer).transfer(f.other.address, 1);
    await f.policy.connect(f.issuer).setAccreditationRequired(true);
    await f.registry
      .connect(f.attestor)
      .updateIdentity(f.other.address, f.data(f.other.address));
    await f.token.connect(f.issuer).transfer(f.other.address, 1);
  });
  it("rejects policy mutation, re-binding and arbitrary custody grants", async () => {
    const f = await h.loadFixture(fixture);
    await expect(f.policy.setCountryAllowed(702, false)).to.revert(ethers);
    await expect(f.policy.setMaxWalletHolding(9999)).to.revert(ethers);
    await expect(f.policy.setAccreditationRequired(false)).to.revert(ethers);
    await expect(
      f.policy.connect(f.issuer).setCountryAllowed(999, true),
    ).to.revert(ethers);
    await expect(f.policy.bindToken(await f.token.getAddress())).to.revert(
      ethers,
    );
    await expect(
      f.token.connect(f.issuer).registerSale(f.attacker.address),
    ).to.revert(ethers);
    await expect(
      f.token.connect(f.issuer).registerSubscriptionEscrow(f.attacker.address),
    ).to.revert(ethers);
    await expect(
      f.factory.setSubscriptionFactory(await f.sf.getAddress()),
    ).to.revert(ethers);
    const deployer = await ethers.getContractAt(
      "RegulatedAssetDeployer",
      await f.factory.regulatedDeployer(),
    );
    await expect(
      deployer.deploy({
        name: "X",
        symbol: "X",
        supply: 1,
        price: 1,
        issuer: f.attacker.address,
        identityAdmin: f.attacker.address,
        maximum: 100,
        accredited: false,
      }),
    ).to.revert(ethers);
  });
  it("cannot bypass cap or identity via allowance; failed execution is atomic", async () => {
    const f = await h.loadFixture(fixture);
    await f.token.connect(f.issuer).approve(f.attacker.address, 1000);
    await f.token
      .connect(f.attacker)
      .transferFrom(f.issuer.address, f.investor.address, 450);
    const allowance = await f.token.allowance(
      f.issuer.address,
      f.attacker.address,
    );
    await expect(
      f.token
        .connect(f.attacker)
        .transferFrom(f.issuer.address, f.investor.address, 100),
    )
      .revertedWithCustomError(f.token, "TransferRestricted")
      .withArgs(5);
    expect(await f.token.allowance(f.issuer.address, f.attacker.address)).eq(
      allowance,
    );
    expect(await f.token.balanceOf(f.investor.address)).eq(450);
    expect(await f.token.totalSupply()).eq(10000);
    await f.registry.revokeIdentity(f.investor.address);
    await expect(
      f.token
        .connect(f.attacker)
        .transferFrom(f.issuer.address, f.investor.address, 1),
    )
      .revertedWithCustomError(f.token, "TransferRestricted")
      .withArgs(2);
  });
  it("preflight reports insufficient balance, zero endpoints and excessive quantities without overflow", async () => {
    const f = await h.loadFixture(fixture);
    expect(
      await f.token.transferStatus(f.investor.address, f.other.address, 1),
    ).eq(7);
    expect(
      await f.token.transferStatus(ethers.ZeroAddress, f.other.address, 0),
    ).eq(8);
    expect(
      await f.token.transferStatus(f.issuer.address, ethers.ZeroAddress, 0),
    ).eq(8);
    expect(
      await f.policy.transferStatus(
        f.issuer.address,
        f.investor.address,
        ethers.MaxUint256,
      ),
    ).eq(5);
  });
  it("direct sale deposits exceed cap, compliant purchases work, failed delivery rolls back ETH", async () => {
    const f = await h.loadFixture(fixture);
    const at = await f.sale.getAddress();
    await f.token.connect(f.issuer).approve(at, 2000);
    await f.sale.connect(f.issuer).allocate(2000);
    await f.sale.connect(f.investor).buyTokens(450, { value: 450 });
    const before = await ethers.provider.getBalance(at);
    await expect(f.sale.connect(f.investor).buyTokens(100, { value: 100 }))
      .revertedWithCustomError(f.token, "TransferRestricted")
      .withArgs(5);
    expect(await ethers.provider.getBalance(at)).eq(before);
    expect(await f.sale.unclaimedProceeds()).eq(450);
    expect(await f.sale.availableTokens()).eq(1550);
    await f.sale.connect(f.issuer).closeSale();
    await f.sale.connect(f.issuer).recoverUnsoldTokens();
    expect(await f.token.balanceOf(f.issuer.address)).eq(9550);
  });
  it("isolates country, accreditation and holding policies between two assets and retains legacy mode", async () => {
    const f = await h.loadFixture(fixture);
    await f.factory
      .connect(f.issuer)
      .createRegulatedAsset({
        name: "Digital",
        symbol: "DLT",
        description: "",
        assetType: 1,
        supply: 10000,
        price: 1,
        maximum: 2000,
        accredited: false,
      });
    const a = await f.factory.getAsset(1),
      m = await f.factory.modules(1);
    const t = await ethers.getContractAt(
        "RegulatedAssetToken",
        a.tokenContract,
      ),
      r = await ethers.getContractAt(
        "IdentityRegistryLite",
        m.identityRegistry,
      ),
      p = await ethers.getContractAt("ComplianceLite", m.compliance);
    await r.grantRole(f.role, f.attestor.address);
    await r
      .connect(f.attestor)
      .registerIdentity(
        f.restricted.address,
        f.data(f.restricted.address, 356, false),
      );
    await p.connect(f.issuer).setCountryAllowed(356, true);
    await t.connect(f.issuer).transfer(f.restricted.address, 2000);
    expect(await f.token.isWhitelisted(f.restricted.address)).eq(false);
    expect(await f.policy.maxWalletHolding()).eq(500);
    await f.factory
      .connect(f.issuer)
      .createAsset("Legacy", "LEG", "", 0, 100, 1);
    expect((await f.factory.modules(2)).identityRegistry).eq(
      ethers.ZeroAddress,
    );
    expect(await f.factory.getAssetCount()).eq(3);
  });
});

async function offeringFixture() {
  const f = await fixture();
  const start = (await h.time.latest()) + 100,
    end = start + 100;
  await f.sf
    .connect(f.issuer)
    .createOffering(0, 1000, usd(2), usd(1200), start, end);
  const at = await f.sf.offeringAt(0),
    o = await ethers.getContractAt("SubscriptionOffering", at);
  await f.token.connect(f.issuer).registerSubscriptionEscrow(at);
  await f.token.connect(f.issuer).approve(at, 1000);
  await o.connect(f.issuer).depositOfferingTokens(1000);
  for (const who of [f.investor, f.other, f.restricted]) {
    await f.payment.mint(who.address, usd(4000));
    await f.payment.connect(who).approve(at, usd(4000));
  }
  await h.time.increaseTo(start);
  return { ...f, o, at, start, end };
}
describe("Compliance Lite subscription integration", () => {
  it("rejects ineligible commitments and self-appointed or wrong-asset custody", async () => {
    const f = await h.loadFixture(offeringFixture);
    await expect(
      f.o.connect(f.restricted).commit(usd(100)),
    ).revertedWithCustomError(f.o, "InvestorNotEligible");
    await f.registry.revokeIdentity(f.investor.address);
    await expect(
      f.o.connect(f.investor).commit(usd(100)),
    ).revertedWithCustomError(f.o, "InvestorNotEligible");
    await expect(
      f.token.connect(f.attacker).registerSubscriptionEscrow(f.at),
    ).to.revert(ethers);
    await f.factory
      .connect(f.issuer)
      .createRegulatedAsset({
        name: "Other",
        symbol: "OTH",
        description: "",
        assetType: 0,
        supply: 10000,
        price: 1,
        maximum: 500,
        accredited: true,
      });
    const a = await f.factory.getAsset(1),
      t = await ethers.getContractAt("RegulatedAssetToken", a.tokenContract);
    await expect(
      t.connect(f.issuer).registerSubscriptionEscrow(f.at),
    ).to.revert(ethers);
  });
  for (const reason of ["expiry", "revocation", "holdingLimit"])
    it(`preserves entitlement and refunds under ${reason}, then allows restored claims`, async () => {
      const f = await h.loadFixture(offeringFixture);
      await f.o.connect(f.investor).commit(usd(2000));
      await f.o.connect(f.other).commit(usd(2000));
      await h.time.increaseTo(f.end);
      await f.o.finalizeOffering();
      await f.o.connect(f.investor).settleSubscription();
      await f.o.connect(f.other).settleSubscription();
      const allocation = await f.o.allocationOf(f.investor.address);
      expect(allocation[0]).eq(500);
      expect(allocation[2]).eq(usd(1000));
      if (reason === "expiry") await h.time.increaseTo(f.expiry);
      if (reason === "revocation")
        await f.registry.revokeIdentity(f.investor.address);
      if (reason === "holdingLimit")
        await f.token.connect(f.issuer).transfer(f.investor.address, 1);
      await expect(f.o.connect(f.investor).claimTokens()).to.revert(ethers);
      expect((await f.o.entitlements(f.investor.address)).claimed).eq(false);
      expect(await f.o.reservedTokens()).eq(1000);
      expect(await f.o.recoverableTokens()).eq(0);
      await expect(f.o.connect(f.issuer).recoverUnsoldTokens()).to.revert(
        ethers,
      );
      await f.o.connect(f.investor).withdrawRefund();
      expect(await f.payment.balanceOf(f.investor.address)).eq(usd(3000));
      expect(await f.o.allocationOf(f.investor.address)).deep.eq(allocation);
      if (reason === "holdingLimit")
        await f.token.connect(f.investor).transfer(f.issuer.address, 1);
      else
        await f.registry
          .connect(f.attestor)
          .updateIdentity(
            f.investor.address,
            f.data(
              f.investor.address,
              702,
              true,
              (await h.time.latest()) + 10000,
            ),
          );
      await f.o.connect(f.investor).claimTokens();
      expect(await f.token.balanceOf(f.investor.address)).eq(500);
      expect(await f.o.reservedTokens()).eq(500);
    });
  it("country/attestor changes preserve pro-rata math and blocked inventory", async () => {
    const f = await h.loadFixture(offeringFixture);
    await f.o.connect(f.investor).commit(usd(1800));
    await f.o.connect(f.other).commit(usd(2200));
    await h.time.increaseTo(f.end);
    await f.o.finalizeOffering();
    await f.o.connect(f.investor).settleSubscription();
    expect((await f.o.allocationOf(f.investor.address))[0]).eq(450);
    await f.policy.connect(f.issuer).setCountryAllowed(702, false);
    await expect(f.o.connect(f.investor).claimTokens()).to.revert(ethers);
    await f.o.connect(f.investor).withdrawRefund();
    await f.policy.connect(f.issuer).setCountryAllowed(702, true);
    await f.registry.revokeRole(f.role, f.attestor.address);
    await expect(f.o.connect(f.investor).claimTokens()).to.revert(ethers);
    await f.registry.grantRole(f.role, f.attestor.address);
    await f.o.connect(f.investor).claimTokens();
    expect(await f.token.balanceOf(f.investor.address)).eq(450);
    expect(await f.o.reservedTokens()).eq(550);
  });
  it("failed offering refunds stay available after revocation", async () => {
    const f = await h.loadFixture(offeringFixture);
    await f.o.connect(f.investor).commit(usd(100));
    await h.time.increaseTo(f.end);
    await f.o.finalizeOffering();
    await f.registry.revokeIdentity(f.investor.address);
    await f.o.connect(f.investor).settleSubscription();
    await f.o.connect(f.investor).withdrawRefund();
    expect(await f.payment.balanceOf(f.investor.address)).eq(usd(4000));
    await f.o.connect(f.issuer).recoverUnsoldTokens();
    expect(await f.token.balanceOf(f.issuer.address)).eq(10000);
  });
});

describe("Compliance Lite adversarial boundaries", () => {
  it("rejects direct mint, burn, forced transfer and module replacement selectors", async () => {
    const f = await h.loadFixture(fixture),
      at = await f.token.getAddress();
    for (const [signature, args] of [
      ["function mint(address,uint256)", [f.attacker.address, 10000]],
      ["function burn(uint256)", [1]],
      [
        "function forcedTransfer(address,address,uint256)",
        [f.issuer.address, f.attacker.address, 1],
      ],
      ["function setIdentityRegistry(address)", [f.attacker.address]],
      ["function setCompliance(address)", [f.attacker.address]],
    ] as const) {
      const iface = new ethers.Interface([signature]);
      await expect(
        f.issuer.sendTransaction({
          to: at,
          data: iface.encodeFunctionData(iface.fragments[0].format(), [
            ...args,
          ]),
        }),
      ).to.revert(ethers);
    }
    expect(await f.token.totalSupply()).eq(10000);
    expect(await f.token.balanceOf(f.attacker.address)).eq(0);
  });
  it("cannot register a forged sale or a standalone matching subscription escrow", async () => {
    const f = await h.loadFixture(fixture);
    const sale = await ethers.deployContract("AssetSale", [
      await f.token.getAddress(),
      1,
      f.issuer.address,
    ]);
    await expect(
      f.token.connect(f.issuer).registerSale(await sale.getAddress()),
    ).to.revert(ethers);
    const start = (await h.time.latest()) + 100;
    const o = await ethers.deployContract("SubscriptionOffering", [
      {
        assetToken: await f.token.getAddress(),
        paymentToken: await f.payment.getAddress(),
        issuer: f.issuer.address,
        supply: 1000,
        price: usd(2),
        softCap: usd(1200),
        start,
        end: start + 100,
      },
    ]);
    await expect(
      f.token
        .connect(f.issuer)
        .registerSubscriptionEscrow(await o.getAddress()),
    ).to.revert(ethers);
    expect(await f.token.operationalClass(await o.getAddress())).eq(0);
  });
  it("cannot remove issuer or escrow authorization through an arbitrary selector", async () => {
    const f = await h.loadFixture(offeringFixture);
    const iface = new ethers.Interface([
      "function setOperationalAccount(address,bool)",
    ]);
    await expect(
      f.issuer.sendTransaction({
        to: await f.token.getAddress(),
        data: iface.encodeFunctionData("setOperationalAccount", [f.at, false]),
      }),
    ).to.revert(ethers);
    expect(await f.token.operationalClass(f.at)).eq(3);
    expect(await f.token.balanceOf(f.at)).eq(1000);
  });
  it("starts regulated access closed and rejects unauthorized issuance and wrong registry linkage", async () => {
    const f = await h.loadFixture(fixture);
    const r = {
      name: "Closed",
      symbol: "CLS",
      description: "",
      assetType: 0,
      supply: 100,
      price: 1,
      maximum: 100,
      accredited: false,
    };
    await expect(
      f.factory.connect(f.attacker).createRegulatedAsset(r),
    ).to.revert(ethers);
    await expect(
      f.factory.connect(f.issuer).createRegulatedAsset({ ...r, supply: 0 }),
    ).revertedWithCustomError(f.factory, "InvalidSupply");
    await expect(
      f.factory.connect(f.issuer).createRegulatedAsset({ ...r, price: 0 }),
    ).revertedWithCustomError(f.factory, "InvalidPrice");
    await f.factory.connect(f.issuer).createRegulatedAsset(r);
    const m = await f.factory.modules(1),
      p = await ethers.getContractAt("ComplianceLite", m.compliance);
    expect(await p.countryAllowed(702)).eq(false);
    const factory = await ethers.deployContract("RegulatedAssetFactory", [
      f.admin.address,
    ]);
    await expect(
      factory.setSubscriptionFactory(await f.sf.getAddress()),
    ).revertedWithCustomError(factory, "InvalidSubscriptionFactory");
    await expect(
      factory
        .connect(f.attacker)
        .setSubscriptionFactory(await f.sf.getAddress()),
    ).revertedWithCustomError(factory, "NotAdmin");
  });
  it("zero cap prevents incoming investor ownership but permits inventory and outgoing reductions", async () => {
    const f = await h.loadFixture(fixture);
    await f.token.connect(f.issuer).transfer(f.investor.address, 100);
    await f.policy.connect(f.issuer).setMaxWalletHolding(0);
    await expect(f.token.connect(f.issuer).transfer(f.other.address, 1))
      .revertedWithCustomError(f.token, "TransferRestricted")
      .withArgs(5);
    await f.token.connect(f.investor).transfer(f.issuer.address, 100);
    await f.token.connect(f.issuer).approve(await f.sale.getAddress(), 1000);
    await f.sale.connect(f.issuer).allocate(1000);
    expect(await f.token.balanceOf(f.investor.address)).eq(0);
  });
  it("seeded direct/delegated transfers preserve fixed supply and per-wallet capacity", async () => {
    const f = await h.loadFixture(fixture);
    const wallets = [f.issuer, f.investor, f.other];
    let seed = 3643;
    for (const owner of wallets)
      await f.token
        .connect(owner)
        .approve(f.attacker.address, ethers.MaxUint256);
    for (let step = 0; step < 60; step++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const from = wallets[seed % 3];
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const to = wallets[seed % 3],
        amount = BigInt(seed % 351);
      const before = await Promise.all(
        wallets.map((w) => f.token.balanceOf(w.address)),
      );
      const allowed = await f.token.canTransfer(
        from.address,
        to.address,
        amount,
      );
      const pending = () =>
        step % 2 === 0
          ? f.token.connect(from).transfer(to.address, amount)
          : f.token
              .connect(f.attacker)
              .transferFrom(from.address, to.address, amount);
      if (allowed) await pending();
      else {
        await expect(pending()).to.revert(ethers);
        expect(
          await Promise.all(wallets.map((w) => f.token.balanceOf(w.address))),
        ).deep.eq(before);
      }
      const balances = await Promise.all(
        wallets.map((w) => f.token.balanceOf(w.address)),
      );
      expect(balances.reduce((a, b) => a + b, 0n)).eq(10000);
      expect(balances[1]).lte(500n);
      expect(balances[2]).lte(500n);
    }
  });
});
