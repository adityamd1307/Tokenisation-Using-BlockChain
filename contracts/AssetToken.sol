// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Fixed-supply whole asset units with on-chain investor eligibility.
/// @dev Governed by docs/spec/phase2-requirements.md §2, superseding spec-v1
/// where revocation and delegated compliance administration differ.
contract AssetToken is ERC20, AccessControl {
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    address public immutable issuer;
    mapping(address => bool) public isWhitelisted;

    error InvalidIssuer();
    error InvalidInitialSupply();
    error InvalidInvestor();
    error SenderNotWhitelisted(address sender);
    error RecipientNotWhitelisted(address recipient);
    error IssuerAdminRoleLocked();

    event WhitelistUpdated(address indexed investor, bool approved, address indexed operator);

    /// @dev Phase 2 §2.1–2.2: assign ownership and roles to issuer_, not deployer.
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        address issuer_
    ) ERC20(name_, symbol_) {
        if (issuer_ == address(0)) revert InvalidIssuer();
        if (initialSupply_ == 0) revert InvalidInitialSupply();

        issuer = issuer_;
        _grantRole(DEFAULT_ADMIN_ROLE, issuer_);
        _grantRole(COMPLIANCE_ROLE, issuer_);
        isWhitelisted[issuer_] = true;
        emit WhitelistUpdated(issuer_, true, _msgSender());
        _mint(issuer_, initialSupply_);
    }

    /// @dev Phase 2 §2.1: supply and transfers are expressed in whole units.
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /// @notice Compatibility getter for the Phase 1 whitelist interface (§2.3).
    function whitelist(address investor) external view returns (bool) {
        return isWhitelisted[investor];
    }

    /// @notice Phase 2 §2.3: revocation blocks movement without altering balances.
    /// @dev Repeating the current status is a no-op; only changes emit an event.
    function setWhitelisted(address investor, bool approved) external onlyRole(COMPLIANCE_ROLE) {
        if (investor == address(0)) revert InvalidInvestor();
        if (isWhitelisted[investor] == approved) return;
        isWhitelisted[investor] = approved;
        emit WhitelistUpdated(investor, approved, _msgSender());
    }

    /// @dev Phase 3 decision D6 (AUD-006): the issuer always keeps DEFAULT_ADMIN_ROLE,
    /// so `issuer` names the ultimate authority and can always restore COMPLIANCE_ROLE.
    /// Both revokeRole and renounceRole route through here.
    function _revokeRole(bytes32 role, address account) internal override returns (bool) {
        if (role == DEFAULT_ADMIN_ROLE && account == issuer) revert IssuerAdminRoleLocked();
        return super._revokeRole(role, account);
    }

    /// @dev Phase 2 §2.4: covers transfer and transferFrom, checking the holder
    /// rather than the spender. The zero sender is exempt for the initial mint.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && !isWhitelisted[from]) revert SenderNotWhitelisted(from);
        if (to != address(0) && !isWhitelisted[to]) revert RecipientNotWhitelisted(to);
        super._update(from, to, value);
    }
}
