// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AssetFactory.sol";
import "./SubscriptionOffering.sol";

/// @notice §16: additive registry, linked to existing asset IDs. Payment currency is pinned.
contract SubscriptionFactory {
    AssetFactory public immutable assetFactory;
    address public immutable paymentToken;
    address[] private _offerings;
    mapping(address => uint256) public assetIdOf;
    mapping(address => bool) public isOffering;
    error InvalidConfiguration();
    error NotAssetIssuer();
    event OfferingCreated(uint256 indexed offeringId, uint256 indexed assetId, address indexed issuer, address offering);

    constructor(address factory_, address payment_) {
        if (factory_.code.length == 0 || payment_.code.length == 0
            || IERC20Metadata(payment_).decimals() != 6) revert InvalidConfiguration();
        assetFactory = AssetFactory(factory_);
        paymentToken = payment_;
    }

    function createOffering(uint256 assetId, uint256 supply, uint256 price, uint256 softCap,
        uint256 start, uint256 end) external returns (address offering) {
        AssetFactory.Asset memory asset = assetFactory.getAsset(assetId);
        if (!assetFactory.authorisedIssuers(msg.sender) || asset.issuerAddress != msg.sender) revert NotAssetIssuer();
        offering = address(new SubscriptionOffering(SubscriptionOffering.Config({
            assetToken: asset.tokenContract, paymentToken: paymentToken, issuer: msg.sender,
            supply: supply, price: price, softCap: softCap, start: start, end: end
        })));
        assetIdOf[offering] = assetId;
        isOffering[offering] = true;
        _offerings.push(offering);
        emit OfferingCreated(_offerings.length - 1, assetId, msg.sender, offering);
    }

    function offeringCount() external view returns (uint256) { return _offerings.length; }
    function offeringAt(uint256 index) external view returns (address) { return _offerings[index]; }
}
