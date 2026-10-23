# SC4053 Blockchain Technology — Phase 2: Asset Tokenisation and Compliance

## Project Context

We are developing a decentralised application (dApp) titled **Tokenisation of Real-World and Digital Assets on Ethereum** for the NTU SC4053 Blockchain Technology Development Project.

The application simulates an institutional real-world asset (RWA) tokenisation platform, inspired by financial institutions such as BlackRock, J.P. Morgan, and DTCC.

Users will eventually be able to create tokenised assets, purchase tokens using testnet ETH, manage investor permissions, and transfer tokens between eligible wallets.

The project is being developed in six sequential phases:

1. Project Foundation and Architecture — COMPLETED
2. Asset Tokenisation and Compliance — CURRENT PHASE
3. Asset Registry and Primary Issuance
4. Frontend and MetaMask Integration
5. End-to-End Integration and Testnet Deployment
6. Security Audit, AI Evaluation and Final Submission

**Your task is to fully implement Phase 2, including Solidity development, automated testing, validation, and technical documentation.**

Do not implement functionality belonging to later phases.

---

## Step 1: Inspect the Existing Repository

Before writing any code:

1. Read the existing README, project specifications, architecture documents, and relevant source files.
2. Inspect the Hardhat configuration, Solidity compiler version, OpenZeppelin version, package dependencies, and testing framework.
3. Understand the architecture established in Phase 1.
4. Identify any existing smart contracts or tests relevant to Phase 2.
5. Run the existing baseline tests, if available.
6. Preserve working Phase 1 code and established project conventions.

If there are minor differences between this prompt and the existing repository architecture, adapt the implementation to preserve compatibility. Document any meaningful architectural decisions.

Do not unnecessarily reinstall dependencies, overwrite configurations, introduce new frameworks, or restructure the project.

## Step 2: Implement `AssetToken.sol`

Create or complete:

`contracts/AssetToken.sol`

This is the core token contract representing fractional interests in a simulated real-world or digital asset.

### 2.1 ERC-20 Implementation

Use OpenZeppelin's ERC-20 implementation rather than writing token accounting from scratch.

The contract must support:

- Token name and symbol.
- Fixed initial token supply.
- Token balances.
- Standard `transfer`, `approve`, `allowance`, and `transferFrom` functionality.
- ERC-20 `Transfer` and `Approval` events.
- Ownership records derived from token balances.

The contract constructor should accept:

```solidity
constructor(
    string memory name_,
    string memory symbol_,
    uint256 initialSupply_,
    address issuer_
)
```

Expected behaviour:

- The token name and symbol are configured at deployment.
- `initialSupply_` is minted to the issuer's wallet.
- `totalSupply()` returns the correct fixed supply.
- `balanceOf(issuer_)` initially equals `initialSupply_`.
- Token decimals are set to **0**, representing whole asset units.
- Further minting is not permitted after deployment.
- Zero issuer addresses and zero initial supply must be rejected.

For example:

```text
Token Name: Campus Property Token
Symbol: CPT
Initial Supply: 10,000
Decimals: 0

Issuer Balance: 10,000 CPT
Total Supply: 10,000 CPT
```

The MVP uses whole token units. Do not automatically multiply the supply by 10^18.

### 2.2 Role-Based Access Control

Implement role-based permissions using OpenZeppelin AccessControl.

At minimum, define:

```solidity
bytes32 public constant COMPLIANCE_ROLE =
    keccak256("COMPLIANCE_ROLE");
```

The issuer supplied during deployment should initially receive:

- `DEFAULT_ADMIN_ROLE`
- `COMPLIANCE_ROLE`

The issuer must also automatically be whitelisted.

Only authorised compliance administrators may approve or revoke investor eligibility.

Important implementation detail: **Do not assume `msg.sender` is always the issuer during construction.**

In Phase 3, the token contract may be deployed by an asset factory on behalf of an issuer. Therefore, roles must be explicitly assigned to the `issuer_` constructor argument rather than blindly assigned to the deploying contract.

Do not implement the platform-wide issuer approval system yet; that belongs to Phase 3.

### 2.3 Investor Whitelisting

Implement an on-chain investor eligibility registry.

Suggested state variable:

```solidity
mapping(address => bool) public isWhitelisted;
```

Required function:

```solidity
function setWhitelisted(
    address investor,
    bool approved
) external;
```

Requirements:

1. Only addresses holding `COMPLIANCE_ROLE` may call the function.
2. Setting `approved = true` adds an investor to the whitelist.
3. Setting `approved = false` revokes an investor's eligibility.
4. Zero addresses cannot be whitelisted.
5. Emit a `WhitelistUpdated` event when eligibility changes.
6. Whitelist status must be publicly readable.

An approved investor is permitted to hold and receive the asset tokens.

An investor removed from the whitelist must no longer be able to send or receive tokens, even if they still have a positive token balance.

Do not forcibly confiscate or burn tokens when whitelist access is revoked.

### 2.4 Enforce Transfer Restrictions

This is the most important functionality of Phase 2.

Modify ERC-20 transfer behaviour so that tokens can only move between whitelisted addresses.

Expected behaviour:

| Sender | Recipient | Result |
|---|---|---|
| Whitelisted | Whitelisted | Transfer succeeds |
| Whitelisted | Not whitelisted | Transfer reverts |
| Not whitelisted | Whitelisted | Transfer reverts |
| Not whitelisted | Not whitelisted | Transfer reverts |

**The restrictions must be enforced inside the token contract itself, not just in a separate purchasing contract or frontend.**

Both `transfer()` and `transferFrom()` must respect the restrictions.

If OpenZeppelin Contracts v5 is installed, use the appropriate ERC-20 `_update()` override to enforce transfer eligibility. If an older compatible version is already used by the project, implement the equivalent restriction using the supported hook for that version.

Do not downgrade OpenZeppelin or use deprecated methods just to follow an example.

Handle the zero-address minting case correctly during initial deployment.

The initial mint must succeed even though the zero address is not an eligible investor.

Avoid adding unnecessary restrictions to standard ERC-20 approval functionality unless required for security.

### 2.5 Contract Events and Errors

Implement clear events for compliance operations, such as:

```solidity
event WhitelistUpdated(
    address indexed investor,
    bool approved,
    address indexed operator
);
```

Use descriptive custom errors where appropriate.

The code should clearly distinguish failures caused by:

- Unauthorised compliance administration.
- Invalid wallet addresses.
- Non-whitelisted senders.
- Non-whitelisted recipients.
- Invalid constructor parameters.

Keep the implementation concise and readable.

### 2.6 Future Compatibility

The contract must be designed to support Phase 3 without major redesign.

In Phase 3, an `AssetSale` contract will temporarily hold token inventory and distribute tokens to approved investors.

Therefore:

- Compliance administrators must be able to whitelist smart-contract addresses, not only externally owned wallets.
- Whitelisted sale contracts must be capable of receiving and transferring asset tokens.
- The token should work when instantiated by a factory contract.
- The token must not depend on any frontend implementation.
- Each deployed token must maintain independent balances, roles, and whitelist state.

Do not implement `AssetSale.sol` or `AssetFactory.sol` in this phase.

---

## Step 3: Implement Automated Unit Tests

Create or update:

`test/AssetToken.test.js`

Use the testing framework already configured in Phase 1.

Tests must be deterministic and must not require Sepolia, MetaMask, live network access, or real ETH.

Use multiple local test accounts:

```text
Account A: Issuer / Compliance Admin
Account B: Approved Investor 1
Account C: Approved Investor 2
Account D: Unapproved Investor
Account E: Unauthorised Administrator
```

### Test Group A — Token Deployment

Verify:

1. Correct token name.
2. Correct token symbol.
3. Decimals equal 0.
4. Initial total supply equals 10,000.
5. Issuer initially receives 10,000 tokens.
6. Issuer is automatically whitelisted.
7. Issuer receives the required administrator roles.
8. Invalid issuer addresses are rejected.
9. Zero supply is rejected.
10. No externally accessible function can arbitrarily mint additional tokens.

### Test Group B — Investor Whitelisting

Verify:

1. Compliance admin can whitelist Account B.
2. Compliance admin can whitelist Account C.
3. Approved addresses return `true` from the whitelist.
4. Compliance admin can revoke Account B.
5. Revoked addresses return `false`.
6. Unauthorised Account E cannot whitelist investors.
7. Unauthorised Account E cannot revoke investors.
8. Whitelist modifications emit the expected event.
9. Attempts to whitelist the zero address revert.
10. Revoking a wallet does not silently change its token balance.

### Test Group C — ERC-20 Transfers

Test the following sequence:

1. Deploy CPT with 10,000 tokens.
2. Whitelist Account B.
3. Transfer 100 CPT from issuer to Account B.
4. Verify issuer balance equals 9,900.
5. Verify Account B balance equals 100.
6. Attempt transferring tokens from Account B to unapproved Account D.
7. Confirm the transaction reverts.
8. Verify all token balances remain unchanged after the revert.
9. Whitelist Account C.
10. Transfer 20 CPT from Account B to Account C.
11. Verify Account B now holds 80 CPT.
12. Verify Account C now holds 20 CPT.
13. Revoke Account B's whitelist status.
14. Verify Account B can neither send nor receive tokens.
15. Reapprove Account B.
16. Confirm transfers become possible again.

### Test Group D — Delegated Transfers

Test `approve()` and `transferFrom()`.

Verify:

- Allowances are created correctly.
- An approved delegated transfer between whitelisted holders succeeds.
- Delegated transfers to non-whitelisted recipients revert.
- Delegated transfers from non-whitelisted token holders revert.
- Failed delegated transfers do not unexpectedly alter balances or allowances.
- Standard ERC-20 insufficient-allowance behaviour is preserved.

Be careful not to confuse the spender with the actual token sender. Compliance checks must cover the token holder (`from`) and recipient (`to`).

### Test Group E — Edge Cases

Include tests for:

- Transfers exceeding the sender's balance.
- Transfers of zero tokens.
- Transfers to the zero address.
- Repeated whitelist updates.
- Token balance invariants.
- Revocation and subsequent reapproval.
- Independent whitelist states across two deployed asset-token instances.
- A token whose issuer differs from the deploying account, simulating deployment by a future factory.

Use meaningful test descriptions so failures are understandable.

---

## Step 4: Validate the Implementation

After implementation:

1. Compile all Solidity contracts.
2. Run the complete Phase 2 test suite.
3. Run any existing repository tests to detect regressions.
4. Fix all compilation errors and failing tests.
5. Check for common Solidity security problems.
6. Remove unnecessary code and unused imports.
7. Ensure code style matches the existing project.
8. Verify compatibility with the installed OpenZeppelin version.

Run the actual relevant build and test commands, rather than merely describing what should be run.

If existing failures are unrelated to Phase 2, document them without making unrelated changes.

Do not claim any test passed unless you executed it successfully.

---

## Step 5: Documentation and AI Audit Evidence

The SC4053 assignment requires an AI Audit Report evaluating AI-assisted development.

Maintain an accurate and reviewable record of this phase.

Create or update:

`docs/phase2-implementation.md`

Include:

- Smart-contract overview.
- Explanation of ERC-20 tokenisation.
- Constructor parameters.
- Access-control architecture.
- Whitelist mechanism.
- Transfer restriction logic.
- Relevant functions and events.
- Explanation of the OpenZeppelin implementation choices.
- How Phase 3 will integrate with this contract.
- Testing methodology and outcomes.

Also preserve evidence relevant to the AI Audit Report, using the existing documentation structure where possible.

Record:

1. The initial Phase 2 requirements.
2. How AI was used to generate or modify the implementation.
3. Major architectural decisions.
4. Any genuine bugs, security concerns or incorrect AI-generated code discovered.
5. Why each issue was problematic.
6. The actual fixes implemented.
7. Evidence demonstrating that the fixes work.

Do not fabricate vulnerabilities or pretend tests were performed.

If possible, preserve representative failing and passing tests for genuinely discovered issues.

---

## Step 6: Provide a Working Demonstration

Create a minimal local demonstration using automated tests or a Hardhat script.

The demonstration must prove the following:

```text
1. Deploy Campus Property Token
   Name: Campus Property Token
   Symbol: CPT
   Supply: 10,000

2. Verify:
   Issuer owns 10,000 CPT

3. Whitelist Investor B

4. Transfer 100 CPT:
   Issuer -> Investor B

5. Verify:
   Issuer: 9,900 CPT
   Investor B: 100 CPT

6. Attempt transfer:
   Investor B -> Unapproved Investor D
   Amount: 20 CPT

7. Expected:
   Transaction REVERTED

8. Whitelist Investor C

9. Transfer:
   Investor B -> Investor C
   Amount: 20 CPT

10. Verify final balances:
    Issuer: 9,900 CPT
    Investor B: 80 CPT
    Investor C: 20 CPT
    Total Supply: 10,000 CPT
```

This should run locally without requiring a connected wallet or deployed frontend.

---

## Step 7: Strict Scope Boundaries

This phase must implement only **asset tokenisation and compliance**.

Do not implement:

- Asset factory and asset registry.
- Primary token sale contracts.
- ETH payment functionality.
- Asset marketplaces.
- React frontend.
- MetaMask integration.
- Secondary-market trading.
- Price oracles.
- Dividend distribution.
- Token redemption.
- NFTs or ERC-721.
- Mainnet deployment.
- External KYC integrations.

Do not add unnecessary abstractions, upgradeable proxies, or complex external dependencies.

Focus on a clean, secure, well-tested implementation.

---

## Step 8: Final Acceptance Criteria

Phase 2 is complete only when:

- [ ] `AssetToken.sol` implements a working ERC-20 token.
- [ ] Tokens are minted correctly to the designated issuer.
- [ ] Total token supply is fixed.
- [ ] Token decimals are 0.
- [ ] Role-based administrative permissions work.
- [ ] Issuers/compliance administrators can whitelist investors.
- [ ] Unauthorised wallets cannot modify whitelist permissions.
- [ ] Only whitelisted wallets can send and receive tokens.
- [ ] Both `transfer` and `transferFrom` enforce restrictions.
- [ ] Revoked wallets cannot transfer tokens.
- [ ] Multiple independent token instances work.
- [ ] The full automated test suite passes.
- [ ] The demonstration scenario succeeds.
- [ ] Documentation is updated.
- [ ] AI-assisted development and any discovered issues are accurately documented.
- [ ] Existing Phase 1 functionality remains intact.

## Expected Final Response

Once implementation and testing are complete, provide a structured report containing:

**1. Files Created/Modified**
List every file changed and explain its purpose.

**2. Implementation Summary**
Explain what was built and the important contract-design decisions.

**3. Testing Results**
Provide the actual commands executed, number of tests passing/failing, and relevant terminal output.

**4. Security Considerations**
Describe access-control, whitelisting, transfer-restriction and supply-integrity protections.

**5. Issues Discovered**
Report any genuine errors encountered and how they were fixed.

**6. Phase 2 Completion Status**
State which acceptance criteria are satisfied and which, if any, remain incomplete.

**7. Phase 3 Readiness**
Explain how the finished `AssetToken` contract can integrate with the future asset factory and primary issuance contracts.

### Important Development Instructions

- Implement the functionality; do not stop after writing a plan.
- Inspect the repository before modifying files.
- Preserve Phase 1 architecture wherever possible.
- Prefer established OpenZeppelin implementations.
- Write and execute automated tests.
- Fix failures before finishing.
- Avoid unrelated changes.
- Do not make Git commits unless explicitly requested.
- Document assumptions and important deviations.
- Prioritise correct, secure, maintainable code over unnecessary functionality.

**Begin by inspecting the current repository, then complete Phase 2 from implementation through automated validation.**