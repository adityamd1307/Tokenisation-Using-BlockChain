import { expect } from "chai";
import { network } from "hardhat";

// AUD-004: use the shared pre/post API so failure proves a transfer bypass,
// rather than merely detecting a missing Phase 2 function or error declaration.
describe("AssetToken AUD-004 regression", function () {
  it("rejects a transfer to an unapproved investor without changing balances", async function () {
    const connection = await network.create();
    try {
      const { ethers } = connection;
      const [issuer, unapproved] = await ethers.getSigners();
      const token = await ethers.deployContract("AssetToken", [
        "Campus Property Token", "CPT", 10_000n, issuer.address,
      ], issuer);
      expect(await token.whitelist(unapproved.address)).to.equal(false);
      await expect(token.transfer(unapproved.address, 20n)).to.revert(ethers);
      expect(await token.balanceOf(issuer.address)).to.equal(10_000n);
      expect(await token.balanceOf(unapproved.address)).to.equal(0n);
      expect(await token.totalSupply()).to.equal(10_000n);
    } finally {
      await connection.close();
    }
  });
});
