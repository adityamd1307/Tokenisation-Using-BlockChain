# AUD-015: Frontend unit tests fail once the committed deployment is on Sepolia

| Field | Value |
|---|---|
| Status | fixed |
| Severity | low |
| Category | other (test isolation / build configuration) |
| Found by (method) | experiment during Phase 5 generation: the full frontend suite run with `addresses.json` set to chain 11155111 |
| Found by (person) | Claude Code (claude-opus-5-5), Phase 5 session, directed by Chordia Laksh |
| Location | `frontend/src/config/networks.ts:3-10` and `frontend/src/test/fixtures.ts:56` at `f943f9c` (Phase 4); exposed by Phase 5 decision D18 at `3be10c0` (`ai-baseline-phase5`) |
| AI session that produced the code | Phase 4 frontend and tests: Codex, 28 October 2026 ([curated summary](../ai-logs/phase4-session.md); no verbatim log). Phase 5 generation that exposes it: Claude Code (claude-opus-5-5), session archived under `docs/ai-logs/raw/` |
| Baseline commit | 3be10c0 (`ai-baseline-phase5`) |
| Regression test commit | 342234a |
| Fix commit | a36b1e9 |

## What is wrong

The app takes its target chain from the committed, generated deployment file:

```ts
// frontend/src/config/networks.ts (Phase 4)
export const targetNetwork = { chainId: deployment.chainId, ... };   // deployment = addresses.json
```

The unit tests' mock wallet is hard-wired to the local chain:

```ts
// frontend/src/test/fixtures.ts:56
chain = "0x7a69";   // 31337
```

Nothing in the test setup pins the deployment. The suite therefore passes only while the committed `addresses.json` says chain 31337. Under Phase 5 decision D18, `addresses.json` keeps the latest deployment and points at Sepolia once the Sepolia deployment is committed. With chain 11155111 in that file, 39 of the 117 existing frontend tests fail: the app treats the mock wallet as being on the wrong network (`docs/evidence/aud-015/frontend-tests-sepolia-config-before.log`, 40 failed including the new regression test).

## 1. Why the AI made the mistake

What the code shows:
- Phase 4 (Codex) wrote the tests against the one deployment that existed, a local one. `fixtures.ts` hard-codes 31337 while `networks.ts` reads the chain from the generated file, and `setup.ts` mocked nothing.
- The Phase 4 report says the generated addresses "identify the validation session" (`docs/phase4-implementation.md`, "Reproducible local workflow"). The coupling was therefore visible, but no test covered a non-local deployment.
- The Phase 5 generation (Claude Code, `3be10c0`) made the change that brings this out. D18 makes the committed file point at Sepolia, and the generation changed `networks.ts` without changing how the unit tests get their deployment. The defect showed up only because the session ran the suite with a Sepolia `addresses.json` as an experiment. Without that run it would have surfaced when the user committed the real Sepolia deployment.

Hypothesis: neither generation treated `addresses.json` as an input that changes by network. Phase 4 had no public-network deployment to test against, and the Phase 5 generation focused on the scripts and the network table.

## 2. Why it is a problem

The failure sequence: the user runs `npm run deploy:sepolia` and commits `addresses.json` and `deployments/sepolia.json` as Phase 5 evidence. From that commit on, `npm test --prefix frontend` fails 39 tests on `main` for every developer. The contracts and frontend code are still correct. This is the evidence the report relies on ("the same contract functionality has passing automated tests locally"). It would either be reported falsely as broken, or someone would "fix" it by reverting the Sepolia configuration. No funds or permissions are at risk.

## 3. How we fixed it

`frontend/src/test/setup.ts` mocks `../config/contracts` for every unit test file. It keeps the real ABIs and replaces `deployment` with the fixed local test values the suite was written against: chain 31337, the same address, block and hashes as the Phase 4 `addresses.json`. The unit tests no longer read the committed deployment. The app code is unchanged. The integration test (`vite.integration.config.ts`) does not use `setup.ts` and deploys its own fixture, so it is unaffected. Fix commit: a36b1e9.

CLAUDE.md rule added (see "Rules learned from audit findings").

## 4. Evidence the fix works

- Regression test: `frontend/src/test/deploymentIsolation.regression.test.ts` :: "targets the local test chain even when addresses.json points at Sepolia". It mocks the committed file as Sepolia and checks that `switchNetwork` asks the wallet for `0x7a69` and that the app's target chain is 31337.
- Before: `docs/evidence/aud-015/frontend-tests-before.log`: 1 failed (the regression test), 117 passed. With a Sepolia `addresses.json`: `frontend-tests-sepolia-config-before.log`, 40 failed and 78 passed.
- After: `docs/evidence/aud-015/frontend-tests-after.log`: 118 passed. With a Sepolia `addresses.json`: `frontend-tests-sepolia-config-after.log`, 118 passed. The production build passes with either file (`frontend-build-after.log`, `frontend-build-sepolia-config-after.log`), and so does the integration test against a local node (`integration-after.log`).
- Contract evidence runs, unaffected because the defect is frontend-only: `docs/evidence/runs/20261105T034657Z_342234a-dirty_AUD-015-before/` and `20261105T035112Z_a36b1e9-dirty_AUD-015-after-rerun/`, both 142 passing. The first after-run, `20261105T035007Z_a36b1e9-dirty_AUD-015-after/`, recorded `gas exit 1`. The cause was `EBUSY: resource busy or locked` on a generated typechain file, not a test failure, and the re-run is clean. "-dirty" refers only to the archived 069871d2 transcript, which another session modified.
- Not verified: the real Sepolia `addresses.json` (none exists yet). The test uses a simulated one.
