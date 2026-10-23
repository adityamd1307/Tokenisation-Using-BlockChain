import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const SUPPLY = 10_000n;
const PRICE = ethers.parseEther("0.001");
const INVENTORY = 5_000n;

// spec-v1 §9: index 0 = admin, 1 = issuer, 2 = investor.
async function deploySale() {
  const [admin, issuer, investor, investor2, unapproved, outsider] = await ethers.getSigners();
  const factory = await ethers.deployContract("AssetFactory", [admin.address]);
  await factory.authorizeIssuer(issuer.address);
  await factory.connect(issuer).createAsset(
    "Campus Property Token", "CPT", "Fictional campus real estate fund", 0n, SUPPLY, PRICE,
  );
  const asset = await factory.getAsset(0n);
  const token = await ethers.getContractAt("AssetToken", asset.tokenContract, issuer);
  const sale = await ethers.getContractAt("AssetSale", asset.saleContract, issuer);
  return { factory, token, sale, admin, issuer, investor, investor2, unapproved, outsider };
}

// Phase 3 §3.3 lifecycle: whitelist the sale, deposit 5,000 CPT, approve investors.
async function fundedSale() {
  const state = await deploySale();
  const saleAddress = await state.sale.getAddress();
  await state.token.setWhitelisted(saleAddress, true);
  await state.token.approve(saleAddress, INVENTORY);
  await state.sale.allocate(INVENTORY);
  await state.token.setWhitelisted(state.investor.address, true);
  await state.token.setWhitelisted(state.investor2.address, true);
  return state;
}

async function afterPurchase() {
  const state = await fundedSale();
  await state.sale.connect(state.investor).buyTokens(100n, { value: 100n * PRICE });
  return state;
}

// spec-v1 invariant 8: an issuer that is a contract and re-enters on payout.
async function contractIssuerSale() {
  const [, , investor] = await ethers.getSigners();
  const harness = await ethers.deployContract("AssetSaleIssuerHarness");
  const harnessAddress = await harness.getAddress();
  const token = await ethers.deployContract("AssetToken", ["Campus Property Token", "CPT", SUPPLY, harnessAddress]);
  const sale = await ethers.deployContract("AssetSale", [await token.getAddress(), PRICE, harnessAddress]);
  const tokenAddress = await token.getAddress();
  const saleAddress = await sale.getAddress();
  await harness.setSale(saleAddress);
  await harness.execute(tokenAddress, token.interface.encodeFunctionData("setWhitelisted", [saleAddress, true]));
  await harness.execute(tokenAddress, token.interface.encodeFunctionData("setWhitelisted", [investor.address, true]));
  await harness.execute(tokenAddress, token.interface.encodeFunctionData("approve", [saleAddress, 1_000n]));
  await harness.execute(saleAddress, sale.interface.encodeFunctionData("allocate", [1_000n]));
  await sale.connect(investor).buyTokens(300n, { value: 300n * PRICE });
  return { harness, token, sale, investor, withdrawData: sale.interface.encodeFunctionData("withdrawProceeds") };
}

describe("AssetSale — Phase 3", function () {
  describe("deployment", function () {
    it("deploys with correct assetToken, pricePerToken, and issuer", async function () {
      const { token, sale, issuer } = await networkHelpers.loadFixture(deploySale);
      expect(await sale.assetToken()).to.equal(await token.getAddress());
      expect(await sale.pricePerToken()).to.equal(PRICE);
      expect(await sale.issuer()).to.equal(issuer.address);
      expect(await sale.availableTokens()).to.equal(0n);
      expect(await sale.unclaimedProceeds()).to.equal(0n);
      expect(await sale.saleClosed()).to.equal(false);
    });

    it("rejects a zero token, zero issuer, or zero price", async function () {
      const { token, sale, issuer } = await networkHelpers.loadFixture(deploySale);
      const tokenAddress = await token.getAddress();
      await expect(ethers.deployContract("AssetSale", [ethers.ZeroAddress, PRICE, issuer.address]))
        .to.be.revertedWithCustomError(sale, "InvalidToken");
      await expect(ethers.deployContract("AssetSale", [tokenAddress, PRICE, ethers.ZeroAddress]))
        .to.be.revertedWithCustomError(sale, "InvalidIssuer");
      await expect(ethers.deployContract("AssetSale", [tokenAddress, 0n, issuer.address]))
        .to.be.revertedWithCustomError(sale, "InvalidPrice");
    });

    it("exposes no function to change the price after creation", async function () {
      const { sale } = await networkHelpers.loadFixture(deploySale);
      const names = sale.interface.fragments.filter((f) => f.type === "function").map((f) => (f as { name: string }).name);
      expect(names.filter((n) => /price/i.test(n))).to.deep.equal(["pricePerToken"]);
    });
  });

  // Phase 3 §3.3 inventory funding; spec-v1 §5 allocate.
  describe("allocation", function () {
    it("issuer can allocate tokens (whitelist sale, approve, allocate)", async function () {
      const { token, sale, issuer } = await networkHelpers.loadFixture(deploySale);
      const saleAddress = await sale.getAddress();
      await token.setWhitelisted(saleAddress, true);
      await token.approve(saleAddress, INVENTORY);
      const tx = sale.allocate(INVENTORY);
      await expect(tx).to.emit(sale, "Allocated").withArgs(INVENTORY);
      await expect(tx).to.changeTokenBalances(ethers, token, [issuer, sale], [-INVENTORY, INVENTORY]);
      expect(await sale.availableTokens()).to.equal(INVENTORY);
      expect(await token.allowance(issuer.address, saleAddress)).to.equal(0n);
    });

    it("allocate reverts until the issuer whitelists the sale contract", async function () {
      const { token, sale } = await networkHelpers.loadFixture(deploySale);
      const saleAddress = await sale.getAddress();
      await token.approve(saleAddress, INVENTORY);
      await expect(sale.allocate(INVENTORY))
        .to.be.revertedWithCustomError(token, "RecipientNotWhitelisted").withArgs(saleAddress);
    });

    it("allocate without an approval reverts", async function () {
      const { token, sale } = await networkHelpers.loadFixture(deploySale);
      await token.setWhitelisted(await sale.getAddress(), true);
      await expect(sale.allocate(1n)).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("non-issuer cannot allocate", async function () {
      const { sale, outsider } = await networkHelpers.loadFixture(fundedSale);
      await expect(sale.connect(outsider).allocate(1n)).to.be.revertedWithCustomError(sale, "NotIssuer");
    });

    it("allocate with insufficient issuer balance reverts", async function () {
      const { token, sale, issuer } = await networkHelpers.loadFixture(fundedSale);
      const remaining = SUPPLY - INVENTORY;
      await token.approve(await sale.getAddress(), SUPPLY);
      await expect(sale.allocate(remaining + 1n))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
        .withArgs(issuer.address, remaining, remaining + 1n);
    });

    it("allocate of zero reverts", async function () {
      const { sale } = await networkHelpers.loadFixture(fundedSale);
      await expect(sale.allocate(0n)).to.be.revertedWithCustomError(sale, "InvalidQuantity");
    });
  });

  // Phase 3 §3.2 buyTokens validation, §3.5 test table.
  describe("buying (instant subscription flow)", function () {
    it("whitelisted investor buys 100 tokens with exact ETH payment", async function () {
      const { token, sale, investor } = await networkHelpers.loadFixture(fundedSale);
      const cost = 100n * PRICE;
      expect(cost).to.equal(ethers.parseEther("0.1"));
      const tx = sale.connect(investor).buyTokens(100n, { value: cost });
      await expect(tx).to.emit(sale, "Purchased").withArgs(investor.address, 100n, cost);
      await expect(tx).to.changeEtherBalances(ethers, [investor, sale], [-cost, cost]);
      await expect(tx).to.changeTokenBalances(ethers, token, [investor, sale], [100n, -100n]);
      expect(await sale.unclaimedProceeds()).to.equal(cost);
      expect(await sale.availableTokens()).to.equal(INVENTORY - 100n);
    });

    it("investor underpays: reverts", async function () {
      const { sale, investor } = await networkHelpers.loadFixture(fundedSale);
      await expect(sale.connect(investor).buyTokens(100n, { value: 100n * PRICE - 1n }))
        .to.be.revertedWithCustomError(sale, "IncorrectPayment").withArgs(100n * PRICE, 100n * PRICE - 1n);
    });

    it("investor overpays: reverts", async function () {
      const { sale, investor } = await networkHelpers.loadFixture(fundedSale);
      await expect(sale.connect(investor).buyTokens(100n, { value: 100n * PRICE + 1n }))
        .to.be.revertedWithCustomError(sale, "IncorrectPayment").withArgs(100n * PRICE, 100n * PRICE + 1n);
    });

    it("unapproved investor attempts purchase: reverts", async function () {
      const { token, sale, unapproved } = await networkHelpers.loadFixture(fundedSale);
      await expect(sale.connect(unapproved).buyTokens(100n, { value: 100n * PRICE }))
        .to.be.revertedWithCustomError(sale, "InvestorNotWhitelisted").withArgs(unapproved.address);
      expect(await token.balanceOf(unapproved.address)).to.equal(0n);
    });

    it("revoked investor cannot buy", async function () {
      const { token, sale, investor } = await networkHelpers.loadFixture(fundedSale);
      await token.setWhitelisted(investor.address, false);
      await expect(sale.connect(investor).buyTokens(1n, { value: PRICE }))
        .to.be.revertedWithCustomError(sale, "InvestorNotWhitelisted");
    });

    it("investor buys more than inventory: reverts", async function () {
      const { sale, investor } = await networkHelpers.loadFixture(fundedSale);
      await expect(sale.connect(investor).buyTokens(INVENTORY + 1n, { value: (INVENTORY + 1n) * PRICE }))
        .to.be.revertedWithCustomError(sale, "InsufficientInventory").withArgs(INVENTORY + 1n, INVENTORY);
    });

    it("buying the entire inventory succeeds and leaves nothing for sale", async function () {
      const { sale, investor } = await networkHelpers.loadFixture(fundedSale);
      await sale.connect(investor).buyTokens(INVENTORY, { value: INVENTORY * PRICE });
      expect(await sale.availableTokens()).to.equal(0n);
      await expect(sale.connect(investor).buyTokens(1n, { value: PRICE }))
        .to.be.revertedWithCustomError(sale, "InsufficientInventory").withArgs(1n, 0n);
    });

    it("buy of zero quantity reverts", async function () {
      const { sale, investor } = await networkHelpers.loadFixture(fundedSale);
      await expect(sale.connect(investor).buyTokens(0n, { value: 0n }))
        .to.be.revertedWithCustomError(sale, "InvalidQuantity");
    });

    it("rejects plain ETH sent outside buyTokens", async function () {
      const { sale, investor } = await networkHelpers.loadFixture(fundedSale);
      await expect(investor.sendTransaction({ to: await sale.getAddress(), value: 1n })).to.revert(ethers);
    });
  });

  // Phase 3 §3.4; spec-v1 §4 reentrancy requirement.
  describe("proceeds", function () {
    it("issuer can withdraw ETH proceeds after a purchase", async function () {
      const { sale, issuer } = await networkHelpers.loadFixture(afterPurchase);
      const tx = sale.withdrawProceeds();
      await expect(tx).to.emit(sale, "ProceedsWithdrawn").withArgs(100n * PRICE);
      await expect(tx).to.changeEtherBalances(ethers, [issuer, sale], [100n * PRICE, -100n * PRICE]);
      expect(await sale.unclaimedProceeds()).to.equal(0n);
    });

    it("non-issuer withdraws proceeds: reverts", async function () {
      const { sale, investor, admin } = await networkHelpers.loadFixture(afterPurchase);
      for (const caller of [investor, admin]) {
        await expect(sale.connect(caller).withdrawProceeds()).to.be.revertedWithCustomError(sale, "NotIssuer");
      }
      expect(await sale.unclaimedProceeds()).to.equal(100n * PRICE);
    });

    it("withdrawProceeds with zero balance reverts", async function () {
      const { sale } = await networkHelpers.loadFixture(fundedSale);
      await expect(sale.withdrawProceeds()).to.be.revertedWithCustomError(sale, "NoProceeds");
    });

    it("invariant 8: a re-entrant contract issuer is paid exactly once and the balance is zero", async function () {
      const { harness, sale, withdrawData } = await networkHelpers.loadFixture(contractIssuerSale);
      const owed = 300n * PRICE;
      await expect(harness.execute(await sale.getAddress(), withdrawData))
        .to.changeEtherBalances(ethers, [harness, sale], [owed, -owed]);
      expect(await harness.reentryAttempted()).to.equal(true);
      expect(await harness.reentrySucceeded()).to.equal(false);
      // The balance must already be zero while the ETH send is in flight.
      expect(await harness.proceedsSeenDuringPayout()).to.equal(0n);
      expect(await sale.unclaimedProceeds()).to.equal(0n);
      expect(await ethers.provider.getBalance(await sale.getAddress())).to.equal(0n);
    });

    it("a failed payout reverts and leaves the proceeds claimable", async function () {
      const { harness, sale, withdrawData } = await networkHelpers.loadFixture(contractIssuerSale);
      await harness.setRejectPayments(true);
      await expect(harness.execute(await sale.getAddress(), withdrawData))
        .to.be.revertedWithCustomError(sale, "WithdrawalFailed");
      expect(await sale.unclaimedProceeds()).to.equal(300n * PRICE);
      await harness.setRejectPayments(false);
      await harness.execute(await sale.getAddress(), withdrawData);
      expect(await sale.unclaimedProceeds()).to.equal(0n);
    });
  });

  // Phase 3 §3.4, decision D3.
  describe("closing and inventory recovery", function () {
    it("issuer can close the sale, after which buying and allocating revert", async function () {
      const { sale, investor } = await networkHelpers.loadFixture(afterPurchase);
      await expect(sale.closeSale()).to.emit(sale, "SaleClosed");
      expect(await sale.saleClosed()).to.equal(true);
      await expect(sale.connect(investor).buyTokens(1n, { value: PRICE }))
        .to.be.revertedWithCustomError(sale, "SaleIsClosed");
      await expect(sale.allocate(1n)).to.be.revertedWithCustomError(sale, "SaleIsClosed");
      await expect(sale.closeSale()).to.be.revertedWithCustomError(sale, "SaleIsClosed");
    });

    it("recoverUnsoldTokens reverts while the sale is open", async function () {
      const { sale } = await networkHelpers.loadFixture(afterPurchase);
      await expect(sale.recoverUnsoldTokens()).to.be.revertedWithCustomError(sale, "SaleNotClosed");
    });

    it("issuer recovers all unsold inventory after closing and can still withdraw proceeds", async function () {
      const { token, sale, issuer } = await networkHelpers.loadFixture(afterPurchase);
      const unsold = INVENTORY - 100n;
      await sale.closeSale();
      const tx = sale.recoverUnsoldTokens();
      await expect(tx).to.emit(sale, "UnsoldTokensRecovered").withArgs(unsold);
      await expect(tx).to.changeTokenBalances(ethers, token, [issuer, sale], [unsold, -unsold]);
      expect(await token.balanceOf(issuer.address)).to.equal(SUPPLY - 100n);
      await expect(sale.recoverUnsoldTokens()).to.be.revertedWithCustomError(sale, "NoUnsoldTokens");
      await expect(sale.withdrawProceeds()).to.changeEtherBalance(ethers, issuer, 100n * PRICE);
    });

    it("non-issuer cannot close the sale or recover inventory", async function () {
      const { sale, outsider } = await networkHelpers.loadFixture(afterPurchase);
      await expect(sale.connect(outsider).closeSale()).to.be.revertedWithCustomError(sale, "NotIssuer");
      await sale.closeSale();
      await expect(sale.connect(outsider).recoverUnsoldTokens()).to.be.revertedWithCustomError(sale, "NotIssuer");
    });
  });

  describe("invariants", function () {
    it("invariant 3: sale ETH balance equals tokens sold times pricePerToken minus withdrawals", async function () {
      const { sale, investor, investor2 } = await networkHelpers.loadFixture(fundedSale);
      const saleAddress = await sale.getAddress();
      let sold = 0n;
      let withdrawn = 0n;
      const check = async () => {
        const balance = await ethers.provider.getBalance(saleAddress);
        expect(balance).to.equal(sold * PRICE - withdrawn);
        expect(await sale.unclaimedProceeds()).to.equal(balance);
        expect(await sale.availableTokens()).to.equal(INVENTORY - sold);
      };
      const steps: Array<["buy", typeof investor, bigint] | ["withdraw"]> = [
        ["buy", investor, 100n], ["buy", investor2, 250n], ["withdraw"],
        ["buy", investor, 1n], ["buy", investor2, 49n], ["withdraw"], ["buy", investor, 600n],
      ];
      for (const step of steps) {
        if (step[0] === "buy") {
          await sale.connect(step[1]).buyTokens(step[2], { value: step[2] * PRICE });
          sold += step[2];
        } else {
          withdrawn += await sale.unclaimedProceeds();
          await sale.withdrawProceeds();
        }
        await check();
      }
      await expect(sale.connect(investor).buyTokens(1n, { value: PRICE - 1n })).to.be.revertedWithCustomError(sale, "IncorrectPayment");
      await check();
    });

    it("invariants 1 and 2: every holder is whitelisted and supply equals the sum of balances", async function () {
      const { token, sale, issuer, investor, investor2 } = await networkHelpers.loadFixture(afterPurchase);
      await sale.connect(investor2).buyTokens(40n, { value: 40n * PRICE });
      await token.connect(investor).transfer(investor2.address, 10n);
      const holders = [issuer.address, investor.address, investor2.address, await sale.getAddress()];
      let sum = 0n;
      for (const holder of holders) {
        const balance = await token.balanceOf(holder);
        if (balance > 0n) expect(await token.isWhitelisted(holder)).to.equal(true);
        sum += balance;
      }
      expect(sum).to.equal(await token.totalSupply());
    });
  });

  // Phase 3 §3.3 lifecycle and completion criteria.
  describe("Phase 3 lifecycle demonstration", function () {
    it("create 10,000 CPT, whitelist sale, deposit 5,000, investor pays 0.1 ETH for 100 CPT", async function () {
      const { token, sale, issuer, investor } = await networkHelpers.loadFixture(fundedSale);
      expect(await token.balanceOf(issuer.address)).to.equal(SUPPLY - INVENTORY);
      expect(await sale.availableTokens()).to.equal(INVENTORY);
      await expect(sale.connect(investor).buyTokens(100n, { value: ethers.parseEther("0.1") }))
        .to.changeEtherBalance(ethers, investor, -ethers.parseEther("0.1"));
      expect(await token.balanceOf(investor.address)).to.equal(100n);
      expect(await sale.availableTokens()).to.equal(4_900n);
      expect(await token.totalSupply()).to.equal(SUPPLY);
    });
  });
});
