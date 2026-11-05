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

## Phase 4 follow-up — 28 October 2026

Persistent `npm run deploy:local` now targets explicit localhost chain 31337 and writes deployment address, block/hash, runtime bytecode hash and all three compiled ABI arrays. The frontend has its own TypeScript/Vite/test configuration and lockfile. Both TypeScript checks, the production frontend build, 112 frontend behavior tests, 108 existing contract tests, actual local frontend-service lifecycle and HTTP route smoke checks pass. See [Phase 4 evidence](../evidence/phase4/README.md). `deploy:ephemeral` retains the throwaway workflow; `demo:local` explicitly seeds the two demo assets only on an empty local registry.

Still open: genuine browser/MetaMask validation, Sepolia deployment and a multi-wallet public-testnet demonstration. No public deployment or interactive pass is claimed; Phase 5 remains outside this task.

## Deferral — 4 November 2026

The Sepolia deployment was attempted on 4 November 2026 and did not run: the project root has no `.env` (only `.env.example`), and no Sepolia RPC endpoint has been provisioned yet. Chordia Laksh deferred the deployment until Phase 5. The Phase 1 roadmap places public-testnet integration inside Phase 5 ("End-to-End Integration & Testing"), so the Phase 5 plan must include it.

Ready now: `npm run deploy:sepolia` builds with the optimised `production` profile (AUD-012, AUD-014). It reads `TESTNET_RPC_URL` and `PRIVATE_KEY` from environment variables or Hardhat's keystore; nothing loads `.env` automatically. The README's "Sepolia deployment" section documents this.

Needed for Phase 5:
- A Sepolia RPC endpoint.
- A funded Sepolia burner wallet for the platform admin.
- Two or more further burner wallets for the issuer and investors. `setupDemo.ts` needs three signers, and the Sepolia network config currently has one.

Claude Code does not read `.env` (`.claude/settings.json`, CLAUDE.md), so the deploy command must be run by a person, outside the logged session.

## Phase 5 follow-up — 5 November 2026

The tooling for the Sepolia deployment now exists and is verified locally ([Phase 5 implementation](../phase5-implementation.md), tag `ai-baseline-phase5`):
- Decision D12: `hardhat.config.ts` reads four keys, `SEPOLIA_KEY_A` to `SEPOLIA_KEY_D`, with `configVariable`, plus `TESTNET_RPC_URL`. **`PRIVATE_KEY` is no longer used.** The "one signer" gap above is closed. *Superseded: "It reads `TESTNET_RPC_URL` and `PRIVATE_KEY` from environment variables or Hardhat's keystore."*
- `npm run deploy:sepolia` deploys an empty main factory with Wallet A as admin. It writes `frontend/src/config/addresses.json` and `deployments/sepolia.json` (address, chain ID, block, ABIs) (D11, D18).
- `npm run replay:sepolia` runs all 12 Task 5.1 steps on its own factory with Wallets A–D and writes every hash to `docs/evidence/phase5/`. Scenario 7 is recorded as a reverted transaction (D13). It checks every wallet's balance before sending anything.
- Both scripts run locally (`deploy:ephemeral`, `deploy:local`, `replay:ephemeral`), and `test/Phase5.scripts.test.ts` covers them.

Still open: running both on Sepolia (a person must do it, outside the logged session), then recording the hashes in `docs/evidence/testnet-log.md`. Etherscan verification is not part of the Phase 5 brief and has not been built. Status stays open until the Sepolia transactions are recorded.
