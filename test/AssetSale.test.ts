import { assert } from "chai";
import hre from "hardhat";

// spec-v1 §5 & §6 — full test suite in Phase 2
describe("AssetSale", function () {
  it.skip("deploys with correct token, priceWei, and issuer");

  // Allocation
  it.skip("issuer can allocate tokens (approve + allocate)");
  it.skip("non-issuer cannot allocate");
  it.skip("allocate with insufficient issuer balance reverts");

  // Buying (instant subscription flow)
  it.skip("whitelisted investor can buy tokens with exact ETH payment");
  it.skip("buy with wrong ETH amount reverts");
  it.skip("buy when not whitelisted reverts");
  it.skip("buy more than available inventory reverts");

  // Proceeds
  it.skip("issuer can withdraw ETH proceeds after a purchase");
  it.skip("non-issuer cannot withdraw proceeds");
  it.skip("withdrawProceeds with zero balance reverts");

  // Invariant 3: ETH balance = tokens sold * price - proceeds withdrawn
  it.skip("invariant: sale ETH balance equals tokens sold times priceWei minus withdrawals");
});
