# AUD-007: ETH forced into AssetSale is unrecoverable

| Field | Value |
|---|---|
| Status | fixed |
| Severity | low |
| Category | logic |
| Found by (method) | AI review (audit-1 finding F-08, probe P1, simulated with `setBalance`) |
| Found by (person) | Claude Code audit session 7b0eabb6 |
| Location | contracts/AssetSale.sol `withdrawProceeds` / `unclaimedProceeds` at 7fd3e26 |
| AI session that produced the code | Phase 3 session c567bbec, commit e407edf |
| Baseline commit | 7fd3e26 |
| Regression test commit | 947b4b7 |
| Fix commit | 3659cce |

## What is wrong

AssetSale pays out only `unclaimedProceeds` and has no `receive` or `fallback`. ETH can still be forced in by `selfdestruct` or as a coinbase reward. Any such ETH can never leave the contract, and spec-v1 invariant 3 ("ETH held equals paid minus withdrawn") stops holding.

## 1. Why the AI made the mistake

From the transcript: the Phase 3 brief stated invariant 3 as "ETH in AssetSale == tokens sold * priceWei - proceeds withdrawn". The session wrote in `phase3-implementation.md` that because there is no `receive`/`fallback`, "ETH can only arrive through `buyTokens` and invariant 3 holds". The Phase 3 implementation turns never mention `selfdestruct`; it first appears in the audit prompt at 07:46.

Hypothesis: the session treated "no receive function" as equivalent to "cannot receive ETH", which is a known Solidity misconception.

## 2. Why it is a problem

Funds get stuck, though only the forcer's own ETH. Buyer proceeds were never at risk, because the payout uses tracked accounting. The documented invariant was false.

Failure sequence: buy 100 CPT → `ForceSendHarness` self-destructs 1,000 wei into the sale → the issuer withdraws proceeds → 1,000 wei remain, and no call can move them.

## 3. How we fixed it

Decision D7. Fix commit 3659cce:
- **New function:** issuer-only `sweepExcessETH()` sends `address(this).balance − unclaimedProceeds` to the issuer. It reverts with `NoExcessETH` when there is nothing to sweep, and emits `ExcessETHSwept`. Owed proceeds are excluded, so a sweep never pays them out.
- **Invariant 3 restated** in spec-v1 §6: `unclaimedProceeds` = paid − withdrawn, and it is ≤ the balance. The superseded wording is quoted.

New CLAUDE.md rule citing AUD-007.

## 4. Evidence the fix works

- Regression tests: `test/Phase3.regression.test.ts` :: "AUD-007 forced ETH". There are 4 tests, and they use a **real** `selfdestruct` through `contracts/test/ForceSendHarness.sol` rather than the audit's `setBalance` simulation. The first test proves the forced ETH actually arrives; it passes both before and after the fix.
- Before: `docs/evidence/runs/20261023T084218Z_947b4b7_AUD-007-before/test.log`. 104 passing, **3 failing**: "function selector was not recognized". No recovery path exists.
- After: `docs/evidence/runs/20261023T084542Z_3659cce_AUD-007-after/test.log`. **107 passing, 0 failing.**
- Not tested: a sweep that is re-entered by a contract issuer. The invariant 8 harness re-enters `withdrawProceeds`, not `sweepExcessETH`.
