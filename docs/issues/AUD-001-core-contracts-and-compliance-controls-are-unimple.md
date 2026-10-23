# AUD-001: Core contracts and compliance controls are unimplemented

| Field | Value |
|---|---|
| Status | open |
| Severity | high |
| Category | logic |
| Found by (method) | manual code review and command execution |
| Found by (person) | Codex |
| Location | contracts/AssetToken.sol:8; contracts/AssetFactory.sol:9; contracts/AssetSale.sol:8, baseline c504215 |
| AI session that produced the code | Unknown; no attribution inferred |
| Baseline commit | c504215 |
| Regression test commit | None |
| Fix commit | None |

## What is wrong

Spec §§4–6 are largely unimplemented. Factory and sale expose only constructor state; authorisation, creation, allocation, buying and withdrawal are absent. AssetToken inherits unrestricted ERC-20 transfers and never enforces whitelist, pause or freeze. An issuer can transfer to any non-whitelisted wallet, violating the whitelist invariant.

## 1. Why the AI made the mistake

The source explicitly labels these areas as future phases. The original generation transcript was not inspected; no causal claim is made.

## 2. Why it is a problem

The application cannot satisfy its frozen specification or support an end-to-end demonstration. A successful compile or zero-exit test command does not establish working behavior.

## 3. How we fixed it

Open; no implementation change made during verification. Required next work: Implement the specified contract functions and compliance checks, then add executable access-control, transfer, sale and invariant tests.

## 4. Evidence the fix works

No fix or regression result is claimed. See `docs/VERIFICATION.md` for observed command results and limitations.

## Phase 2 follow-up — 23 October 2026

The token portion is now implemented under the later Phase 2 requirements, with the transfer bypass verified in AUD-004. This issue remains open because factory and sale functions belong to Phase 3 and remain placeholders. Pause/freeze/forced-transfer features from the historical spec are outside the current Phase 2 scope. See `docs/phase2-implementation.md`.

## Phase 3 follow-up — 23 October 2026

AssetFactory and AssetSale are now implemented under `docs/spec/phase3-requirements.md` (commit e407edf), covering authorisation, creation, registry, allocation, buying, withdrawal and close/recover. `npx hardhat test` reports 99 passing, 0 pending (`docs/evidence/phase3/test-full.log`). This issue remains open only for pause, freeze and forced transfer (spec-v1 §4–6, invariants 5–6), which await a team decision. See `docs/phase3-implementation.md`.
