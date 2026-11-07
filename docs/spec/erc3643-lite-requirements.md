# SC4053 Blockchain Technology — Feature Enhancement C: ERC-3643-Inspired Institutional Compliance Framework

## PROJECT CONTEXT

We have developed an Ethereum-based decentralised application titled:

**Tokenisation of Real-World and Digital Assets on Ethereum**

This is our Bring Your Own Project (BYOP) for NTU's SC4053 Blockchain Technology Development Project.

Our application currently supports:

- ERC-20 asset tokenisation.
- Platform administrator and issuer authorisation.
- AssetFactory and asset registry.
- AssetToken with fixed supply.
- Investor whitelisting.
- Direct primary asset sales.
- Subscription-based primary offerings.
- Mock stablecoin commitments.
- Soft caps, hard caps and oversubscription.
- Pro-rata allocation and token claims.
- Pull-based investor refunds.
- Issuer proceeds withdrawals.
- React dashboards and MetaMask integration.
- Automated smart-contract testing and security auditing.

Verify which functionality is actually implemented in the repository before proceeding.

We now want to implement a significant institutional-compliance enhancement inspired by **ERC-3643 (T-REX — Token for Regulated EXchanges)**.

# MAIN OBJECTIVE

Replace or extend the current basic investor-whitelisting mechanism with a modular, identity-aware on-chain compliance architecture.

The core idea is that token ownership and transfers should be subject to two distinct categories of checks:

**Identity Verification**

Is the receiving investor registered and holding valid simulated eligibility credentials?

**Asset Compliance**

Does the requested transfer satisfy the asset's specific compliance rules?

The asset token must query both components before executing a restricted transfer.

If either check fails, the transaction must revert.

We are NOT attempting to implement the complete ERC-3643 standard.

Instead, implement a clearly documented **ERC-3643-inspired Lite Compliance Framework**, retaining ERC-20 compatibility while demonstrating the most important architectural ideas.

The implementation must be secure, modular, testable, integrated with the existing issuance systems, and suitable for a live academic demonstration.

Do not merely produce a design document. Implement the feature, run tests, integrate the frontend and update the AI Audit Report.

---

# STEP 1 — INSPECT THE EXISTING PROJECT

Before coding:

1. Read README.md.
2. Read the existing specifications and architecture documentation.
3. Inspect AssetToken.sol.
4. Inspect AssetFactory.sol.
5. Inspect AssetSale.sol.
6. Inspect SubscriptionOffering.sol if implemented.
7. Inspect MockUSD.sol if implemented.
8. Examine the existing whitelist and role-permission mechanisms.
9. Review all current contract ABIs.
10. Inspect frontend wallet and contract-service components.
11. Review existing automated tests.
12. Inspect the AI Audit Report and security findings.

Run the existing test suites and builds.

Record the initial results.

Do not assume every proposed contract or feature already exists.

## Reference Architecture

Research and inspect the official ERC-3643 specification:

https://eips.ethereum.org/EIPS/eip-3643

Also inspect the available official T-REX reference implementation and its contract interfaces.

Understand the distinction between:

- ERC-20 token functionality.
- Identity Registry.
- Identity Registry Storage.
- Trusted Issuers Registry.
- Claim Topics Registry.
- Compliance contract.
- Agent roles.
- Token-level transfer controls.

Our implementation should intentionally simplify this structure.

**Important:** The original ERC-3643 specification has additional requirements, including ONCHAINID-based identity claims, pausing, freezing, recovery, mint/burn controls and agent operations.

Do not describe our Lite version as fully ERC-3643-compliant unless every mandatory requirement has actually been implemented and verified.

---

# STEP 2 — DEFINE THE TARGET ARCHITECTURE

Implement three principal components:

1. `IdentityRegistryLite.sol`
2. `ComplianceLite.sol`
3. A regulated version of the existing ERC-20 AssetToken.

Recommended architecture:

```text
                 React Frontend
                       |
                       v
                 AssetFactory
                       |
          +------------+------------+
          |            |            |
          v            v            v
   RegulatedToken  IdentityRegistry  Compliance
          |            ^            ^
          |            |            |
          +------------+------------+
                       |
                Transfer checks
```

The token must consult the Identity Registry and Compliance contract for ordinary transfers.

## Design Principle

Keep identity verification separate from asset-specific compliance rules.

**IdentityRegistryLite**

Answers:

"Is this wallet associated with a currently valid simulated investor credential?"

**ComplianceLite**

Answers:

"Is this particular token transfer permitted under the asset's policy?"

**Regulated AssetToken**

Enforces both decisions before moving tokens.

## Contract Naming

Inspect the existing token implementation first.

If safely upgrading the implementation for future deployments without breaking the project's established interfaces is practical, retain AssetToken.sol.

Otherwise, introduce:

`RegulatedAssetToken.sol`

and preserve the legacy token implementation.

Do not attempt to modify an already deployed non-upgradeable ERC-20 contract in place.

Explain how existing assets remain supported and how new regulated assets will be created.

Prefer new regulated deployments rather than a risky redesign of existing immutable deployments.

---

# STEP 3 — IMPLEMENT IDENTITY REGISTRY LITE

Create:

`contracts/IdentityRegistryLite.sol`

## 3.1 Purpose

The Identity Registry should maintain a simulated on-chain record of whether an investor has the necessary identity attributes to hold a regulated asset token.

This must go beyond a simple boolean whitelist.

The registry should track:

- Investor wallet.
- Opaque identity identifier.
- Investor country.
- Simulated KYC approval.
- Simulated accredited-investor status.
- Credential expiration.
- Credential issuer/attestor.
- Revocation status.

Do not store real names, passport numbers, government IDs, physical addresses or other personal identity documents on-chain.

All identity information is synthetic and for academic demonstration only.

## 3.2 Identity Structure

Implement a structure conceptually equivalent to:

```solidity
struct InvestorIdentity {
    bytes32 identityId;
    uint16 country;
    bool kycApproved;
    bool accredited;
    uint64 validUntil;
    address attestedBy;
    bool revoked;
}
```

Use a mapping from wallet address to its identity record.

The identity ID should be an opaque synthetic identifier, not a hash of a real passport number or other low-entropy personal information.

For this Lite MVP, one registered identity per wallet is sufficient.

Document that the system does not prove that different wallets belong to different real-world individuals.

## 3.3 Identity Registration

Implement a controlled identity-registration function, conceptually:

`registerIdentity(address investor, IdentityData data)`

Only an authorised identity attestor or compliance administrator may register investor credentials.

An investor must not be able to approve their own KYC status.

Validate:

- Nonzero wallet address.
- Nonzero identity ID.
- Valid country code.
- Valid future credential expiration.
- Proper identity-attestor permissions.
- No unintended overwriting of existing records.

Use ISO 3166-1 numeric country codes.

Example:

```text
Singapore: 702
United States: 840
India: 356
```

These are synthetic country attributes supplied by the mock identity administrator.

Do not infer country from an Ethereum address.

## 3.4 Trusted Identity Attestors

Implement a simplified trusted-issuer mechanism.

Use OpenZeppelin AccessControl or the existing project role system.

Suggested roles:

- DEFAULT_ADMIN_ROLE
- IDENTITY_AGENT_ROLE
- TRUSTED_ATTESTOR_ROLE

Separate the permission to approve trusted attestors from the permission to issue identity credentials.

Only authorised trusted attestors may create or renew simulated investor attestations.

Store the attestor associated with each identity record.

Verification must account for whether the attestor is still trusted.

Revoking a trusted attestor should invalidate credentials depending on that attestor, unless a documented migration or re-attestation mechanism is used.

For the Lite version, authorised on-chain attestations are sufficient.

Do not pretend this is equivalent to the full ERC-3643 ONCHAINID signed-claim verification system.

Do not add cryptographic signatures merely for appearances.

If you implement signed attestations, ensure proper domain separation, nonce handling, expiry and replay protection.

## 3.5 Identity Verification

Implement:

```solidity
function isVerified(
    address investor
) external view returns (bool);
```

Return true only when:

1. The wallet has a registered identity.
2. The identity has simulated KYC approval.
3. The credential is not revoked.
4. The credential has not expired.
5. The credential was issued by a currently trusted attestor.

Accredited-investor status and country restrictions should be evaluated separately by the Compliance contract because different assets may impose different requirements.

A registered identity must not automatically imply eligibility for every asset.

## 3.6 Identity Revocation and Expiration

Implement functions for:

- Registering credentials.
- Updating or renewing credentials.
- Revoking credentials.
- Querying eligibility.
- Reading non-sensitive metadata.

Test:

- Expired credentials.
- Revoked identities.
- Untrusted attestors.
- Invalid registrations.
- Re-registration.
- Credential renewal.

Expired credentials must automatically fail verification based on block.timestamp.

No scheduled backend job should be required.

## 3.7 Events

Emit appropriate events such as:

- IdentityRegistered.
- IdentityUpdated.
- IdentityRevoked.
- TrustedAttestorAdded.
- TrustedAttestorRemoved.

Ensure sensitive personal information is not emitted.

### Milestone A

The Identity Registry can independently answer whether a simulated investor's identity credentials are valid.

---

# STEP 4 — IMPLEMENT COMPLIANCE ENGINE LITE

Create:

`contracts/ComplianceLite.sol`

## 4.1 Purpose

The Compliance contract determines whether an otherwise identity-verified token transfer satisfies asset-specific rules.

It must not simply duplicate `isVerified()`.

Implement three mandatory policies:

1. Jurisdiction restrictions.
2. Maximum wallet holdings.
3. Accredited-investor requirements.

The three policies should be independently configurable per asset.

## 4.2 Jurisdiction Restrictions

Each asset must specify which countries are permitted.

For example:

```text
Campus Property Token

Allowed Countries:
Singapore (702)
United States (840)

Restricted for this demo:
India (356)
```

This is an arbitrary simulated asset policy, not a statement about real securities law in these countries.

Implement:

`setCountryAllowed(uint16 country, bool allowed)`

Only an authorised asset compliance administrator may modify the rule.

The compliance engine should retrieve investor country information from the Identity Registry.

A transfer to an investor in a disallowed jurisdiction must revert.

Changing country eligibility must affect subsequent transfers without retroactively changing existing balances.

## 4.3 Maximum Wallet Holdings

Implement:

`setMaxWalletHolding(uint256 maximum)`

For example:

```text
Asset total supply: 10,000 CPT
Maximum investor wallet holdings: 500 CPT
```

Example:

```text
Investor currently owns: 450 CPT

Attempted incoming transfer: 40 CPT
Result: ALLOWED

Attempted incoming transfer: 100 CPT
Result: REJECTED
```

The rule should check the actual resulting token balance.

Conceptually:

`balanceOf(recipient) + amount <= maximum`

Use exact integer arithmetic.

Handle:

- Incoming transfers.
- transferFrom.
- Purchases.
- Subscription token claims.
- Self-transfers.
- Zero-value transfers.
- Issuer allocations.
- Contract custody accounts.

The limit is explicitly a **per-wallet holding limit**, not a guaranteed per-person ownership limit.

Do not claim that it prevents individuals from splitting holdings across multiple wallets.

## 4.4 Accredited-Investor Requirement

Implement an optional asset-level rule:

`setAccreditationRequired(bool required)`

When enabled, the recipient must have a valid identity record with:

`accredited = true`

Example:

```text
Asset: Institutional Property Fund

Accreditation required: YES

Investor A: Verified and accredited
Result: ELIGIBLE

Investor B: Verified but not accredited
Result: NOT ELIGIBLE
```

The accreditation credential is simulated.

It does not constitute real legal investor qualification.

## 4.5 Compliance Interface

Implement a function equivalent to:

```solidity
function canTransfer(
    address from,
    address to,
    uint256 amount
) external view returns (bool);
```

This function should evaluate all configured asset rules.

The compliance contract must be bound to its specific authorised token contract.

Do not allow an arbitrary external caller to manipulate compliance state or impersonate the token.

If the compliance engine needs token balances, retrieve them through the bound token's read-only ERC-20 interface.

Avoid unbounded loops over investor lists.

## 4.6 Policy Independence

Two assets must support different policies.

Example:

```text
Campus Property Token:
Allowed country: Singapore
Accreditation: Required
Max wallet holdings: 500 CPT

Digital Licensing Token:
Allowed countries: Singapore, India
Accreditation: Not required
Max wallet holdings: 2,000 DLT
```

Eligibility for one asset must not automatically imply eligibility for the other.

Use separate compliance contracts per asset, unless an equally secure and clearly isolated shared-state design already exists.

### Milestone B

The Compliance contract can independently determine whether a proposed transfer satisfies jurisdiction, accreditation and holding-limit rules.

---

# STEP 5 — HANDLE ISSUERS AND SMART-CONTRACT CUSTODY

This is a critical integration requirement.

Our platform uses operational accounts such as:

- Asset issuers.
- AssetSale contracts.
- SubscriptionOffering contracts.

These accounts may need to hold thousands of tokens temporarily.

They must not be treated identically to ordinary individual investors.

For example:

```text
Max investor wallet holdings: 500 CPT

Issuer initially receives: 10,000 CPT

Subscription offering escrow: 1,000 CPT
```

A naive holding-limit implementation would break asset creation and sale funding.

## 5.1 Introduce Controlled System Accounts

Implement a narrowly scoped operational-account classification.

Examples:

- ISSUER
- SALE_ESCROW
- SUBSCRIPTION_ESCROW

Only authorised administrators or appropriately designed factories may register an account as an operational actor.

Investors must never be able to classify themselves as exempt system accounts.

## 5.2 Operational Account Policy

Document exactly which checks apply to each class.

Suggested design:

**Ordinary Investor**

Must satisfy identity verification, allowed-country restrictions, accreditation rules and maximum holding limits.

**Issuer**

May hold the initial token supply and recover unsold inventory.

**Approved Sale Contract**

May temporarily hold asset-token inventory and distribute tokens to eligible investors.

**Approved Subscription Contract**

May escrow asset tokens pending allocation, claiming and safe recovery.

Operational accounts may be exempt from investor-specific holding caps and simulated KYC requirements, but must remain explicitly authorised.

Avoid blanket exemptions from every security check.

Do not let a generic operational-account permission become a mechanism for unrestricted token transfers or unauthorised custody.

## 5.3 Revoke and Remove Operational Accounts Carefully

Removing an escrow contract's operational authorisation while it still holds investor-entitled tokens could permanently block legitimate claims.

Implement safe configuration rules or document and test the operational consequences.

Never silently confiscate investor entitlements.

Where system-account revocation would lock outstanding claims, design a controlled remediation or safe administrative process.

### Milestone C

Issuers and approved escrow contracts can perform required operations without weakening normal investor compliance.

---

# STEP 6 — INTEGRATE CHECKS INTO THE ERC-20 TOKEN

This is the central security requirement.

The token contract must enforce the rules on-chain.

For every ordinary transfer:

1. Check the sender's applicable identity/operational status.
2. Check the recipient's applicable identity/operational status.
3. Query the Identity Registry.
4. Query the Compliance contract.
5. Revert if an applicable check fails.
6. Execute the ERC-20 transfer only after validation.

The reference ERC-3643 specification primarily requires verified recipient identity and handles certain sender restrictions separately.

For our Lite implementation, checking both ordinary investor endpoints is an intentional stricter policy. Document this difference from the reference standard.

## 6.1 ERC-20 Compatibility

Preserve:

- name()
- symbol()
- decimals()
- totalSupply()
- balanceOf()
- transfer()
- approve()
- allowance()
- transferFrom()

Continue to use OpenZeppelin ERC-20.

Do not implement custom ERC-20 balance bookkeeping.

## 6.2 Correct Enforcement Point

Inspect the installed OpenZeppelin version.

For OpenZeppelin Contracts v5, use an appropriate `_update()` override.

Apply transfer rules to both direct and delegated transfers.

Avoid deprecated Solidity or OpenZeppelin hooks.

## 6.3 Conceptual Transfer Logic

The implementation should achieve this behaviour:

```text
Request transfer
      |
      v
Check amount/balance
      |
      v
Check sender eligibility
      |
      v
Check recipient eligibility
      |
      v
IdentityRegistry.isVerified()
      |
      v
Compliance.canTransfer()
      |
  +---+---+
  |       |
 PASS     FAIL
  |       |
  v       v
Transfer Revert
tokens
```

Handle issuer and authorised operational accounts using the explicitly documented role rules.

Initial minting must not fail because the token supply is created before normal investors exist.

Burning, if present, must be handled separately from normal transfers.

Do not introduce unrestricted minting or bypass roles.

## 6.4 Preflight Transfer Check

Add a read-only helper such as:

```solidity
function canTransfer(
    address from,
    address to,
    uint256 amount
) external view returns (bool);
```

Or, preferably, provide a helper returning a reason code.

Example statuses:

```text
0 — Transfer allowed
1 — Sender identity invalid
2 — Recipient identity invalid
3 — Jurisdiction restricted
4 — Accreditation required
5 — Holding limit exceeded
6 — Token paused or account frozen
7 — Insufficient balance
```

Adapt the final list to the actual implemented features.

The frontend should use this helper before submitting a transaction.

The preflight result must match the contract's actual transfer enforcement as closely as possible.

A successful preflight check is not a guarantee of future success because compliance state may change between the read and the transaction.

Always recheck eligibility on-chain during the actual transfer.

## 6.5 Preserve State Integrity

If a transfer fails:

- Sender balance remains unchanged.
- Recipient balance remains unchanged.
- Total token supply remains unchanged.
- No partial transfer occurs.
- No token-movement event from the reverted transaction persists.

### Milestone D

The AssetToken automatically rejects non-compliant transfers, regardless of whether the transaction originates from the frontend, a script or another smart contract.

---

# STEP 7 — UPDATE ASSETFACTORY AND DEPLOYMENT

Modify the existing factory carefully.

For newly created regulated assets, deploy and configure:

1. IdentityRegistryLite.
2. ComplianceLite.
3. RegulatedAssetToken.
4. The selected sale or subscription offering contracts.

Use safe deployment sequencing.

Avoid circular-dependency bugs.

## 7.1 Registry and Compliance Binding

Each new asset must reference its intended registry and compliance contract.

If a component needs its token address after deployment, use a tightly permissioned one-time binding mechanism.

Prevent arbitrary rebinding by attackers.

Do not leave components uninitialised or publicly initialisable.

## 7.2 Correct Permissions

The designated issuer must receive appropriate compliance-administration permissions.

The factory must not accidentally retain unintended issuer authority merely because it deployed a contract.

The trusted identity-attestor role must remain distinct from platform issuer authorisation.

## 7.3 Deployment Mode

If compatibility requires it, support:

- Legacy ERC-20 asset.
- Regulated asset using the Lite compliance architecture.

For the final demonstration, prefer the regulated token path.

Do not silently change the behaviour of previously deployed legacy tokens.

## 7.4 Registry Metadata

Expose the necessary addresses:

```text
Asset ID
Token Address
Identity Registry Address
Compliance Address
Issuer Address
Sale / Offering Address
```

Update contract ABI export and frontend configuration workflows.

### Milestone E

A new regulated asset can be created through the existing issuance architecture, with its identity and compliance modules correctly connected.

---

# STEP 8 — INTEGRATE WITH PRIMARY SALES AND SUBSCRIPTION OFFERINGS

Do not break the existing financial mechanisms.

The compliance system must work with:

- Direct fixed-price asset purchases.
- Stablecoin subscription commitments.
- Pro-rata allocation.
- Investor token claims.
- Pull-based refunds.
- Unsold inventory recovery.

## 8.1 Direct Purchases

Before an approved investor purchases an asset:

- Investor must have valid identity credentials.
- Investor must satisfy asset-specific compliance rules.
- The sale contract must be authorised to hold inventory.
- Final token delivery must satisfy all token transfer checks.

A purchase that violates a compliance rule must revert atomically.

Do not retain ETH if token delivery fails.

## 8.2 Subscription Commitments

Differentiate between:

**Committing Stablecoins**

The investor deposits mock stablecoins into the subscription contract.

**Receiving Asset Tokens**

The investor claims their allocated regulated asset tokens.

At commitment time, check investor eligibility according to the documented offering policy.

At claim time, re-evaluate the actual asset-token compliance conditions.

## 8.3 Credential Expiration During the Offering

Consider:

```text
Investor A has valid KYC.

Investor A commits 1,800 mUSD.

Subscription closes.

Investor A's KYC credential expires.

Investor A attempts to claim 450 CPT.
```

The asset token must reject delivery while the investor is ineligible.

However:

- The original commitment must remain recorded.
- The final allocation must remain correctly accounted for.
- Refund entitlements must remain accessible.
- The investor must not lose funds because of unrelated token compliance restrictions.
- The system must not silently forfeit the allocated tokens.

Document a clear policy for delayed claims and credential renewal.

For the MVP, holding the allocated tokens safely in escrow until eligibility is restored is acceptable.

Do not implement arbitrary claim expiry.

## 8.4 Refund Independence

Mock stablecoin refunds must not be blocked merely because the investor's asset-token KYC status has expired or been revoked.

Keep refund accounting independent from regulated asset-token transfers.

Do not introduce an identity-registry requirement into MockUSD itself.

## 8.5 Holding Limit and Allocation

Suppose:

```text
Investor holding limit: 500 CPT
Current investor balance: 200 CPT
New subscription allocation: 450 CPT
```

The investor would exceed the holding limit upon claiming the full allocation.

Determine and document the correct behaviour.

For the Lite MVP, it is acceptable to block the claim until sufficient room is available or the policy is lawfully updated.

Do not silently discard the investor's entitlement.

Do not automatically reduce final pro-rata allocation after finalisation without a formally designed allocation policy.

Preserve subscription accounting, refund entitlements and investor claim rights.

## 8.6 Escrow Solvency

Ensure that the regulated-token compliance changes do not allow issuers to recover tokens reserved for outstanding subscriptions.

All existing offering accounting invariants must continue to hold.

### Milestone F

Direct purchases, subscription claims and investor refunds continue to function correctly under the new compliance architecture.

---

# STEP 9 — BUILD THE COMPLIANCE FRONTEND

Integrate the feature into the existing React application.

Do not build an unrelated second frontend.

Match the existing visual design.

## 9.1 Compliance Administration Dashboard

Add a dedicated Compliance section.

It should support:

- Trusted attestor management.
- Investor identity registration.
- Credential renewal.
- Credential revocation.
- Simulated KYC approval.
- Simulated accreditation status.
- Country assignment.
- Identity status lookup.
- Asset compliance settings.

Use role-based controls.

Never expose private identity information.

## 9.2 Investor Identity Dashboard

For the connected investor, display:

```text
Investor Identity Status

Wallet: 0x1234...ABCD

Identity: Registered
KYC: Verified (Simulated)
Accreditation: Approved (Simulated)
Country: Singapore
Credential Expiry: [Actual timestamp]

Overall Identity Status: Valid
```

Display only fields that actually exist on-chain.

Provide informative warnings for expired or revoked credentials.

## 9.3 Asset Compliance Dashboard

For each regulated asset, display:

```text
Campus Property Token

Compliance Standard:
ERC-3643-Inspired Lite

KYC Required: Yes
Accredited Investor Required: Yes

Allowed Jurisdictions:
Singapore

Maximum Wallet Holdings:
500 CPT

Identity Registry:
0x...

Compliance Contract:
0x...
```

Allow authorised administrators to update supported policies.

Display the transaction status and wait for confirmation.

## 9.4 Transfer Eligibility Checker

Add an interactive compliance pre-check.

Form:

```text
Transfer Eligibility Check

Asset: Campus Property Token

Sender:
[0x...]

Recipient:
[0x...]

Amount:
[100 CPT]

[Check Eligibility]
```

Return a result such as:

**Transfer Allowed**

or

**Transfer Rejected — Recipient exceeds maximum wallet holdings.**

Use the actual contract preflight function.

Do not duplicate the policy entirely in frontend JavaScript.

## 9.5 Compliance Failure Explanations

Provide specific error messages.

Examples:

- Investor identity not registered.
- KYC credential expired.
- Credential issuer no longer trusted.
- Accredited-investor status required.
- Recipient jurisdiction not allowed.
- Maximum holding limit exceeded.
- Sender is not currently eligible.
- Offering contract not authorised for custody.

Avoid generic messages such as "Transaction failed" when a meaningful reason is available.

## 9.6 UI Visualisation

Add a clear compliance flow diagram or status panel:

```text
Identity Registered       PASS
KYC Credential Valid      PASS
Trusted Attestor          PASS
Country Allowed           PASS
Accreditation Required    PASS
Wallet Holding Limit      FAIL

TRANSFER NOT PERMITTED
```

Use actual contract-derived results.

### Milestone G

Administrators can manage simulated identity credentials and asset policies, while investors can inspect their eligibility and understand rejected transfers through the browser.

---

# STEP 10 — AUTOMATED TESTING

Write comprehensive tests using the existing Hardhat test framework.

Suggested files:

```text
test/compliance/
├── IdentityRegistryLite.test.js
├── TrustedAttestors.test.js
├── ComplianceLite.test.js
├── RegulatedAssetToken.test.js
├── ComplianceFactoryIntegration.test.js
├── ComplianceSubscriptionIntegration.test.js
└── ComplianceSecurity.test.js
```

Adapt filenames to the repository.

## Test Group A — Identity Management

Test:

1. Authorised identity registration.
2. Unauthorised registration rejected.
3. Identity verification succeeds.
4. Unregistered identity rejected.
5. Expired credential rejected.
6. Revoked credential rejected.
7. Credential renewal.
8. Attestor revocation.
9. Untrusted attestor rejected.
10. Zero-address registration rejected.
11. Self-approval attempts rejected.
12. No raw sensitive personal information stored.

## Test Group B — Jurisdiction Compliance

Test:

1. Transfer to allowed country.
2. Transfer to disallowed country.
3. Change allowed-country policy.
4. Transfer after policy update.
5. Invalid or unsupported country data.
6. Country rules remain asset-specific.

## Test Group C — Accreditation

Test:

1. Accredited investor receives tokens.
2. Non-accredited investor rejected when accreditation is required.
3. Non-accredited investor allowed when accreditation is optional.
4. Accreditation status updated.
5. Expired credentials invalidate eligibility even if accreditation was previously approved.

## Test Group D — Holding Limits

Test:

1. Balance below maximum.
2. Balance exactly at maximum.
3. Transfer exceeding maximum.
4. transferFrom exceeding maximum.
5. Purchase exceeding maximum.
6. Subscription claim exceeding maximum.
7. Self-transfer.
8. Zero-quantity transfer.
9. Issuer initial supply.
10. Escrow inventory deposits.
11. Maximum holding configuration changes.
12. Independent limits for two assets.

## Test Group E — Token Integration

Test:

1. Valid transfer succeeds.
2. Invalid identity blocks transfer.
3. Compliance failure blocks transfer.
4. transferFrom cannot bypass compliance.
5. Initial mint works.
6. Total supply remains fixed.
7. Failed transfer preserves balances.
8. Unauthorised changes to compliance references are rejected.
9. Correct role assignment during factory deployment.
10. Operational-account privileges cannot be self-granted.

## Test Group F — Subscription Integration

Test:

1. Verified investor subscribes.
2. Invalid investor cannot subscribe under the configured policy.
3. Compliant investor claims tokens.
4. Expired investor cannot claim regulated tokens.
5. Expired investor can still withdraw available mUSD refunds.
6. Credential renewal allows a previously blocked claim.
7. Pro-rata allocations remain unchanged by compliance updates.
8. Restricted investor's tokens remain safely escrowed.
9. Issuer cannot withdraw reserved claim inventory.
10. Existing oversubscription maths remains correct.

## Test Group G — Adversarial Security

Investigate:

- Unauthorised identity updates.
- Malicious trusted-attestor registration.
- Role escalation.
- Fake identity credentials.
- Compliance bypass through transferFrom.
- Operational-account exemption abuse.
- Contract-binding manipulation.
- Incorrect asset-specific policies.
- Expired and revoked credentials.
- Reentrancy where external calls are involved.
- Denial-of-service through identity or compliance contracts.
- Stale frontend identity state.
- Failure to update investor eligibility after account switching.

Test realistic exploit conditions.

Do not invent vulnerabilities for the report.

---

# STEP 11 — END-TO-END DEMONSTRATION

Create:

`scripts/demoCompliance.js`

Use local Hardhat accounts.

## Participants

```text
Wallet A — Platform Administrator
Wallet B — Asset Issuer
Wallet C — Identity Attestor
Wallet D — Verified Accredited Investor
Wallet E — Verified Non-Accredited Investor
Wallet F — Investor with Invalid/Expired KYC
Wallet G — Investor in Restricted Jurisdiction
```

## Asset Configuration

```text
Asset: Campus Property Token

Symbol: CPT
Total Supply: 10,000 CPT

Identity Verification: Required
Accreditation: Required

Allowed Country:
Singapore (702)

Maximum Investor Wallet Holdings:
500 CPT
```

## Demonstration Sequence

**Part 1 — Setup**

1. Deploy regulated-token contracts.
2. Deploy IdentityRegistryLite.
3. Deploy ComplianceLite.
4. Bind the contracts correctly.
5. Configure the issuer and trusted identity attestor.

**Part 2 — Register Investors**

6. Register Wallet D with valid KYC, accreditation and Singapore country code.
7. Register Wallet E with valid KYC but no accreditation.
8. Register Wallet F with expired KYC.
9. Register Wallet G with valid KYC and a restricted-country attribute.

**Part 3 — Successful Transfer**

10. Issuer transfers 100 CPT to Wallet D.
11. Verify Wallet D receives 100 CPT.

**Part 4 — Missing Accreditation**

12. Attempt transfer of 100 CPT to Wallet E.
13. Confirm transaction reverts because the asset requires accreditation.

**Part 5 — Expired Identity**

14. Attempt transfer to Wallet F.
15. Confirm identity verification fails.

**Part 6 — Jurisdiction Restriction**

16. Attempt transfer to Wallet G.
17. Confirm compliance rejects the recipient's country.

**Part 7 — Maximum Holdings**

18. Increase Wallet D's balance to 450 CPT through compliant transfers.
19. Attempt another transfer of 100 CPT.
20. Verify it fails because the resulting balance exceeds 500 CPT.
21. Attempt a transfer of 50 CPT.
22. Verify it succeeds because the resulting balance is exactly 500 CPT.

**Part 8 — Credential Revocation**

23. Revoke Wallet D's simulated KYC credential.
24. Verify that normal outgoing and incoming investor transfers are blocked under the Lite policy.
25. Renew the credential.
26. Verify eligible transfers can proceed again, subject to the other compliance limits.

**Part 9 — Subscription Integration**

27. Create a regulated subscription offering.
28. Register its escrow contract as an authorised operational account.
29. Deposit offered tokens into escrow.
30. Execute valid mock stablecoin commitments.
31. Finalise the offering.
32. Verify compliant claims.
33. Verify invalid identity status blocks token delivery but not eligible stablecoin refunds.

Print the results and make the script fail if expected outcomes are violated.

---

# STEP 12 — SECURITY ANALYSIS

The new architecture introduces additional security-sensitive trust boundaries.

Audit:

## Identity Registry

- Who can create credentials?
- Who can revoke credentials?
- Can investors approve themselves?
- Can a revoked attestor's credentials remain improperly valid?
- Can expired credentials be used?
- Can registry administrators be replaced unexpectedly?

## Compliance Engine

- Can an attacker change allowed jurisdictions?
- Can holding limits be bypassed through delegated transfers?
- Can issuer privileges bypass restrictions unintentionally?
- Can operational-account privileges be abused?
- Can an incorrect token binding expose other assets?

## Token Contract

- Are checks enforced for every ordinary transfer path?
- Can malicious contract interactions bypass checks?
- Are minting and burning handled correctly?
- Can reentrant external validation alter assumptions?
- Does the preflight check agree with execution?
- Are failures atomic?

## Subscription Integration

- Can compliance restrictions lock legitimate refunds?
- Can a revoked investor's allocation be confiscated?
- Can an issuer recover tokens reserved for claims?
- Can an escrow contract be revoked while holding obligations?
- Do token claims remain consistent with pro-rata allocations?

## Gas and Scalability

- Avoid on-chain enumeration of all investors for each transfer.
- Keep identity lookups bounded.
- Keep compliance evaluation deterministic.
- Measure relevant additional gas costs where practical.

The security audit must distinguish confirmed vulnerabilities, design trade-offs and theoretical risks.

---

# STEP 13 — DOCUMENTATION AND AI AUDIT REPORT

Create or update:

```text
docs/
├── erc3643-lite-specification.md
├── identity-registry-design.md
├── compliance-engine-design.md
├── compliance-threat-model.md
├── compliance-test-results.md
├── erc3643-comparison.md
└── AI_Audit_Report.md
```

## Required Documentation

Explain:

1. Why simple address whitelisting is insufficient for richer asset policies.
2. What ERC-3643 is designed to achieve.
3. How the full standard separates identity and compliance.
4. Which components our Lite implementation includes.
5. Which parts of the real standard are intentionally omitted.
6. How trusted simulated identity attestations work.
7. How country restrictions are enforced.
8. How accreditation requirements are enforced.
9. How maximum wallet holdings are calculated.
10. How token transfers invoke the external checks.
11. How existing offerings and claims are affected.
12. How operational custody accounts are handled.
13. What security risks were considered.
14. What actual bugs or vulnerabilities were found and fixed.
15. What tests validate the implementation.

Include a comparison table:

| Capability | Full ERC-3643 | Our Lite Version |
|---|---|---|
| ERC-20 compatibility | Required | Implemented |
| Identity Registry | Required | Simplified |
| ONCHAINID signed claims | Part of reference architecture | Mock trusted attestations |
| Trusted issuers | Supported | Simplified role-based attestors |
| Compliance contract | Required | Implemented |
| Jurisdiction policies | Supported | Implemented |
| Holding limits | Supported | Per-wallet |
| Accreditation policies | Configurable | Simulated |
| Freeze / pause | Required by full standard | Optional enhancement |
| Lost-wallet recovery | Required | Not in core MVP |
| Forced transfers | Required | Not in core MVP |
| Batch operations | Required | Not in core MVP |

Adjust the comparison to the actual finished implementation.

Do not suggest full standards compliance.

## AI Audit Requirements

Update the existing SC4053 AI Audit Report using actual development evidence.

Record:

- Original Codex specification.
- AI-generated architectural decisions.
- Contract integration problems.
- Incorrect compliance assumptions.
- Solidity issues discovered.
- Security findings.
- Corrections.
- Test evidence.

For genuine major issues, explain:

1. Why AI made the mistake, if supported by evidence.
2. Why the issue was problematic.
3. How the issue was fixed.
4. Evidence that the fix works.

Do not fabricate audit findings.

---

# STEP 14 — OPTIONAL ENHANCEMENTS

Only implement these after all core requirements are complete and tested.

## Optional A — Token Pause

Allow an authorised agent to pause ordinary token transfers.

Use established OpenZeppelin mechanisms.

Ensure the interaction with existing escrow obligations is understood.

## Optional B — Wallet Freezing

Allow an authorised compliance administrator to freeze a specific wallet's regulated-token transfers.

This is different from deleting the wallet's identity record.

## Optional C — Partial Token Freezing

Support an amount of tokens that cannot be transferred.

This requires careful free-balance accounting.

## Optional D — Wallet Recovery

Allow a tightly authorised recovery operation to migrate holdings from a lost wallet to a replacement wallet.

Require appropriate identity continuity and explicit safeguards against theft.

Do not implement a generic administrator function capable of transferring arbitrary investor balances without a documented, restricted recovery policy.

These capabilities would bring the design closer to ERC-3643, but are not mandatory for this enhancement.

---

# STEP 15 — FINAL ACCEPTANCE CRITERIA

## Identity

- [ ] Identity Registry implemented.
- [ ] Synthetic identity records supported.
- [ ] Trusted attestors managed securely.
- [ ] Simulated KYC status verified.
- [ ] Credential expiration enforced.
- [ ] Credential revocation enforced.
- [ ] Unauthorized identity changes rejected.

## Compliance

- [ ] Separate Compliance contract implemented.
- [ ] Country eligibility supported.
- [ ] Accredited-investor requirements supported.
- [ ] Maximum wallet holdings supported.
- [ ] Policies configured per asset.
- [ ] Only authorised users can change policies.
- [ ] Operational issuer and escrow accounts handled safely.

## Token Enforcement

- [ ] ERC-20 functionality preserved.
- [ ] Token queries identity verification.
- [ ] Token queries compliance rules.
- [ ] Non-compliant transfers revert.
- [ ] transferFrom cannot bypass restrictions.
- [ ] Read-only transfer preflight available.
- [ ] Factory deployment assigns permissions correctly.
- [ ] Legacy assets remain functional or migration limitations are documented.

## Integration

- [ ] Direct asset purchases remain functional.
- [ ] Subscription commitments remain functional.
- [ ] Pro-rata allocation remains correct.
- [ ] Compliant token claims succeed.
- [ ] Ineligible token claims are safely blocked.
- [ ] Stablecoin refunds remain accessible.
- [ ] Unclaimed inventory is protected.
- [ ] Multi-asset compliance rules are independent.

## Frontend

- [ ] Identity management interface implemented.
- [ ] Compliance policy interface implemented.
- [ ] Investor status displayed.
- [ ] Transfer preflight checker works.
- [ ] Compliance errors are understandable.
- [ ] Existing dashboard design remains consistent.

## Validation

- [ ] Existing tests pass.
- [ ] New identity tests pass.
- [ ] New compliance tests pass.
- [ ] Token integration tests pass.
- [ ] Subscription integration tests pass.
- [ ] Adversarial tests pass.
- [ ] Demonstration script executes successfully.
- [ ] Documentation updated.
- [ ] AI Audit Report updated with genuine findings.
- [ ] No unresolved known critical security defects remain.

---

# STEP 16 — EXPECTED FINAL CODEX OUTPUT

After implementing the feature, provide:

1. **Architecture Summary**
   - New contracts.
   - Contract relationships.
   - Identity verification workflow.
   - Compliance validation workflow.

2. **Files Created/Modified**
   - Every source, test, configuration and documentation file changed.

3. **ERC-3643 Comparison**
   - What was implemented.
   - What was simplified.
   - What remains unsupported.

4. **Compliance Rules**
   - KYC verification.
   - Country restrictions.
   - Accreditation.
   - Maximum wallet holdings.
   - Operational account exemptions.

5. **Integration Results**
   - AssetFactory.
   - AssetToken.
   - AssetSale.
   - SubscriptionOffering.
   - React frontend.

6. **Testing Results**
   - Actual executed commands.
   - Passing and failing test counts.
   - Demonstration results.

7. **Security Review**
   - Genuine vulnerabilities.
   - Design risks.
   - Implemented mitigations.
   - Remaining limitations.

8. **AI Audit Evidence**
   - Actual problems discovered.
   - Fixes implemented.
   - Tests demonstrating correctness.

9. **Completion Status**
   - Clearly identify completed and incomplete acceptance criteria.

---

# FINAL DEVELOPMENT INSTRUCTIONS

- Inspect the existing repository first.
- Read the official ERC-3643 specification before implementing.
- Implement an ERC-3643-inspired Lite framework, not a misleading partial clone.
- Preserve the existing Ethereum tokenisation architecture.
- Separate identity verification from asset compliance logic.
- Enforce both checks inside the token contract.
- Use OpenZeppelin wherever appropriate.
- Maintain strict role-based permissions.
- Use synthetic identity credentials only.
- Never store real personal identity documents on-chain.
- Preserve the fixed token supply.
- Maintain issuer and escrow compatibility.
- Do not bypass compliance for normal investor transfers.
- Ensure refunds remain independent of regulated-token eligibility.
- Protect outstanding subscription claims.
- Avoid unbounded loops.
- Write comprehensive adversarial tests.
- Execute the existing regression suite.
- Fix all identified integration failures.
- Update frontend interfaces and contract ABIs.
- Document deviations from the ERC-3643 standard.
- Record genuine AI-generated problems for the SC4053 audit.
- Do not invent test results or vulnerabilities.
- Do not make Git commits unless requested.
- Do not deploy to mainnet.
- Complete the implementation rather than stopping at the planning stage.

## EXECUTION ORDER

**Milestone 1:** Repository inspection and standards comparison.

**Milestone 2:** Identity Registry and trusted attestors.

**Milestone 3:** Compliance Engine and configurable policies.

**Milestone 4:** ERC-20 token integration and transfer preflight.

**Milestone 5:** Factory, issuer and escrow compatibility.

**Milestone 6:** Direct-sale and subscription-offering integration.

**Milestone 7:** Compliance administration frontend.

**Milestone 8:** Security testing and adversarial validation.

**Milestone 9:** Full demonstration and documentation.

**BEGIN NOW. Inspect the repository, implement the ERC-3643-inspired Lite Compliance Framework, integrate it across the existing tokenisation and subscription architecture, execute the tests, and update the SC4053 AI Audit Report.**