// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AssetToken.sol";
import "./AssetSale.sol";

// spec-v1 §4: authorises issuers and deploys AssetToken + AssetSale pairs.
// Full implementation in Phase 2.
contract AssetFactory {
    address public admin;
    mapping(address => bool) public authorisedIssuers;
    address[] public assets;
    mapping(address => address) public tokenToSale;

    constructor(address _admin) {
        admin = _admin;
    }
}
