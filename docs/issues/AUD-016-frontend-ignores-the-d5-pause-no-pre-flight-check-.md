# AUD-016: Frontend ignores the D5 pause: no pre-flight check and a raw EnforcedPause error

| Field | Value |
|---|---|
| Status | fixed |
| Severity | low |
| Category | frontend |
| Found by (method) | AI review: reading the frontend's contract wiring before the frontend redesign |
| Found by (person) | Claude Code (claude-opus-5-5), session 4c2425b5 (frontend redesign). Not an independent review: the same model family wrote D5 |
| Location | `frontend/src/services/blockchain.ts` `asset()`, `buy()`, `transfer()`, `deposit()`, `manageSale()` and `frontend/src/utils/errors.ts` message map, at 0b1249e (`main`) |
| AI session that produced the code | Pre-flight checks and error map: [Phase 4 summary](../ai-logs/phase4-session.md) (Codex). Pause: D5, session 069871d2 |
| Baseline commit | 714366d (`ai-baseline-d5`); frontend code from f943f9c (`ai-baseline-phase4`) |
| Regression test commit | 8d4cca5 |
| Fix commit | fd74329 |

## What is wrong

D5 added `pause()` to `AssetToken`. While paused, `transfer`, `allocate`, `buyTokens` and `recoverUnsoldTokens` revert with OpenZeppelin's `EnforcedPause` (spec-v1 §5 D5 functions, invariant 5). The frontend never read `paused()`:

- `Blockchain.asset()` read only the sale state, so no page could show that a token was paused.
- `buy`, `transfer`, `deposit` and `manageSale("recoverUnsoldTokens")` ran their pre-flight checks and then called the contract. The revert came back from gas estimation.
- `errors.ts` had no entry for `EnforcedPause`, so the user saw the fallback:

```ts
messages[parsed.name] || `Contract rejected the request: ${parsed.name}.`
// -> "Contract rejected the request: EnforcedPause."
```

## 1. Why the AI made the mistake

What the code and documents show:
- The Phase 4 frontend was written before pause existed. `docs/phase4-implementation.md` says no pause capability is invented, so its pre-flight checks were complete for the contracts at the time.
- The D5 session saw the gap and decided not to fix it. `docs/d5-implementation.md` lists under review findings: "Paused-token errors are generic. The frontend shows 'Contract rejected the request: EnforcedPause.' … The UI has no pause or forced-transfer controls, and spec-v1 §7 does not require any." This was recorded as a note in the implementation summary, not raised as an AUD issue.
- The D5 integration step (532abab) pauses CPT and then calls `api.token(cpt, signer).transfer(...)` directly on the contract. It checks that the contract reverts, but it never goes through `Blockchain.transfer`, the code path that has the pre-flight checks. So no test exercised the frontend's handling of a paused token.

Hypothesis: the reviewer read "the UI has no pause controls" as "the UI is not affected by pause". But pause changes the outcome of four actions the UI already offers, even though the UI cannot trigger a pause itself.

## 2. Why it is a problem

No funds are at risk, because the contract reverts. The failure is in what the user is told:
1. The issuer pauses CPT, for example during a compliance incident.
2. An investor opens CPT. Nothing on the page says the token is paused, and the purchase and transfer buttons are enabled.
3. The investor submits. The wallet's gas estimate reverts, and the UI shows "Contract rejected the request: EnforcedPause.", an internal error name rather than an explanation.

The issuer sees the same message on deposit and on unsold-token recovery. Spec-v1 §1's claim of transparent, code-enforced rules fails if the interface hides which rule is in force.

## 3. How we fixed it

fd74329:
- `Asset` gains `paused`, read from `AssetToken.paused()` alongside the sale state.
- `buy`, `transfer`, `deposit` and `manageSale("recoverUnsoldTokens")` reject before signing with "This asset is paused by its issuer. No tokens can move until it is unpaused." `closeSale`, `withdrawProceeds` and `sweepExcessETH` move no tokens and stay available.
- `EnforcedPause` and `ExpectedPause` are mapped to plain-English messages.

The redesigned frontend (branch `frontend-redesign`) also shows the paused state on the fund factsheet and disables each affected action, with the reason shown next to it.

New CLAUDE.md rule: see the AUD-016 entry under "Rules learned from audit findings".

## 4. Evidence the fix works

- Regression tests: `frontend/src/test/pause.regression.test.ts`, 5 cases: purchase, transfer, deposit and recovery are blocked before signing, and `EnforcedPause` is decoded.
- Before: `docs/evidence/aud-016/frontend-test-before.log` (5 failed of 5: each contract method was called, and the message was `"Contract rejected the request: EnforcedPause."`). Contract suite at the test commit: `docs/evidence/runs/20261107T064849Z_8d4cca5-dirty_AUD-016-before/`. The regression is in the frontend suite, which `evidence.sh` does not run (as in AUD-013).
- After: `docs/evidence/aud-016/frontend-tests-after.log` (123 passed). Contract suite: `docs/evidence/runs/20261107T065217Z_fd74329-dirty_AUD-016-after/`.
- Both runs are marked `-dirty` because of unrelated uncommitted files in the working tree: the regenerated `addresses.json` and ABIs, and AI transcripts. No frontend or contract source was uncommitted.
