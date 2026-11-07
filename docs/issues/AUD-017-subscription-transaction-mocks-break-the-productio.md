# AUD-017: Subscription transaction mocks break the production type check

| Field | Value |
|---|---|
| Status | fixed in working tree; no commit requested |
| Severity | low |
| Category | frontend build / test infrastructure |
| Found by | Codex baseline production build, 7 November 2026 |
| Location | frontend/src/test/fixtures.ts and subscription.test.tsx; baseline d9ff2f5 |
| Evidence | docs/evidence/compliance/AUD-017-before.log and AUD-017-after.log |

## 1. Why the AI made the mistake

The existing fixture returned a partial object with `hash` and mocked `wait`. Subscription service methods explicitly returned `Promise<TransactionResponse>`, so Vitest spies required the full response type. Runtime tests passed, but the production TypeScript check included test files and rejected this mismatch. This is observable code behavior; the original model's internal reasoning is unknown. A prior documentation claim of successful build does not override the reproduced failure in this checkout.

## 2. Why it is a problem

`npm --prefix frontend run build` failed with six TS2345 diagnostics despite 131 passing runtime tests. This blocked production output, not on-chain funds. The existing build itself is the regression check; it failed before correction.

## 3. How we fixed it

Explicitly typed the deliberately partial transaction fixture as a test double for `TransactionResponse`, retaining its precise mock `wait` type. The cast is confined to the fixture; production service types and runtime receipt handling were not weakened. No dependencies or TypeScript exclusions were added. Per the user's instruction, no commits were made.

## 4. Evidence the fix works

- [Before](../evidence/compliance/AUD-017-before.log): actual production build fails on subscription transaction mocks.
- [After](../evidence/compliance/AUD-017-after.log): TypeScript and Vite production build pass.
- [Expanded frontend suite](../evidence/compliance/frontend-tests.log): 140 tests pass.
- No Slither or testnet evidence is relevant to this typing defect. Evidence is retained directly rather than claiming nonexistent regression/fix commits.
