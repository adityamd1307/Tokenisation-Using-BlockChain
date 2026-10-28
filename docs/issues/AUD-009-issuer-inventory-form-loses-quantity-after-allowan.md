# AUD-009: Issuer inventory form loses quantity after allowance confirmation

| Field | Value |
|---|---|
| Status | corrected in working tree; targeted before/after regression recorded |
| Severity | low |
| Category | frontend / state lifecycle |
| Found by | Codex, React component behavior test |
| Location | `frontend/src/hooks/useAsync.ts`, `context/DataContext.tsx`, `pages/IssuerDashboard.tsx` |
| AI session | [Phase 4 summary](../ai-logs/phase4-session.md) |
| Baseline / regression / fix commit | None; user explicitly prohibited commits |

## What is wrong

The initial Phase 4 version replaced the entire issuer management component with a loading state whenever a confirmed transaction refreshed the public registry. The selected manager unmounted, losing its local `amount` state. After confirming a 5,000-token approval, the deposit input became empty and the deposit button remained disabled until the user re-entered the quantity.

## 1. Why the AI made the mistake

The generated code used one clearing strategy for both public registry refreshes and private account changes. `useAssets` dropped its previous array on every revision, and `IssuerDashboard` rendered only Loading while it refetched. The failing test demonstrates the lifecycle effect. No claim about the model's hidden reasoning is made.

## 2. Why it is a problem

Approval and deposit are separate transactions. Erasing the user's quantity in between makes the primary funding workflow appear stuck even after allowance is sufficient. It does not lose tokens or bypass contract permissions, but makes the intended two-step UI unreliable.

## 3. How we corrected it

`useAsync` can retain prior data only when explicitly enabled. Only the public registry enables this behavior. The issuer manager stays mounted while that registry refreshes, preserving quantity, while account-specific balance/allowance reads still refresh and account/chain changes immediately invalidate all dependent state. Writes always preflight fresh blockchain state.

## 4. Evidence

- Regression: `frontend/src/test/issuer.test.tsx` → `performs separate approval and deposit transactions and refreshes allowance`.
- Before: [frontend-tests-third.log](../evidence/phase4/frontend-tests-third.log), 102 pass / 1 fails because Deposit Tokens remains disabled after successful approval.
- After: [frontend-tests-after-refresh-fix.log](../evidence/phase4/frontend-tests-after-refresh-fix.log), 103 pass; final [frontend-tests.log](../evidence/phase4/frontend-tests.log) also includes this regression.
- The test confirms the approval does not automatically deposit, the deposit becomes enabled after receipt/allowance refresh, and the subsequent explicit deposit uses the original `5000` input.
- No commits, testnet transactions or project-wide evidence-script runs were made; the user's no-commit instruction was followed with actual targeted command logs.
