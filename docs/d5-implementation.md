# D5 implementation and review: pause and forced transfer

Date: 3–4 November 2026. Tool: Claude Code (claude-opus-5-5), session 069871d2, directed by Chordia Laksh. The transcript is archived by the hook under `docs/ai-logs/raw/`.

## What was decided

D5 was opened on 23 October 2026 and decided on 3 November 2026. Pause and forced transfer are implemented. Freeze is dropped, because whitelist revocation already blocks a holder from sending, receiving and buying. The normative rows are spec-v1 §5 "D5 functions", with invariants 1, 5, 6 and 7 restated. The reasons are in `docs/spec/phase3-requirements.md`, "D5 decision". Claude Code proposed each option, and the user adopted every recommendation.

## What was built (tag `ai-baseline-d5`, 714366d)

| Spec row / invariant | Implementation |
|---|---|
| `pause()` / `unpause()`, caller `DEFAULT_ADMIN_ROLE` | OpenZeppelin `Pausable`. `_update` calls `_requireNotPaused()`, so `transfer`, `transferFrom` and AssetSale's `allocate`, `buyTokens` and `recoverUnsoldTokens` revert with `EnforcedPause` |
| `forcedTransfer(from, to, amount)`, caller `DEFAULT_ADMIN_ROLE` | Reverts with `ForcedTransferFromZeroAddress` (a zero source would mint), `ForcedTransferFromWhitelisted(from)` or `RecipientNotWhitelisted(to)`. Calls ERC20's `_update` directly, which bypasses pause and the sender check. Emits `Transfer` and `ForcedTransfer` |
| Invariants 5, 6, 7 | `test/AssetToken.D5.test.ts` (21 tests after review), including a pairwise sweep of every source and recipient for invariant 6 |

Mutation check (`docs/evidence/d5/mutation.log`): removing the pause check, the zero-source check or the whitelisted-source check, or routing `forcedTransfer` through the overridden `_update`, makes the D5 suite fail. All 4 of 4 mutants were killed.

## Review before merge

This review was done by the same session that wrote the code, so it is **not independent**. Audit-1 had the same limitation. It covered the contract diff against spec-v1 §3 and §5, the CLAUDE.md rules, and every frontend consumer of the token's ABI and events.

| Finding | Outcome |
|---|---|
| AssetFactory runtime is exactly 24 576 bytes (EIP-170 limit) on the unoptimised profile used by `deploy:sepolia` | [AUD-012](issues/AUD-012-assetfactory-is-exactly-at-the-eip-170-size-limit-.md), fixed: the Sepolia deploy uses the `production` profile (13 545 bytes) |
| History shows a forced transfer as an ordinary `Transfer` sent by the holder | [AUD-013](issues/AUD-013-transaction-history-shows-a-forced-transfer-as-an-.md), fixed |
| D5 tests covered granting `DEFAULT_ADMIN_ROLE` but not revoking or renouncing it (CLAUDE.md AUD-006 rule) | Tests added in f1c1534. They pass, so there is no defect |
| Contract logic against the D5 table: caller, preconditions, events and every revert condition | No defect found |

Observations, not changed in this merge:
- **Delegating `DEFAULT_ADMIN_ROLE` now delegates confiscation.** A delegated admin can grant itself `COMPLIANCE_ROLE`, revoke a holder and force-transfer their balance to any whitelisted address. Before D5, the most it could do was block a holder. The frontend never grants this role (it only restores `COMPLIANCE_ROLE` to the connected wallet), but a direct contract call can. The trust model in spec-v1 §1 ("the issuer is trusted") now extends to anyone the issuer makes an admin.
- **Paused-token errors are generic.** The frontend shows "Contract rejected the request: EnforcedPause." because `frontend/src/utils/errors.ts` has no message for it. The UI has no pause or forced-transfer controls, and spec-v1 §7 does not require any.
- **The default profile has 0 bytes of headroom.** AUD-012 fixed the Sepolia path only. Any further growth in `AssetToken`, `AssetSale` or `AssetFactory` makes local deploys and the test suite fail until the optimizer is enabled for `default`. *Resolved after the merge by [AUD-014](issues/AUD-014-default-build-profile-leaves-assetfactory-at-the-e.md) (e1fc698): the factory is now 13 545 bytes.*
- **`evidence.sh` leaves coverage-instrumented artifacts** (factory 31 817 bytes). `npm run test:integration` deploys straight from `artifacts/`, so after an evidence run it fails at factory deployment until `npx hardhat compile --force` is run. This predates D5. *Resolved as a side effect of AUD-014: the instrumented factory is now 19 944 bytes, and the integration test passes straight after an evidence run (`docs/evidence/aud-014/integration-after-evidence-run.log`).*

## Results at merge

- Contracts: 131 passing, line coverage 98.79%. Evidence run: `docs/evidence/runs/20261104T060834Z_f1c1534-dirty_AUD-013-after/`. "-dirty" refers to uncommitted session transcripts and docs only.
- Frontend: 113 tests passed (`docs/evidence/aud-013/frontend-tests-after.log`). The build succeeds.
- Local integration lifecycle against a real Hardhat node: passes, including the new forced-transfer and pause steps (`docs/evidence/aud-013/integration-after.log`).
- Not done: a real Sepolia deployment (AUD-003), and browser or MetaMask checks of the new behaviour.
