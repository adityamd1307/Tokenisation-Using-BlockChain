# Remediation log

Baseline `0b1249e`, clean tracked tree, 6 November 2026. No production Solidity, dependency versions, economic rules, or compliance exceptions changed.

| Change | Reason | Before / after evidence |
|---|---|---|
| SEC-013 / AUD-030: check signing-provider deployment and recheck account/chain | Same chain ID can identify distinct local chains; public RPC checking alone does not bind signing | `SEC-013-before.log`: 4 regression failures; `SEC-013-after.log`: 122 frontend passes; final integration/build pass |
| Sidebar uses configured network and “ACADEMIC DEMO” | Hardcoded LOCAL DEVELOPMENT / PHASE 04 mislabels a Sepolia configuration | Source diff; frontend build and suite pass. No new visual screenshot claim |
| Add 11 contract security tests and isolated callback helper | Boundary arithmetic, outsider matrix, cross-function callbacks, recovery, two-issuer state sequences | `security-tests.log`, `final-retry-security-tests.log`: 11 passes; full suite 153 |
| Extend real-chain frontend integration to the exact CPT two-buyer flow | Previous scenario bought 100 only | `final-integration.log`: pass; 80/70/9850/0 final balances |
| Add local audit demo with hashes/logs/state assertions | Reproducible Phase 6 evidence independent of browser | `final-retry-demo.log`: 31 checks, 18 receipts, 3 expected reverts; `final-demo.json` |
| Documentation and evidence indexing | Actual current behavior, findings, prompt provenance and remaining gates | Eight-section AI report, final technical/demo/deployment guides, changed-file manifest |

Two new audit-code errors were detected and corrected: the callback test's generic string function name did not satisfy generated TypeChain overloads (root typecheck exit 1); the demo assumed ethers always attached a decoded `revert.name` and needed ABI decoding of raw revert data (demo exit 1). Original logs are `final-typecheck.log` and `final-demo.log`; retry logs show success. These were audit-harness issues, not vulnerabilities in production contracts. No failures were deleted or counted as passes.

Slither setup retries are recorded in slither-summary.md. Sandbox compiler-cache locking was an environment blocker, resolved with access to the existing cache; no compiler replacement. Existing AUD-004–015 fixes are historical and were revalidated, not reimplemented. No Phase 6 gas savings are claimed.

Final recheck after interruption: the local RPC was no longer listening, causing an ECONNREFUSED integration attempt. Restarting the local node restores the required test prerequisite; separate submission retry logs preserve the rerun. No contract/client correction was required.
