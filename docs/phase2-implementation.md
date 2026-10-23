# Phase 2: Asset Tokenisation and Compliance

Date: 23 October 2026. Scope: local `AssetToken` implementation, automated tests, demonstration, and audit evidence. This document does not certify completion of the application or later phases.

## Requirements and scope decisions

The [user's Phase 2 requirements](spec/phase2-requirements.md) are the implementation authority for this phase. The earlier [spec v1](spec/spec-v1.md) remains a historical architecture reference. Where they differ, the user's more recent, explicit instructions apply:

| Earlier scaffold/spec | Phase 2 decision and reason |
|---|---|
| Issuer-only whitelist administration | OpenZeppelin `AccessControl`; issuer starts with `DEFAULT_ADMIN_ROLE` and `COMPLIANCE_ROLE`, and can delegate roles. |
| Revocation only when a holder has no tokens | Revocation is permitted with a positive balance; that balance remains recorded and transfers are blocked until reapproval. |
| Every token holder must always be whitelisted | Superseded: every successful transfer must have eligible endpoints. A revoked holder may retain tokens. |
| Separate `addToWhitelist` / `removeFromWhitelist` methods | The requested `setWhitelisted(address,bool)` is the write API. The old `whitelist(address)` read name remains an alias for compatibility. |
| Inert `paused` and `frozen` scaffold fields; future forced transfers | Removed from the token. No pause, freeze, confiscation, or forced-transfer API is introduced in this phase. |
| Hardhat 2 described in spec v1 | Preserve the installed Hardhat 3 toolchain and its connection API. |
| Suggested `test/AssetToken.test.js` | Retain `test/AssetToken.test.ts` to match the existing TypeScript/Mocha test framework. |
| Commit-based audit workflow in `CLAUDE.md` | The user explicitly prohibits commits unless requested. Preserve source snapshots and command logs in the working tree instead. |

Production `AssetFactory.sol`, `AssetSale.sol`, frontend, wallet integration, payments, and deployment tooling for the full application are outside this implementation. The helpers in [`contracts/test/AssetTokenHarness.sol`](../contracts/test/AssetTokenHarness.sol) simulate deployment by another contract and inventory custody for automated tests; they are not an asset registry or primary-sale implementation.

## Contract overview

[`contracts/AssetToken.sol`](../contracts/AssetToken.sol) extends OpenZeppelin `ERC20` and `AccessControl`. Each deployment represents one asset as fungible whole units. Balances are the on-chain ownership record; the contract makes no assertion about legal title or off-chain asset backing.

For Campus Property Token, `initialSupply_ = 10000` creates exactly 10,000 CPT. `decimals()` returns `0`; neither the constructor nor clients should multiply the quantity by `10**18`.

### Construction and supply

```solidity
constructor(
    string memory name_,
    string memory symbol_,
    uint256 initialSupply_,
    address issuer_
)
```

| Parameter | Meaning / validation |
|---|---|
| `name_` | ERC-20 display name; no extra metadata restrictions. |
| `symbol_` | ERC-20 symbol; no extra metadata restrictions. |
| `initialSupply_` | Whole token units; must be nonzero. |
| `issuer_` | Initial token owner and administrator; must be nonzero. |

The immutable public `issuer` records the designated issuer. Construction grants both required roles to `issuer_`, approves the issuer in the whitelist, and only then calls `_mint(issuer_, initialSupply_)`. The deploying wallet or factory receives no implicit role when it differs from `issuer_`.

Construction emits `WhitelistUpdated(issuer_, true, deployer)` for that initial approval, followed by the ERC-20 mint `Transfer` event. The event operator records who performed the deployment; it does not identify the owner of the administration roles.

The only call to `_mint` is in the constructor. There is no external mint, burn, upgrade, or supply-changing method. ERC-20 transfers redistribute the fixed supply; eligibility changes and role changes do not alter balances or supply. An inherited or modified future contract would need its own review before claiming the same supply guarantee.

### Access control

`COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE")` authorizes `setWhitelisted`. The issuer initially also holds `DEFAULT_ADMIN_ROLE`, which administers roles through the inherited `grantRole`, `revokeRole`, and `renounceRole` API.

Role membership and eligibility are independent. Granting a compliance role does not approve the recipient to hold or move tokens. A compliance officer does not need to be whitelisted to manage eligibility. A default administrator without `COMPLIANCE_ROLE` cannot call `setWhitelisted`, although that administrator can grant the role to itself or another account. Administrative powers confer no token-transfer bypass. The immutable issuer remains the original issuer even if role memberships later change.

AccessControl's standard `AccessControlUnauthorizedAccount(account, neededRole)` error reports unauthorized administration. Role changes use OpenZeppelin's `RoleGranted` and `RoleRevoked` events.

### Eligibility registry

`isWhitelisted(address)` exposes each token instance's independent eligibility mapping. The compatibility reader `whitelist(address)` returns the same value.

`setWhitelisted(investor, approved)`:

1. Requires `COMPLIANCE_ROLE`.
2. Rejects the zero address for both approval and revocation.
3. Updates eligibility and emits `WhitelistUpdated` only when the status actually changes; repeated identical updates succeed without emitting that event.
4. Leaves balances and allowances unchanged.

```solidity
event WhitelistUpdated(
    address indexed investor,
    bool approved,
    address indexed operator
);
```

Revocation blocks sending and receiving, including when a wallet already holds tokens. Reapproval restores eligibility without moving or minting anything. The issuer can also be revoked: its role permissions remain, but it cannot transfer until an authorized compliance account approves it again.

### Transfer enforcement

The OpenZeppelin v5 `_update(from, to, value)` override checks eligibility before calling `super._update`:

- For a nonzero `from`, require `isWhitelisted[from]`.
- For a nonzero `to`, require `isWhitelisted[to]`.
- Skip the zero-address endpoint so constructor minting works; the issuer is already approved before the mint.

Both `transfer` and `transferFrom` reach this hook. The token holder (`from`) and recipient (`to`) are checked. The allowance spender is not required to be whitelisted: approving an intermediary does not give that intermediary ownership of the tokens.

| Sender | Recipient | Transfer eligibility |
|---|---|---|
| Approved | Approved | Allowed, subject to normal balance/allowance checks |
| Approved | Unapproved | Reverts |
| Unapproved | Approved | Reverts |
| Unapproved | Unapproved | Reverts |

The hook applies to zero-value and self-transfers as well. Standard ERC-20 validation rejects transfers to the zero address; the mint exception does not expose a public burn operation. OpenZeppelin supplies balance accounting, approvals, allowance spending, and standard `Transfer` / `Approval` events. No custom approval restriction is added.

When `transferFrom` fails after allowance handling, transaction atomicity rolls back any allowance change and balance change. Insufficient allowance retains OpenZeppelin's normal error behavior; if several preconditions fail, the first check reached determines the error. Infinite allowances retain OpenZeppelin's usual behavior. Existing allowances survive revocation and can be used again after reapproval, so holders must explicitly adjust approvals when they intend to withdraw spender permission.

### Public API and errors

| API | Purpose |
|---|---|
| `name`, `symbol`, `decimals`, `totalSupply`, `balanceOf` | ERC-20 metadata and balances |
| `transfer`, `approve`, `allowance`, `transferFrom` | Standard ERC-20 operations with transfer eligibility enforced centrally |
| `issuer` | Original designated issuer |
| `isWhitelisted`, `whitelist` | Eligibility reader and compatibility alias |
| `setWhitelisted` | Approve or revoke eligibility |
| `COMPLIANCE_ROLE`, `DEFAULT_ADMIN_ROLE`, `hasRole`, `getRoleAdmin` | Inspect role identifiers and membership |
| `grantRole`, `revokeRole`, `renounceRole`, `supportsInterface` | Inherited AccessControl administration and ERC-165 support |

| Custom error | Condition |
|---|---|
| `InvalidIssuer()` | Constructor issuer is zero |
| `InvalidInitialSupply()` | Constructor supply is zero |
| `InvalidInvestor()` | Whitelist update targets zero |
| `SenderNotWhitelisted(address)` | Nonzero token sender is ineligible |
| `RecipientNotWhitelisted(address)` | Nonzero token recipient is ineligible |

Standard OpenZeppelin errors remain for insufficient balance, insufficient allowance, invalid ERC-20 endpoints, and unauthorized role operations.

## Toolchain choices

The installed versions were inspected rather than replaced: Solidity `0.8.24`, Hardhat `3.21.0`, OpenZeppelin Contracts `5.6.1`, ethers `6.17.0`, and `@nomicfoundation/hardhat-toolbox-mocha-ethers` `4.0.0`. See [captured versions](evidence/phase2/versions.json).

OpenZeppelin v5 centralizes ERC-20 mint, burn, and transfer accounting in `_update`. Overriding that supported hook ensures a single eligibility gate for direct and delegated transfers. Inheriting `ERC20` and `AccessControl` avoids rewriting accounting or role checks. No dependency downgrade, extra framework, proxy, external KYC service, or token callback is needed.

## Phase 3 integration

A future factory should pass the actual issuer wallet as `issuer_` when deploying a token. Factory deployment does not automatically make the factory an administrator. Tests cover an issuer distinct from the deployer and smart-contract deployment to exercise this boundary.

A future inventory/sale contract can hold and distribute tokens after a compliance officer whitelists its address. The issuer can then transfer inventory directly or approve the inventory contract to pull it using `transferFrom`. Each buyer must be approved, and the sale address must remain approved while receiving or sending tokens. All token amounts are whole units. ETH prices, payment handling, registry entries, and proceeds withdrawal belong to later contracts.

Every asset deployment has separate roles, eligibility, balances, and allowances. A compliance grant for asset A does not confer any permission on asset B. The factory must not assume the token's default admin is its own address, and future sale code should use `setWhitelisted` / `isWhitelisted` rather than the obsolete whitelist mutation names.

## Automated validation and demonstration

[`test/AssetToken.test.ts`](../test/AssetToken.test.ts) and the focused [regression test](../test/AssetToken.regression.test.ts) run on Hardhat's local simulated network, using its local signer accounts and ethers/Mocha/Chai assertions. They require no wallet connection, Sepolia endpoint, real ETH, or frontend. Each fixture starts from a deterministic deployment. The contract tests cover:

- Constructor metadata, whole-unit supply, initial roles, issuer approval, and invalid parameters.
- Compliance administration, role delegation/revocation, events, unauthorized writes, zero addresses, and repeated updates.
- The four sender/recipient eligibility combinations; direct and delegated transfers; revocation and reapproval with balances preserved.
- Approval behavior, spender-versus-holder distinction, rollback after reverts, insufficient balances/allowances, and infinite allowances.
- Zero-value transfers, self-transfers, supply/balance conservation over tested sequences, and independent asset instances.
- A separate deployer and issuer, contract deployment, and whitelisted smart-contract custody.
- The user's 10,000 CPT demonstration and the original missing-transfer-restriction regression.

These are deterministic behavioral tests, not a proof over every possible transaction sequence or a completed external security audit.

### Actual command outcomes

The pre-implementation `npm test` baseline completed with **0 passing and 41 pending Mocha tests**: [baseline-approved.log](evidence/phase2/baseline-approved.log). The skipped tests did not verify token behavior.

| Executed command | Result | Evidence |
|---|---|---|
| `npm run compile` | Passed; compiled Solidity using `0.8.24` | [compile.log](evidence/phase2/compile.log) |
| `npx hardhat test mocha --no-compile test/AssetToken.regression.test.ts` against the original token | Expected regression failure: 0 passing, 1 failing | [before.log](evidence/phase2/before.log) |
| `npx hardhat test mocha --no-compile test/AssetToken.regression.test.ts` against the fixed token | Passed: 1 passing, 0 failing | [regression-after.log](evidence/phase2/regression-after.log) |

TBD: insert final full-suite and focused Phase 2 commands, exit codes, passing/failing/pending counts, and captured logs after validation finishes. Pending tests are not executed tests. In this toolchain, Hardhat's aggregate summary can count skipped Mocha cases; the Mocha `passing` and `pending` lines are the evidence for actual execution.

### Demonstration

TBD: insert final demonstration command and output log. The required verified balances are issuer `9900`, investor B `80`, investor C `20`, and total supply `10000`. Before investor C is approved, the attempted transfer from B to unapproved investor D must revert with balances unchanged.

## Audit evidence and genuine findings

The initial requirements are preserved at [docs/spec/phase2-requirements.md](spec/phase2-requirements.md). The original token source is retained as [AssetToken.before.sol](evidence/phase2/AssetToken.before.sol); this is an evidence snapshot, outside the compiled contracts directory. Related command outputs are stored under [docs/evidence/phase2](evidence/phase2).

AI assisted with repository inspection, implementation, test generation, review, and this documentation. The resulting code and command evidence are reviewable working-tree artifacts. No Git commit or testnet deployment is implied. Existing evidence instructions prefer committed runs; this phase records the explicit no-commit exception required by the user. See the [AI session index](ai-logs/INDEX.md) for the session record. Generated ethers bindings remain available locally under `types/ethers-contracts/` and are ignored by Git, like other regenerated build artifacts.

The original token inherited unrestricted ERC-20 transfers and had no compliance hook or whitelist management function. Consequently a holder could transfer tokens to an unapproved recipient. This was a missing implementation, not evidence of a reentrancy exploit or an observed loss. [AUD-004](issues/AUD-004-assettoken-does-not-enforce-transfer-eligibility.md) records the regression, `_update` fix, and before/after evidence. The focused regression produced **0 passing / 1 failing** against the original source ([before.log](evidence/phase2/before.log)) because the expected revert did not occur, then **1 passing / 0 failing** with the hook ([regression-after.log](evidence/phase2/regression-after.log)). The test exercises the same pre/post transfer and reader APIs, so the original failure demonstrates a behavioral bypass rather than a missing method. The original source also lacked AccessControl and a positive-supply guard; the implementation adds them and tests their behavior. Do not attribute the scaffold's shortcomings to a particular AI model without a supporting transcript.

The prior [whole-project verification](VERIFICATION.md) identified additional incomplete factory, sale, frontend, deployment, and evidence tooling. Its observations are historical; later-phase placeholders do not become implemented by passing token tests. The existing Foundry/Slither evidence script is separate from the installed Hardhat/Mocha workflow. No Foundry, Slither, fuzzing, coverage, gas-analysis, or live-network result is claimed unless separately captured.

## Security considerations and limits

- Compliance officers are trusted to approve the correct addresses. Administrators can appoint or remove compliance officers; a compromised administrator can change eligibility policy.
- Revocation deliberately locks token movement while preserving recorded ownership. It does not confiscate tokens or cancel approvals. There is no privileged transfer bypass.
- The issuer can delegate or renounce roles. Losing every default administrator prevents future role grants. If no usable compliance account remains either, eligibility changes become unavailable. No hidden recovery owner exists.
- Token updates perform no external calls. This token introduces no ETH custody, payable purchase path, or external callback in its transfer restrictions.
- Fixed supply follows from the one constructor mint and absence of external mint/burn/upgrade paths. The tests verify behavior and exposed interfaces; they do not certify future derived contracts.
- Whitelisting is a local allowlist, not identity verification or real-world regulatory certification. Asset backing and legal rights remain off-chain.

## Phase 2 acceptance status

TBD: complete only after successful compilation, Phase 2 test execution, full repository regression run, and demonstration. Explicitly separate Phase 2 results from later-phase skipped tests and pre-existing application/tooling failures.
