# AUD-003: Deployment and verification tooling are incomplete

| Field | Value |
|---|---|
| Status | open |
| Severity | high |
| Category | other |
| Found by (method) | manual code review and command execution |
| Found by (person) | Codex |
| Location | scripts/deploy.ts:10; frontend/package.json:8; tsconfig.json; scripts/evidence.sh; test/, baseline c504215 |
| AI session that produced the code | Unknown; no attribution inferred |
| Baseline commit | c504215 |
| Regression test commit | None |
| Fix commit | None |

## What is wrong

Local deployment throws TypeError at hre.network.provider.request under Hardhat 3. The frontend production build fails with TS5083 because frontend/tsconfig.json is absent. Root type checking includes the frontend without JSX/DOM options and reports invalid Hardhat API usage. All 41 test cases are skipped. The evidence runner invokes absent forge/slither commands and returns exit 0 even though every recorded step exits 127.

## 1. Why the AI made the mistake

The source explicitly labels these areas as future phases. The original generation transcript was not inspected; no causal claim is made.

## 2. Why it is a problem

The application cannot satisfy its frozen specification or support an end-to-end demonstration. A successful compile or zero-exit test command does not establish working behavior.

## 3. How we fixed it

Open; no implementation change made during verification. Required next work: Update deployment for Hardhat 3; add separate frontend/backend TypeScript configuration; implement real tests; align the evidence pipeline with the selected toolchain and propagate failure status.

## 4. Evidence the fix works

No fix or regression result is claimed. See `docs/VERIFICATION.md` for observed command results and limitations.

## Phase 2 follow-up — 23 October 2026

Token tests are now executable; only the 22 factory/sale placeholders remain skipped. This issue remains open for the unrelated frontend, full deployment, root typecheck and Foundry evidence pipeline. Phase 2 runs Hardhat directly and stores command logs under `docs/evidence/phase2/`; see `docs/phase2-implementation.md`.

## Phase 3 follow-up — 23 October 2026

`scripts/deploy.ts` and `scripts/setupDemo.ts` now run under Hardhat 3 (`network.getOrCreate()`) and complete on the in-process network (`docs/evidence/phase3/deploy-local.log`, `setupDemo.log`). The factory/sale placeholders are replaced by 48 executing tests. Still open:
- No Sepolia deployment has been attempted.
- The Sepolia config has one signer, but `setupDemo.ts` needs three.
- ~~No `localhost` network is configured for a persistent node.~~ Wrong (audit-1 F-16): Hardhat 3 provides `localhost` by default.
- ~~`scripts/evidence.sh` still requires `forge`.~~ It has been ported to Hardhat 3: compile, test, gas-stats, coverage, with Slither optional. Each step logs its command and the run records the commit SHA.
- ~~Root typecheck has not been addressed.~~ `npx tsc --noEmit` now exits 0. The frontend is excluded until Vite provides its own tsconfig in Phase 4.
- Still open: Sepolia deployment, and multiple Sepolia signers for `setupDemo.ts`.
