# Subscription validation and acceptance

Date: 7 November 2026 (Asia/Singapore). Evidence directory: [subscription](evidence/subscription/). The checkout at enhancement start had 142 contract tests and 118 frontend tests; earlier scope-review results from a different checkout were not reused as this baseline.

## Executed checks

| Command | Result | Evidence |
|---|---|---|
| Baseline `npm test` | 142 passed | baseline-contracts.log |
| Baseline `npm test --prefix frontend` | 118 passed | baseline-frontend.log |
| Baseline frontend build / root typecheck | Passed | baseline-build.log, baseline-typecheck.log |
| Final `npm test` | 194 passed: 142 preserved + 52 new | contracts-final.log |
| Final `npm test --prefix frontend` | 131 passed: 118 preserved + 13 new | frontend-tests-final.log |
| `npm run test:integration` | 2 passed: direct lifecycle and subscription lifecycle | integration-final.log |
| `npm run demo:subscriptions` | Successful oversubscription, full failed-offering refund, assertions passed | demo-final.log, demo.json |
| `npx tsc --noEmit` | Passed | typecheck-final.log |
| `npm run build --prefix frontend` | TypeScript and Vite build passed | frontend-build-final.log |
| `npx hardhat test --coverage` | 194 passed; measured coverage below | coverage-final.log |
| `npx hardhat test --gas-stats` | 194 passed; operation ranges recorded | gas-final.log |
| Local base + extension deployment | Succeeded; configuration, fingerprints, ABIs and 10,000 mUSD per investor written | deploy-local.log, deploy-subscriptions.log |
| Production profile compile | Passed; runtime sizes below EIP-170 | production-compile.log, bytecode-sizes.json |
| Local frontend HTTP routes | Four routes returned 200 with the app root; not visual QA | http-smoke.json |
| Slither, current clean artifacts | 33 contracts, 102 detectors, 13 findings triaged; JSON success true | slither-reviewed-results.json, slither-reviewed.log |

Compiled Solidity 0.8.24, optimizer runs 200, Shanghai target; installed Hardhat 3.21.0, OpenZeppelin 5.6.1, ethers 6.17.0, React 18.3.1 and Vite 6.4.5. No package dependencies were added or upgraded.

## Coverage and deployment size

| Contract | Lines | Statements | Runtime bytes |
|---|---:|---:|---:|
| MockUSD | 100% | 100% | 2,200 |
| SubscriptionFactory | 93.75% | 92.86% | 12,202 |
| SubscriptionOffering | 97.62% | 98.04% | 8,308 |
| AssetFactory | 100% | 100% | 13,545 |
| AssetToken | 100% | 100% | 4,124 |
| AssetSale | 97.67% | 98.25% | 3,132 |
| Entire measured set including harnesses | 98.02% | 98.32% | — |

All runtime sizes are below 24,576 bytes; the original three production contracts are unchanged. Coverage is not branch completeness or formal proof. The new offering's uncovered reported lines are the incompatible asset-receipt guard and two read-only guard paths; the factory's offeringCount getter is exercised by integration/demo but is outside this contract-suite coverage count. No frontend coverage percentage is claimed.

## Scenario evidence

With 1,000 CPT at 2 mUSD and a 1,200 mUSD soft cap:

| Investor | Committed mUSD | Claimed CPT | Accepted mUSD | Refunded mUSD | Final mUSD |
|---|---:|---:|---:|---:|---:|
| A | 1,800 | 450 | 900 | 900 | 9,100 |
| B | 1,400 | 350 | 700 | 700 | 9,300 |
| C | 800 | 200 | 400 | 400 | 9,600 |

Successful escrow ends with zero mUSD and zero CPT. Issuer receives 2,000 mUSD. Supply remains 10,000 CPT. A second offering with 700 mUSD fails, refunds all 700, accepts zero, allocates zero and returns all 1,000 escrowed tokens; issuer holds 9,000 CPT after both scenarios. All values come from [demo.json](evidence/subscription/demo.json), whose money fields are six-decimal base units. Expected-rejection checks use contract simulation and are not falsely labelled mined failed transactions.

Additional tests include seven-unit dust; zero-token subscribers; a soft cap above rounded net proceeds; conservative false failure; more subscribers than units; exact soft/hard thresholds; forward/reverse settlement and claim order; three seeds with 18 top-ups each; and multiplication whose intermediate product exceeds 256 bits. Adversarial tests exercise fee, false, reverting, no-return and callback tokens; insufficient reserves; contract investors; cross-offering isolation; and inherited issuer seizure. Their finite actor sets do not establish exhaustive fuzzing or formal verification.

Frontend tests cover six-decimal precision, oversubscription display, separate approval/commit, input preservation, blocked eligibility/underfunding, independent refunds, settlement gating, failure/finalisation, issuer inventory controls, rejection, creation and account invalidation. Existing timeout/network/wallet tests remain. Real-chain integration uses production services over an EIP-1193 adapter; it is not MetaMask.

## Acceptance status

| Area | Status |
|---|---|
| All requested core contract operations and financial invariants | Implemented and automatically tested |
| Existing direct ETH sale and registry compatibility | Existing tests and real-chain lifecycle pass; source contracts unchanged |
| Issuer and investor subscription UI actions | Implemented; component and service integration tests pass |
| Responsive layout rules and institutional visual style | Implemented; actual visual/browser acceptance pending |
| Security review, allocation explanation, AI report and evidence | Present; residual trust/economic limitations explicitly documented |
| Reproducible local successful/failed demo | Executed successfully |
| Real MetaMask/browser acceptance and screenshots | Not executed: browser runtime reported no browser; discovery returned an empty list |
| Public subscription/testnet or mainnet deployment | Not executed; extension setup is local-only |

Implementation and automated local validation are complete. Full manual acceptance is not claimed. The team should rehearse the real wallet flow and visually check desktop/mobile layouts before submission. Existing Sepolia acceptance remains separate work. No Git commits were made.
