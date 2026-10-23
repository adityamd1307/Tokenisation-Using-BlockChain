import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();
const INITIAL_SUPPLY = 10_000n;

async function deployToken() {
  const [issuer, investorB, investorC, unapprovedD, unauthorisedE, otherIssuer, deployer] = await ethers.getSigners();
  const token = await ethers.deployContract("AssetToken", ["Campus Property Token", "CPT", INITIAL_SUPPLY, issuer.address]);
  await token.waitForDeployment();
  return { token, issuer, investorB, investorC, unapprovedD, unauthorisedE, otherIssuer, deployer };
}

async function approvedHolders() {
  const state = await deployToken();
  await state.token.setWhitelisted(state.investorB.address, true);
  await state.token.setWhitelisted(state.investorC.address, true);
  await state.token.transfer(state.investorB.address, 100n);
  return state;
}

describe("AssetToken — Phase 2", function () {
  describe("A — deployment and fixed supply", function () {
    it("sets the name, symbol, and whole-unit decimals", async function () {
      const { token } = await networkHelpers.loadFixture(deployToken);
      expect(await token.name()).to.equal("Campus Property Token");
      expect(await token.symbol()).to.equal("CPT");
      expect(await token.decimals()).to.equal(0n);
    });

    it("mints exactly 10,000 whole units to the designated issuer", async function () {
      const { token, issuer, investorB } = await networkHelpers.loadFixture(deployToken);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await token.balanceOf(issuer.address)).to.equal(INITIAL_SUPPLY);
      expect(await token.balanceOf(investorB.address)).to.equal(0n);
      expect(await token.issuer()).to.equal(issuer.address);
    });

    it("emits the standard mint Transfer from the zero address", async function () {
      const { token, issuer } = await networkHelpers.loadFixture(deployToken);
      await expect(token.deploymentTransaction()).to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, issuer.address, INITIAL_SUPPLY);
    });

    it("whitelists the issuer and leaves other addresses, including zero, ineligible", async function () {
      const { token, issuer, investorB } = await networkHelpers.loadFixture(deployToken);
      expect(await token.isWhitelisted(issuer.address)).to.equal(true);
      expect(await token.isWhitelisted(investorB.address)).to.equal(false);
      expect(await token.isWhitelisted(ethers.ZeroAddress)).to.equal(false);
      expect(await token.whitelist(issuer.address)).to.equal(true);
    });

    it("grants the issuer the administrator and compliance roles", async function () {
      const { token, issuer, unauthorisedE } = await networkHelpers.loadFixture(deployToken);
      const role = await token.COMPLIANCE_ROLE();
      expect(role).to.equal(ethers.id("COMPLIANCE_ROLE"));
      expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), issuer.address)).to.equal(true);
      expect(await token.hasRole(role, issuer.address)).to.equal(true);
      expect(await token.hasRole(role, unauthorisedE.address)).to.equal(false);
      expect(await token.getRoleAdmin(role)).to.equal(await token.DEFAULT_ADMIN_ROLE());
    });

    it("rejects a zero issuer", async function () {
      const { token } = await networkHelpers.loadFixture(deployToken);
      await expect(ethers.deployContract("AssetToken", ["Invalid", "BAD", 1n, ethers.ZeroAddress]))
        .to.be.revertedWithCustomError(token, "InvalidIssuer");
    });

    it("rejects a zero supply", async function () {
      const { token, issuer } = await networkHelpers.loadFixture(deployToken);
      await expect(ethers.deployContract("AssetToken", ["Invalid", "BAD", 0n, issuer.address]))
        .to.be.revertedWithCustomError(token, "InvalidInitialSupply");
    });

    it("exposes no mint or burn entry point, even to the administrator", async function () {
      const { token, issuer, investorB } = await networkHelpers.loadFixture(deployToken);
      const publicInterface = new ethers.Interface(token.interface.fragments);
      for (const signature of ["mint(address,uint256)", "_mint(address,uint256)", "burn(uint256)", "burnFrom(address,uint256)"]) {
        expect(publicInterface.getFunction(signature)).to.equal(null);
      }
      const mintInterface = new ethers.Interface(["function mint(address,uint256)"]);
      await expect(issuer.sendTransaction({
        to: await token.getAddress(),
        data: mintInterface.encodeFunctionData("mint", [investorB.address, 1n]),
      })).to.revert(ethers);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await token.balanceOf(investorB.address)).to.equal(0n);
    });

    it("assigns supply and roles to the issuer instead of a different deploying account", async function () {
      const { issuer, deployer } = await networkHelpers.loadFixture(deployToken);
      const token = await ethers.deployContract("AssetToken", ["Other", "OTH", 25n, issuer.address], deployer);
      expect(await token.balanceOf(issuer.address)).to.equal(25n);
      expect(await token.balanceOf(deployer.address)).to.equal(0n);
      for (const role of [await token.DEFAULT_ADMIN_ROLE(), await token.COMPLIANCE_ROLE()]) {
        expect(await token.hasRole(role, issuer.address)).to.equal(true);
        expect(await token.hasRole(role, deployer.address)).to.equal(false);
      }
      expect(await token.isWhitelisted(deployer.address)).to.equal(false);
    });

    it("supports construction by a contract without granting that contract authority", async function () {
      const { issuer, investorB, deployer } = await networkHelpers.loadFixture(deployToken);
      const harness = await ethers.deployContract("AssetTokenDeploymentHarness", [issuer.address], deployer);
      const token = await ethers.getContractAt("AssetToken", await harness.token(), issuer);
      expect(await token.balanceOf(issuer.address)).to.equal(INITIAL_SUPPLY);
      for (const role of [await token.DEFAULT_ADMIN_ROLE(), await token.COMPLIANCE_ROLE()]) {
        expect(await token.hasRole(role, issuer.address)).to.equal(true);
        expect(await token.hasRole(role, await harness.getAddress())).to.equal(false);
      }
      expect(await token.isWhitelisted(await harness.getAddress())).to.equal(false);
      await token.setWhitelisted(investorB.address, true);
      await token.transfer(investorB.address, 1n);
      expect(await token.balanceOf(investorB.address)).to.equal(1n);
    });
  });

  describe("B — whitelist and role administration", function () {
    it("approves investors B and C with publicly readable status", async function () {
      const { token, investorB, investorC } = await networkHelpers.loadFixture(deployToken);
      await token.setWhitelisted(investorB.address, true);
      await token.setWhitelisted(investorC.address, true);
      expect(await token.isWhitelisted(investorB.address)).to.equal(true);
      expect(await token.isWhitelisted(investorC.address)).to.equal(true);
      expect(await token.whitelist(investorB.address)).to.equal(true);
    });

    it("emits investor, status, and operator on approval and revocation", async function () {
      const { token, issuer, investorB } = await networkHelpers.loadFixture(deployToken);
      await expect(token.setWhitelisted(investorB.address, true))
        .to.emit(token, "WhitelistUpdated").withArgs(investorB.address, true, issuer.address);
      await expect(token.setWhitelisted(investorB.address, false))
        .to.emit(token, "WhitelistUpdated").withArgs(investorB.address, false, issuer.address);
      expect(await token.isWhitelisted(investorB.address)).to.equal(false);
      expect(await token.whitelist(investorB.address)).to.equal(false);
    });

    for (const approved of [true, false]) {
      it(`rejects unauthorised whitelist update approved=${approved}`, async function () {
        const { token, investorB, unauthorisedE } = await networkHelpers.loadFixture(
          approved ? deployToken : approvedHolders,
        );
        await expect(token.connect(unauthorisedE).setWhitelisted(investorB.address, approved))
          .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
          .withArgs(unauthorisedE.address, await token.COMPLIANCE_ROLE());
        expect(await token.isWhitelisted(investorB.address)).to.equal(!approved);
      });

      it(`rejects a zero investor when approved=${approved}`, async function () {
        const { token } = await networkHelpers.loadFixture(deployToken);
        await expect(token.setWhitelisted(ethers.ZeroAddress, approved))
          .to.be.revertedWithCustomError(token, "InvalidInvestor");
      });
    }

    it("treats repeated status updates as no-ops without duplicate events", async function () {
      const { token, investorB } = await networkHelpers.loadFixture(deployToken);
      await expect(token.setWhitelisted(investorB.address, false)).not.to.emit(token, "WhitelistUpdated");
      await token.setWhitelisted(investorB.address, true);
      await expect(token.setWhitelisted(investorB.address, true)).not.to.emit(token, "WhitelistUpdated");
      expect(await token.isWhitelisted(investorB.address)).to.equal(true);
      await token.setWhitelisted(investorB.address, false);
      await expect(token.setWhitelisted(investorB.address, false)).not.to.emit(token, "WhitelistUpdated");
      expect(await token.isWhitelisted(investorB.address)).to.equal(false);
    });

    it("revokes a funded investor without confiscation, burning, or Transfer events", async function () {
      const { token, issuer, investorB } = await networkHelpers.loadFixture(approvedHolders);
      await expect(token.setWhitelisted(investorB.address, false)).not.to.emit(token, "Transfer");
      expect(await token.isWhitelisted(investorB.address)).to.equal(false);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
      expect(await token.balanceOf(issuer.address)).to.equal(9_900n);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("delegates compliance and records the actual delegate as operator", async function () {
      const { token, investorB, unauthorisedE } = await networkHelpers.loadFixture(deployToken);
      await token.grantRole(await token.COMPLIANCE_ROLE(), unauthorisedE.address);
      await expect(token.connect(unauthorisedE).setWhitelisted(investorB.address, true))
        .to.emit(token, "WhitelistUpdated").withArgs(investorB.address, true, unauthorisedE.address);
      expect(await token.isWhitelisted(unauthorisedE.address)).to.equal(false);
      expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), unauthorisedE.address)).to.equal(false);
    });

    it("prevents unauthorised accounts from granting themselves compliance authority", async function () {
      const { token, unauthorisedE } = await networkHelpers.loadFixture(deployToken);
      await expect(token.connect(unauthorisedE).grantRole(await token.COMPLIANCE_ROLE(), unauthorisedE.address))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(unauthorisedE.address, await token.DEFAULT_ADMIN_ROLE());
    });

    it("prevents compliance-only delegates from granting roles", async function () {
      const { token, investorB, unauthorisedE } = await networkHelpers.loadFixture(deployToken);
      await token.grantRole(await token.COMPLIANCE_ROLE(), unauthorisedE.address);
      await expect(token.connect(unauthorisedE).grantRole(await token.COMPLIANCE_ROLE(), investorB.address))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(unauthorisedE.address, await token.DEFAULT_ADMIN_ROLE());
    });

    it("removes compliance authority immediately when the role is revoked", async function () {
      const { token, investorB, unauthorisedE } = await networkHelpers.loadFixture(deployToken);
      const role = await token.COMPLIANCE_ROLE();
      await token.grantRole(role, unauthorisedE.address);
      await token.revokeRole(role, unauthorisedE.address);
      await expect(token.connect(unauthorisedE).setWhitelisted(investorB.address, true))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount").withArgs(unauthorisedE.address, role);
    });

    it("requires compliance authority even for an administrator whose compliance role was revoked", async function () {
      const { token, issuer, investorB } = await networkHelpers.loadFixture(deployToken);
      const role = await token.COMPLIANCE_ROLE();
      await token.revokeRole(role, issuer.address);
      await expect(token.setWhitelisted(investorB.address, true))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount").withArgs(issuer.address, role);
      await token.grantRole(role, issuer.address);
      await token.setWhitelisted(investorB.address, true);
      expect(await token.isWhitelisted(investorB.address)).to.equal(true);
    });
  });

  describe("C — direct transfers and revocation", function () {
    it("transfers 100 units to B and emits the standard Transfer event", async function () {
      const { token, issuer, investorB } = await networkHelpers.loadFixture(deployToken);
      await token.setWhitelisted(investorB.address, true);
      await expect(token.transfer(investorB.address, 100n))
        .to.emit(token, "Transfer").withArgs(issuer.address, investorB.address, 100n);
      expect(await token.balanceOf(issuer.address)).to.equal(9_900n);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
    });

    it("rejects an unapproved recipient and preserves balances and supply", async function () {
      const { token, issuer, investorB, unapprovedD } = await networkHelpers.loadFixture(approvedHolders);
      await expect(token.connect(investorB).transfer(unapprovedD.address, 20n))
        .to.be.revertedWithCustomError(token, "RecipientNotWhitelisted").withArgs(unapprovedD.address);
      expect(await token.balanceOf(issuer.address)).to.equal(9_900n);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
      expect(await token.balanceOf(unapprovedD.address)).to.equal(0n);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("allows B to transfer 20 units to approved C", async function () {
      const { token, investorB, investorC } = await networkHelpers.loadFixture(approvedHolders);
      await token.connect(investorB).transfer(investorC.address, 20n);
      expect(await token.balanceOf(investorB.address)).to.equal(80n);
      expect(await token.balanceOf(investorC.address)).to.equal(20n);
    });

    it("rejects a revoked sender even when the recipient is approved", async function () {
      const { token, investorB, investorC } = await networkHelpers.loadFixture(approvedHolders);
      await token.setWhitelisted(investorB.address, false);
      await expect(token.connect(investorB).transfer(investorC.address, 20n))
        .to.be.revertedWithCustomError(token, "SenderNotWhitelisted").withArgs(investorB.address);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
      expect(await token.balanceOf(investorC.address)).to.equal(0n);
    });

    it("rejects transfers into a revoked holder with a positive balance", async function () {
      const { token, issuer, investorB } = await networkHelpers.loadFixture(approvedHolders);
      await token.setWhitelisted(investorB.address, false);
      await expect(token.transfer(investorB.address, 20n))
        .to.be.revertedWithCustomError(token, "RecipientNotWhitelisted").withArgs(investorB.address);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
      expect(await token.balanceOf(issuer.address)).to.equal(9_900n);
    });

    it("rejects transfers when both holder and recipient are ineligible", async function () {
      const { token, investorB, unapprovedD } = await networkHelpers.loadFixture(approvedHolders);
      await token.setWhitelisted(investorB.address, false);
      await expect(token.connect(investorB).transfer(unapprovedD.address, 1n))
        .to.be.revertedWithCustomError(token, "SenderNotWhitelisted").withArgs(investorB.address);
    });

    it("restores sending and receiving after reapproval", async function () {
      const { token, issuer, investorB, investorC } = await networkHelpers.loadFixture(approvedHolders);
      await token.setWhitelisted(investorB.address, false);
      await token.setWhitelisted(investorB.address, true);
      await token.connect(investorB).transfer(investorC.address, 20n);
      await token.transfer(investorB.address, 5n);
      expect(await token.balanceOf(issuer.address)).to.equal(9_895n);
      expect(await token.balanceOf(investorB.address)).to.equal(85n);
      expect(await token.balanceOf(investorC.address)).to.equal(20n);
    });

    it("applies the same eligibility requirements to the issuer", async function () {
      const { token, issuer, investorB } = await networkHelpers.loadFixture(approvedHolders);
      await token.setWhitelisted(issuer.address, false);
      await expect(token.transfer(investorB.address, 1n))
        .to.be.revertedWithCustomError(token, "SenderNotWhitelisted").withArgs(issuer.address);
      await expect(token.connect(investorB).transfer(issuer.address, 1n))
        .to.be.revertedWithCustomError(token, "RecipientNotWhitelisted").withArgs(issuer.address);
      await token.setWhitelisted(issuer.address, true);
      await token.transfer(investorB.address, 1n);
    });
  });

  describe("D — approvals and delegated transfers", function () {
    it("creates and replaces allowances with standard Approval events", async function () {
      const { token, investorB, unapprovedD } = await networkHelpers.loadFixture(approvedHolders);
      await expect(token.connect(investorB).approve(unapprovedD.address, 30n))
        .to.emit(token, "Approval").withArgs(investorB.address, unapprovedD.address, 30n);
      expect(await token.allowance(investorB.address, unapprovedD.address)).to.equal(30n);
      await token.connect(investorB).approve(unapprovedD.address, 0n);
      expect(await token.allowance(investorB.address, unapprovedD.address)).to.equal(0n);
    });

    it("allows an unwhitelisted spender to transfer between approved holders", async function () {
      const { token, investorB, investorC, unapprovedD } = await networkHelpers.loadFixture(approvedHolders);
      await token.connect(investorB).approve(unapprovedD.address, 30n);
      await expect(token.connect(unapprovedD).transferFrom(investorB.address, investorC.address, 20n))
        .to.emit(token, "Transfer").withArgs(investorB.address, investorC.address, 20n);
      expect(await token.isWhitelisted(unapprovedD.address)).to.equal(false);
      expect(await token.balanceOf(investorB.address)).to.equal(80n);
      expect(await token.balanceOf(investorC.address)).to.equal(20n);
      expect(await token.allowance(investorB.address, unapprovedD.address)).to.equal(10n);
    });

    it("rolls back balances and allowance for an ineligible delegated recipient", async function () {
      const { token, investorB, investorC, unapprovedD } = await networkHelpers.loadFixture(approvedHolders);
      await token.connect(investorB).approve(investorC.address, 30n);
      await expect(token.connect(investorC).transferFrom(investorB.address, unapprovedD.address, 20n))
        .to.be.revertedWithCustomError(token, "RecipientNotWhitelisted").withArgs(unapprovedD.address);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
      expect(await token.balanceOf(unapprovedD.address)).to.equal(0n);
      expect(await token.allowance(investorB.address, investorC.address)).to.equal(30n);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("checks the actual holder and rolls back allowance when that holder is revoked", async function () {
      const { token, issuer, investorB, investorC } = await networkHelpers.loadFixture(approvedHolders);
      await token.connect(investorB).approve(issuer.address, 30n);
      await token.setWhitelisted(investorB.address, false);
      await expect(token.transferFrom(investorB.address, investorC.address, 20n))
        .to.be.revertedWithCustomError(token, "SenderNotWhitelisted").withArgs(investorB.address);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
      expect(await token.balanceOf(investorC.address)).to.equal(0n);
      expect(await token.allowance(investorB.address, issuer.address)).to.equal(30n);
      await token.setWhitelisted(investorB.address, true);
      await token.transferFrom(investorB.address, investorC.address, 20n);
      expect(await token.allowance(investorB.address, issuer.address)).to.equal(10n);
    });

    it("preserves the standard insufficient-allowance error and unchanged state", async function () {
      const { token, investorB, investorC, unapprovedD } = await networkHelpers.loadFixture(approvedHolders);
      await token.connect(investorB).approve(unapprovedD.address, 10n);
      await expect(token.connect(unapprovedD).transferFrom(investorB.address, investorC.address, 20n))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance").withArgs(unapprovedD.address, 10n, 20n);
      expect(await token.allowance(investorB.address, unapprovedD.address)).to.equal(10n);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
      expect(await token.balanceOf(investorC.address)).to.equal(0n);
    });

    it("preserves approvals and approval revocation for ineligible wallets", async function () {
      const { token, investorB, unapprovedD, unauthorisedE } = await networkHelpers.loadFixture(approvedHolders);
      await token.connect(unapprovedD).approve(unauthorisedE.address, 5n);
      expect(await token.allowance(unapprovedD.address, unauthorisedE.address)).to.equal(5n);
      await token.setWhitelisted(investorB.address, false);
      await token.connect(investorB).approve(unapprovedD.address, 25n);
      expect(await token.allowance(investorB.address, unapprovedD.address)).to.equal(25n);
      await token.connect(investorB).approve(unapprovedD.address, 0n);
      expect(await token.allowance(investorB.address, unapprovedD.address)).to.equal(0n);
    });

    it("preserves unlimited allowances across successful transfers", async function () {
      const { token, investorB, investorC, unapprovedD } = await networkHelpers.loadFixture(approvedHolders);
      await token.connect(investorB).approve(unapprovedD.address, ethers.MaxUint256);
      await token.connect(unapprovedD).transferFrom(investorB.address, investorC.address, 20n);
      expect(await token.allowance(investorB.address, unapprovedD.address)).to.equal(ethers.MaxUint256);
    });

    it("rolls back allowance spending when the delegated holder has insufficient balance", async function () {
      const { token, investorB, investorC, unapprovedD } = await networkHelpers.loadFixture(approvedHolders);
      await token.connect(investorB).approve(unapprovedD.address, 101n);
      await expect(token.connect(unapprovedD).transferFrom(investorB.address, investorC.address, 101n))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance").withArgs(investorB.address, 100n, 101n);
      expect(await token.allowance(investorB.address, unapprovedD.address)).to.equal(101n);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
      expect(await token.balanceOf(investorC.address)).to.equal(0n);
    });
  });

  describe("E — edge cases, contract holders, and instance isolation", function () {
    it("rejects a direct transfer exceeding the balance", async function () {
      const { token, investorB, investorC } = await networkHelpers.loadFixture(approvedHolders);
      await expect(token.connect(investorB).transfer(investorC.address, 101n))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance").withArgs(investorB.address, 100n, 101n);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
    });

    it("permits a zero-value transfer between eligible accounts and emits Transfer", async function () {
      const { token, investorB, investorC } = await networkHelpers.loadFixture(approvedHolders);
      await expect(token.connect(investorB).transfer(investorC.address, 0n))
        .to.emit(token, "Transfer").withArgs(investorB.address, investorC.address, 0n);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
      expect(await token.balanceOf(investorC.address)).to.equal(0n);
    });

    it("enforces both eligibility checks even for zero-value transfers", async function () {
      const { token, investorB, unapprovedD } = await networkHelpers.loadFixture(approvedHolders);
      await expect(token.connect(investorB).transfer(unapprovedD.address, 0n))
        .to.be.revertedWithCustomError(token, "RecipientNotWhitelisted").withArgs(unapprovedD.address);
      await expect(token.connect(unapprovedD).transfer(investorB.address, 0n))
        .to.be.revertedWithCustomError(token, "SenderNotWhitelisted").withArgs(unapprovedD.address);
    });

    it("allows zero-value delegated transfers but still checks holder eligibility", async function () {
      const { token, investorB, investorC, unapprovedD } = await networkHelpers.loadFixture(approvedHolders);
      await token.connect(unapprovedD).transferFrom(investorB.address, investorC.address, 0n);
      await token.setWhitelisted(investorB.address, false);
      await expect(token.connect(unapprovedD).transferFrom(investorB.address, investorC.address, 0n))
        .to.be.revertedWithCustomError(token, "SenderNotWhitelisted").withArgs(investorB.address);
    });

    it("preserves standard zero-recipient errors for direct and delegated transfers", async function () {
      const { token, investorB, investorC } = await networkHelpers.loadFixture(approvedHolders);
      await expect(token.connect(investorB).transfer(ethers.ZeroAddress, 1n))
        .to.be.revertedWithCustomError(token, "ERC20InvalidReceiver").withArgs(ethers.ZeroAddress);
      await token.connect(investorB).approve(investorC.address, 1n);
      await expect(token.connect(investorC).transferFrom(investorB.address, ethers.ZeroAddress, 1n))
        .to.be.revertedWithCustomError(token, "ERC20InvalidReceiver").withArgs(ethers.ZeroAddress);
      expect(await token.allowance(investorB.address, investorC.address)).to.equal(1n);
    });

    it("preserves standard errors for a zero spender or a zero delegated owner", async function () {
      const { token, investorB, investorC } = await networkHelpers.loadFixture(approvedHolders);
      await expect(token.connect(investorB).approve(ethers.ZeroAddress, 1n))
        .to.be.revertedWithCustomError(token, "ERC20InvalidSpender").withArgs(ethers.ZeroAddress);
      // OpenZeppelin spends allowance before transferring, so a zero owner is
      // rejected by _approve even when the delegated amount is zero.
      await expect(token.transferFrom(ethers.ZeroAddress, investorC.address, 0n))
        .to.be.revertedWithCustomError(token, "ERC20InvalidApprover").withArgs(ethers.ZeroAddress);
    });

    it("supports self-transfers without altering balance or supply", async function () {
      const { token, investorB } = await networkHelpers.loadFixture(approvedHolders);
      await token.connect(investorB).transfer(investorB.address, 100n);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("allows an approved smart-contract holder to receive and forward inventory", async function () {
      const { token, investorB } = await networkHelpers.loadFixture(deployToken);
      const holder = await ethers.deployContract("AssetTokenHolderHarness");
      const holderAddress = await holder.getAddress();
      await token.setWhitelisted(holderAddress, true);
      await token.setWhitelisted(investorB.address, true);
      await token.transfer(holderAddress, 100n);
      await holder.forward(await token.getAddress(), investorB.address, 20n);
      expect(await token.balanceOf(holderAddress)).to.equal(80n);
      expect(await token.balanceOf(investorB.address)).to.equal(20n);
      await token.setWhitelisted(holderAddress, false);
      await expect(holder.forward(await token.getAddress(), investorB.address, 1n))
        .to.be.revertedWithCustomError(token, "SenderNotWhitelisted").withArgs(holderAddress);
      await expect(token.transfer(holderAddress, 1n))
        .to.be.revertedWithCustomError(token, "RecipientNotWhitelisted").withArgs(holderAddress);
      expect(await token.balanceOf(holderAddress)).to.equal(80n);
    });

    it("isolates roles, whitelist, allowances, balances, and supply across assets", async function () {
      const { token, issuer, investorB, unapprovedD, otherIssuer } = await networkHelpers.loadFixture(approvedHolders);
      const second = await ethers.deployContract("AssetToken", ["Digital Licensing Pool", "DLP", 500n, otherIssuer.address]);
      const role = await token.COMPLIANCE_ROLE();
      expect(await second.isWhitelisted(investorB.address)).to.equal(false);
      expect(await second.isWhitelisted(issuer.address)).to.equal(false);
      expect(await token.isWhitelisted(otherIssuer.address)).to.equal(false);
      expect(await second.hasRole(role, issuer.address)).to.equal(false);
      expect(await token.hasRole(role, otherIssuer.address)).to.equal(false);
      await expect(second.setWhitelisted(investorB.address, true))
        .to.be.revertedWithCustomError(second, "AccessControlUnauthorizedAccount").withArgs(issuer.address, role);
      await expect(token.connect(otherIssuer).setWhitelisted(investorB.address, false))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount").withArgs(otherIssuer.address, role);
      await second.connect(otherIssuer).setWhitelisted(investorB.address, true);
      await second.connect(otherIssuer).transfer(investorB.address, 10n);
      await token.connect(investorB).approve(unapprovedD.address, 20n);
      await token.grantRole(role, unapprovedD.address);
      await token.setWhitelisted(investorB.address, false);
      expect(await second.isWhitelisted(investorB.address)).to.equal(true);
      expect(await second.hasRole(role, unapprovedD.address)).to.equal(false);
      expect(await second.allowance(investorB.address, unapprovedD.address)).to.equal(0n);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
      expect(await second.balanceOf(investorB.address)).to.equal(10n);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await second.totalSupply()).to.equal(500n);
    });

    it("conserves supply across deterministic transfers, revocation, and failures", async function () {
      const { token, issuer, investorB, investorC, unapprovedD, unauthorisedE } = await networkHelpers.loadFixture(approvedHolders);
      const holders = [issuer, investorB, investorC, unapprovedD, unauthorisedE];
      async function assertSupply() {
        const balances = await Promise.all(holders.map((holder) => token.balanceOf(holder.address)));
        expect(balances.reduce((sum, balance) => sum + balance, 0n)).to.equal(INITIAL_SUPPLY);
        expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
      }
      await assertSupply();
      await token.connect(investorB).transfer(investorC.address, 30n);
      await assertSupply();
      await token.connect(investorC).approve(unapprovedD.address, 10n);
      await token.connect(unapprovedD).transferFrom(investorC.address, issuer.address, 10n);
      await assertSupply();
      await token.setWhitelisted(investorB.address, false);
      await expect(token.connect(investorB).transfer(investorC.address, 1n))
        .to.be.revertedWithCustomError(token, "SenderNotWhitelisted").withArgs(investorB.address);
      await assertSupply();
      await token.setWhitelisted(investorB.address, true);
      await token.connect(investorC).transfer(investorB.address, 20n);
      await assertSupply();
    });
  });

  describe("Local demonstration", function () {
    it("demonstrates CPT issuance, unapproved D rejection, and final balances 9,900 / 80 / 20", async function () {
      const { token, issuer, investorB, investorC, unapprovedD } = await networkHelpers.loadFixture(deployToken);
      expect(await token.name()).to.equal("Campus Property Token");
      expect(await token.symbol()).to.equal("CPT");
      expect(await token.balanceOf(issuer.address)).to.equal(INITIAL_SUPPLY);
      await token.setWhitelisted(investorB.address, true);
      await token.transfer(investorB.address, 100n);
      expect(await token.balanceOf(issuer.address)).to.equal(9_900n);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
      await expect(token.connect(investorB).transfer(unapprovedD.address, 20n))
        .to.be.revertedWithCustomError(token, "RecipientNotWhitelisted").withArgs(unapprovedD.address);
      expect(await token.balanceOf(investorB.address)).to.equal(100n);
      expect(await token.balanceOf(unapprovedD.address)).to.equal(0n);
      await token.setWhitelisted(investorC.address, true);
      await token.connect(investorB).transfer(investorC.address, 20n);
      expect(await token.balanceOf(issuer.address)).to.equal(9_900n);
      expect(await token.balanceOf(investorB.address)).to.equal(80n);
      expect(await token.balanceOf(investorC.address)).to.equal(20n);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    });
  });
});
