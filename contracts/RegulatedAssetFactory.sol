// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./AssetFactory.sol";
import "./RegulatedAssetDeployer.sol";
interface ILinkedSubscriptionFactory { function assetFactory() external view returns (address); }
/// @notice New-deployment superset of the existing asset registry. Specification D.
contract RegulatedAssetFactory is AssetFactory {
    RegulatedAssetDeployer public immutable regulatedDeployer;
    address public subscriptionFactory;
    struct Modules { address identityRegistry; address compliance; }
    mapping(uint256 => Modules) public modules;
    error InvalidSubscriptionFactory();
    event SubscriptionFactoryConfigured(address indexed factory);
    event RegulatedAssetCreated(uint256 indexed assetId, address indexed identityRegistry, address indexed compliance);
    constructor(address admin_) AssetFactory(admin_) { regulatedDeployer = new RegulatedAssetDeployer(); }
    function setSubscriptionFactory(address factory_) external onlyAdmin {
        if (subscriptionFactory != address(0) || factory_.code.length == 0
            || ILinkedSubscriptionFactory(factory_).assetFactory() != address(this)) revert InvalidSubscriptionFactory();
        subscriptionFactory = factory_; emit SubscriptionFactoryConfigured(factory_);
    }
    struct RegulatedRequest {
        string name; string symbol; string description; AssetType assetType;
        uint256 supply; uint256 price; uint256 maximum; bool accredited;
    }
    function createRegulatedAsset(RegulatedRequest calldata r) external returns (uint256 assetId) {
        if (!authorisedIssuers[msg.sender]) revert IssuerNotAuthorised(msg.sender);
        if (r.supply == 0) revert InvalidSupply();
        if (r.price == 0) revert InvalidPrice();
        RegulatedAssetDeployer.Deployment memory d = regulatedDeployer.deploy(
            RegulatedAssetDeployer.Request(r.name, r.symbol, r.supply, r.price, msg.sender, admin, r.maximum, r.accredited));
        assetId = _registerAsset(r.name, r.symbol, r.description, r.assetType, r.supply, r.price, d.token, d.sale, msg.sender);
        modules[assetId] = Modules(d.registry, d.policy);
        emit RegulatedAssetCreated(assetId, d.registry, d.policy);
    }
}
