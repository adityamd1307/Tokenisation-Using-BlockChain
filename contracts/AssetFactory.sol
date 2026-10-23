// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AssetToken.sol";
import "./AssetSale.sol";

/// @notice Platform registry: authorises issuers and deploys AssetToken + AssetSale pairs.
/// @dev Governed by docs/spec/phase3-requirements.md §3.1 and decisions D1–D2,
/// superseding spec-v1 §4–5 names (`authoriseIssuer`, `deauthoriseIssuer`, `assets`).
contract AssetFactory {
    enum AssetType {
        RealWorld,
        Digital
    }

    struct Asset {
        uint256 assetId;
        string name;
        string symbol;
        string description;
        AssetType assetType;
        uint256 totalSupply;
        address tokenContract;
        address saleContract;
        address issuerAddress;
        uint256 unitPriceWei;
    }

    address public immutable admin;
    mapping(address => bool) public authorisedIssuers;
    mapping(address => address) public tokenToSale;
    Asset[] private _assets;

    error InvalidAdmin();
    error NotAdmin();
    error InvalidIssuer();
    error AdminCannotBeIssuer();
    error IssuerAlreadyAuthorised(address issuer);
    error IssuerNotAuthorised(address issuer);
    error InvalidSupply();
    error InvalidPrice();
    error AssetNotFound(uint256 assetId);

    event IssuerAuthorised(address indexed issuer);
    event IssuerRevoked(address indexed issuer);
    event AssetCreated(uint256 indexed assetId, address indexed token, address sale, address indexed issuer);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    /// @dev spec-v1 §4: platform admin is set in the constructor.
    constructor(address admin_) {
        if (admin_ == address(0)) revert InvalidAdmin();
        admin = admin_;
    }

    /// @dev Phase 3 §3.1; spec-v1 §5 reverts if already authorised. Decision D8
    /// (AUD-008): spec-v1 §3 bars the admin from holding tokens. Policy check only;
    /// it cannot stop the admin using a second wallet.
    function authorizeIssuer(address issuer) external onlyAdmin {
        if (issuer == address(0)) revert InvalidIssuer();
        if (issuer == admin) revert AdminCannotBeIssuer();
        if (authorisedIssuers[issuer]) revert IssuerAlreadyAuthorised(issuer);
        authorisedIssuers[issuer] = true;
        emit IssuerAuthorised(issuer);
    }

    /// @dev Phase 3 §3.1; spec-v1 §5 note: only blocks future createAsset calls.
    /// Contracts this issuer already deployed keep operating.
    function revokeIssuer(address issuer) external onlyAdmin {
        if (!authorisedIssuers[issuer]) revert IssuerNotAuthorised(issuer);
        authorisedIssuers[issuer] = false;
        emit IssuerRevoked(issuer);
    }

    /// @notice Deploys a token (supply minted to the caller) and its sale, then registers both.
    /// @dev Phase 3 §3.1, decision D2. The caller still has to whitelist and fund the
    /// sale (§3.3); the factory holds no role on the token it deploys.
    function createAsset(
        string calldata name,
        string calldata symbol,
        string calldata description,
        AssetType assetType,
        uint256 totalSupply,
        uint256 unitPriceWei
    ) external returns (uint256 assetId) {
        if (!authorisedIssuers[msg.sender]) revert IssuerNotAuthorised(msg.sender);
        if (totalSupply == 0) revert InvalidSupply();
        if (unitPriceWei == 0) revert InvalidPrice();

        AssetToken token = new AssetToken(name, symbol, totalSupply, msg.sender);
        AssetSale sale = new AssetSale(address(token), unitPriceWei, msg.sender);

        assetId = _assets.length;
        _assets.push(Asset({
            assetId: assetId,
            name: name,
            symbol: symbol,
            description: description,
            assetType: assetType,
            totalSupply: totalSupply,
            tokenContract: address(token),
            saleContract: address(sale),
            issuerAddress: msg.sender,
            unitPriceWei: unitPriceWei
        }));
        tokenToSale[address(token)] = address(sale);

        emit AssetCreated(assetId, address(token), address(sale), msg.sender);
    }

    /// @dev Phase 3 §3.1: asset IDs are sequential from 0.
    function getAsset(uint256 assetId) external view returns (Asset memory) {
        if (assetId >= _assets.length) revert AssetNotFound(assetId);
        return _assets[assetId];
    }

    /// @dev Phase 3 §3.1.
    function getAssetCount() external view returns (uint256) {
        return _assets.length;
    }
}
