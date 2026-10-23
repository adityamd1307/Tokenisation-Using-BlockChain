// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// spec-v1 §4: ERC-20 with whitelist, pause, freeze, and forced-transfer controls.
// Full implementation in Phase 2.
contract AssetToken is ERC20 {
    address public issuer;
    mapping(address => bool) public whitelist;
    bool public paused;
    mapping(address => bool) public frozen;

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address _issuer
    ) ERC20(name, symbol) {
        issuer = _issuer;
        // Issuer is whitelisted so the initial mint can land.
        whitelist[_issuer] = true;
        _mint(_issuer, initialSupply);
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }
}
