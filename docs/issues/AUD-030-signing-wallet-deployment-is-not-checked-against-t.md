# AUD-030 / SEC-013: Signing wallet deployment is not checked against the public RPC

Numbering: commit c7cb0d1 (origin/phase-6) files this issue as AUD-016. It was renumbered AUD-030 on main on 7 November 2026, because AUD-016 and AUD-017 are used on `frontend-redesign` and AUD-018 to AUD-029 are left for the independent review pass. The raw logs under `docs/audit/logs/`, `docs/audit/source-manifest.json` and `docs/ai-logs/phase6-session.md` keep the original number. Later the same day, origin/main published its own AUD-016 to AUD-018 (subscription and compliance work). AUD-030 is distinct from all of them. See `docs/issues/INDEX.md`.

After that merge (c263253), origin/main had added a narrower wallet-side check of its own, for regulated deployments only. Both checks are kept: Phase 6's `ready(provider)` validation and recheck run for every signer, after origin/main's requirement that a regulated deployment carry a `runtimeCodeHash`. On the merged tree, `signingDeployment.security.test.ts` passes within 144 frontend tests.

Status: fixed (c7cb0d1); severity: medium; category: frontend transaction correctness. Found by Codex during Phase 6 source review and failing regression. Baseline: `0b1249e`. No commits requested or made.

## 1. Why AI made the mistake

The Phase 4 service validates the factory bytecode and deployment block through its public JsonRpcProvider, while signer() separately checks only the wallet chain ID and selected account. The code is AI-assisted according to the Phase 4 session summary; that summary does not preserve the author's exact reasoning. Hypothesis: the implementation treated equal chain IDs as sufficient evidence that both providers reference the same deployment.

## 2. Why it is problematic

Two local RPCs can both use chain 31337 and deterministic factory addresses while containing different contracts or blockchain sessions. The user could see eligibility/inventory from one node and sign on another. Depending on the destination, the transaction may revert or send value to an unintended contract/address. No real funds were lost in this audit; the mismatch is reproduced with a controlled EIP-1193 provider. A malicious provider can still lie about all returned data.

## 3. How the issue was fixed

`Blockchain.ready` accepts either read or browser provider and applies the same chain/code/deployment-block checks. `signer` validates the BrowserProvider before obtaining a signer and then rechecks the wallet's chain and first account. No contracts or financial rules changed. The test fixture returns a valid JSON-RPC block when validation requests it.

## 4. Evidence that the fix works

`frontend/src/test/signingDeployment.security.test.ts`: three negative cases (missing code, different code, different deployment block despite equal chain ID) and one matching-deployment success case. Before: `docs/audit/logs/SEC-013-before.log`, 4 failing; the three negative cases resolved instead of rejecting, while the positive case proved the expected code request was absent. After: `SEC-013-after.log`, full frontend suite 122 passing. Final real-chain integration (`final-integration.log`) passes with actual wallet-side deployment reads. Final build passes.

The issue script created this record. The user's explicit no-commit instruction supersedes the repository's two-commit evidence convention. Raw targeted before/after logs, baseline revision and the final source manifest replace that convention here; no separate evidence.sh run is claimed.

### Workflow deviation and after-the-fact evidence (7 November 2026)

The Codex session made no commits. adityamd later committed its working tree as the single commit c7cb0d1 ("initial commit", no CLAUDE.md prefix). There is no separate `test(AUD-NNN)` commit and no `fix(AUD-NNN)` commit, and that history is published, so it stays as it is. All 99 hashes in `docs/audit/source-manifest.json` match c7cb0d1, so the commit is the working tree Codex recorded.

A different session, Claude Code f349e0d7 (claude-opus-5-5), made the missing runs afterwards from worktrees, without changing history. It is an AI reviewing another AI tool's work, not a human review.

- Before: `docs/evidence/runs/20261107T074535Z_c7cb0d1-dirty_AUD-030-before/` is c7cb0d1 with 0b1249e's `frontend/src/services/blockchain.ts`. The root suite shows 153 passing. That is expected: `evidence.sh` runs only the root Hardhat suite, and this defect is frontend-only. The frontend suite at the same state, `docs/evidence/aud-030/frontend-tests-before.log`, shows **4 failed / 118 passed**. The 4 are exactly this issue's regressions. Three fail with "promise resolved `JsonRpcSigner` instead of rejecting"; the positive case fails because `eth_getCode` was never requested. These are behavioural failures.
- After: `docs/evidence/runs/20261107T074758Z_c7cb0d1_AUD-030-after/` is clean c7cb0d1, all steps exit 0. `docs/evidence/aud-030/frontend-tests-after.log` shows **122 passed**. `integration-after.log` shows the real-chain lifecycle passing on a fresh node.
- Mutations (AUD-005 rule), in `docs/evidence/aud-030/mutation-*.log`:
  - M1, removing `await this.ready(provider)`: 4 tests fail.
  - M2, `ready()` reading through `this.provider` and ignoring its parameter: 4 fail.
  - M3, taking only the block hash from the public RPC: 2 fail.
  - M4, deleting the chain/account recheck that runs after `ready(provider)`: **0 fail**.
- Not tested: the post-validation recheck of `eth_chainId` and `eth_accounts`, the M4 result above. It is implemented, but no test fails without it.
- Not tested: a real MetaMask wallet on Sepolia or localhost. The AUD-002 rehearsal (7c73461) ran at 0b1249e, before this change. The signing path now also sends `eth_chainId`, `eth_getCode` and `eth_getBlockByNumber(deployBlock)` through the wallet's RPC. See `docs/phase6-verification.md` for the expected effects.
