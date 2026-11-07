// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./RegulatedAssetToken.sol";
import "./AssetSale.sol";
/// @notice Constructor-created factory helper; no lasting admin roles. Specification D.
contract RegulatedAssetDeployer {
    address public immutable factory;
    error OnlyFactory();
    constructor() { factory = msg.sender; }
    struct Request { string name; string symbol; uint256 supply; uint256 price; address issuer; address identityAdmin; uint256 maximum; bool accredited; }
    struct Deployment { address token; address sale; address registry; address policy; }
    function deploy(Request calldata r) external returns (Deployment memory d) {
        if (msg.sender != factory) revert OnlyFactory();
        d.registry = address(new IdentityRegistryLite(r.identityAdmin));
        d.policy = address(new ComplianceLite(r.issuer, d.registry, r.maximum, r.accredited));
        RegulatedAssetToken regulated = new RegulatedAssetToken(r.name, r.symbol, r.supply, r.issuer, d.registry, d.policy, factory);
        d.token = address(regulated);
        ComplianceLite(d.policy).bindToken(d.token);
        d.sale = address(new AssetSale(d.token, r.price, r.issuer));
        regulated.registerSale(d.sale);
    }
}
