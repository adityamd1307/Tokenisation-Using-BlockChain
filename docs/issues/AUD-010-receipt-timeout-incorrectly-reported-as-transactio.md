# AUD-010: Receipt timeout incorrectly reported as transaction failure

| Field | Value |
|---|---|
| Status | corrected in working tree; targeted before/after regression recorded |
| Severity | medium |
| Category | frontend / transaction correctness |
| Found by | Codex, source review followed by a failing component regression |
| Location | `frontend/src/services/transactions.ts`, `context/TransactionContext.tsx`, `components/TransactionStatus.tsx` |
| AI session | [Phase 4 summary](../ai-logs/phase4-session.md) |
| Baseline / regression / fix commit | None; user explicitly prohibited commits |

## What is wrong

The first receipt implementation bounded `tx.wait(1, 120000)`, but all wait errors flowed into the transaction context's generic failed state. A TIMEOUT after a hash had been returned could therefore display “Failed or reverted” and re-enable another purchase, even though the first transaction might still mine.

## 1. Why the AI made the mistake

The initial generated code distinguished user rejection from general errors but did not distinguish failed transactions from inability to observe a receipt. A targeted test mocked a returned hash followed by TIMEOUT and reproduced the incorrect state. No claim is made that an actual duplicate purchase occurred.

## 2. Why it is a problem

A user could interpret the first transaction as failed and submit again while it remains pending. If both later mine, both purchases execute. A missing receipt cannot establish a revert, just as a transaction hash cannot establish success.

## 3. How we corrected it

Non-revert receipt errors are tagged as confirmation unknown. The context preserves the hash, displays “Confirmation not yet verified”, keeps write controls disabled and provides Check confirmation. The explicit recheck reads the actual receipt: null stays unknown, status 0 fails, status 1 confirms and refreshes. Successful repricing is accepted; cancelled/changed replacements are not accepted as the original operation's success. Session identity still protects against late results after wallet changes.

## 4. Evidence

- Regression: `frontend/src/test/ui.test.tsx` → `keeps a timed-out submitted transaction unconfirmed and checks its receipt before allowing another purchase`.
- Before: [receipt-timeout-before.log](../evidence/phase4/receipt-timeout-before.log), failing expectation for the unknown-confirmation state.
- After: [frontend-tests.log](../evidence/phase4/frontend-tests.log), regression passes along with the full frontend suite.
- The test asserts that another purchase remains disabled and that success appears only after `getTransactionReceipt` returns status 1 for the submitted hash.
- Separate service tests cover status-0 receipts, successful repricing and cancelled replacements.
- No real funds, testnet deployment, commits or claimed browser signing evidence were involved.
