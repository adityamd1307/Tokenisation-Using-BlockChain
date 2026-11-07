// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Synthetic credentials only. Specification A; Enhancement C §3.
contract IdentityRegistryLite is AccessControl {
    bytes32 public constant TRUSTED_ATTESTOR_ROLE = keccak256("TRUSTED_ATTESTOR_ROLE");
    address public immutable administrator;
    struct IdentityData { bytes32 identityId; uint16 country; bool kycApproved; bool accredited; uint64 validUntil; }
    struct InvestorIdentity { bytes32 identityId; uint16 country; bool kycApproved; bool accredited; uint64 validUntil; address attestedBy; bool revoked; }
    mapping(address => InvestorIdentity) private _identities;
    error InvalidIdentity();
    error AlreadyRegistered();
    error NotRegistered();
    error SelfAttestation();
    error AdministratorLocked();
    event IdentityRegistered(address indexed investor, bytes32 indexed identityId, address indexed attestor);
    event IdentityUpdated(address indexed investor, address indexed attestor);
    event IdentityRevoked(address indexed investor, address indexed operator);
    event TrustedAttestorAdded(address indexed attestor);
    event TrustedAttestorRemoved(address indexed attestor);
    constructor(address admin_) {
        if (admin_ == address(0)) revert InvalidIdentity();
        administrator = admin_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    }
    function supportedCountry(uint16 country) public pure returns (bool) {
        return country == 702 || country == 840 || country == 356;
    }
    function identity(address investor) external view returns (InvestorIdentity memory) { return _identities[investor]; }
    /// @return code 0 valid, 1 unregistered, 2 KYC not approved, 3 revoked, 4 expired, 5 untrusted attestor.
    function identityStatus(address investor) public view returns (uint8 code) {
        InvestorIdentity storage i = _identities[investor];
        if (i.identityId == bytes32(0)) return 1;
        if (!i.kycApproved) return 2;
        if (i.revoked) return 3;
        if (block.timestamp >= i.validUntil) return 4;
        if (!hasRole(TRUSTED_ATTESTOR_ROLE, i.attestedBy)) return 5;
        return 0;
    }
    function isVerified(address investor) external view returns (bool) { return identityStatus(investor) == 0; }
    function registerIdentity(address investor, IdentityData calldata data) external onlyRole(TRUSTED_ATTESTOR_ROLE) {
        if (_identities[investor].identityId != bytes32(0)) revert AlreadyRegistered();
        _write(investor, data);
        emit IdentityRegistered(investor, data.identityId, msg.sender);
    }
    function updateIdentity(address investor, IdentityData calldata data) external onlyRole(TRUSTED_ATTESTOR_ROLE) {
        bytes32 oldId = _identities[investor].identityId;
        if (oldId == bytes32(0)) revert NotRegistered();
        if (data.identityId != oldId) revert InvalidIdentity();
        _write(investor, data);
        emit IdentityUpdated(investor, msg.sender);
    }
    function revokeIdentity(address investor) external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) _checkRole(TRUSTED_ATTESTOR_ROLE);
        if (_identities[investor].identityId == bytes32(0)) revert NotRegistered();
        _identities[investor].revoked = true;
        emit IdentityRevoked(investor, msg.sender);
    }
    function _write(address investor, IdentityData calldata data) private {
        if (investor == msg.sender) revert SelfAttestation();
        if (investor == address(0) || data.identityId == bytes32(0) || !supportedCountry(data.country)
            || data.validUntil <= block.timestamp) revert InvalidIdentity();
        _identities[investor] = InvestorIdentity(data.identityId, data.country, data.kycApproved,
            data.accredited, data.validUntil, msg.sender, false);
    }
    function _grantRole(bytes32 role, address account) internal override returns (bool) {
        if (account == address(0)) revert InvalidIdentity();
        bool changed = super._grantRole(role, account);
        if (changed && role == TRUSTED_ATTESTOR_ROLE) emit TrustedAttestorAdded(account);
        return changed;
    }
    function _revokeRole(bytes32 role, address account) internal override returns (bool) {
        if (role == DEFAULT_ADMIN_ROLE && account == administrator) revert AdministratorLocked();
        bool changed = super._revokeRole(role, account);
        if (changed && role == TRUSTED_ATTESTOR_ROLE) emit TrustedAttestorRemoved(account);
        return changed;
    }
}
