// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../AssetSale.sol";

/// @dev Phase 6 test-only issuer. Never deployed by AssetFactory or deployment scripts.
contract SaleCallbackHarness {
    AssetSale public sale;
    bool public rejectPayment;
    bool public entered;
    bool public nestedSweep;
    bool public nestedWithdrawal;
    uint256 public received;

    function configure(AssetSale target, bool reject_) external {
        sale = target;
        rejectPayment = reject_;
    }

    function execute(address target, bytes calldata data) external {
        (bool ok, bytes memory reason) = target.call(data);
        if (!ok) assembly { revert(add(reason, 32), mload(reason)) }
    }

    receive() external payable {
        require(!rejectPayment, "reject payout");
        received += msg.value;
        if (entered) return;
        entered = true;
        try sale.sweepExcessETH() { nestedSweep = true; } catch {}
        try sale.withdrawProceeds() { nestedWithdrawal = true; } catch {}
    }
}
