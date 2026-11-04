# AUD-011: Frontend lockfile omits non-macOS platform binaries so npm ci fails on Windows and Linux

| Field | Value |
|---|---|
| Status | fixed |
| Severity | medium |
| Category | other (build tooling / reproducibility) |
| Found by (method) | command execution: `npm ci` on Windows while verifying the Phase 4 merge |
| Found by (person) | Claude Code (claude-opus-5-5), session 069871d2, directed by Chordia Laksh |
| Location | `frontend/package-lock.json`, at f943f9c (tag `ai-baseline-phase4`) |
| AI session that produced the code | [Phase 4 summary](../ai-logs/phase4-session.md) (Codex, 2026-10-28; not verbatim) |
| Baseline commit | f943f9c |
| Regression test commit | 7673452 |
| Fix commit | cdea4e9 |

## What is wrong

esbuild and rollup ship their native binaries as one optional package per platform, such as `@esbuild/win32-x64` and `@rollup/rollup-linux-x64-gnu`. A portable lockfile records all of them, and npm installs only the one that matches the machine. The Phase 4 lockfile records only `@esbuild/darwin-arm64` and the matching rollup package. 52 optional dependencies have no lock entry: 25 for esbuild, 26 for rollup and 1 for vite.

On Windows with node 24.15.0 and npm 11.12.1, `npm ci` refuses to install:

```
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync.
npm error Missing: @esbuild/aix-ppc64@0.25.12 from lock file
```

This contradicts `docs/evidence/phase4/npm-ci.log` ("added 167 packages") and `phase4-session.md` ("Final default `npm ci` from lock succeeds"). Both were true only on the machine that generated the lockfile.

## 1. Why the AI made the mistake

What the code and evidence show:
- The only platform binary in the lockfile is `darwin-arm64`, so the lockfile was generated or last rewritten on an Apple Silicon Mac.
- `docs/evidence/phase4/versions.json` records node v22.18.0. The `npm-ci.log` success was observed on that machine only.
- `phase4-session.md` says the npm resolver failed during a Vitest upgrade and that dependencies were re-resolved several times. The session did not check the lockfile on a second platform.

Hypothesis: the lockfile was rewritten by `npm install` while a `node_modules` folder already existed. A known npm behaviour (npm/cli#4828) can then drop optional entries for other platforms. The resulting lockfile looks complete on the machine that wrote it.

Hypothesis: npm 10, which ships with node 22, accepts the incomplete lockfile in `npm ci`, while npm 11 rejects it. That would explain why the Phase 4 run passed.

## 2. Why it is a problem

Any reviewer or grader on Windows or Linux who follows the documented setup (`npm ci` in `frontend/`) cannot install the frontend under npm 11. With an older npm that accepts the lockfile, the install would succeed without the host's esbuild or rollup binary. Vite would then fail at build or test time, because no native binary exists for that platform. In both cases the Phase 4 build and test evidence cannot be reproduced off macOS, which weakens the report's Section 6 claims. There is no on-chain or security impact.

## 3. How we fixed it

cdea4e9 regenerates the lockfile with `npm install --package-lock-only` against the existing lockfile, on Windows with npm 11.12.1. The command only adds the 51 missing package entries (838 lines). A script check over all lock entries confirmed that **no** resolved version changed.

New CLAUDE.md rule: see the AUD-011 entry under "Rules learned from audit findings".

## 4. Evidence the fix works

- Regression test: `test/FrontendLockfile.regression.test.ts` :: `records every optional dependency, so npm ci works on every platform`. It checks the same condition npm ci reports. Every optional dependency in the lockfile must have its own entry.
- Before: `docs/evidence/runs/20261104T053310Z_7673452-dirty_AUD-011-before/test.log` (108 passing, 1 failing: the AUD-011 test lists all 52 missing entries). Also `docs/evidence/aud-011/npm-ci-before.log`: the actual `npm ci` EUSAGE failure on the 6b9d615 lockfile. "-dirty" refers to uncommitted session transcripts only, not code.
- After: `docs/evidence/runs/20261104T053753Z_737ba02-dirty_AUD-011-after/test.log` (109 passing, coverage unchanged at 98.68% lines). Also `docs/evidence/aud-011/npm-ci-after.log` (clean `npm ci` on Windows) and `docs/evidence/aud-011/frontend-tests-after.log` (frontend suite on Windows).
- Not verified: a Linux or macOS install from the new lockfile. The regression test is platform-independent, but no Linux run was performed.
