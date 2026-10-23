// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./AssetToken.sol";

/// @notice Fixed-price escrow sale for one AssetToken.
/// @dev Governed by docs/spec/phase3-requirements.md §3.2–3.4 and decision D3,
/// superseding spec-v1 §4–5 names (`buy`, `priceWei`, `token`).
contract AssetSale {
    using SafeERC20 for AssetToken;

    AssetToken public immutable assetToken;
    address public immutable issuer;
    uint256 public immutable pricePerToken;

    /// @dev spec-v1 invariant 8: ETH owed to the issuer, zeroed before the payout call.
    uint256 public unclaimedProceeds;
    bool public saleClosed;

    error InvalidToken();
    error InvalidIssuer();
    error InvalidPrice();
    error NotIssuer();
    error InvalidQuantity();
    error SaleIsClosed();
    error SaleNotClosed();
    error InvestorNotWhitelisted(address investor);
    error InsufficientInventory(uint256 requested, uint256 available);
    error IncorrectPayment(uint256 expected, uint256 received);
    error NoProceeds();
    error WithdrawalFailed();
    error NoUnsoldTokens();

    event Allocated(uint256 amount);
    event Purchased(address indexed buyer, uint256 quantity, uint256 paid);
    event ProceedsWithdrawn(uint256 amount);
    event SaleClosed();
    event UnsoldTokensRecovered(uint256 amount);

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert NotIssuer();
        _;
    }

    modifier whenOpen() {
        if (saleClosed) revert SaleIsClosed();
        _;
    }

    /// @dev Phase 3 §3.3: price is fixed at asset creation and never changes.
    constructor(address assetToken_, uint256 pricePerToken_, address issuer_) {
        if (assetToken_ == address(0)) revert InvalidToken();
        if (issuer_ == address(0)) revert InvalidIssuer();
        if (pricePerToken_ == 0) revert InvalidPrice();
        assetToken = AssetToken(assetToken_);
        pricePerToken = pricePerToken_;
        issuer = issuer_;
    }

    /// @notice Tokens currently held for sale.
    /// @dev spec-v1 §7: the investor dashboard shows available tokens.
    function availableTokens() public view returns (uint256) {
        return assetToken.balanceOf(address(this));
    }

    /// @notice Moves inventory from the issuer into the sale. The issuer must
    /// first whitelist this contract and approve it for `amount`.
    /// @dev Phase 3 §3.3; spec-v1 §5 `allocate`.
    function allocate(uint256 amount) external onlyIssuer whenOpen {
        if (amount == 0) revert InvalidQuantity();
        assetToken.safeTransferFrom(issuer, address(this), amount);
        emit Allocated(amount);
    }

    /// @dev Phase 3 §3.2: exact payment, instant settlement (spec-v1 §4 DvP escrow).
    function buyTokens(uint256 quantity) external payable whenOpen {
        if (quantity == 0) revert InvalidQuantity();
        if (!assetToken.isWhitelisted(msg.sender)) revert InvestorNotWhitelisted(msg.sender);
        uint256 available = availableTokens();
        if (quantity > available) revert InsufficientInventory(quantity, available);
        uint256 cost = quantity * pricePerToken;
        if (msg.value != cost) revert IncorrectPayment(cost, msg.value);

        unclaimedProceeds += msg.value;
        assetToken.safeTransfer(msg.sender, quantity);
        emit Purchased(msg.sender, quantity, msg.value);
    }

    /// @dev Phase 3 §3.4; spec-v1 §4 reentrancy requirement and invariant 8:
    /// checks-effects-interactions, so the balance is zero before the ETH send.
    function withdrawProceeds() external onlyIssuer {
        uint256 amount = unclaimedProceeds;
        if (amount == 0) revert NoProceeds();
        unclaimedProceeds = 0;
        (bool ok, ) = issuer.call{value: amount}("");
        if (!ok) revert WithdrawalFailed();
        emit ProceedsWithdrawn(amount);
    }

    /// @dev Phase 3 §3.4, decision D3: closing is irreversible.
    function closeSale() external onlyIssuer whenOpen {
        saleClosed = true;
        emit SaleClosed();
    }

    /// @dev Phase 3 §3.4, decision D3: returns all unsold inventory to the issuer.
    function recoverUnsoldTokens() external onlyIssuer {
        if (!saleClosed) revert SaleNotClosed();
        uint256 amount = availableTokens();
        if (amount == 0) revert NoUnsoldTokens();
        assetToken.safeTransfer(issuer, amount);
        emit UnsoldTokensRecovered(amount);
    }
}
