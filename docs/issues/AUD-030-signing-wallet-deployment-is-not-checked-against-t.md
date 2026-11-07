# AUD-030 / SEC-013: Signing wallet deployment is not checked against the public RPC

Numbering: commit c7cb0d1 (origin/phase-6) files this issue as AUD-016. It was renumbered AUD-030 on main on 7 November 2026, because AUD-016 and AUD-017 are used on `frontend-redesign` and AUD-018 to AUD-029 are left for the independent review pass. The raw logs under `docs/audit/logs/`, `docs/audit/source-manifest.json` and `docs/ai-logs/phase6-session.md` keep the original number. See `docs/issues/INDEX.md`.

Status: fixed in the working tree; severity: medium; category: frontend transaction correctness. Found by Codex during Phase 6 source review and failing regression. Baseline: `0b1249e`. No commits requested or made.

## 1. Why AI made the mistake

The Phase 4 service validates the factory bytecode and deployment block through its public JsonRpcProvider, while signer() separately checks only the wallet chain ID and selected account. The code is AI-assisted according to the Phase 4 session summary; that summary does not preserve the author's exact reasoning. Hypothesis: the implementation treated equal chain IDs as sufficient evidence that both providers reference the same deployment.

## 2. Why it is problematic

Two local RPCs can both use chain 31337 and deterministic factory addresses while containing different contracts or blockchain sessions. The user could see eligibility/inventory from one node and sign on another. Depending on the destination, the transaction may revert or send value to an unintended contract/address. No real funds were lost in this audit; the mismatch is reproduced with a controlled EIP-1193 provider. A malicious provider can still lie about all returned data.

## 3. How the issue was fixed

`Blockchain.ready` accepts either read or browser provider and applies the same chain/code/deployment-block checks. `signer` validates the BrowserProvider before obtaining a signer and then rechecks the wallet's chain and first account. No contracts or financial rules changed. The test fixture returns a valid JSON-RPC block when validation requests it.

## 4. Evidence that the fix works

`frontend/src/test/signingDeployment.security.test.ts`: three negative cases (missing code, different code, different deployment block despite equal chain ID) and one matching-deployment success case. Before: `docs/audit/logs/SEC-013-before.log`, 4 failing; the three negative cases resolved instead of rejecting, while the positive case proved the expected code request was absent. After: `SEC-013-after.log`, full frontend suite 122 passing. Final real-chain integration (`final-integration.log`) passes with actual wallet-side deployment reads. Final build passes.

The issue script created this record. The user's explicit no-commit instruction supersedes the repository's two-commit evidence convention. Raw targeted before/after logs, baseline revision and the final source manifest replace that convention here; no separate evidence.sh run is claimed.
