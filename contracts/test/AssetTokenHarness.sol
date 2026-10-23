// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../AssetToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Test-only construction helper, without registry or sale functionality.
contract AssetTokenDeploymentHarness {
    AssetToken public immutable token;

    constructor(address issuer) {
        token = new AssetToken("Campus Property Token", "CPT", 10_000, issuer);
    }
}

/// @dev Test-only holder. Forwarding is unrestricted; never use as a custody contract.
contract AssetTokenHolderHarness {
    function forward(IERC20 token, address recipient, uint256 amount) external {
        token.transfer(recipient, amount);
    }
}
