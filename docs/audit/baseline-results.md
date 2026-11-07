# Phase 6 baseline — 6 November 2026 (Asia/Singapore)

Starting revision: `0b1249e`; tracked working tree initially clean. No production changes preceded these checks. No assignment PDF was found in the repository; the supplied Phase 6 brief supplies the eight report headings. The existing spec, phase requirements, issue ledger and preserved AI sessions are available.

| Command | Exit | Actual baseline |
|---|---:|---|
| `npm run compile` (sandbox) | 1 | Compiler cache lock timed out after 60 seconds; environment restriction, not a Solidity failure |
| `npm run compile -- --force` (cache access granted) | 0 | Six Solidity files; one selfdestruct warning in test-only ForceSendHarness |
| `npm test` | 0 | 142 passed, 0 failed |
| `npx tsc --noEmit` | 0 | Root typecheck |
| `npm test --prefix frontend` | 0 | 118 passed, 0 failed in 9 files |
| `npm run build --prefix frontend` | 0 | TypeScript and Vite production build |
| `npm run replay:ephemeral` | 0 | Existing Phase 5 replay: 12 steps, 34 checks |
| `npx hardhat run scripts/setupDemo.ts --network hardhatMainnet` | 0 | Existing Phase 3 demo: CPT supply 10,000, inventory 4,900, buyer 100, proceeds 0.1 ETH |

The first sandbox test attempt was interrupted while waiting for the same compiler-cache lock, then rerun successfully above. Logs: `logs/baseline-*.log`, machine-readable commands: `baseline-commands.json`, `baseline-rerun-commands.json`. Integration result is recorded in `logs/baseline-integration.log` after starting a filtered local Hardhat node. No frontend lint command is configured; typechecking is not called linting.

Runtime: Node 22.18.0, npm 10.9.3, Python 3.13.2. Installed root packages: Hardhat 3.21.0, OpenZeppelin 5.6.1, ethers 6.17.0, TypeScript 7.0.2. Solidity 0.8.24, Shanghai EVM, optimizer enabled with 200 runs in both profiles.

## Scope and gaps before changes

Three production contracts: factory registry/issuer authorisation; zero-decimal fixed-supply token with AccessControl, whitelist, pause and recovery; fixed-price escrow sale with proceeds withdrawal, closure, inventory recovery and forced-ETH sweep. Factory-created token roles belong to the issuer. React services read public RPC state and sign through a wallet provider.

Historical defects AUD-004–015 have remedies and evidence. AUD-002 retains real MetaMask/browser acceptance; AUD-003 retains Sepolia deployment. There is no verified Sepolia record. Existing local replay is not the exact Phase 6 two-buyer/closure scenario. Existing reentrancy tests cover recursive withdrawal and rejection, but cross-function sweep callbacks, boundary arithmetic and longer controlled actor sequences warrant additional tests. Wallet deployment checking currently applies to the public RPC; signing provider consistency needs adversarial validation. No Slither executable is on PATH. No new vulnerability is claimed at baseline.

Local frontend-service integration: `npm run test:integration`, exit 0, **1 passed / 0 failed** against a freshly started local chain. This is not a browser extension test.
