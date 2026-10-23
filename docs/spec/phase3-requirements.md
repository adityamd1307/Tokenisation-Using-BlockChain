# SC4053 Blockchain Technology — Phase 3: Asset Registry and Primary Issuance

The text below is the user's Phase 3 request, given to Claude Code on 23 October 2026. Table formatting was lost when it was pasted and has been restored as Markdown; the wording is unchanged. The decisions in the final section were made by the user in the same session, in answer to questions raised by Claude Code about conflicts with `spec-v1.md`.

---

Deliverable: Functional on-chain asset issuance and purchase

Objective: Let authorised issuers create multiple tokenised assets and sell them to eligible investors.

This is where your project develops beyond a simple ERC-20 token demonstration.

## Task 3.1 — Implement AssetFactory.sol

The factory will act as the entry point for new asset issuance.

It should provide these functions:

| Function | Purpose |
|---|---|
| `authorizeIssuer(address)` | Platform admin grants issuer permission |
| `revokeIssuer(address)` | Platform admin removes issuer creation permission |
| `createAsset(...)` | Authorised issuer creates an asset |
| `getAsset(assetId)` | Returns asset metadata and contract addresses |
| `getAssetCount()` | Returns number of registered assets |

A successful `createAsset()` should deploy an AssetToken and associated AssetSale, then record the asset in the registry.

Suggested metadata:

```text
assetId
name
symbol
description
assetType
totalSupply
tokenContract
saleContract
issuerAddress
unitPriceWei
```

The asset ID should be generated automatically rather than supplied by the issuer.

## Task 3.2 — Implement AssetSale.sol

This contract will facilitate primary-market purchases.

Essential variables:

```solidity
IERC20 public assetToken;
address public issuer;
uint256 public pricePerToken;
```

Main function:

```solidity
buyTokens(uint256 quantity) external payable
```

Purchase validation must confirm:

- The buyer is an approved investor.
- Quantity is greater than zero.
- Enough tokens remain in the sale contract.
- `msg.value` equals `quantity * pricePerToken`.

If every condition passes, the contract transfers tokens to the investor and records the purchase event.

Use exact payment for the MVP; partial payments, complex refunds and variable pricing are unnecessary.

## Task 3.3 — Implement the inventory funding process

The issuer must allocate tokens to the sale contract before buyers can purchase them.

The lifecycle will be:

| Step | Result |
|---|---|
| Issuer creates an asset | 10,000 CPT minted to issuer |
| Issuer whitelists the sale contract | Contract is permitted to hold and transfer CPT |
| Issuer deposits 5,000 CPT for sale | Sale contract now has purchasable inventory |
| Investor buys 100 CPT | Investor pays 0.1 testnet ETH and receives 100 CPT |

To simplify the MVP, the price is fixed at asset creation. Later changes to the sale price are not supported.

## Task 3.4 — Implement issuer withdrawals

Create an issuer-only withdrawal function for sale proceeds.

The function must prevent unauthorised withdrawals and account for reentrancy risks when sending ETH. Include a protected way to recover any unsold token inventory if the sale is closed.

## Task 3.5 — Test factory and sale contracts

Test the following scenarios:

| Test case | Expected result |
|---|---|
| Unauthorised wallet creates an asset | Revert |
| Authorised issuer creates asset | Token and sale contracts deployed |
| Issuer creates two different assets | Both registered independently |
| Whitelisted investor buys 100 tokens | Correct ETH payment and token transfer |
| Investor underpays | Revert |
| Investor overpays | Revert |
| Investor buys more than inventory | Revert |
| Unapproved investor attempts purchase | Revert |
| Non-issuer withdraws proceeds | Revert |

Phase 3 completion criteria: From a Hardhat script or console, you should be able to register an issuer, create an asset, whitelist an investor, fund the sale contract, execute a purchase and inspect the updated balances.

You now have a working blockchain backend.

---

## Additional constraints from the session brief

- Implement AssetFactory and AssetSale only. Do not add pause, freeze or forced transfer to AssetToken in this phase; that needs a separate team decision.
- `withdrawProceeds` must follow checks-effects-interactions (spec-v1 §4 reentrancy requirement, invariant 8).
- `revokeIssuer` only blocks future `createAsset` calls. Contracts the issuer has already deployed keep operating (spec-v1 §5 note on `deauthoriseIssuer`).

## Decisions made by the user (23 October 2026)

Claude Code raised these conflicts between this request and `spec-v1.md` before writing code. The user chose:

| # | Question | Decision |
|---|---|---|
| D1 | spec-v1 and this request name functions and variables differently. Which governs? | **This request governs**, as Phase 2's requirements did. Use `authorizeIssuer`, `revokeIssuer`, `getAsset`, `getAssetCount`, `buyTokens`, `pricePerToken` and `assetToken`. spec-v1 names (`authoriseIssuer`, `deauthoriseIssuer`, `buy`, `priceWei`, `token`) are superseded. The test stub titles are updated to match. |
| D2 | What does `createAsset` take as metadata? | `createAsset(name, symbol, description, assetType, totalSupply, unitPriceWei)`. `assetType` is an enum: `AssetType { RealWorld, Digital }`. `assetId` is assigned automatically. |
| D3 | How is unsold inventory recovered? | An issuer-only, irreversible `closeSale()`. After closing, `buyTokens` and `allocate` revert, and an issuer-only `recoverUnsoldTokens()` returns the sale contract's entire token balance to the issuer. |
| D4 | The repo was mid-rebase of `fix/spec-corrections-phase1`. | Abort the rebase and merge the branch into `main` normally, so no published history is rewritten. |
| D5 | Pause, freeze and forced transfer (spec-v1 §4–6, invariants 5–6) have been deferred twice, with no final decision (audit-1 F-06). | **Still open.** The user decided to keep these deferred, but with an owner and a deadline. Owners: Chordia Laksh and adityamd-1307, jointly. Due before Phase 4 starts. No code is written for these features until D5 is decided. The research session rated them "Must" (research R296–297), so if they are dropped, the report must justify it. |
