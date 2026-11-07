# Executed validation results

Date: 6 November 2026, Asia/Singapore. Baseline revision: `0b1249e`; Phase 6 remains uncommitted by instruction. Machine-readable exits/timing: `baseline-rerun-commands.json`, `final-commands.json`, `final-retry-commands.json`, `deployment-commands.json`. Raw logs are in `logs/`.

| Command | Baseline | Final observed result | Exit |
|---|---|---|---:|
| `npm run compile -- --force` | Six Solidity files; harness selfdestruct warning | Seven files including new test helper; same warning | 0 |
| `npm test` | 142 pass | 153 pass, 0 fail, 0 skipped | 0 |
| `npx hardhat test mocha test/security/Phase6.security.test.ts` | Not present | 11 pass | 0 |
| `npx tsc --noEmit` | Pass | Pass after correcting test helper overload | 0 |
| `npm test --prefix frontend` | 118 pass in 9 files | 122 pass in 10 files, 0 fail | 0 |
| `npm run build --prefix frontend` | Pass | TypeScript and Vite production build pass | 0 |
| `npm run test:integration` | 1 pass | 1 pass with two CPT buyers and signing RPC validation | 0 |
| `npm run replay:ephemeral` | 12 Phase 5 steps / 34 checks | Baseline execution retained; separate Phase 6 scenario below | 0 |
| `npx hardhat run scripts/setupDemo.ts --network hardhatMainnet` | Phase 3 demo passed | Baseline execution retained | 0 |
| `npx hardhat run scripts/auditDemo.ts --network hardhatMainnet` | Not present | 31 checks; 18 mined transactions, 3 deliberate status-0 reverts | 0 |
| `npx hardhat test --gas-stats` | Not remeasured | 153 pass; gas table saved | 0 |
| `npx hardhat test --coverage` | Historical coverage only | 153 pass; 100% production lines/statements, 99.25%/99.37% including helpers | 0 |
| `npm run deploy:local` / `npm run demo:local` | Historical scripts inspected | Local factory/configuration and seeded CPT/DLT successful | 0 each |
| `npx hardhat compile --build-profile production --force` | Profile inspected | Seven files compiled, production runtime sizes verified | 0 |

The expected mined failures in the demo are successful negative checks, not failing tests. Fee-adjusted balances prove the rejected buyer paid gas only, with no retained purchase value. `final-demo.json` stores every receipt's raw logs, block, hash, status, gas, fee, addresses, and expected/actual checks.

## Adversarial coverage

Existing suites cover whitelist sender/receiver checks, delegated allowances, zero transfers, role delegation/revocation, D5 forced transfer and pause, factory permission/registry construction, payment and inventory rejection, withdrawal recursion/rejection, closure/recovery and asset isolation. Added tests cover the outsider access matrix and unchanged state, revoked issuer/sale recovery, uint256 multiplication overflow, insufficient-balance RPC admission, failed factory input atomicity, three deterministic seeds × 48 operations with model balances/proceeds and two issuers, plus nested sweep/withdrawal and rejecting-sweep rollback. They do not exhaust all states.

Frontend coverage includes actual ABI method arguments, exact wei, lifecycle forms, account/network invalidation, rejection/receipt timeouts, real event decoding, history deduplication, generated-deployment test isolation and signing-node fingerprints. Integration uses production frontend services and a local EIP-1193 adapter, not MetaMask.

## Not executed / limits

No frontend lint script configured; no frontend coverage run; no fresh install on every OS; no public-network transaction; no Sepolia receipt verification (no configured deployment record); no actual browser or MetaMask acceptance. Browser skill bootstrap returned “No browser is available” and discovery returned an empty list. No screenshots were taken. Manual cases are in Final_Demo_Guide.md. Static and npm scan results, including warnings, are reported separately.

## Failed attempts retained

Initial sandbox compile: exit 1 (cache lock timeout); sandbox contract attempt interrupted. Slither installation/invocation corrections retained. SEC-013 negative regression: 4 failures before correction. Initial final typecheck: exit 1 (test helper overload), then exit 0. Initial audit demo: exit 1 (raw revert decoding), then exit 0. Full successful regression results must not be substituted for those historical failed attempts.

## Final working-tree recheck after interruption

`submission-commands.json` records a fresh successful 153-test contract run, root typecheck, 122-test frontend run and frontend build. Integration initially failed with ECONNREFUSED at 127.0.0.1:8545 because the local node had stopped during the interrupted session. This was an environment failure, not a failing lifecycle assertion. The node was restarted and integration/local deployment/seed/build rerun; see `submission-retry-commands.json` and its raw logs. The failure remains preserved in `logs/submission-integration.log`.

The final retry completed with exit 0 for all four commands: integration (1 pass), local deployment, local seed and production frontend build. No further source correction was needed.
