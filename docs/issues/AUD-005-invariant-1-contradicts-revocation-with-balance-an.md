# AUD-005: Invariant 1 contradicts revocation-with-balance and its test cannot detect it

| Field | Value |
|---|---|
| Status | fixed |
| Severity | medium |
| Category | spec gap |
| Found by (method) | AI review (audit-1 finding F-04, probe P2) |
| Found by (person) | Claude Code audit session 7b0eabb6 |
| Location | docs/spec/spec-v1.md §6 invariant 1; test/AssetSale.test.ts "invariants 1 and 2…" at 7fd3e26 |
| AI session that produced the code | Phase 3 session c567bbec (docs/ai-logs/raw/…c567bbec….jsonl), commit 4b09196 |
| Baseline commit | 7fd3e26 |
| Regression test commit | b85271f |
| Fix commit | 0f9ce3f |

## What is wrong

spec-v1 §6 invariant 1 said "every address with a non-zero CPT balance is on the whitelist". Since Phase 2 §2.3, revoking an investor keeps their balance, so that invariant is false by design whenever anyone is revoked. Phase 3 nonetheless added a test titled "invariants 1 and 2: every holder is whitelisted…". The test never revoked anyone, so it checked a weaker property than its name claims.

## 1. Why the AI made the mistake

From the transcript: the Phase 3 brief that the user pasted listed "Invariants to test: 1. Every holder is whitelisted" verbatim. The session wrote a test against that wording. It had also read `phase2-requirements.md` §2.3 (revocation preserves balances) during the same session, but no transcript turn reconciles the two.

Hypothesis: the session treated the invariant list in the brief as authoritative and did not cross-check it against the later revocation rule.

## 2. Why it is a problem

- The report would claim invariant 1 is "tested" while the property is actually false.
- The test could not catch a revocation-related regression.
- A grader comparing spec §6 with Phase 2 behaviour would find the contradiction.

Failure sequence (probe P2): investor buys 10 CPT → the issuer revokes them → `balanceOf = 10` while `isWhitelisted = false`.

## 3. How we fixed it

This is a spec gap, so the fix is a spec change plus an honest test (0f9ce3f):
- **Invariant 1 restated** in spec-v1 §6 as an eligibility-of-movement invariant: every `transfer`, `transferFrom` and purchase has whitelisted endpoints, and a revoked holder keeps its balance but can neither send, receive nor buy. The superseded wording is quoted for audit comparison.
- **Regression test rewritten.** In the test commit (b85271f) the regression asserted the *old* wording through a revocation, to demonstrate the contradiction. The fix rewrites it to assert the restated invariant: the revoked holder cannot send, receive or buy; its balance is unchanged; re-approval restores movement.
- **Misleading test renamed.** The Phase 3 test is now "invariant 2: … holders are eligible absent revocation".
- **New CLAUDE.md rule** citing AUD-005.

## 4. Evidence the fix works

- Regression test: `test/Phase3.regression.test.ts` :: "AUD-005 invariant 1 through a revocation".
- Before: `docs/evidence/runs/20261023T082349Z_b85271f_AUD-005-before/test.log`. 99 passing, **1 failing**: the revoked holder `0x3C44…` holds tokens.
- After: `docs/evidence/runs/20261023T082825Z_0f9ce3f_AUD-005-after/test.log`. **100 passing, 0 failing.**
- Note: the after-run directory was committed together with the AUD-006 before-run (3ba1b26) instead of in its own `evidence:` commit. Its directory name records the commit it ran against.
