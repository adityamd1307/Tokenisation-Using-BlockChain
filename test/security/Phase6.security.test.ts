// Phase 6 threat model I01–I11/I14. Controlled actors, no external fuzzing dependency.
import { expect } from "chai";
import { network } from "hardhat";
const { ethers, networkHelpers } = await network.create();
const PRICE = ethers.parseEther("0.001");
async function fixture() {
  const [admin, issuer, otherIssuer, a, b, attacker] = await ethers.getSigners();
  const factory = await ethers.deployContract("AssetFactory", [admin.address]);
  const pairs = [];
  for (const [i, owner] of [issuer, otherIssuer].entries()) {
    await factory.authorizeIssuer(owner.address);
    await factory.connect(owner).createAsset(`Asset ${i}`, `T${i}`, "security fixture", i, 10_000n, PRICE);
    const record = await factory.getAsset(i);
    const token = await ethers.getContractAt("AssetToken", record.tokenContract, owner);
    const sale = await ethers.getContractAt("AssetSale", record.saleContract, owner);
    for (const account of [record.saleContract, a.address, b.address]) await token.setWhitelisted(account, true);
    await token.approve(record.saleContract, 5_000n);
    await sale.allocate(5_000n);
    pairs.push({ token, sale, record, owner });
  }
  return { admin, issuer, otherIssuer, a, b, attacker, factory, pairs };
}
async function snapshot(pair: Awaited<ReturnType<typeof fixture>>['pairs'][number], actors: string[]) {
  return {
    balances: await Promise.all(actors.map(a => pair.token.balanceOf(a))),
    supply: await pair.token.totalSupply(), inventory: await pair.sale.availableTokens(),
    proceeds: await pair.sale.unclaimedProceeds(), eth: await ethers.provider.getBalance(pair.record.saleContract),
    closed: await pair.sale.saleClosed(),
  };
}
describe("Phase 6 security", function () {
  it("rejects the full outsider privilege matrix without changing either asset", async function () {
    const { factory, pairs, admin, issuer, attacker } = await networkHelpers.loadFixture(fixture);
    const actors = [issuer.address, attacker.address, ...pairs.map(p => p.record.saleContract)];
    const before = await Promise.all(pairs.map(p => snapshot(p, actors)));
    await expect(factory.connect(attacker).authorizeIssuer(attacker.address)).to.be.revertedWithCustomError(factory, "NotAdmin");
    await expect(factory.connect(attacker).revokeIssuer(issuer.address)).to.be.revertedWithCustomError(factory, "NotAdmin");
    await expect(factory.connect(attacker).createAsset("X", "X", "", 0, 1, 1)).to.be.revertedWithCustomError(factory, "IssuerNotAuthorised");
    for (const { token, sale } of pairs) {
      for (const role of [await token.DEFAULT_ADMIN_ROLE(), await token.COMPLIANCE_ROLE()])
        await expect(token.connect(attacker).grantRole(role, attacker.address)).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
      await expect(token.connect(attacker).setWhitelisted(attacker.address, true)).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
      for (const actor of [attacker, admin]) {
        for (const op of ["withdrawProceeds", "closeSale", "recoverUnsoldTokens", "sweepExcessETH"] as const)
          await expect(sale.connect(actor)[op]()).to.be.revertedWithCustomError(sale, "NotIssuer");
      }
    }
    expect(await Promise.all(pairs.map(p => snapshot(p, actors)))).to.deep.equal(before);
    expect(await factory.getAssetCount()).to.equal(2n);
  });

  it("rolls back payment, allowance and inventory when the sale or issuer is revoked", async function () {
    const { pairs: [p], a, issuer } = await networkHelpers.loadFixture(fixture);
    const actors = [issuer.address, a.address, p.record.saleContract];
    await p.token.setWhitelisted(p.record.saleContract, false);
    const before = await snapshot(p, actors);
    await expect(p.sale.connect(a).buyTokens(1n, { value: PRICE })).to.be.revertedWithCustomError(p.token, "SenderNotWhitelisted");
    expect(await snapshot(p, actors)).to.deep.equal(before);
    await p.sale.closeSale();
    await expect(p.sale.recoverUnsoldTokens()).to.be.revertedWithCustomError(p.token, "SenderNotWhitelisted");
    await p.token.setWhitelisted(p.record.saleContract, true);
    await p.token.setWhitelisted(issuer.address, false);
    await expect(p.sale.recoverUnsoldTokens()).to.be.revertedWithCustomError(p.token, "RecipientNotWhitelisted");
    expect(await p.sale.availableTokens()).to.equal(5_000n);
    await p.token.setWhitelisted(issuer.address, true);
    await p.sale.recoverUnsoldTokens();
    expect(await p.token.balanceOf(issuer.address)).to.equal(10_000n);
  });

  it("reverts uint256 payment overflow without accepting ETH or delivering tokens", async function () {
    const [, issuer, buyer] = await ethers.getSigners();
    const token = await ethers.deployContract("AssetToken", ["Limit", "L", ethers.MaxUint256, issuer.address]);
    const sale = await ethers.deployContract("AssetSale", [await token.getAddress(), 2n, issuer.address]);
    const t = token.connect(issuer), s = sale.connect(issuer), addr = await sale.getAddress();
    await t.setWhitelisted(addr, true); await t.setWhitelisted(buyer.address, true);
    await t.approve(addr, ethers.MaxUint256); await s.allocate(ethers.MaxUint256);
    await expect(sale.connect(buyer).buyTokens(ethers.MaxUint256 / 2n + 1n, { value: 0n })).to.be.revertedWithPanic(0x11);
    expect(await sale.availableTokens()).to.equal(ethers.MaxUint256);
    expect(await sale.unclaimedProceeds()).to.equal(0n);
    expect(await ethers.provider.getBalance(addr)).to.equal(0n);
    expect(await token.balanceOf(buyer.address)).to.equal(0n);
    await sale.connect(buyer).buyTokens(1n, { value: 2n });
    expect(await token.totalSupply()).to.equal(ethers.MaxUint256);
  });

  it("rejects a buyer without ETH at RPC admission without changing sale state", async function () {
    const { pairs: [p], a, issuer } = await networkHelpers.loadFixture(fixture);
    const before = await snapshot(p, [issuer.address, a.address, p.record.saleContract]);
    await networkHelpers.setBalance(a.address, 0n);
    let rejected = false;
    try { await p.sale.connect(a).buyTokens(1n, { value: PRICE, gasLimit: 150_000n }); }
    catch (error) { rejected = /funds|balance/i.test(String(error)); }
    expect(rejected).to.equal(true);
    expect(await snapshot(p, [issuer.address, a.address, p.record.saleContract])).to.deep.equal(before);
  });

  it("failed factory inputs preserve sequential IDs and do not register partial assets", async function () {
    const { factory, issuer, pairs } = await networkHelpers.loadFixture(fixture);
    const before = await factory.getAssetCount();
    await expect(factory.connect(issuer).createAsset("Bad", "B", "", 0, 1, 0)).to.be.revertedWithCustomError(factory, "InvalidPrice");
    expect(await factory.getAssetCount()).to.equal(before);
    await expect(factory.getAsset(before)).to.be.revertedWithCustomError(factory, "AssetNotFound");
    await factory.connect(issuer).createAsset("Next", "N", "", 0, 1, 1);
    const next = await factory.getAsset(before);
    expect(next.assetId).to.equal(before);
    expect(await factory.tokenToSale(next.tokenContract)).to.equal(next.saleContract);
    expect(await pairs[0].token.hasRole(await pairs[0].token.DEFAULT_ADMIN_ROLE(), await factory.getAddress())).to.equal(false);
  });

  for (const seed of [7, 41, 2026]) it(`conserves supply, inventory and proceeds across 48 seeded operations (seed ${seed})`, async function () {
    const { pairs, a, b, attacker } = await networkHelpers.loadFixture(fixture);
    let rng = seed >>> 0;
    const next = () => (rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0);
    const models = pairs.map(() => ({ issuer: 5000n, sale: 5000n, a: 0n, b: 0n, proceeds: 0n }));
    for (let step = 0; step < 48; step++) {
      const index = next() % 2, p = pairs[index], m = models[index];
      const amount = BigInt(next() % 19 + 1), op = (next() >>> 8) % 6;
      if (op === 0 || op === 1) {
        const who = op === 0 ? a : b, key = op === 0 ? "a" : "b";
        await p.sale.connect(who).buyTokens(amount, { value: amount * PRICE });
        m[key] += amount; m.sale -= amount; m.proceeds += amount * PRICE;
      } else if (op === 2 && m.a >= amount) {
        await p.token.connect(a).approve(attacker.address, amount);
        await p.token.connect(attacker).transferFrom(a.address, b.address, amount);
        m.a -= amount; m.b += amount;
      } else if (op === 3) {
        await p.token.setWhitelisted(a.address, false);
        await expect(p.token.connect(a).transfer(b.address, 0n)).to.be.revertedWithCustomError(p.token, "SenderNotWhitelisted");
        await expect(p.sale.connect(a).buyTokens(1n, { value: PRICE })).to.be.revertedWithCustomError(p.sale, "InvestorNotWhitelisted");
        await p.token.setWhitelisted(a.address, true);
      } else if (op === 4 && m.proceeds > 0n) {
        await p.sale.withdrawProceeds(); m.proceeds = 0n;
      } else {
        await expect(p.sale.connect(b).buyTokens(amount, { value: amount * PRICE + 1n })).to.be.revertedWithCustomError(p.sale, "IncorrectPayment");
        await expect(p.sale.connect(attacker).withdrawProceeds()).to.be.revertedWithCustomError(p.sale, "NotIssuer");
      }
      for (const [i, q] of pairs.entries()) {
        const x = models[i];
        expect(await q.token.totalSupply()).to.equal(10_000n);
        const balances = await Promise.all([q.owner.address, q.record.saleContract, a.address, b.address, attacker.address].map(addr => q.token.balanceOf(addr)));
        expect(balances).to.deep.equal([x.issuer, x.sale, x.a, x.b, 0n]);
        expect(balances.reduce((sum, n) => sum + n, 0n)).to.equal(10_000n);
        expect(await q.sale.unclaimedProceeds()).to.equal(x.proceeds);
        expect(await ethers.provider.getBalance(q.record.saleContract)).to.equal(x.proceeds);
      }
    }
    await pairs[0].sale.closeSale();
    await pairs[0].sale.recoverUnsoldTokens();
    await expect(pairs[0].sale.connect(a).buyTokens(1n, { value: PRICE })).to.be.revertedWithCustomError(pairs[0].sale, "SaleIsClosed");
    expect(await pairs[1].sale.saleClosed()).to.equal(false);
    expect(await pairs[1].sale.availableTokens()).to.equal(models[1].sale);
  });
});

async function callbackFixture() {
  const [, buyer] = await ethers.getSigners();
  const h = await ethers.deployContract("SaleCallbackHarness");
  const issuer = await h.getAddress();
  const token = await ethers.deployContract("AssetToken", ["Callback", "CB", 100n, issuer]);
  const sale = await ethers.deployContract("AssetSale", [await token.getAddress(), 10n, issuer]);
  const addr = await sale.getAddress();
  await h.configure(addr, false);
  const execToken = async (data: string) => h.execute(await token.getAddress(), data);
  await execToken(token.interface.encodeFunctionData("setWhitelisted", [addr, true]));
  await execToken(token.interface.encodeFunctionData("setWhitelisted", [buyer.address, true]));
  await execToken(token.interface.encodeFunctionData("approve", [addr, 100n]));
  await h.execute(addr, sale.interface.encodeFunctionData("allocate", [100n]));
  await sale.connect(buyer).buyTokens(10n, { value: 100n });
  await ethers.deployContract("ForceSendHarness", [addr], { value: 25n });
  return { h, sale, addr };
}
describe("Phase 6 withdrawal callbacks", function () {
  it("sweeping cannot recursively sweep twice; nested withdrawal only pays owed proceeds once", async function () {
    const { h, sale, addr } = await networkHelpers.loadFixture(callbackFixture);
    await h.execute(addr, sale.interface.encodeFunctionData("sweepExcessETH"));
    expect(await h.nestedSweep()).to.equal(false);
    expect(await h.nestedWithdrawal()).to.equal(true);
    expect(await h.received()).to.equal(125n);
    expect(await sale.unclaimedProceeds()).to.equal(0n);
    expect(await ethers.provider.getBalance(addr)).to.equal(0n);
  });
  it("withdrawal callback can sweep excess but cannot withdraw proceeds twice", async function () {
    const { h, sale, addr } = await networkHelpers.loadFixture(callbackFixture);
    await h.execute(addr, sale.interface.encodeFunctionData("withdrawProceeds"));
    expect(await h.nestedSweep()).to.equal(true);
    expect(await h.nestedWithdrawal()).to.equal(false);
    expect(await h.received()).to.equal(125n);
    expect(await sale.unclaimedProceeds()).to.equal(0n);
    expect(await ethers.provider.getBalance(addr)).to.equal(0n);
  });
  it("rejected sweep preserves both excess ETH and owed proceeds for retry", async function () {
    const { h, sale, addr } = await networkHelpers.loadFixture(callbackFixture);
    await h.configure(addr, true);
    await expect(h.execute(addr, sale.interface.encodeFunctionData("sweepExcessETH"))).to.be.revertedWithCustomError(sale, "WithdrawalFailed");
    expect(await ethers.provider.getBalance(addr)).to.equal(125n);
    expect(await sale.unclaimedProceeds()).to.equal(100n);
    await h.configure(addr, false);
    await h.execute(addr, sale.interface.encodeFunctionData("sweepExcessETH"));
    expect(await h.received()).to.equal(125n);
  });
});
