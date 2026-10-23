# AUD-004: AssetToken does not enforce transfer eligibility

| Field | Value |
|---|---|
| Status | fixed (committed in 4faf156, merged to main by PR #2 e3d0cc4; see "Post-commit correction") |
| Severity | high |
| Category | access control / logic |
| Found by (method) | source review and executed regression test |
| Found by (person) | Codex, at user direction |
| Location | contracts/AssetToken.sol, inherited ERC-20 transfer path |
| AI session that produced the original code | Claude Code Phase 1 setup session e2c8deac (claude-sonnet-4-6). The stub was written at `phase1-setup.txt:1417–1425` and committed as `f09926f ai: contract stubs` |
| Baseline commit | c5042157a38fdd04d56162deefcd67ca49023cd8 |
| Regression test commit | 4faf156, in the same commit as the fix; not committed separately |
| Fix commit | 4faf156 (merged by e3d0cc4) |

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

## Post-commit correction — 23 October 2026 (audit-1 F-02, F-14)

The fields above were written while the fix sat uncommitted. They are now corrected:

- **Workflow deviation.** The CLAUDE.md workflow asks for two separate commits: a failing `test(AUD-004)`, then a `fix(AUD-004)`. Neither exists. The regression test, the fix, the evidence logs, this file and the CLAUDE.md rule all arrived together in `4faf156` ("initial commit", no prefix), merged by PR #2 (`e3d0cc4`). So git history alone cannot show the test failing before the fix. The before/after logs above are the only evidence of that, and they record no commit.
- **Origin of the code.** The Phase 1 transcript shows Claude Code writing the stub with the comment "Full implementation in Phase 2" (`phase1-setup.txt:1425`). The missing transfer hook was a deliberate placeholder, not a mistake the Phase 1 AI made while trying to implement the feature. The finding still matters: the placeholder compiled and its tests were all skipped, so nothing flagged the gap.
- **Full-suite evidence.** Item 7 of the evidence list above points to `phase2-implementation.md`, whose full-suite section was a TBD. It has now been filled from a retroactive run at `4faf156`: 51 passing, 0 failing ([retro-4faf156-full-suite.log](../evidence/phase2/retro-4faf156-full-suite.log)).
