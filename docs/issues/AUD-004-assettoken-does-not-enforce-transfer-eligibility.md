# AUD-004: AssetToken does not enforce transfer eligibility

| Field | Value |
|---|---|
| Status | fixed in working tree; uncommitted as requested |
| Severity | high |
| Category | access control / logic |
| Found by (method) | source review and executed regression test |
| Found by (person) | Codex, at user direction |
| Location | contracts/AssetToken.sol, inherited ERC-20 transfer path |
| AI session that produced the original code | Not established |
| Baseline commit | c5042157a38fdd04d56162deefcd67ca49023cd8 |
| Regression test commit | None: user prohibited commits |
| Fix commit | None: user prohibited commits |

## What is wrong

The original contract defined a whitelist but never checked it during transfers. The issuer could transfer 20 tokens directly to an unapproved investor. This violates both the original transfer-gate requirement and the current Phase 2 request.

## 1. Why the AI made the mistake

The source labels the contract as a placeholder for future implementation. The initial generation transcript was not inspected. No claim about the original author's reasoning is made. A separate test-harness error in this session used a deprecated `.reverted` matcher; installed plugin documentation showed the supported `.revert(ethers)` call, which was applied before the real regression run.

## 2. Why it is a problem

An issuer or holder can move tokens to an ineligible wallet through the token's inherited transfer function. Enforcement in a future sale contract or frontend would not protect this path. The original tests were all skipped, so they did not detect the violation.

## 3. How we fixed it

`AssetToken._update` now checks the actual holder and recipient against per-token eligibility before calling OpenZeppelin accounting. The initial mint exempts the zero sender only; the issuer is whitelisted before minting. AccessControl protects `setWhitelisted`. Revocation preserves balances and allowances but blocks movement in both directions. Standard allowance and accounting logic remains inherited from OpenZeppelin.

The later user requirements explicitly allow revoking an existing holder, superseding the historical no-balance revocation rule. No factory, sale or frontend implementation is included. The broader AUD-001 remains open for those later phases.

## 4. Evidence the fix works

- Regression: `test/AssetToken.regression.test.ts`, “rejects a transfer to an unapproved investor without changing balances”.
- Command for both runs: `npx hardhat test mocha --no-compile test/AssetToken.regression.test.ts` (against the corresponding compiled token).
- Before: [`before.log`](../evidence/phase2/before.log), **0 passing / 1 failing**, “Expected transaction to be reverted”. This is a behavior failure, not a missing ABI method.
- After: [`regression-after.log`](../evidence/phase2/regression-after.log), **1 passing / 0 failing**; unchanged balances and supply are asserted after the rejected transfer.
- Original source: [`AssetToken.before.sol`](../evidence/phase2/AssetToken.before.sol).
- Initial test setup error: [`test-harness-initial-error.log`](../evidence/phase2/test-harness-initial-error.log), superseded by the corrected before/after runs above.
- Complete Phase 2 coverage and full-suite outcomes: [`phase2-implementation.md`](../phase2-implementation.md).
- Slither/testnet: not run; not claimed. The existing Foundry-based evidence runner was not used for this Hardhat change. Logs and source snapshots replace commit-based evidence because the user explicitly requested no commits.
