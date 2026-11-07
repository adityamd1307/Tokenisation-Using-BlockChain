# Subscription enhancement file inventory

Original AssetFactory.sol, AssetToken.sol and AssetSale.sol are unchanged. No dependency versions, Git commits, public deployments or presentation decks were added. The user-provided project PDF is not an implementation change.

| File | Purpose |
|---|---|
| [.gitignore](../.gitignore) | Ignores session-specific subscription localhost deployment records. |
| [CLAUDE.md](../CLAUDE.md) | Adds the learned AUD-016 optional-feature rule. |
| [README.md](../README.md) | Explains dual issuance, setup, validation and limits. |
| [contracts/MockUSD.sol](../contracts/MockUSD.sol) | Owner-minted six-decimal simulated currency. |
| [contracts/SubscriptionFactory.sol](../contracts/SubscriptionFactory.sol) | Additive offering registry linked to existing asset IDs and issuer permissions. |
| [contracts/SubscriptionOffering.sol](../contracts/SubscriptionOffering.sol) | Timed commitments, allocation, settlement, refund, claim and proceeds accounting. |
| [contracts/test/SubscriptionAdversary.sol](../contracts/test/SubscriptionAdversary.sol) | Test-only incompatible/callback currency, callback asset and contract investor. |
| [docs/AI_Audit_Report.md](AI_Audit_Report.md) | Eight-section course report with genuine findings and evidence. |
| [docs/ai-logs/INDEX.md](ai-logs/INDEX.md) | Indexes the enhancement session. |
| [docs/ai-logs/subscription-session.md](ai-logs/subscription-session.md) | Curated session summary; not fabricated verbatim conversation. |
| [docs/evidence/subscription/baseline-build.log](evidence/subscription/baseline-build.log) | Executed pre-enhancement baseline evidence. |
| [docs/evidence/subscription/baseline-contracts.log](evidence/subscription/baseline-contracts.log) | Executed pre-enhancement baseline evidence. |
| [docs/evidence/subscription/baseline-frontend.log](evidence/subscription/baseline-frontend.log) | Executed pre-enhancement baseline evidence. |
| [docs/evidence/subscription/baseline-typecheck.log](evidence/subscription/baseline-typecheck.log) | Executed pre-enhancement baseline evidence. |
| [docs/evidence/subscription/build-source-check.json](evidence/subscription/build-source-check.json) | Compiler inputs checked against current source. |
| [docs/evidence/subscription/bytecode-sizes.json](evidence/subscription/bytecode-sizes.json) | Measured optimised runtime bytes versus EIP-170. |
| [docs/evidence/subscription/clean-compile.log](evidence/subscription/clean-compile.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/compile-final.log](evidence/subscription/compile-final.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/compile.log](evidence/subscription/compile.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/contracts-final.log](evidence/subscription/contracts-final.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/contracts.log](evidence/subscription/contracts.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/coverage-final.log](evidence/subscription/coverage-final.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/coverage-no-compile-empty.log](evidence/subscription/coverage-no-compile-empty.log) | Retained failed/intermediate attempt; not final acceptance evidence. |
| [docs/evidence/subscription/coverage.log](evidence/subscription/coverage.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/demo-final.log](evidence/subscription/demo-final.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/demo.json](evidence/subscription/demo.json) | Actual local receipts, invariants, final allocations and balances. |
| [docs/evidence/subscription/demo.log](evidence/subscription/demo.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/deploy-local.log](evidence/subscription/deploy-local.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/deploy-subscriptions.log](evidence/subscription/deploy-subscriptions.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/format.log](evidence/subscription/format.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/frontend-build-final.log](evidence/subscription/frontend-build-final.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/frontend-build-first.log](evidence/subscription/frontend-build-first.log) | Retained failed/intermediate attempt; not final acceptance evidence. |
| [docs/evidence/subscription/frontend-build.log](evidence/subscription/frontend-build.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/frontend-compatibility-after.log](evidence/subscription/frontend-compatibility-after.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/frontend-compatibility.log](evidence/subscription/frontend-compatibility.log) | Retained failed/intermediate attempt; not final acceptance evidence. |
| [docs/evidence/subscription/frontend-tests-final.log](evidence/subscription/frontend-tests-final.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/frontend-tests-first.log](evidence/subscription/frontend-tests-first.log) | Retained failed/intermediate attempt; not final acceptance evidence. |
| [docs/evidence/subscription/frontend-tests.log](evidence/subscription/frontend-tests.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/gas-final.log](evidence/subscription/gas-final.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/gas.log](evidence/subscription/gas.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/http-smoke.json](evidence/subscription/http-smoke.json) | Local route readiness; not rendered-browser evidence. |
| [docs/evidence/subscription/initial-test-harness-failure.log](evidence/subscription/initial-test-harness-failure.log) | Retained failed/intermediate attempt; not final acceptance evidence. |
| [docs/evidence/subscription/integration-final.log](evidence/subscription/integration-final.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/integration-first.log](evidence/subscription/integration-first.log) | Retained failed/intermediate attempt; not final acceptance evidence. |
| [docs/evidence/subscription/milestones-2-5-tests.log](evidence/subscription/milestones-2-5-tests.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/production-compile.log](evidence/subscription/production-compile.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/rounding-final.log](evidence/subscription/rounding-final.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/security-compile.log](evidence/subscription/security-compile.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/security-harness-compile-failure.log](evidence/subscription/security-harness-compile-failure.log) | Retained failed/intermediate attempt; not final acceptance evidence. |
| [docs/evidence/subscription/security-tests.log](evidence/subscription/security-tests.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/security-typecheck-failure.log](evidence/subscription/security-typecheck-failure.log) | Retained failed/intermediate attempt; not final acceptance evidence. |
| [docs/evidence/subscription/slither-current-results.json](evidence/subscription/slither-current-results.json) | Static-analysis output; slither-reviewed files are the final scan. |
| [docs/evidence/subscription/slither-current.log](evidence/subscription/slither-current.log) | Static-analysis output; slither-reviewed files are the final scan. |
| [docs/evidence/subscription/slither-final-results.json](evidence/subscription/slither-final-results.json) | Static-analysis output; slither-reviewed files are the final scan. |
| [docs/evidence/subscription/slither-final.log](evidence/subscription/slither-final.log) | Static-analysis output; slither-reviewed files are the final scan. |
| [docs/evidence/subscription/slither-reviewed-results.json](evidence/subscription/slither-reviewed-results.json) | Static-analysis output; slither-reviewed files are the final scan. |
| [docs/evidence/subscription/slither-reviewed.log](evidence/subscription/slither-reviewed.log) | Static-analysis output; slither-reviewed files are the final scan. |
| [docs/evidence/subscription/slither-triage.json](evidence/subscription/slither-triage.json) | Individual disposition of all final scanner findings. |
| [docs/evidence/subscription/slither.log](evidence/subscription/slither.log) | Static-analysis output; slither-reviewed files are the final scan. |
| [docs/evidence/subscription/source-manifest.json](evidence/subscription/source-manifest.json) | SHA-256 fingerprints of implementation and documentation files (excluding itself). |
| [docs/evidence/subscription/timestamp-test-harness-failure.log](evidence/subscription/timestamp-test-harness-failure.log) | Retained failed/intermediate attempt; not final acceptance evidence. |
| [docs/evidence/subscription/typecheck-final.log](evidence/subscription/typecheck-final.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/evidence/subscription/typecheck-first.log](evidence/subscription/typecheck-first.log) | Retained failed/intermediate attempt; not final acceptance evidence. |
| [docs/evidence/subscription/typecheck.log](evidence/subscription/typecheck.log) | Executed build/test/deployment/format evidence; final acceptance is indexed in testing-results. |
| [docs/issues/AUD-016-disabled-subscription-section-triggers-extra-regis.md](issues/AUD-016-disabled-subscription-section-triggers-extra-regis.md) | Four-part finding with preserved failing/passing logs. |
| [docs/issues/INDEX.md](issues/INDEX.md) | Indexes the observed AUD-016 compatibility regression. |
| [docs/report/REPORT-MAP.md](report/REPORT-MAP.md) | Links new report evidence and corrects historical tag guidance. |
| [docs/spec/subscription-requirements.md](spec/subscription-requirements.md) | Unmodified copy of the user-supplied enhancement request. |
| [docs/subscription-allocation-mathematics.md](subscription-allocation-mathematics.md) | Allocation, soft-cap proof, liabilities, rounding and reserves. |
| [docs/subscription-changed-files.md](subscription-changed-files.md) | This file inventory. |
| [docs/subscription-offering-architecture.md](subscription-offering-architecture.md) | Contract API, frontend design and operational walkthrough. |
| [docs/subscription-offering-specification.md](subscription-offering-specification.md) | Authorised choices, traceability and trust assumptions. |
| [docs/subscription-security-analysis.md](subscription-security-analysis.md) | Threat model, scanner triage, real failures and residual risks. |
| [docs/subscription-testing-results.md](subscription-testing-results.md) | Executed commands, measured results and acceptance status. |
| [frontend/integration/subscriptions.test.ts](../frontend/integration/subscriptions.test.ts) | Production-service integration against actual local contracts. |
| [frontend/src/App.tsx](../frontend/src/App.tsx) | Adds subscription listing/detail routes. |
| [frontend/src/components/AppLayout.tsx](../frontend/src/components/AppLayout.tsx) | Adds navigation and actual network label. |
| [frontend/src/components/AssetCard.tsx](../frontend/src/components/AssetCard.tsx) | Labels legacy cards as direct ETH sales. |
| [frontend/src/components/SubscriptionOfferings.tsx](../frontend/src/components/SubscriptionOfferings.tsx) | Subscription cards, progress, paged listing and issuer creation. |
| [frontend/src/components/TransactionHistory.tsx](../frontend/src/components/TransactionHistory.tsx) | Displays six-decimal mUSD separately from ETH. |
| [frontend/src/config/abi/MockUSD.json](../frontend/src/config/abi/MockUSD.json) | ABI generated from the actual compiled contract. |
| [frontend/src/config/abi/SubscriptionFactory.json](../frontend/src/config/abi/SubscriptionFactory.json) | ABI generated from the actual compiled contract. |
| [frontend/src/config/abi/SubscriptionOffering.json](../frontend/src/config/abi/SubscriptionOffering.json) | ABI generated from the actual compiled contract. |
| [frontend/src/config/addresses.json](../frontend/src/config/addresses.json) | Actual local deployment addresses, links and code fingerprints. |
| [frontend/src/config/contracts.ts](../frontend/src/config/contracts.ts) | Adds extension deployment fields and compiled ABIs. |
| [frontend/src/index.css](../frontend/src/index.css) | Responsive subscription progress, metrics, forms and allocation cards. |
| [frontend/src/pages/IssuerDashboard.tsx](../frontend/src/pages/IssuerDashboard.tsx) | Integrates subscription creation for an existing selected asset. |
| [frontend/src/pages/Marketplace.tsx](../frontend/src/pages/Marketplace.tsx) | Adds the subscription offering section. |
| [frontend/src/pages/SubscriptionPage.tsx](../frontend/src/pages/SubscriptionPage.tsx) | Offering detail, investor/issuer operations and paged event history. |
| [frontend/src/services/history.ts](../frontend/src/services/history.ts) | Exports existing adaptive event query helper for subscription history. |
| [frontend/src/services/subscriptions.ts](../frontend/src/services/subscriptions.ts) | Read/write/history service with six-decimal input and deployment validation. |
| [frontend/src/test/subscription.test.tsx](../frontend/src/test/subscription.test.tsx) | 13 precision/component flow tests. |
| [frontend/src/types.ts](../frontend/src/types.ts) | Adds an explicit activity currency discriminator. |
| [frontend/src/utils/errors.ts](../frontend/src/utils/errors.ts) | Human-readable subscription contract errors. |
| [frontend/src/utils/subscription.ts](../frontend/src/utils/subscription.ts) | BigInt monetary parsing, formatting and configuration validation. |
| [package.json](../package.json) | Adds local subscription setup and ephemeral demo commands. |
| [scripts/demoSubscriptionOffering.ts](../scripts/demoSubscriptionOffering.ts) | Executes and asserts actual successful/failed offering scenarios. |
| [scripts/deploySubscriptions.ts](../scripts/deploySubscriptions.ts) | Preserves configured AssetFactory, adds local MockUSD/registry and funds demo wallets. |
| [scripts/syncFrontend.mjs](../scripts/syncFrontend.mjs) | Synchronizes all six production ABIs. |
| [test/SubscriptionOffering.test.ts](../test/SubscriptionOffering.test.ts) | 32 lifecycle, allocation, precision and conservation tests. |
| [test/SubscriptionSecurity.test.ts](../test/SubscriptionSecurity.test.ts) | 20 adversarial transfer, callback, access and isolation tests. |
