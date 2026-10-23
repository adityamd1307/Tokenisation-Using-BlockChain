# AUD-008: Platform admin can authorise itself as an issuer

| Field | Value |
|---|---|
| Status | fixed |
| Severity | low |
| Category | access control / spec gap |
| Found by (method) | AI review (audit-1 finding F-10, probe P7); previously noted in `docs/VERIFICATION.md` |
| Found by (person) | Claude Code audit session 7b0eabb6 |
| Location | contracts/AssetFactory.sol `authorizeIssuer` at 7fd3e26 |
| AI session that produced the code | Phase 3 session c567bbec, commit e407edf |
| Baseline commit | 7fd3e26 |
| Regression test commit | 4ce7928 |
| Fix commit | 118d13b |

## What is wrong

spec-v1 §3 says the platform admin "cannot hold tokens; buy assets". `authorizeIssuer(admin)` succeeded, after which the admin could create an asset and receive its entire supply.

## 1. Why the AI made the mistake

From the code and spec: the Phase 3 session implemented `authorizeIssuer` from the spec-v1 §5 function table, whose "Reverts if" column lists only "caller != admin; addr already authorised". The §3 roles-table restriction is not repeated in §5. The transcript shows no turn that cross-checks §3 against §5.

## 2. Why it is a problem

It violates spec-v1 §3 role separation: one key would hold both platform authority and issuer powers.

This is a **policy** gap, not a security boundary. The admin can always use a second wallet, and the factory cannot stop an issuer from whitelisting the admin as a buyer.

## 3. How we fixed it

Decision D8. Fix commit 118d13b: `authorizeIssuer` reverts with `AdminCannotBeIssuer` when `issuer == admin`. The NatSpec comment states that this is a policy check only.

## 4. Evidence the fix works

- Regression test: `test/Phase3.regression.test.ts` :: "AUD-008 admin cannot be an issuer".
- Before: `docs/evidence/runs/20261023T084815Z_4ce7928-dirty_AUD-008-before/test.log`. 107 passing, **1 failing**, "Expected transaction to be reverted". The run is marked `-dirty` only because the archive hook rewrote the still-open audit session's transcript (`docs/ai-logs/raw/…7b0eabb6….jsonl`) during the run. No contract or test file differed from 4ce7928. The transcript was committed straight afterwards in ee21ee9.
- After: `docs/evidence/runs/20261023T085033Z_118d13b_AUD-008-after/test.log`. **108 passing, 0 failing.**
