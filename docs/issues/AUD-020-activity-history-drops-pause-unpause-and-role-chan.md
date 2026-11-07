# AUD-020: Activity history drops pause, unpause and role-change events

| Field | Value |
|---|---|
| Status | fixed |
| Severity | low |
| Category | frontend |
| Found by (method) | AI review: reading the frontend's contract wiring before the frontend redesign |
| Found by (person) | Claude Code (claude-opus-5-5), session 4c2425b5 (frontend redesign). Not an independent review |
| Location | `frontend/src/services/history.ts` event `switch` (no `Paused`, `Unpaused`, `RoleGranted` or `RoleRevoked` case), at 0b1249e (`main`) |
| AI session that produced the code | History: [Phase 4 summary](../ai-logs/phase4-session.md) (Codex). The `"*"` token query and the `ForcedTransfer` case: AUD-013 fix (7da8dda), session 069871d2 |
| Baseline commit | 714366d (`ai-baseline-d5`); history code from f943f9c (`ai-baseline-phase4`) |
| Regression test commit | 538a483 |
| Fix commit | 3f7e0c4 |

> Numbering: raised as AUD-017 on the unmerged `frontend-redesign` branch, renumbered AUD-020 before merging, because main had already published AUD-017 for another issue. Its commits, `docs/evidence/aud-017/` and the `AUD-017-before/after` evidence runs keep the provisional number.

## What is wrong

Since the AUD-013 fix, the history service reads every token event with one `"*"` query per block range. Its `switch` then turns each event into a row. Events with no `case` are skipped without a trace:

```ts
switch (event.eventName) {
  case "Transfer": ...
  case "ForcedTransfer": ...
  // no Paused, Unpaused, RoleGranted, RoleRevoked
}
```

So these four events never appeared in the activity table:
- `Paused(account)` and `Unpaused(account)`: from D5's `pause()` / `unpause()`.
- `RoleGranted` and `RoleRevoked`: from AccessControl. The Phase 4 UI itself emits `RoleGranted` through "Restore my compliance role".

## 1. Why the AI made the mistake

What the code and documents show:
- AUD-013's fix added a case for `ForcedTransfer` only. D5 added three events to `AssetToken`'s ABI: `ForcedTransfer`, plus `Paused` and `Unpaused` inherited from OpenZeppelin `Pausable`. Only the event declared in `AssetToken.sol` itself was handled.
- `docs/d5-implementation.md` says the review covered "every frontend consumer of the token's ABI and events". Its findings mention forced transfers in history but not pause events.
- The AUD-013 CLAUDE.md rule says "find each frontend or script that reads that contract's events, and test that it labels the new operation correctly". The regression test written for it covers `ForcedTransfer` only.

Hypothesis: the inherited `Paused` and `Unpaused` events do not appear anywhere in `AssetToken.sol`, so a review that reads the contract source, rather than the compiled ABI, does not see them.

## 2. Why it is a problem

The activity table is the only place in the UI where a user can see what happened to an asset.
1. The issuer pauses CPT. Investors' transfers start failing.
2. Neither the issuer's nor the investor's activity log shows the pause, or who did it.
3. If the issuer grants `COMPLIANCE_ROLE` to an agent, or revokes it, the log does not show that either.

Spec-v1 §1 claims a publicly auditable record of how the share register is controlled. Hiding who paused transfers, and who holds compliance authority, undermines that claim. No funds or on-chain state are affected.

## 3. How we fixed it

3f7e0c4:
- Adds `Paused` and `Unpaused` rows, with the admin who acted as `from`.
- Adds "Role granted" and "Role revoked" rows, with the sender as `from` and the grantee as `to`. The role is named ("Token admin" / "Compliance agent") in a new optional `Activity.detail` field.
- The investor (account) view filter is unchanged.

New CLAUDE.md rule: see the AUD-020 entry under "Rules learned from audit findings".

## 4. Evidence the fix works

- Regression test: `frontend/src/test/history.test.ts` :: `labels pause, unpause and role changes instead of dropping them`.
- Before: `docs/evidence/aud-017/frontend-test-before.log` (1 failed / 5 passed: `expected [] to have a length of 1`). Contract suite at the test commit: `docs/evidence/runs/20261107T065504Z_538a483-dirty_AUD-017-before/`.
- After: `docs/evidence/aud-017/frontend-tests-after.log` (124 passed). Contract suite: `docs/evidence/runs/20261107T065636Z_3f7e0c4-dirty_AUD-017-after/`.
- Runs are `-dirty` for the same unrelated working-tree files as AUD-016.
