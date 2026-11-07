// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./ComplianceLite.sol";
interface IRegulatedRegistry { function subscriptionFactory() external view returns (address); }
interface IOfferingRegistry { function isOffering(address offering) external view returns (bool); }
interface ICustody { function assetToken() external view returns (address); function issuer() external view returns (address); }
/// @notice Fixed-supply ERC20, intentionally NOT full ERC-3643. Specification C.
contract RegulatedAssetToken is ERC20 {
    address public immutable issuer;
    IdentityRegistryLite public immutable identityRegistry;
    ComplianceLite public immutable compliance;
    address public immutable assetFactory;
    address private immutable _deployer;
    address public sale;
    // 0 investor, 1 issuer, 2 sale, 3 subscription. Permanent, exact custody contracts only.
    mapping(address => uint8) public operationalClass;
    error InvalidConfiguration();
    error InvalidCustody();
    error TransferRestricted(uint8 reason);
    event OperationalAccountRegistered(address indexed account, uint8 category);
    constructor(string memory name_, string memory symbol_, uint256 supply, address issuer_,
        address registry_, address compliance_, address factory_) ERC20(name_, symbol_) {
        if (issuer_ == address(0) || supply == 0 || registry_.code.length == 0 || compliance_.code.length == 0
            || factory_.code.length == 0) revert InvalidConfiguration();
        issuer = issuer_; identityRegistry = IdentityRegistryLite(registry_); compliance = ComplianceLite(compliance_);
        if (address(compliance.identityRegistry()) != registry_) revert InvalidConfiguration();
        assetFactory = factory_; _deployer = msg.sender;
        operationalClass[issuer_] = 1; emit OperationalAccountRegistered(issuer_, 1);
        // The ONLY mint. No public mint/burn/recovery bypass exists.
        super._update(address(0), issuer_, supply);
    }
    function decimals() public pure override returns (uint8) { return 0; }
    function paused() external pure returns (bool) { return false; }
    function registerSale(address sale_) external {
        if (msg.sender != _deployer || sale != address(0) || sale_.code.length == 0
            || ICustody(sale_).assetToken() != address(this) || ICustody(sale_).issuer() != issuer) revert InvalidCustody();
        sale = sale_; operationalClass[sale_] = 2; emit OperationalAccountRegistered(sale_, 2);
    }
    function registerSubscriptionEscrow(address offering) external {
        address registry = IRegulatedRegistry(assetFactory).subscriptionFactory();
        if (msg.sender != issuer || registry == address(0) || !IOfferingRegistry(registry).isOffering(offering)
            || ICustody(offering).assetToken() != address(this) || ICustody(offering).issuer() != issuer) revert InvalidCustody();
        if (operationalClass[offering] != 0) revert InvalidCustody();
        operationalClass[offering] = 3; emit OperationalAccountRegistered(offering, 3);
    }
    function isWhitelisted(address account) public view returns (bool) {
        if (account == address(0)) return false;
        return operationalClass[account] != 0 || (identityRegistry.isVerified(account) && compliance.recipientStatus(account) == 0);
    }
    function transferStatus(address from, address to, uint256 amount) public view returns (uint8) {
        if (from == address(0) || to == address(0)) return 8;
        if (amount > balanceOf(from)) return 7;
        if (operationalClass[from] == 0 && !identityRegistry.isVerified(from)) return 1;
        if (operationalClass[to] == 0 && !identityRegistry.isVerified(to)) return 2;
        return compliance.transferStatus(from, to, amount);
    }
    function canTransfer(address from, address to, uint256 amount) external view returns (bool) { return transferStatus(from, to, amount) == 0; }
    function _update(address from, address to, uint256 amount) internal override {
        uint8 reason = transferStatus(from, to, amount);
        if (reason != 0) revert TransferRestricted(reason);
        super._update(from, to, amount);
    }
}
