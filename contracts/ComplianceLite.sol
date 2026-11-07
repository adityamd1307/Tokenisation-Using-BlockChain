// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IdentityRegistryLite.sol";
interface IOperationalToken is IERC20 { function operationalClass(address account) external view returns (uint8); }
/// @notice Constant-time asset policy, separate from credential verification. Specification B.
contract ComplianceLite {
    IdentityRegistryLite public immutable identityRegistry;
    address public immutable administrator;
    address private immutable _binder;
    address public token;
    mapping(uint16 => bool) public countryAllowed;
    uint256 public maxWalletHolding;
    bool public accreditationRequired;
    error NotAdministrator();
    error InvalidBinding();
    error UnsupportedCountry();
    event TokenBound(address indexed token);
    event CountryAllowed(uint16 indexed country, bool allowed);
    event MaxWalletHoldingUpdated(uint256 maximum);
    event AccreditationRequiredUpdated(bool required);
    modifier onlyAdmin() { if (msg.sender != administrator) revert NotAdministrator(); _; }
    constructor(address admin_, address registry_, uint256 maximum, bool accredited) {
        if (admin_ == address(0) || registry_.code.length == 0) revert InvalidBinding();
        administrator = admin_; identityRegistry = IdentityRegistryLite(registry_); _binder = msg.sender;
        maxWalletHolding = maximum; accreditationRequired = accredited;
    }
    function bindToken(address token_) external {
        if (msg.sender != _binder || token != address(0) || token_.code.length == 0) revert InvalidBinding();
        token = token_; emit TokenBound(token_);
    }
    function setCountryAllowed(uint16 country, bool allowed) external onlyAdmin {
        if (!identityRegistry.supportedCountry(country)) revert UnsupportedCountry();
        countryAllowed[country] = allowed; emit CountryAllowed(country, allowed);
    }
    function setMaxWalletHolding(uint256 maximum) external onlyAdmin {
        maxWalletHolding = maximum; emit MaxWalletHoldingUpdated(maximum);
    }
    function setAccreditationRequired(bool required) external onlyAdmin {
        accreditationRequired = required; emit AccreditationRequiredUpdated(required);
    }
    /// @dev Does not assert identity validity; the token checks that separately.
    function recipientStatus(address recipient) public view returns (uint8) {
        if (token == address(0)) revert InvalidBinding();
        if (IOperationalToken(token).operationalClass(recipient) != 0) return 0;
        IdentityRegistryLite.InvestorIdentity memory i = identityRegistry.identity(recipient);
        if (!countryAllowed[i.country]) return 3;
        if (accreditationRequired && !i.accredited) return 4;
        return 0;
    }
    function transferStatus(address from, address to, uint256 amount) public view returns (uint8) {
        uint8 status = recipientStatus(to);
        if (status != 0) return status;
        if (IOperationalToken(token).operationalClass(to) != 0 || from == to || amount == 0) return 0;
        uint256 balance = IERC20(token).balanceOf(to);
        // Subtraction avoids overflow even for adversarial preflight amounts.
        if (balance > maxWalletHolding || amount > maxWalletHolding - balance) return 5;
        return 0;
    }
    function canTransfer(address from, address to, uint256 amount) external view returns (bool) {
        return transferStatus(from, to, amount) == 0;
    }
}
