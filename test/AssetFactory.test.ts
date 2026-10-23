import { assert } from "chai";
import hre from "hardhat";

// spec-v1 §5 — full test suite in Phase 2
describe("AssetFactory", function () {
  it.skip("deploys with correct admin address");

  // Issuer authorisation
  it.skip("admin can authorise an issuer");
  it.skip("admin can deauthorise an issuer");
  it.skip("non-admin cannot authorise an issuer");

  // Asset creation
  it.skip("authorised issuer can create an asset (deploys AssetToken + AssetSale)");
  it.skip("created asset is recorded in assets array and tokenToSale mapping");
  it.skip("unauthorised address cannot create an asset");
  it.skip("createAsset with priceWei == 0 reverts");
  it.skip("createAsset with supply == 0 reverts");

  // Issuer isolation (invariant 7)
  it.skip("issuer A cannot whitelist investors on issuer B's token");
});
