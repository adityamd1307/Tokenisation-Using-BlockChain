// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Simulated currency with no backing. Subscription requirements §3.
contract MockUSD is ERC20, Ownable {
    constructor(address owner_) ERC20("Mock USD", "mUSD") Ownable(owner_) {}

    function decimals() public pure override returns (uint8) { return 6; }

    /// @notice Only the demo currency owner distributes test balances.
    function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }
}
