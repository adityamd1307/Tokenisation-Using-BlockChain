// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../AssetSale.sol";

/// @dev Test-only contract issuer for spec-v1 invariant 8. On receiving ETH it
/// re-enters withdrawProceeds once, or rejects the payment when `rejectPayments`.
contract AssetSaleIssuerHarness {
    AssetSale public sale;
    bool public rejectPayments;
    bool public reentryAttempted;
    bool public reentrySucceeded;
    uint256 public proceedsSeenDuringPayout;

    function setSale(AssetSale sale_) external {
        sale = sale_;
    }

    function setRejectPayments(bool reject) external {
        rejectPayments = reject;
    }

    function execute(address target, bytes calldata data) external {
        (bool ok, bytes memory reason) = target.call(data);
        if (!ok) {
            assembly {
                revert(add(reason, 32), mload(reason))
            }
        }
    }

    receive() external payable {
        if (rejectPayments) revert("payment rejected");
        if (!reentryAttempted) {
            reentryAttempted = true;
            proceedsSeenDuringPayout = sale.unclaimedProceeds();
            try sale.withdrawProceeds() {
                reentrySucceeded = true;
            } catch {}
        }
    }
}
