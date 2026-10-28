# SC4053 Blockchain Technology — Phase 4: Frontend Development and MetaMask Integration

## Project Context

We are developing an Ethereum-based decentralised application (dApp) titled **Tokenisation of Real-World and Digital Assets on Ethereum** for the NTU SC4053 Blockchain Technology Development Project.

The platform simulates institutional tokenisation of real-world and digital assets, allowing authorised issuers to create ERC-20 assets, distribute tokens, manage investor eligibility, and receive ETH payments from token purchases.

The project follows six sequential development phases:

1. Phase 1 — Foundation and Architecture: COMPLETED
2. Phase 2 — Asset Tokenisation and Compliance: COMPLETED
3. Phase 3 — Asset Registry and Primary Issuance: COMPLETED
4. Phase 4 — Frontend and MetaMask Integration: CURRENT PHASE
5. Phase 5 — End-to-End Integration and Testnet Deployment
6. Phase 6 — Security Audit and Final Submission

## Main Objective

Develop a complete, responsive, modern React frontend that allows users to interact with all functionality already implemented in the blockchain backend.

The application must support three primary user roles:

- **Platform Administrator:** Authorises and revokes permission for asset issuers.
- **Asset Issuer:** Creates assets, manages investor whitelists, funds primary offerings, manages proceeds, and closes offerings.
- **Investor:** Browses assets, purchases tokens, checks holdings, views transaction activity, and transfers tokens to other eligible investors.

The application should resemble a professional institutional financial asset-management dashboard rather than a basic blockchain tutorial.

By the end of Phase 4, a user should be able to complete the entire asset-tokenisation lifecycle through the browser without using the Hardhat console.

**Implement all Phase 4 functionality, execute the relevant tests, and update documentation. Do not stop after producing a plan.**

---

# STEP 1 — Inspect the Existing Repository

Before writing or modifying frontend code, inspect the entire relevant repository.

## 1.1 Review Existing Architecture

Read:

- `README.md`
- `docs/specification.md`, if present
- `docs/architecture.md`, if present
- Phase 2 implementation documentation
- Phase 3 implementation documentation
- Existing frontend source files
- Existing package configurations
- Hardhat network configuration
- Existing deployment scripts
- Contract tests and integration scripts

Inspect these contracts:

- `AssetToken.sol`
- `AssetFactory.sol`
- `AssetSale.sol`

Understand exactly how they interact.

## 1.2 Identify Actual Contract Interfaces

Determine the actual deployed contract functions, events, constructor arrangements, and access-control mechanisms.

Expected capabilities include:

**AssetFactory**
- Issuer authorisation and revocation
- Issuer role checking
- Asset creation
- Asset registry lookup
- Asset count retrieval

**AssetToken**
- ERC-20 balances
- ERC-20 allowances
- Token approval
- Token transfers
- Investor whitelist management
- Investor whitelist checking
- Access-control role checking

**AssetSale**
- Token inventory deposits
- Fixed-price token purchases
- Issuer proceeds withdrawal
- Offering closure
- Recovery of unsold inventory
- Sale status and price retrieval

The function names described in this prompt are conceptual examples.

**Use the real contract ABIs as the source of truth. Do not assume every function has exactly the name or signature listed here.**

If a desired frontend operation is unsupported by the actual contracts, identify the limitation and determine whether the operation can be achieved through an existing public method or event.

Do not silently fabricate frontend functionality or contract APIs.

Avoid Solidity modifications unless a genuine integration-blocking problem is found. Document and test any necessary changes.

## 1.3 Verify Development Environment

Inspect the installed versions of:

- React
- Vite or existing frontend build tooling
- ethers.js
- React Router
- Hardhat
- Node.js
- OpenZeppelin Contracts

Use the existing frontend framework and package manager wherever possible.

Do not unnecessarily replace the established toolchain.

Verify that the frontend builds before making significant changes, and record the initial results.

---

# STEP 2 — Establish Frontend Architecture

## 2.1 Recommended Project Structure

Use the existing repository structure where appropriate. A suitable structure is:

```text
frontend/
├── public/
│
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── AppLayout.jsx
│   │   │
│   │   ├── wallet/
│   │   │   ├── ConnectWallet.jsx
│   │   │   ├── WalletStatus.jsx
│   │   │   └── NetworkWarning.jsx
│   │   │
│   │   ├── assets/
│   │   │   ├── AssetCard.jsx
│   │   │   ├── AssetTable.jsx
│   │   │   ├── AssetDetails.jsx
│   │   │   └── AssetCreationForm.jsx
│   │   │
│   │   ├── transactions/
│   │   │   ├── TransactionStatus.jsx
│   │   │   └── TransactionHistory.jsx
│   │   │
│   │   └── common/
│   │       ├── LoadingSpinner.jsx
│   │       ├── EmptyState.jsx
│   │       ├── ErrorMessage.jsx
│   │       └── ConfirmDialog.jsx
│   │
│   ├── pages/
│   │   ├── Marketplace.jsx
│   │   ├── AssetPage.jsx
│   │   ├── AdminDashboard.jsx
│   │   ├── IssuerDashboard.jsx
│   │   └── InvestorPortfolio.jsx
│   │
│   ├── hooks/
│   │   ├── useWallet.js
│   │   ├── useContracts.js
│   │   └── useAssets.js
│   │
│   ├── context/
│   │   └── WalletContext.jsx
│   │
│   ├── services/
│   │   ├── blockchain.js
│   │   ├── assetFactory.js
│   │   ├── assetToken.js
│   │   ├── assetSale.js
│   │   └── transactionHistory.js
│   │
│   ├── config/
│   │   ├── contracts.js
│   │   └── networks.js
│   │
│   ├── utils/
│   │   ├── formatting.js
│   │   └── validation.js
│   │
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
└── package.json
```

This structure is a guideline rather than a mandate. Preserve useful existing code and avoid unnecessary duplication.

## 2.2 Architecture Requirements

Separate the application into three layers:

**Presentation Layer**

React pages, forms, tables, cards, dialogs, navigation and transaction feedback.

**Blockchain Integration Layer**

Reusable functions responsible for reading and writing smart-contract data.

**Application State Layer**

Wallet connection state, active network, contract instances, selected assets, fetched balances and transaction statuses.

Avoid embedding raw smart-contract calls throughout UI components.

Reusable service functions should handle blockchain communication, while React components handle user interactions and rendering.

## 2.3 Frontend Routes

Implement routes equivalent to:

```text
/                 Marketplace
/assets/:id       Asset Details
/admin            Platform Administrator
/issuer           Issuer Dashboard
/portfolio        Investor Portfolio
```

Allow all users to browse the public marketplace.

Administrative and issuer write actions should only be accessible when the connected wallet has the appropriate on-chain permissions.

The frontend may hide or disable controls based on roles, but the smart contracts must remain the authoritative access-control layer.

---

# STEP 3 — MetaMask Wallet Integration

## 3.1 Connect Wallet

Implement a prominent **Connect Wallet** button.

When clicked:

1. Check whether a compatible EIP-1193 wallet provider is available.
2. Request wallet connection through the provider.
3. Retrieve the connected Ethereum address.
4. Retrieve the active chain ID.
5. Initialise the ethers.js provider.
6. Initialise the signer when needed for transactions.
7. Display the connected wallet address.

Display addresses in shortened form:

`0x1234...ABCD`

Allow users to copy the full address.

If MetaMask is missing, display an informative message with instructions for installing or enabling a compatible wallet.

Do not assume a wallet is available.

## 3.2 Handle Wallet State Changes

Correctly handle:

- Account switching
- Wallet disconnection
- Chain switching
- Wallet connection rejection
- Provider unavailability
- Multiple wallet extensions where supported

Listen for appropriate wallet events, including:

```javascript
accountsChanged
chainChanged
```

Remove event listeners during cleanup.

If the account changes, immediately invalidate all account-dependent data, including:

- Role permissions
- Wallet balances
- Investor whitelist status
- Portfolio holdings
- Issuer-owned assets
- Transaction-related UI state

Do not display stale information from a previously connected account.

## 3.3 Local Blockchain Network

Phase 4 should work with the local Hardhat network.

Use the chain ID configured in the repository, typically:

`31337`

Read the exact chain ID from the existing configuration.

If the wallet is connected to the wrong network:

- Display the current network.
- Display the required network.
- Provide a **Switch Network** button.
- Attempt `wallet_switchEthereumChain`.
- If appropriate, support adding the configured local network using `wallet_addEthereumChain`.
- Handle rejected requests without crashing.

Do not automatically send transactions on an unintended network.

Public Sepolia deployment and final testnet verification belong to Phase 5.

## 3.4 Contract Configuration

Create a central configuration for:

- Target chain ID
- Factory contract address
- Factory contract ABI
- Token contract ABI
- Sale contract ABI
- Deployment block, where available
- Local RPC configuration

Reuse ABIs generated by the Hardhat compilation process.

Do not manually maintain ABI definitions when the compiled artifacts can be used.

Avoid hardcoding addresses throughout UI components.

Provide a reliable development workflow that synchronises the factory address and ABI files from the local deployment artifacts.

If contracts have not yet been deployed, show an appropriate configuration error instead of silently connecting to the wrong address.

Do not store private keys, wallet seed phrases, or other secrets in the frontend.

### Milestone 4.1

The user can:

1. Open the React application.
2. Connect MetaMask.
3. View the wallet address.
4. See the current network.
5. Switch to the configured network.
6. View the connected account's platform roles.

All wallet-related errors must be handled gracefully.

---

# STEP 4 — Asset Marketplace

Create:

`pages/Marketplace.jsx`

## 4.1 Marketplace Purpose

The marketplace is the public entry point for exploring all tokenised assets registered on the blockchain.

Users should be able to browse assets without connecting a wallet.

## 4.2 Retrieve Registered Assets

Read the deployed `AssetFactory` contract.

Retrieve:

1. Total registered asset count.
2. Asset IDs.
3. Asset metadata.
4. Associated ERC-20 token addresses.
5. Associated sale contract addresses.
6. Issuer addresses.
7. Fixed token prices.

Use the factory's actual registry interfaces.

For the MVP, enumerating registered asset IDs is acceptable.

Avoid unnecessary third-party APIs or blockchain indexers.

Handle an empty registry without errors.

## 4.3 Marketplace Asset Cards

Each asset card should display:

- Asset name
- Token symbol
- Asset category
- Short description
- Issuer address
- Total token supply
- Token price in ETH
- Current available sale inventory
- Offering status, if exposed by the contract

Example:

```text
Campus Property Token

Symbol: CPT
Type: Real-World Asset

Issuer: 0x1234...ABCD

Total Supply: 10,000 CPT
Price: 0.001 ETH / CPT
Available: 5,000 CPT

[View Asset]
```

The card should open the relevant asset-details page.

## 4.4 Marketplace Features

Implement:

- Search by asset name or token symbol.
- Filter by real-world versus digital assets.
- Filter by active versus closed offerings, where supported.
- Loading and empty states.
- Responsive asset cards.
- Helpful feedback for failed RPC requests.

Client-side filtering is sufficient for the MVP.

Do not add on-chain search contracts or external databases.

## 4.5 Data Accuracy

The frontend must fetch actual asset information from the connected blockchain.

Do not use permanently hardcoded demo assets as the application's real data source.

Use mock data only inside tests or explicitly identified development fixtures.

Where a metric is unavailable from the smart contracts, do not fabricate it.

For example, do not display real market valuations, investment returns or token prices in USD unless there is an actual supported data source.

### Milestone 4.2

After the backend has registered two assets:

```text
Campus Property Token
Digital Licensing Token
```

Both must automatically appear in the marketplace.

Each card must show the correct metadata and link to its corresponding smart contracts.

---

# STEP 5 — Asset Details and Primary Token Purchase

Create:

`pages/AssetPage.jsx`

This screen is responsible for displaying individual asset information and allowing authorised investors to purchase tokens.

## 5.1 Asset Overview

Display:

- Asset name and symbol
- Asset category
- Full description
- Asset ID
- Issuer wallet
- Token contract address
- Sale contract address
- Total token supply
- Current sale inventory
- Price per token
- Offering status
- Connected wallet's token balance
- Connected wallet's eligibility status

Use an organised layout separating asset details, purchase controls and transaction activity.

## 5.2 Wallet Eligibility

If the user is not connected, show:

**Connect your wallet to purchase this asset.**

After connection, check the token contract's investor whitelist.

If the user is approved, display:

**Eligible investor — You may purchase this asset.**

If the user is not approved:

**Your wallet is not currently authorised to acquire this asset. Contact the asset issuer for approval.**

Disable the purchase action when the wallet is not eligible, but keep the underlying smart-contract checks intact.

## 5.3 Purchase Form

Implement a token purchase form.

Inputs:

- Quantity of tokens to purchase

Automatically display:

- Token price
- Quantity
- Total required ETH
- Available inventory

For example:

```text
Asset: Campus Property Token

Price: 0.001 ETH / CPT

Quantity: 100 CPT

Total Payment: 0.1 ETH

[Purchase Tokens]
```

Use the actual `pricePerToken` value returned by the sale contract.

**Do not use JavaScript floating-point arithmetic for blockchain payment calculations.**

For zero-decimal tokens, parse and validate the token quantity as a positive integer.

Calculate payment in wei using `BigInt` or the exact integer representation required by the installed ethers.js version.

For example, conceptually:

```javascript
const totalWei =
  BigInt(quantity) * pricePerTokenWei;
```

Use the installed ethers.js version's appropriate utilities to format the payment for display.

## 5.4 Purchase Transaction

When the user clicks **Purchase Tokens**:

1. Confirm wallet connection.
2. Confirm correct network.
3. Confirm the sale is active.
4. Confirm investor eligibility.
5. Confirm quantity is valid.
6. Confirm available inventory is sufficient.
7. Calculate the exact required ETH payment.
8. Call the actual `buyTokens` contract function.
9. Include the correct payable ETH value.
10. Request MetaMask confirmation.
11. Show the submitted transaction hash.
12. Wait for transaction confirmation.
13. Refresh the wallet's token balance and sale inventory.

Do not assume success merely because MetaMask returned a transaction hash.

A transaction is only confirmed as successful after the relevant receipt indicates success.

## 5.5 Transaction Status UI

Support the following transaction states:

- Awaiting wallet confirmation
- Submitted to network
- Pending confirmation
- Confirmed successfully
- Failed or reverted
- Rejected by user

Display meaningful errors for:

- Wrong network
- Insufficient ETH
- Unapproved wallet
- Insufficient inventory
- Sale closed
- Invalid purchase quantity
- Incorrect payment
- Wallet rejection
- RPC/network failures

Prevent accidental repeated submission while a transaction is pending.

Never display a successful purchase notification for a failed or reverted transaction.

### Milestone 4.3

An approved investor can:

1. Open the marketplace.
2. Select Campus Property Token.
3. Connect MetaMask.
4. Enter a quantity of 100 CPT.
5. See the required payment of 0.1 ETH.
6. Confirm the transaction in MetaMask.
7. Receive the tokens.
8. See the updated balance and inventory.

All functionality must use the existing Phase 3 contracts.

---

# STEP 6 — Platform Administrator Dashboard

Create:

`pages/AdminDashboard.jsx`

## 6.1 Purpose

The administrator dashboard manages which Ethereum addresses are authorised to create new tokenised assets.

This functionality belongs to `AssetFactory.sol`.

## 6.2 Platform Role Verification

Determine whether the connected wallet has the factory's platform-administrator permission.

For example, if the contract uses OpenZeppelin AccessControl:

- Read the actual `DEFAULT_ADMIN_ROLE`.
- Check `hasRole()` against the connected wallet.

If the user lacks permission:

- Show a clear access-restricted state.
- Do not render enabled administrative transaction controls.

Do not rely on frontend role checking for security.

## 6.3 Authorise an Issuer

Provide a form:

```text
Authorise Asset Issuer

Ethereum Address:
[0x________________________]

[Authorise Issuer]
```

Validate the address using ethers.js before submitting.

Call the actual factory authorisation function.

After confirmation:

- Show success feedback.
- Refresh issuer status.
- Display the transaction hash.

## 6.4 Revoke Issuer Authorisation

Provide a function to revoke a previously approved issuer.

Before submission, show a confirmation dialog explaining:

**Revoking issuer permission prevents this wallet from creating new assets. Existing asset-token and sale contracts are not automatically deleted or frozen.**

The contract remains the source of truth.

## 6.5 Issuer Status Lookup

Allow the administrator to enter an Ethereum address and retrieve whether it currently has issuer permission.

If the contract does not expose a full issuer enumeration function, do not pretend to list every historical issuer.

A status lookup by address is sufficient.

### Milestone 4.4

Using the administrator wallet:

1. Open the admin dashboard.
2. Enter an issuer's Ethereum address.
3. Authorise the issuer.
4. Confirm the corresponding role is now active.
5. Revoke the permission.
6. Verify that the wallet can no longer create new assets.

---

# STEP 7 — Asset Issuer Dashboard

Create:

`pages/IssuerDashboard.jsx`

This is one of the most important parts of the frontend.

It must allow issuers to manage the complete primary issuance lifecycle.

Organise the dashboard into clear sections:

1. My Assets
2. Create Asset
3. Investor Compliance
4. Sale Inventory
5. Sale Proceeds
6. Offering Management

## 7.1 My Assets

Retrieve registered assets belonging to the connected issuer.

Display:

- Asset name and symbol
- Asset ID
- Token address
- Sale address
- Total supply
- Available inventory
- Token price
- Sale status

Use the issuer address stored in the registry to identify assets belonging to the wallet.

Selecting an asset should open its management interface.

## 7.2 Create Asset

Implement an asset-creation form.

Fields:

```text
Create Tokenised Asset

Asset Name:
[Campus Property Token]

Token Symbol:
[CPT]

Asset Description:
[Simulated ownership units in a property fund]

Asset Category:
[Real-World Asset / Digital Asset]

Total Token Supply:
[10000]

Price per Token (ETH):
[0.001]

[Create Asset]
```

Required validation:

- User is connected.
- Correct network is selected.
- User holds the issuer role.
- Asset name is nonempty.
- Symbol is nonempty.
- Description is valid under the existing contract requirements.
- Asset category is supported.
- Supply is a positive integer.
- Token price is positive.
- Token price converts accurately to wei.

When the user submits:

1. Validate the form.
2. Call the actual `AssetFactory.createAsset()` function.
3. Request MetaMask confirmation.
4. Wait for transaction confirmation.
5. Read the emitted asset-creation event or registry.
6. Retrieve the new asset ID and contract addresses.
7. Update the marketplace and issuer asset list.

Display a confirmation screen containing:

```text
Asset Created Successfully

Campus Property Token (CPT)

Asset ID: 0
Total Supply: 10,000 CPT

Token Contract: 0x...
Sale Contract: 0x...
```

Do not manufacture success data before the transaction is confirmed.

## 7.3 Investor Compliance Management

For each issuer-owned asset, provide an investor whitelist management panel.

Functions:

- Check an investor's whitelist status.
- Approve an investor.
- Revoke an investor's eligibility.

Example:

```text
Investor Compliance — CPT

Investor Wallet:
[0x_______________________]

Current Status: Not Approved

[Approve Investor]
```

After the transaction confirms, refresh status.

Show an appropriate warning before revoking an investor:

**Revoking eligibility blocks this address from sending or receiving this asset's tokens, even if it already holds tokens.**

Investor whitelists are asset-specific.

Approving an investor for CPT must not automatically approve that investor for DLT.

Use the token's actual compliance functions and permissions.

## 7.4 Sale Contract Whitelisting

Because the ERC-20 token enforces transfer restrictions, the asset's `AssetSale` contract must be whitelisted before receiving inventory.

Implement a section displaying:

- Sale contract address
- Current whitelist status
- An **Approve Sale Contract** action if required

This action should call the existing token compliance method.

Do not bypass the whitelist.

## 7.5 Token Inventory Funding

Implement a workflow allowing the issuer to allocate tokens for primary sale.

Display:

- Issuer token balance
- Current sale inventory
- Approved spending allowance
- Selected deposit quantity
- Sale contract address

Example:

```text
Fund Primary Offering

Asset: CPT

Issuer Balance: 10,000 CPT
Current Inventory: 0 CPT

Deposit Quantity:
[5000]

[Approve Token Spending]
[Deposit Tokens]
```

The required sequence is:

1. Verify that the sale contract is whitelisted.
2. Enter the desired deposit quantity.
3. Check the current ERC-20 allowance.
4. If allowance is insufficient, request an approval transaction.
5. Wait for approval confirmation.
6. Call the sale contract's `depositTokens()` function.
7. Wait for transaction confirmation.
8. Refresh issuer balance, allowance and sale inventory.

**ERC-20 approval and inventory deposit are separate blockchain transactions.**

Do not describe them as a single atomic transaction.

Handle approval rejection or failure correctly.

Never automatically grant unlimited spending allowance when a precise required quantity will suffice.

## 7.6 Sale Proceeds Dashboard

Display:

- Selected asset
- Token unit price
- Current ETH held by the sale contract
- Available proceeds according to contract-supported accounting
- Total sale inventory remaining

If the contract only exposes its ETH balance, label that value accurately as contract ETH balance rather than implying it is necessarily an audited accounting total.

Provide:

**Withdraw Proceeds**

When clicked:

1. Confirm the issuer's identity.
2. Check that withdrawal is permitted.
3. Display a confirmation dialog.
4. Call the existing withdrawal function.
5. Wait for confirmation.
6. Refresh the displayed ETH balance.

Handle the zero-proceeds case.

## 7.7 Offering Closure

Provide an offering-management section.

For an active offering, display a **Close Offering** button.

Require user confirmation with a warning that closure is permanent under the MVP contract design.

After confirmed closure:

- Display offering status as closed.
- Disable the inventory deposit action.
- Indicate that further purchases are unavailable.
- Enable unsold-token recovery where permitted.

## 7.8 Recover Unsold Tokens

Once an offering is closed, allow the issuer to recover unsold inventory.

Display:

- Remaining token inventory
- Recipient issuer address
- Recovery action

Call the actual sale contract recovery function.

Respect the ERC-20 transfer restrictions. If the issuer or sale contract has been removed from the token whitelist and recovery therefore fails, display a meaningful error.

Do not introduce a compliance bypass to fix this situation.

### Milestone 4.5

Through the browser, an issuer can:

1. Create CPT with a 10,000-token supply.
2. Whitelist the associated sale contract.
3. Approve a token allowance.
4. Deposit 5,000 CPT.
5. Whitelist two investors.
6. Observe investor token purchases.
7. Withdraw ETH proceeds.
8. Close the offering.
9. Recover remaining unsold tokens.

The entire workflow must function without Hardhat console interaction.

---

# STEP 8 — Investor Portfolio and Token Transfers

Create:

`pages/InvestorPortfolio.jsx`

## 8.1 Portfolio Overview

Display the connected wallet's token holdings across registered assets.

For each asset with a positive balance, show:

- Asset name
- Token symbol
- Asset category
- Token balance
- Token contract address
- Eligibility status
- Link to the asset-details page

Example:

```text
My Tokenised Assets

Campus Property Token
Balance: 100 CPT
Status: Approved Investor

Digital Licensing Token
Balance: 50 DLT
Status: Approved Investor
```

The portfolio should work for a wallet holding multiple assets.

For the MVP, enumerate registered assets and call the associated token contract's `balanceOf()` function.

Avoid introducing a backend database solely to store portfolio balances.

## 8.2 Token Transfer Form

Implement a transfer interface.

Fields:

```text
Transfer Tokens

Select Asset:
[Campus Property Token]

Available Balance:
100 CPT

Recipient Address:
[0x________________________]

Quantity:
[20]

[Transfer Tokens]
```

Validate:

- Connected wallet is on the correct network.
- Recipient address is valid.
- Quantity is a positive integer.
- Sender holds sufficient tokens.
- Sender is whitelisted.
- Recipient is whitelisted.
- Selected asset contract is valid.

Call the existing ERC-20 `transfer()` function.

After confirmation, refresh the sender's balance and relevant transaction history.

## 8.3 Rejected Transfers

If a recipient is not whitelisted, show an explanatory warning:

**This recipient is not authorised to hold the selected asset. The issuer must approve the recipient before this transfer can succeed.**

Disable submission when this condition is already known, while preserving the contract's own enforcement.

If a transaction reverts despite frontend checks, report the failure.

## 8.4 Transaction History

Implement a transaction-history component using actual blockchain events.

Retrieve relevant events such as:

- ERC-20 `Transfer`
- Asset creation events
- Token purchase events
- Whitelist updates, where appropriate for administrative views
- Sale closure events

For an investor portfolio, prioritise transfers involving the connected wallet and primary-market purchases.

Display:

- Transaction type
- Asset
- Quantity
- Sender
- Recipient
- Transaction hash
- Block number
- Timestamp when available

Event history must be generated from actual contract logs.

Use the contract's deployment block as the starting point if available.

Avoid querying from the Ethereum genesis block unnecessarily.

Handle providers with restricted event-query ranges using bounded queries if needed.

Be aware that purchasing tokens may produce both a token `Transfer` event and a sale `TokensPurchased` event. Avoid presenting them as two separate purchases.

Provide an informative empty state when no events are found.

Do not describe contract events as a complete record of real-world legal ownership.

### Milestone 4.6

Using two approved investor wallets:

1. Investor A purchases 100 CPT.
2. Portfolio displays 100 CPT.
3. Investor A transfers 20 CPT to Investor B.
4. Investor A's portfolio updates to 80 CPT.
5. Investor B's portfolio shows 20 CPT.
6. Relevant transfer activity appears in transaction history.

A transfer to an unapproved wallet must fail.

---

# STEP 9 — UI/UX Design Requirements

The finished application should look polished enough for an academic project demonstration and professional portfolio.

## 9.1 Visual Direction

Use a clean institutional-finance dashboard aesthetic.

Suggested styling:

- Modern typography
- Consistent spacing and alignment
- Neutral backgrounds
- Subtle blue or teal accents
- Clean cards and data tables
- Professional form controls
- Responsive layouts
- Clear transaction-status indicators

Avoid excessive animations, distracting gradients, cryptocurrency-themed gimmicks, or unnecessarily complicated UI components.

Prioritise readability and usability.

## 9.2 Navigation

The main navigation should include:

```text
AssetToken Platform

Marketplace | Issuer | Portfolio | Admin

Connected Wallet: 0x1234...ABCD
Network: Local Ethereum
```

Show the appropriate role-specific functionality based on connected-wallet permissions.

Keep the marketplace accessible to visitors without a connected wallet.

## 9.3 Responsive Design

Support:

- Desktop screens
- Tablets
- Mobile screens

Forms, transaction tables and asset cards should remain usable on smaller devices.

## 9.4 Loading and Error States

Every asynchronous interaction needs explicit feedback.

Examples:

- Loading asset registry
- Loading token balance
- Checking investor eligibility
- Waiting for MetaMask
- Awaiting transaction confirmation
- RPC connection unavailable
- No assets available
- No tokens held
- Unsupported network

Do not leave blank screens, indefinite loading indicators or unhandled errors.

## 9.5 Demo Disclaimer

Because the project simulates asset ownership and primary issuance, include a concise disclaimer:

**Academic demonstration only. Assets and token prices are simulated. Tokens do not represent legally enforceable ownership or investment claims.**

Do not portray the application as a regulated securities platform or claim real-world asset custody.

---

# STEP 10 — Blockchain Integration and Data Consistency

## 10.1 Centralise Blockchain Calls

Implement reusable service functions corresponding to the actual contracts.

Expected operations include:

```javascript
connectWallet()
getWalletNetwork()
getWalletRoles()

getAssetCount()
getAsset(assetId)
getAllAssets()

createAsset(...)

authorizeIssuer(address)
revokeIssuer(address)

getWhitelistStatus(assetId, address)
setWhitelistStatus(assetId, address, approved)

getTokenBalance(assetId, address)
getTokenAllowance(assetId, owner, spender)

approveSaleAllowance(assetId, quantity)
depositTokens(assetId, quantity)

getSaleInventory(assetId)
buyTokens(assetId, quantity)

withdrawProceeds(assetId)
closeSale(assetId)
withdrawUnsoldTokens(assetId)

transferAssetTokens(assetId, recipient, quantity)
getAssetTransactionHistory(assetId)
```

These are suggested JavaScript service operations, not presumed Solidity method names.

Adapt them to the compiled ABIs.

## 10.2 Use Exact Blockchain Units

Token quantities have zero decimals in the Phase 2 MVP.

ETH amounts are represented in wei on-chain.

Use BigInt-compatible calculations, not floating-point multiplication, for payment amounts.

Use ethers.js utilities such as `parseEther`, `formatEther`, and the appropriate integer conversion helpers.

Ensure display formatting does not alter transaction values.

## 10.3 Avoid Stale Data

After a successful transaction, refresh all affected information.

Examples:

**Asset creation**
- Refresh registry.
- Refresh issuer assets.
- Refresh marketplace.

**Purchase**
- Refresh investor token balance.
- Refresh sale inventory.
- Refresh transaction history.
- Refresh ETH proceeds display.

**Token transfer**
- Refresh relevant balances.
- Refresh transaction history.

**Whitelisting**
- Refresh investor eligibility.
- Refresh relevant action availability.

**Wallet account/network change**
- Invalidate account-dependent and chain-dependent state.

Do not rely exclusively on optimistic updates.

## 10.4 Security Practices

- Never request private keys or seed phrases.
- Never store wallet secrets in browser storage.
- Use wallet-based transaction signing.
- Never assume frontend role checking replaces smart-contract permissions.
- Validate all user inputs.
- Do not silently switch networks or accounts.
- Do not submit financial transactions automatically on component mount.
- Make contract addresses and payment amounts visible before sensitive operations.
- Prevent accidental duplicate submissions.
- Avoid embedding testnet private keys in the application.

---

# STEP 11 — Frontend Testing

Create automated frontend tests using the project's established testing setup.

If none exists, introduce a minimal appropriate React testing setup rather than a large new framework.

Use mocked provider and contract interactions for frontend unit tests.

Do not require live public RPC access for these tests.

## Test Group A — Wallet Integration

Test:

1. Wallet connection succeeds.
2. Connected address is displayed.
3. Missing wallet provider is handled.
4. Wallet rejection is handled.
5. Wrong-network warning appears.
6. Account switching updates displayed state.
7. Account switching clears stale balances and permissions.
8. Network switching updates contract configuration.

## Test Group B — Marketplace

Test:

1. Empty asset registry.
2. Multiple registered assets.
3. Correct metadata rendering.
4. Real-world asset filtering.
5. Digital asset filtering.
6. Asset search.
7. Asset-details navigation.
8. RPC failure handling.

## Test Group C — Asset Creation

Test:

1. Authorised issuer sees enabled creation controls.
2. Unauthorised wallet cannot submit an asset-creation transaction through the UI.
3. Invalid supply is rejected.
4. Invalid token price is rejected.
5. Valid creation calls the correct contract method.
6. Pending transaction state is shown.
7. Successful creation refreshes asset data.
8. Failed creation does not display success.

## Test Group D — Purchases

Test:

1. Correct price calculation in wei.
2. Positive integer quantity validation.
3. Non-whitelisted investor cannot submit a purchase.
4. Insufficient inventory is handled.
5. Closed offering disables purchasing.
6. Correct payable ETH value is passed.
7. MetaMask rejection is handled.
8. Successful purchase refreshes portfolio and inventory.
9. Reverted purchase displays failure.

## Test Group E — Issuer Operations

Test:

1. Compliance status lookup.
2. Investor whitelisting.
3. Investor revocation.
4. Sale-contract whitelist verification.
5. Insufficient allowance handling.
6. Token approval workflow.
7. Inventory deposit workflow.
8. Proceeds withdrawal.
9. Sale closure.
10. Unsold-token recovery.

## Test Group F — Portfolio

Test:

1. Empty portfolio.
2. Multiple asset holdings.
3. Correct token balances.
4. Transfer to an approved recipient.
5. Transfer to a non-approved recipient is blocked.
6. Insufficient balance validation.
7. Wallet switching updates portfolio state.
8. Transaction history rendering.

Tests must verify meaningful behaviour rather than merely checking that components render.

---

# STEP 12 — Local End-to-End Demonstration

Before declaring Phase 4 complete, verify that the application works with the actual local smart contracts.

Use the local Hardhat blockchain and MetaMask.

Create or reuse a local deployment script that makes the frontend-ready contract addresses available.

The system should support the following demonstration.

## Demonstration Accounts

```text
Wallet A: Platform Administrator
Wallet B: Authorised Issuer
Wallet C: Investor 1
Wallet D: Investor 2
Wallet E: Unapproved Investor
```

Use local Hardhat test accounts only for development.

Do not commit development-account private keys into source control.

## Demonstration Scenario

### Scenario 1 — Platform Administration

1. Open the React application.
2. Connect Wallet A.
3. Navigate to the Admin Dashboard.
4. Authorise Wallet B as an issuer.
5. Confirm the status updates.

### Scenario 2 — Asset Creation

6. Switch to Wallet B.
7. Navigate to the Issuer Dashboard.
8. Create Campus Property Token.
9. Set supply to 10,000 CPT.
10. Set price to 0.001 ETH per token.
11. Confirm the transaction.
12. Verify the asset appears in the marketplace.

### Scenario 3 — Primary Offering Setup

13. Whitelist the newly created sale contract.
14. Approve spending of 5,000 CPT.
15. Deposit 5,000 CPT into sale inventory.
16. Verify the marketplace displays 5,000 available tokens.

### Scenario 4 — Investor Approval

17. Whitelist Wallet C.
18. Whitelist Wallet D.
19. Leave Wallet E unapproved.

### Scenario 5 — Token Purchase

20. Switch to Wallet C.
21. Open Campus Property Token.
22. Purchase 100 CPT for 0.1 ETH.
23. Confirm the MetaMask transaction.
24. Verify Wallet C owns 100 CPT.
25. Verify sale inventory becomes 4,900 CPT.

### Scenario 6 — Investor Transfer

26. Switch to Wallet C's portfolio.
27. Transfer 20 CPT to Wallet D.
28. Confirm the transaction.
29. Verify Wallet C owns 80 CPT.
30. Switch to Wallet D.
31. Verify Wallet D owns 20 CPT.

### Scenario 7 — Unauthorised Purchase

32. Switch to Wallet E.
33. Attempt to purchase CPT.
34. Confirm the purchase action is blocked or the contract rejects it.
35. Verify inventory and balances remain unchanged.

### Scenario 8 — Issuer Withdrawals

36. Switch to Wallet B.
37. Open the Issuer Dashboard.
38. Withdraw the 0.1 ETH accumulated from the purchase.
39. Verify that withdrawal completes successfully.

### Scenario 9 — Offering Closure

40. Close the CPT offering.
41. Verify purchase controls are disabled.
42. Recover the remaining 4,900 CPT of unsold inventory.
43. Verify the sale contract no longer holds those tokens.

### Scenario 10 — Multiple Assets

44. Create a second asset named Digital Licensing Token.
45. Assign a supply of 5,000 DLT.
46. Set a price of 0.002 ETH per token.
47. Verify it appears separately in the marketplace.
48. Verify the portfolio supports holding multiple assets.
49. Verify asset-specific whitelists are independent.

**Note:** These scenarios should be executed in the browser wherever the environment permits. If Codex cannot operate MetaMask or complete a genuine browser-driven workflow, it must not claim that the interactive demonstration passed. In that case, run all feasible automated integration tests and document the remaining manual verification steps accurately.

---

# STEP 13 — Development and Deployment Workflow

Provide clear instructions for running the complete application locally.

The final developer workflow should be reproducible:

```text
Terminal 1:
Start local Hardhat blockchain

Terminal 2:
Deploy smart contracts locally
Generate/update frontend contract configuration

Terminal 3:
Start React development server

Browser:
Open application
Connect MetaMask
Switch to local network
Interact with deployed contracts
```

Use the actual commands and package manager from the repository.

If the Hardhat network is reset, explain that contracts may need to be redeployed and frontend contract configuration regenerated.

Avoid any requirement to manually copy ABI fragments throughout the application.

Document how to use development wallets safely.

---

# STEP 14 — Documentation and AI Audit Evidence

Create or update:

`docs/phase4-implementation.md`

Include:

## 14.1 Frontend Architecture

Document:

- React component structure.
- Application routing.
- Wallet state management.
- Blockchain service architecture.
- Contract ABI and address configuration.
- Read versus write contract interactions.

## 14.2 User Workflows

Document:

- Wallet connection.
- Issuer authorisation.
- Asset creation.
- Investor whitelisting.
- Sale inventory funding.
- Token purchases.
- Portfolio balance retrieval.
- Token transfers.
- Proceeds withdrawals.
- Offering closure.

## 14.3 Transaction Handling

Explain how the application handles:

- Wallet confirmation.
- Transaction submission.
- Transaction receipts.
- Failed transactions.
- Network errors.
- Account switching.
- Data refresh.

## 14.4 Testing Evidence

Record:

- Frontend build commands and results.
- Automated frontend tests.
- Contract regression-test results.
- Local integration-test results.
- Screenshots or evidence from genuine interactive testing, where available.
- Known limitations.

## 14.5 AI Audit Report Updates

The SC4053 assignment requires an audit of AI-generated code.

Preserve relevant AI-assisted development evidence, including:

- Initial frontend specifications.
- Significant Codex-generated implementation decisions.
- Prompt chains or meaningful prompt revisions.
- Actual bugs discovered.
- Security or correctness concerns.
- Manual code improvements.
- Regression tests and evidence of fixes.

Pay particular attention to AI-generated mistakes involving:

- Incorrect ethers.js API usage.
- Outdated wallet-provider methods.
- Incorrect BigInt handling.
- Wrong ETH payment calculations.
- Incorrect contract ABIs.
- Missing transaction-receipt checks.
- Broken wallet/account state handling.
- Stale balances after transactions.
- Missing error handling.
- Inaccurate access-control assumptions.

Investigate these issues rather than claiming they exist without evidence.

For genuine issues discovered, document the original implementation, root cause, impact, correction and validation.

---

# STEP 15 — Phase 4 Scope Boundaries

Phase 4 is a frontend and wallet integration phase.

Do not implement:

- New token standards.
- Secondary-market order matching.
- Auctions.
- Automated market makers.
- Price oracles.
- NFT markets.
- Yield or dividend distribution.
- Investor identity verification services.
- Fiat payment gateways.
- Centralised user-account authentication.
- A backend database solely to replicate blockchain state.
- Mainnet deployment.
- Public Sepolia deployment unless it is already part of the working environment.
- Unnecessary Solidity redesign.

Do not replace the tested smart contracts merely to simplify frontend development.

Do not introduce a complex backend or unrelated infrastructure.

Keep the implementation maintainable and consistent with the existing architecture.

---

# STEP 16 — Final Acceptance Criteria

Phase 4 is complete only if the following functionality is implemented and validated.

## Wallet Integration

- [ ] MetaMask connects successfully.
- [ ] Connected address is displayed.
- [ ] Network mismatch is handled.
- [ ] Account switching is handled.
- [ ] Wallet rejection is handled.
- [ ] Contract instances use the correct network and addresses.

## Marketplace

- [ ] Registered assets are loaded from the factory.
- [ ] Asset metadata is correctly displayed.
- [ ] Search and filtering work.
- [ ] Asset-details pages work.
- [ ] Sale inventory is accurately displayed.
- [ ] Empty and error states work.

## Administrator Dashboard

- [ ] Platform administrator role is checked.
- [ ] Issuers can be authorised.
- [ ] Issuer permissions can be revoked.
- [ ] Issuer status lookup works.
- [ ] Unauthorised wallets cannot use administrator actions.

## Issuer Dashboard

- [ ] Issuers can view their registered assets.
- [ ] Asset creation works.
- [ ] New asset addresses are displayed.
- [ ] Investors can be whitelisted.
- [ ] Investor approval can be revoked.
- [ ] Sale contracts can be whitelisted.
- [ ] ERC-20 spending allowance can be approved.
- [ ] Tokens can be deposited into sale inventory.
- [ ] ETH proceeds can be withdrawn.
- [ ] Offerings can be closed.
- [ ] Unsold tokens can be recovered.

## Investor Experience

- [ ] Investors can inspect asset details.
- [ ] Investor eligibility is checked.
- [ ] Token purchase quantities are validated.
- [ ] ETH payment calculations are exact.
- [ ] Token purchases work through MetaMask.
- [ ] Investor portfolio shows actual balances.
- [ ] Token transfers work.
- [ ] Unauthorized transfers are blocked by smart contracts.
- [ ] Transaction history displays actual on-chain events.

## Quality and Testing

- [ ] Frontend builds successfully.
- [ ] Relevant frontend tests pass.
- [ ] Existing smart-contract regression tests pass.
- [ ] Responsive layouts work.
- [ ] Transaction confirmation and failure feedback work.
- [ ] No private keys or secrets are exposed.
- [ ] No knowingly fabricated blockchain data appears in the UI.
- [ ] Local development instructions are complete.
- [ ] Phase 4 implementation documentation is complete.
- [ ] AI Audit Report evidence is updated.

---

# STEP 17 — Expected Final Codex Response

After implementation and validation, return a structured report containing:

### 1. Files Created or Modified

List every file changed and its purpose.

### 2. Frontend Architecture

Explain routing, wallet state, contract integration and component structure.

### 3. Features Implemented

Summarise the marketplace, administrator dashboard, issuer dashboard, purchase interface, investor portfolio and transaction history.

### 4. Smart Contract Integration

List which actual contract functions and events are used for each feature.

Describe any changes required to integrate with existing ABIs.

### 5. Testing Results

Provide the actual commands executed and their results.

Distinguish between:

- Automated tests passed.
- Local integration tests passed.
- Browser interactions manually verified.
- Browser interactions not verified.

### 6. Issues Found and Resolved

Report genuine frontend bugs, integration errors and security concerns.

### 7. Phase 4 Completion Status

Explicitly confirm which acceptance criteria are complete and identify any unfinished functionality.

### 8. Phase 5 Readiness

Explain what is needed to deploy the integrated dApp to Sepolia and perform final end-to-end verification.

Do not perform Phase 5 deployment during this task.

---

# Final Development Instructions

1. Inspect the repository and existing ABIs before modifying frontend files.
2. Preserve the completed smart contracts from Phases 2 and 3.
3. Build the frontend incrementally in the order described.
4. Finish wallet integration before implementing contract-dependent screens.
5. Use actual on-chain values instead of mock application data.
6. Keep all blockchain interactions in reusable service modules.
7. Handle transaction failures and wallet/network changes properly.
8. Perform exact integer calculations for token quantities and ETH payments.
9. Build the application and execute automated tests.
10. Verify actual local blockchain integration wherever possible.
11. Fix implementation errors before declaring completion.
12. Maintain comprehensive technical and AI-audit documentation.
13. Do not make Git commits unless explicitly requested.
14. Do not implement unrelated functionality or proceed to Phase 5.

**Begin by inspecting the existing Phase 3 contracts, generated ABIs, deployment scripts, and frontend structure. Then implement Phase 4 completely, progressing through wallet integration, marketplace, asset details, administrator dashboard, issuer dashboard, investor portfolio, automated testing, and local integration validation.**