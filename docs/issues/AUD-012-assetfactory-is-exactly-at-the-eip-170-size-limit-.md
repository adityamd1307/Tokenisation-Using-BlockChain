# AUD-012: AssetFactory is exactly at the EIP-170 size limit because the Sepolia deploy uses the unoptimised profile

| Field | Value |
|---|---|
| Status | fixed |
| Severity | low |
| Category | other (deployment / contract size) |
| Found by (method) | manual review: bytecode size measurement after the D5 tests passed |
| Found by (person) | Claude Code (claude-opus-5-5), session 069871d2, the same session that generated D5 |
| Location | `package.json` `deploy:sepolia` script; `hardhat.config.ts` `default` profile; at 714366d (tag `ai-baseline-d5`) |
| AI session that produced the code | Script and profiles: Phase 1 setup session (`exports/2026-10-23-phase1-setup.txt`, commit 9884a9b). Size growth: D5, session 069871d2 |
| Baseline commit | 714366d |
| Regression test commit | 1e849ec |
| Fix commit | 74af940 |

## What is wrong

`AssetFactory` deploys `AssetToken` and `AssetSale` with `new`, so its runtime bytecode contains both contracts' creation code. `hardhat.config.ts` defines two build profiles. `default` has no optimizer settings; `production` enables the optimizer with 200 runs. `hardhat run` uses `default` unless `--build-profile` is given, and `deploy:sepolia` passes no profile:

```json
"deploy:sepolia": "hardhat run scripts/deploy.ts --network sepolia"
```

| Build | AssetFactory runtime bytes | Share of EIP-170 limit (24 576) |
|---|---|---|
| Phase 3, default profile (`docs/evidence/phase3/bytecode-sizes.txt`) | 22 557 | 91.8% |
| main at bff2f81, default profile | 23 418 | 95.3% |
| D5 at 714366d, default profile | **24 576** | **100.0%, 0 bytes headroom** |
| D5 at 714366d, production profile | 13 545 | 55.1% |

`docs/evidence/aud-012/deploy-before.log` runs `hardhat run scripts/deploy.ts` without a profile, as `deploy:sepolia` does. The factory it compiles is 24 576 bytes. EIP-170 rejects code only when it is *more* than 24 576 bytes, so this build still deploys today. The test suite deploys it too.

## 1. Why the AI made the mistake

What the code and transcripts show:
- The Phase 1 session wrote both profiles and the profile-less `deploy:sepolia` script in commit 9884a9b. Nothing in the repo links the two. The `production` profile was never used by any script.
- The Phase 3 session measured the factory at 22 557 bytes and wrote "It fits, but little headroom remains. The `production` build profile enables the optimiser" (`docs/phase3-implementation.md:93`). It recorded the risk but did not change the deploy script or open an issue.
- The D5 session (this one) added `Pausable` and `forcedTransfer` to `AssetToken`. That grew the factory by 1 158 bytes. The session ran the full test suite before measuring size and only found the problem afterwards. The size was not checked as part of implementing D5, although Phase 3's note was in the files the session had read.

Hypothesis: a passing test run reads as "deployable" because the in-process network enforces EIP-170. That hides how close the code is to the limit, since tests fail only once the limit is actually exceeded.

## 2. Why it is a problem

With no headroom left, the next change to `AssetToken`, `AssetSale` or `AssetFactory` will make `AssetFactory` larger than 24 576 bytes. That includes any fix from the coming D5 review. Its deployment would then revert on Sepolia and locally, which blocks AUD-003 (the outstanding Sepolia deploy) and the demo. The unoptimised build also costs more gas to deploy and call. There is no security impact, and nothing fails at 714366d itself.

## 3. How we fixed it

74af940 changes `deploy:sepolia` to `hardhat run --build-profile production scripts/deploy.ts --network sepolia` and updates the usage comment in `scripts/deploy.ts`. Local scripts and tests keep the `default` profile, so the gas and coverage figures in earlier evidence runs stay comparable.

Not changed (user decision, 4 November 2026): the `default` profile stays unoptimised. Local deploys (`deploy:local`, `deploy:ephemeral`) still use the 24 576-byte build. The regression test guards the Sepolia path only. *Follow-up: the remaining paths were fixed later as [AUD-014](AUD-014-default-build-profile-leaves-assetfactory-at-the-e.md) (e1fc698), which enables the optimizer in `default`.*

New CLAUDE.md rule: see the AUD-012 entry under "Rules learned from audit findings".

## 4. Evidence the fix works

- Regression test: `test/DeployProfile.regression.test.ts` :: `deploy:sepolia builds with a profile that enables the optimizer for every compiler`. It reads the profile from the actual `deploy:sepolia` script and checks Hardhat's resolved config for that profile.
- Before: `docs/evidence/runs/20261104T055346Z_1e849ec-dirty_AUD-012-before/test.log` (128 passing, 1 failing: `"default" solc 0.8.24 optimizer: expected undefined to equal true`); `docs/evidence/aud-012/deploy-before.log` (24 576-byte factory).
- After: `docs/evidence/runs/20261104T055527Z_74af940-dirty_AUD-012-after/test.log` (129 passing; coverage 98.79% lines); `docs/evidence/aud-012/deploy-after.log`: the same deploy script with `--build-profile production` deploys a 13 545-byte factory.
- Not verified: an actual Sepolia deployment (still outstanding under AUD-003).
