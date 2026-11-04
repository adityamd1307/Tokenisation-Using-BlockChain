# AUD-014: Default build profile leaves AssetFactory at the EIP-170 limit so local deploys and tests break on any contract growth

| Field | Value |
|---|---|
| Status | fixed |
| Severity | low |
| Category | other (build configuration / contract size) |
| Found by (method) | follow-up to AUD-012: the limitation recorded there as "Not changed" |
| Found by (person) | Claude Code (claude-opus-5-5), session 069871d2. Fix requested by Chordia Laksh |
| Location | `hardhat.config.ts` `default` profile, at b89f4b6 |
| AI session that produced the code | Profiles: Phase 1 setup session (commit 9884a9b) |
| Baseline commit | b89f4b6 |
| Regression test commit | c97e068 |
| Fix commit | e1fc698 |

## What is wrong

AUD-012 moved only `deploy:sepolia` to the optimised `production` profile. Every other Hardhat build still uses `default`, which has no optimizer settings: `npm test`, `npm run compile`, `deploy:local`, `deploy:ephemeral`, `demo:local` and `frontend:sync`. `npm run test:integration` also deploys straight from those `artifacts/`. On that profile, AssetFactory's runtime bytecode is exactly 24 576 bytes, the EIP-170 limit (`docs/evidence/d5/bytecode-sizes.txt`; `docs/evidence/aud-012/deploy-before.log`).

## 1. Why the AI made the mistake

What the code and transcript show:
- The Phase 1 session created an unoptimised `default` profile and an optimised `production` profile, but no script used `production` (AUD-012).
- During AUD-012, the user asked only for the Sepolia deploy to be switched. The issue file recorded the local paths as "Not changed", so this is a known, recorded limitation, not a missed one.
- The AUD-012 regression test checks `deploy:sepolia` only. It could not detect the same risk on the other build paths.

Hypothesis: the Phase 1 setup copied Hardhat 3's sample configuration, where `default` is unoptimised for fast compiles and readable traces, and `production` is meant for deployment. That split suits contracts with plenty of headroom, not a factory that embeds two other contracts.

## 2. Why it is a problem

With 0 bytes of headroom, any further growth in `AssetToken`, `AssetSale` or `AssetFactory` makes the factory larger than 24 576 bytes. `ethers.deployContract("AssetFactory", …)` then reverts in every test fixture, local deploy, demo seed and integration run. That blocks all further development until someone traces the failure back to contract size. There is no security impact.

## 3. How we fixed it

e1fc698 enables the optimizer (200 runs, the same as `production`) in the `default` profile. `production` is kept, and `deploy:sepolia` still names it explicitly (AUD-012).

Consequence for evidence: gas figures in runs from e1fc698 onward come from optimised bytecode. They are not comparable with earlier runs (`docs/evidence/runs/*/gas.log`).

New CLAUDE.md rule: see the AUD-014 entry under "Rules learned from audit findings".

## 4. Evidence the fix works

- Regression test: `test/DeployProfile.regression.test.ts` :: `every npm script that compiles through hardhat run, test or compile uses an optimised profile`. It reads every script in `package.json` and checks Hardhat's resolved config for each one's profile.
- Before: `docs/evidence/runs/20261104T133014Z_c97e068-dirty_AUD-014-before/test.log` (131 passing, 1 failing: `npm run test: "default" solc 0.8.24 optimizer: expected undefined to equal true`).
- After: `docs/evidence/runs/20261104T133135Z_e1fc698-dirty_AUD-014-after/test.log` (132 passing; coverage unchanged at 98.79% lines, so the coverage step works with the optimizer on).
- Sizes: `docs/evidence/aud-014/bytecode-sizes.txt`. AssetFactory is 13 545 bytes (55.1%), down from 24 576.
- Frontend: `docs/evidence/aud-014/frontend-tests-after.log` (113 passed). Real-node integration: `docs/evidence/aud-014/integration-after.log` (passes).
- Side effect: the coverage-instrumented factory that `evidence.sh` leaves in `artifacts/` is now 19 944 bytes, below the limit; it was 31 817. `docs/evidence/aud-014/integration-after-evidence-run.log` shows `npm run test:integration` passing straight after an evidence run, with no recompile. That removes the trap recorded in `docs/d5-implementation.md` and AUD-013 §4.
