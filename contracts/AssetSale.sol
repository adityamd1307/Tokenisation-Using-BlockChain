// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AssetToken.sol";

// spec-v1 §4: escrow sale contract — issuer allocates tokens, investors buy at fixed price.
// Full implementation in Phase 2.
contract AssetSale {
    AssetToken public token;
    uint256 public priceWei;
    address public issuer;

    constructor(address _token, uint256 _priceWei, address _issuer) {
        token = AssetToken(_token);
        priceWei = _priceWei;
        issuer = _issuer;
    }
}
