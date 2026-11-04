# AUD-013: Transaction history shows a forced transfer as an ordinary transfer sent by the holder

| Field | Value |
|---|---|
| Status | fixed |
| Severity | low |
| Category | frontend |
| Found by (method) | manual review of the D5 branch against the Phase 4 frontend (`frontend/src/services/history.ts`) |
| Found by (person) | Claude Code (claude-opus-5-5), session 069871d2, the same session that generated D5. Not an independent review |
| Location | `frontend/src/services/history.ts:42` (Transfer-only token query) and its event switch, at 71113cc (D5 branch, after `ai-baseline-d5`) |
| AI session that produced the code | History: [Phase 4 summary](../ai-logs/phase4-session.md) (Codex). `ForcedTransfer` event: D5, session 069871d2 |
| Baseline commit | 714366d (`ai-baseline-d5`); history code from f943f9c (`ai-baseline-phase4`) |
| Regression test commit | 5bdeded |
| Fix commit | 7da8dda |

## What is wrong

D5's `forcedTransfer` emits two events in one transaction: OpenZeppelin's `Transfer(from, to, amount)` and `ForcedTransfer(from, to, amount)`. The Phase 4 history service queried the token only for `Transfer`, plus `WhitelistUpdated` in admin views:

```ts
logs(token, token.filters.Transfer(), from, to),
```

As a result, every forced transfer appeared as type "Transfer" with `from` set to the holder. To the holder, the recipient and the admin, an issuer confiscation looked like a transfer the holder chose to make. Phase 4 §8.4 requires each history row to show its "Transaction type". It also requires that one operation emitting two events (there, a purchase) is not shown twice.

## 1. Why the AI made the mistake

What the code shows:
- The Phase 4 history code was correct for the contracts it was written against. When f943f9c was made, `AssetToken` had no forced-transfer path, and `docs/phase4-implementation.md` says "No pause/freeze … capability is invented".
- The D5 session added a new event to `AssetToken` and regenerated the frontend ABI. It then ran the frontend suite, which passed, and did not check which frontend code consumes token events. Every existing history test mocks only `Transfer`, so no test could notice a new event type.

Hypothesis: when a contract change only adds code, it looks safe for existing consumers because nothing they call has changed. But code that reads events or logs still changes its meaning when a new operation reuses an existing event, as `forcedTransfer` reuses `Transfer`.

## 2. Why it is a problem

The activity feed is the investor's record of what happened to their holding. After a lost-key or compliance recovery, the investor's own history would claim they sent the tokens. The issuer's view would also hide that an override power was used. This misstates both who acted and why, which undermines the transparency claim in spec-v1 §1 ("trusted issuer, transparent ledger"). No funds or on-chain state are affected.

## 3. How we fixed it

7da8dda:
- Reads all token events with one `"*"` query per block range, as the sale contract is already read. This keeps a single token request per range, which the existing outage test (`surfaces an RPC outage…`) requires.
- Maps `ForcedTransfer` to a "Forced transfer" row.
- Drops the paired `Transfer` row with the same hash, from, to and amount, the same way a purchase's `Transfer` is already dropped.
- Includes "Forced transfer" in the investor (account) view.

Also, 532abab adds a forced-transfer and pause step to the local integration lifecycle, so the fix is checked against real logs decoded by ethers and not only against mocks.

New CLAUDE.md rule: see the AUD-013 entry under "Rules learned from audit findings".

## 4. Evidence the fix works

- Regression test: `frontend/src/test/history.test.ts` :: `shows a forced transfer once, typed as forced, to the holder, the recipient and the admin view`.
- Before: `docs/evidence/aud-013/history-test-before.log` (1 failed / 4 passed: `expected { …(10) } to match object { type: 'Forced transfer', … }`). Contract suite at the test commit: `docs/evidence/runs/20261104T060403Z_5bdeded-dirty_AUD-013-before/` (129 passing; the regression is in the frontend suite, which `evidence.sh` does not run).
- After: `docs/evidence/aud-013/frontend-tests-after.log` (113 passed). `docs/evidence/aud-013/integration-after.log`: the real-node lifecycle passes, with one "Forced transfer" row, no duplicate "Transfer", and a paused token rejecting a transfer. Contract suite: `docs/evidence/runs/20261104T060834Z_f1c1534-dirty_AUD-013-after/test.log` (131 passing, including the role-path tests added in review).
- Observed while producing this evidence: the first integration run failed because `evidence.sh`'s coverage step leaves instrumented artifacts (factory 31 817 bytes, above EIP-170) that the integration test deploys directly. It passed after `npx hardhat compile --force`. This is a pre-existing tooling interaction, not part of this defect. It is logged as a follow-up in `docs/d5-implementation.md`.
