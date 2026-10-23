# AUD-006: Issuer can renounce or lose the admin role, permanently locking sale inventory

| Field | Value |
|---|---|
| Status | fixed |
| Severity | medium |
| Category | access control |
| Found by (method) | AI review (audit-1 finding F-05, probes P3 and P4) |
| Found by (person) | Claude Code audit session 7b0eabb6 |
| Location | contracts/AssetToken.sol (inherited AccessControl `renounceRole` / `revokeRole`); contracts/AssetSale.sol `recoverUnsoldTokens`, at 7fd3e26 |
| AI session that produced the code | AssetToken roles: Phase 2 Codex session (`docs/ai-logs/phase2-session.md`, not verbatim). AssetSale custody and the incorrect recovery claim: Phase 3 session c567bbec (commits e407edf, 7fd3e26) |
| Baseline commit | 7fd3e26 |
| Regression test commit | a075ff0 |
| Fix commit | 12f8cd2 |

## What is wrong

`issuer` is immutable in AssetToken and AssetSale, but the roles it is meant to represent are not:
- **Renounced:** the issuer can renounce `DEFAULT_ADMIN_ROLE`.
- **Revoked:** any other holder of that role can revoke it from the issuer.

Once the issuer has no admin role and no compliance role, nobody may re-whitelist the sale contract or the issuer. A closed sale's inventory then cannot be recovered by anyone.

## 1. Why the AI made the mistake

From the record:
- The Phase 2 implementation notes already said "The issuer can delegate or renounce roles. Losing every default administrator prevents future role grants" (`phase2-implementation.md`, security considerations). So the token-level risk was documented, not overlooked.
- The Phase 3 session then added a contract that holds inventory and depends on whitelisting, and wrote in `phase3-implementation.md` that de-whitelisting "can be undone by the issuer, who holds `COMPLIANCE_ROLE`".
- The Phase 3 transcript contains no mention of `renounce` before the audit prompt (07:46), and no test exercised any role-removal path.

Hypothesis: the session reasoned about roles as they stood at deployment, without considering that they change afterwards.

## 2. Why it is a problem

- **Stuck tokens (probe P4):** the issuer de-whitelists the sale, renounces both roles and closes the sale. 5,000 tokens are then permanently stuck.
- **Misrepresented authority (probe P3):** after a role hand-over, `token.issuer()` and `sale.issuer()` name an address with no compliance power. The frontend and investors would trust a stale field.

## 3. How we fixed it

Decision D6 (`docs/spec/phase3-requirements.md`). The user narrowed this from "lock both roles" after the conflict with a Phase 2 test was raised.

Fix commit 12f8cd2: `AssetToken._revokeRole` reverts with `IssuerAdminRoleLocked` when anyone tries to remove `DEFAULT_ADMIN_ROLE` from `issuer`. Both `revokeRole` and `renounceRole` route through `_revokeRole`.
- `COMPLIANCE_ROLE` stays delegable and revocable. The issuer can always grant it back, so lock-up is no longer possible.
- The Phase 2 test at `AssetToken.test.ts:209` (admin/compliance separation) passes unchanged.
- Other administrators can still renounce their own admin role.
- AssetToken grew by 166 bytes and the factory by 173 bytes, to 22,730 of the 24,576-byte limit.

New CLAUDE.md rule citing AUD-006.

## 4. Evidence the fix works

- Regression tests: `test/Phase3.regression.test.ts` :: "AUD-006 issuer admin role cannot be removed". There are 3 tests, and each one awaits the "must revert" check before checking the error name, so the failure is a behavioural one.
- Before: `docs/evidence/runs/20261023T083250Z_a075ff0_AUD-006-before/test.log`. 100 passing, **3 failing**, all "Expected transaction to be reverted".
- After: `docs/evidence/runs/20261023T083650Z_12f8cd2_AUD-006-after/test.log`. **103 passing, 0 failing.**
- An earlier draft of this test checked only the custom-error name. It failed for a missing ABI entry, and its un-awaited transaction leaked state into the next test. It was rewritten before the test commit. See the Phase 3 transcript.
