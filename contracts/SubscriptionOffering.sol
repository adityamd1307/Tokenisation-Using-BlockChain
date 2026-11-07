// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./AssetToken.sol";

/// @notice Subscription requirements §§4–15. No enumeration, push refunds or claim expiry.
contract SubscriptionOffering is ReentrancyGuard {
    using SafeERC20 for IERC20;
    struct Config {
        address assetToken;
        address paymentToken;
        address issuer;
        uint256 supply;
        uint256 price;
        uint256 softCap;
        uint256 start;
        uint256 end;
    }
    struct Entitlement {
        uint256 allocation;
        uint256 accepted;
        uint256 refund;
        bool settled;
        bool claimed;
    }
    enum State { Upcoming, Open, AwaitingFinalization, Successful, Failed }
    AssetToken public immutable assetToken;
    IERC20 public immutable paymentToken;
    address public immutable issuer;
    uint256 public immutable tokenSupplyForSale;
    uint256 public immutable tokenPrice;
    uint256 public immutable softCap;
    uint256 public immutable hardCap;
    uint256 public immutable subscriptionStart;
    uint256 public immutable subscriptionEnd;

    bool public finalized;
    bool public successful;
    uint256 public depositedInventory;
    uint256 public totalCommitments;
    uint256 public subscriberCount;
    uint256 public guaranteedAcceptedFunding;
    uint256 public maximumAllocation;
    uint256 public settledCount;
    uint256 public settledCommitments;
    uint256 public totalRefundCredits;
    uint256 public refundsPaid;
    uint256 public recognizedProceeds;
    uint256 public proceedsWithdrawn;
    uint256 public totalAllocated;
    uint256 public totalClaimed;
    mapping(address => uint256) public commitments;
    mapping(address => Entitlement) public entitlements;

    error InvalidConfiguration();
    error NotIssuer();
    error WrongStage();
    error InvalidAmount();
    error InventoryNotFunded();
    error InvestorNotEligible();
    error UnsupportedTokenBehavior();
    error AlreadySettled();
    error NotSettled();
    error NothingDue();
    error Insolvent();

    event InventoryDeposited(uint256 amount);
    event SubscriptionCommitted(address indexed investor, uint256 amount, uint256 totalInvestorCommitment);
    event OfferingFinalized(bool successful, uint256 totalCommitments, uint256 guaranteedAcceptedFunding);
    event AllocationSettled(address indexed investor, uint256 allocation, uint256 accepted, uint256 refund);
    event RefundWithdrawn(address indexed investor, uint256 amount);
    event TokensClaimed(address indexed investor, uint256 amount);
    event ProceedsWithdrawn(uint256 amount);
    event InventoryRecovered(uint256 amount);

    modifier onlyIssuer() { if (msg.sender != issuer) revert NotIssuer(); _; }

    /// @dev §5: registered zero-decimal assets and a trusted six-decimal payment token.
    constructor(Config memory c) {
        if (c.assetToken.code.length == 0 || c.paymentToken.code.length == 0 || c.issuer == address(0)
            || c.assetToken == c.paymentToken || c.supply == 0 || c.price == 0
            || c.supply > type(uint256).max / c.price || c.softCap == 0
            || c.start <= block.timestamp || c.end <= c.start) revert InvalidConfiguration();
        uint256 cap = c.supply * c.price;
        if (c.softCap > cap || AssetToken(c.assetToken).decimals() != 0
            || IERC20Metadata(c.paymentToken).decimals() != 6
            || AssetToken(c.assetToken).issuer() != c.issuer
            || c.supply > AssetToken(c.assetToken).totalSupply()) revert InvalidConfiguration();
        assetToken = AssetToken(c.assetToken);
        paymentToken = IERC20(c.paymentToken);
        issuer = c.issuer;
        tokenSupplyForSale = c.supply;
        tokenPrice = c.price;
        softCap = c.softCap;
        hardCap = cap;
        subscriptionStart = c.start;
        subscriptionEnd = c.end;
    }

    function state() public view returns (State) {
        if (finalized) return successful ? State.Successful : State.Failed;
        if (block.timestamp < subscriptionStart) return State.Upcoming;
        if (block.timestamp < subscriptionEnd) return State.Open;
        return State.AwaitingFinalization;
    }

    /// @dev §6: accounting deposits exclude unsolicited donations.
    function depositOfferingTokens(uint256 amount) external onlyIssuer nonReentrant {
        if (block.timestamp >= subscriptionStart) revert WrongStage();
        if (amount == 0 || amount > tokenSupplyForSale - depositedInventory) revert InvalidAmount();
        uint256 beforeBalance = assetToken.balanceOf(address(this));
        depositedInventory += amount;
        IERC20(address(assetToken)).safeTransferFrom(issuer, address(this), amount);
        if (assetToken.balanceOf(address(this)) != beforeBalance + amount) revert UnsupportedTokenBehavior();
        emit InventoryDeposited(amount);
    }

    /// @dev §§7–8: [start,end); hard cap limits accepted funds, never subscriptions.
    function commit(uint256 amount) external nonReentrant {
        if (state() != State.Open) revert WrongStage();
        if (depositedInventory != tokenSupplyForSale || assetToken.balanceOf(address(this)) < tokenSupplyForSale)
            revert InventoryNotFunded();
        if (!assetToken.isWhitelisted(msg.sender)) revert InvestorNotEligible();
        if (amount == 0 || amount % tokenPrice != 0) revert InvalidAmount();
        uint256 beforeBalance = paymentToken.balanceOf(address(this));
        if (commitments[msg.sender] == 0) subscriberCount++;
        commitments[msg.sender] += amount;
        totalCommitments += amount;
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        if (paymentToken.balanceOf(address(this)) != beforeBalance + amount) revert UnsupportedTokenBehavior();
        _checkPaymentSolvency();
        emit SubscriptionCommitted(msg.sender, amount, commitments[msg.sender]);
    }

    /// @dev §9: sum floor(c_i*S/C) >= max(0,S-n+1) since sum fractions < n.
    function finalizeOffering() external nonReentrant {
        if (finalized || block.timestamp < subscriptionEnd) revert WrongStage();
        uint256 lowerBound = 0;
        if (totalCommitments <= hardCap) {
            lowerBound = totalCommitments;
            maximumAllocation = totalCommitments / tokenPrice;
        } else {
            maximumAllocation = tokenSupplyForSale;
            if (subscriberCount <= tokenSupplyForSale)
                lowerBound = (tokenSupplyForSale - subscriberCount + 1) * tokenPrice;
        }
        successful = lowerBound >= softCap && depositedInventory == tokenSupplyForSale
            && assetToken.balanceOf(address(this)) >= maximumAllocation;
        finalized = true;
        guaranteedAcceptedFunding = successful ? lowerBound : 0;
        if (!successful) maximumAllocation = 0;
        _checkPaymentSolvency();
        emit OfferingFinalized(successful, totalCommitments, guaranteedAcceptedFunding);
    }

    /// @notice Final entitlements only; no preview is represented as final before closing.
    function allocationOf(address investor) public view returns (uint256 allocation, uint256 accepted, uint256 refund) {
        if (!finalized) revert WrongStage();
        uint256 commitment = commitments[investor];
        if (successful) {
            allocation = totalCommitments <= hardCap ? commitment / tokenPrice
                : Math.mulDiv(commitment, tokenSupplyForSale, totalCommitments);
            accepted = allocation * tokenPrice;
        }
        refund = commitment - accepted;
    }

    function settleSubscription() external nonReentrant { _settle(msg.sender); }

    /// @notice §11: anyone may materialize immutable accounting; payouts stay owner-only.
    function settleFor(address investor) external nonReentrant { _settle(investor); }

    function _settle(address investor) private {
        if (!finalized) revert WrongStage();
        Entitlement storage e = entitlements[investor];
        if (e.settled) revert AlreadySettled();
        if (commitments[investor] == 0) revert NothingDue();
        (uint256 allocation, uint256 accepted, uint256 refund) = allocationOf(investor);
        e.allocation = allocation;
        e.accepted = accepted;
        e.refund = refund;
        e.settled = true;
        settledCount++;
        settledCommitments += commitments[investor];
        totalAllocated += allocation;
        recognizedProceeds += accepted;
        totalRefundCredits += refund;
        _checkPaymentSolvency();
        emit AllocationSettled(investor, allocation, accepted, refund);
    }

    /// @dev §12: independent of asset eligibility, pause and token claims.
    function withdrawRefund() external nonReentrant {
        Entitlement storage e = entitlements[msg.sender];
        if (!e.settled) revert NotSettled();
        uint256 amount = e.refund;
        if (amount == 0) revert NothingDue();
        e.refund = 0;
        totalRefundCredits -= amount;
        refundsPaid += amount;
        _pay(msg.sender, amount);
        emit RefundWithdrawn(msg.sender, amount);
    }

    /// @dev §13: AssetToken enforces both endpoints and pause. No claim expiry.
    function claimTokens() external nonReentrant {
        if (!successful) revert WrongStage();
        Entitlement storage e = entitlements[msg.sender];
        if (!e.settled) revert NotSettled();
        if (e.claimed || e.allocation == 0) revert NothingDue();
        e.claimed = true;
        totalClaimed += e.allocation;
        IERC20(address(assetToken)).safeTransfer(msg.sender, e.allocation);
        emit TokensClaimed(msg.sender, e.allocation);
    }

    /// @dev §14: recognises only settled allocations, never gross deposits/donations.
    function withdrawProceeds() external onlyIssuer nonReentrant {
        uint256 amount = recognizedProceeds - proceedsWithdrawn;
        if (amount == 0) revert NothingDue();
        proceedsWithdrawn += amount;
        _pay(issuer, amount);
        emit ProceedsWithdrawn(amount);
    }

    function paymentLiabilities() public view returns (uint256) {
        return totalCommitments - settledCommitments + totalRefundCredits + recognizedProceeds - proceedsWithdrawn;
    }

    function reservedTokens() public view returns (uint256) {
        if (!finalized) return depositedInventory;
        if (!successful) return 0;
        return (settledCount == subscriberCount ? totalAllocated : maximumAllocation) - totalClaimed;
    }

    function recoverableTokens() public view returns (uint256) {
        if (!finalized) return 0;
        uint256 balance = assetToken.balanceOf(address(this));
        uint256 reserve = reservedTokens();
        return balance > reserve ? balance - reserve : 0;
    }

    /// @dev §15: exact dust unlocks only after all accounting is settled, not after claims.
    function recoverUnsoldTokens() external onlyIssuer nonReentrant {
        if (!finalized) revert WrongStage();
        uint256 amount = recoverableTokens();
        if (amount == 0) revert NothingDue();
        IERC20(address(assetToken)).safeTransfer(issuer, amount);
        emit InventoryRecovered(amount);
    }

    function _pay(address to, uint256 amount) private {
        uint256 beforeBalance = paymentToken.balanceOf(address(this));
        uint256 beforeRecipient = paymentToken.balanceOf(to);
        paymentToken.safeTransfer(to, amount);
        if (paymentToken.balanceOf(address(this)) != beforeBalance - amount
            || paymentToken.balanceOf(to) != beforeRecipient + amount) revert UnsupportedTokenBehavior();
        _checkPaymentSolvency();
    }

    function _checkPaymentSolvency() private view {
        if (paymentToken.balanceOf(address(this)) < paymentLiabilities()) revert Insolvent();
    }
}
