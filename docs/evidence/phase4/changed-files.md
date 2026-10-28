# Phase 4 changed-file manifest

Every changed file is listed below, including generated ABI/configuration, test evidence and the deleted placeholder. No Solidity file changed; no Git commit was created.

| File | Purpose |
|---|---|
| `CLAUDE.md` | Append evidence-based rules for preserving funding inputs and unknown receipt state. |
| `README.md` | Current application setup, commands, status and verification limits. |
| `SETUP.md` | Point historical setup readers to the current reproducible workflow. |
| `docs/VERIFICATION.md` | Label scaffold verification as historical and link current evidence. |
| `docs/ai-logs/INDEX.md` | Index the Phase 4 AI-assisted session and outcomes. |
| `docs/ai-logs/phase4-session.md` | Curated prompt context, decisions, genuine issues, corrections and limits. |
| `docs/evidence/phase4/README.md` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/baseline-build.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/baseline-contract-tests.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/build-first.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/build-second.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/build.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/changed-files.md` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/compile.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/contract-tests.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/deploy-local.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/format.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/frontend-tests-after-refresh-fix.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/frontend-tests-first.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/frontend-tests-second.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/frontend-tests-third.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/frontend-tests.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/http-smoke.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/integration-first.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/integration.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/npm-audit.json` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/npm-ci.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/receipt-timeout-before.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/root-typecheck.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/seed-local.log` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/evidence/phase4/versions.json` | Actual validation output or evidence index; see this directory’s README for the individual result. |
| `docs/issues/AUD-002-frontend-dashboards-and-wallet-integration-are-uni.md` | Track implemented frontend and automated validation, with manual browser acceptance outstanding. |
| `docs/issues/AUD-003-deployment-and-verification-tooling-are-incomplete.md` | Record completed local tooling and remaining public-testnet verification. |
| `docs/issues/AUD-009-issuer-inventory-form-loses-quantity-after-allowan.md` | Genuine allowance/deposit form-state defect, root cause and before/after evidence. |
| `docs/issues/AUD-010-receipt-timeout-incorrectly-reported-as-transactio.md` | Genuine unknown-receipt misclassification, correction and before/after evidence. |
| `docs/issues/INDEX.md` | Update frontend tracking and index the two new regression findings. |
| `docs/phase4-implementation.md` | Full architecture, contract map, workflows, tests, acceptance and manual checklist. |
| `docs/report/REPORT-MAP.md` | Map Phase 4 implementation and evidence into the assignment report. |
| `docs/spec/phase4-requirements.md` | Preserve the exact user request as audit evidence. |
| `docs/spec/spec-v1.md` | Record the newer Phase 4 authority without erasing historical D5 discussion. |
| `frontend/index.html` | Application title, description and theme metadata. |
| `frontend/integration/lifecycle.test.ts` | Full real local-contract lifecycle through production frontend services. |
| `frontend/package-lock.json` | Lock the verified frontend dependency tree. |
| `frontend/package.json` | Router/testing dependencies and repeatable sync/build/test commands. |
| `frontend/src/App.tsx` | App providers, real routes, legacy investor redirect and session-keyed admin forms. |
| `frontend/src/components/AppLayout.tsx` | Sidebar, topbar, wallet notices, transaction bar and academic disclaimer. |
| `frontend/src/components/AssetCard.tsx` | Real registry card, price/inventory/status and asset navigation. |
| `frontend/src/components/AssetCreationForm.tsx` | Validated issuance form and confirmed creation addresses. |
| `frontend/src/components/IssuerManagement.tsx` | Compliance, precise allowance, deposit, withdrawals, closure and recovery. |
| `frontend/src/components/TransactionHistory.tsx` | Event table, timestamps, pagination and history loading/error states. |
| `frontend/src/components/TransactionStatus.tsx` | Wallet/pending/confirmed/rejected/failed/unknown receipt feedback. |
| `frontend/src/components/WalletControls.tsx` | Wallet selector/connect/disconnect, address, network switch and roles. |
| `frontend/src/components/common.tsx` | Accessible field, loading/error/empty feedback, copy address and confirm dialog. |
| `frontend/src/config/abi/AssetFactory.json` | Generated ABI copied from the corresponding compiled Hardhat artifact; not manually maintained. |
| `frontend/src/config/abi/AssetSale.json` | Generated ABI copied from the corresponding compiled Hardhat artifact; not manually maintained. |
| `frontend/src/config/abi/AssetToken.json` | Generated ABI copied from the corresponding compiled Hardhat artifact; not manually maintained. |
| `frontend/src/config/addresses.json` | Generated persistent local deployment identity (regenerate after reset). |
| `frontend/src/config/contracts.ts` | Central typed deployment/ABI configuration. |
| `frontend/src/config/networks.ts` | Configured chain/name and public local RPC override. |
| `frontend/src/context/DataContext.tsx` | Shared post-confirmation refresh and public registry reads. |
| `frontend/src/context/TransactionContext.tsx` | Session-scoped transaction state, duplicate locking and receipt rechecks. |
| `frontend/src/context/WalletContext.tsx` | Wallet discovery, connection, network/account events and stale-response guards. |
| `frontend/src/hooks/useAsync.ts` | Keyed cancellable reads; optional public-data retention during refresh. |
| `frontend/src/index.css` | Responsive institutional dashboard styling and accessibility states. |
| `frontend/src/pages/AdminDashboard.tsx` | Actual admin permission, issuer status/authorisation/revocation. |
| `frontend/src/pages/AssetPage.tsx` | Asset overview, eligibility, exact purchase preview and purchase controls. |
| `frontend/src/pages/InvestorDashboard.tsx` | Delete obsolete unused placeholder; /investor redirects to /portfolio. |
| `frontend/src/pages/InvestorPortfolio.tsx` | Actual holdings, eligible transfers and wallet event history. |
| `frontend/src/pages/IssuerDashboard.tsx` | Creation authority, owned assets and selected asset management. |
| `frontend/src/pages/Marketplace.tsx` | Public registry, search, category/status filters and empty/error states. |
| `frontend/src/services/blockchain.ts` | Shared actual contract reads/writes, deployment checks and write preflight. |
| `frontend/src/services/history.ts` | Bounded/adaptive real event queries and purchase transfer deduplication. |
| `frontend/src/services/transactions.ts` | Receipt-success verification, replacements and unknown receipt handling. |
| `frontend/src/services/wallet.ts` | EIP-1193 snapshots and explicit switch/add-network requests. |
| `frontend/src/test/configuration.test.ts` | Missing/stale deployment, wrong chain/code and stale signing account. |
| `frontend/src/test/fixtures.ts` | Explicit test-only assets, accounts, transaction and wallet mocks. |
| `frontend/src/test/history.test.ts` | Deployment start, ranges, deduplication, outages and timestamps. |
| `frontend/src/test/issuer.test.tsx` | Compliance/funding/proceeds/closure/recovery and AUD-009 regression. |
| `frontend/src/test/services.test.ts` | Actual ABI method selection, preflight and receipt behavior tests. |
| `frontend/src/test/setup.ts` | Testing Library cleanup and jsdom dialog support. |
| `frontend/src/test/ui.test.tsx` | Marketplace, admin, creation, purchase, portfolio and receipt-timeout regression. |
| `frontend/src/test/validation.test.ts` | Exact payments, integer/price/address/overflow and ABI argument tests. |
| `frontend/src/test/wallet.test.tsx` | Connection, rejection, missing provider, chain/account events and discovery. |
| `frontend/src/types.ts` | Shared asset/account/history/wallet types. |
| `frontend/src/utils/errors.ts` | Friendly wallet/RPC failures and compiled custom-error decoding. |
| `frontend/src/utils/formatting.ts` | Display-only exact ETH, whole tokens, addresses and categories. |
| `frontend/src/utils/validation.ts` | Exact BigInt/wei parsing, uint256 bounds and creation/address validation. |
| `frontend/tsconfig.json` | Separate strict DOM/React/ES2022 frontend type checking. |
| `frontend/vite.config.ts` | React build, browser-like unit test setup and vendor bundle splitting. |
| `frontend/vite.integration.config.ts` | Isolate actual local-chain integration from mocked unit tests. |
| `hardhat.config.ts` | Explicit local chain ID and persistent localhost connection. |
| `package.json` | Node, persistent/ephemeral deployment, sync, demo and integration commands. |
| `scripts/deploy.ts` | Write deployment identity and sync ABIs after persistent deployment. |
| `scripts/seedLocal.ts` | Explicit empty-registry local CPT/DLT fixture without storing keys. |
| `scripts/syncFrontend.d.mts` | Type declaration for the side-effect ABI sync import. |
| `scripts/syncFrontend.mjs` | Copy ABI arrays from Hardhat compiled artifacts. |
