import { assert } from "chai";
import hre from "hardhat";

// spec-v1 §5 & §6 — full test suite in Phase 2
describe("AssetToken", function () {
  it.skip("deploys with correct name, symbol, decimals, and supply");
  it.skip("mints initial supply to issuer");
  it.skip("issuer is auto-whitelisted on deployment");

  // Whitelist
  it.skip("issuer can add an address to the whitelist");
  it.skip("non-issuer cannot add to whitelist");
  it.skip("issuer can remove a zero-balance address from whitelist");
  it.skip("issuer cannot remove an address that still holds tokens");

  // Transfer gate (invariant 4)
  it.skip("transfer to non-whitelisted address reverts");
  it.skip("transfer from whitelisted to whitelisted succeeds");

  // Pause (invariant 5)
  it.skip("issuer can pause; all transfers revert while paused");
  it.skip("issuer can unpause; transfers succeed again");
  it.skip("non-issuer cannot pause");

  // Freeze (invariant 6)
  it.skip("issuer can freeze an address; that address cannot send tokens");
  it.skip("frozen address cannot receive tokens via transfer");
  it.skip("issuer can unfreeze");

  // Forced transfer
  it.skip("issuer can forcedTransfer from a frozen address to a whitelisted address");
  it.skip("non-issuer cannot call forcedTransfer");

  // Invariants
  it.skip("invariant: every holder is whitelisted (supply invariant)");
  it.skip("invariant: totalSupply equals sum of all balances");
});
