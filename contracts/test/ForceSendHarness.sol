// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Test-only (AUD-007): forces ETH into `target` even when it has no
/// receive/fallback. selfdestruct in the creating transaction still transfers
/// the balance after EIP-6780.
contract ForceSendHarness {
    constructor(address payable target) payable {
        selfdestruct(target);
    }
}
