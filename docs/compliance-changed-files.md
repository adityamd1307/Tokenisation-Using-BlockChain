# Compliance enhancement — changed files

Working tree on `auction`; no commits or pushes. Generated deployment addresses select the current local regulated demo. The previous UI configuration is backed up in ignored `deployments/pre-compliance-localhost.json`.

## Application, contracts, scripts and tests

- `.gitignore`
- `README.md`
- `contracts/AssetFactory.sol`
- `contracts/ComplianceLite.sol`
- `contracts/IdentityRegistryLite.sol`
- `contracts/RegulatedAssetDeployer.sol`
- `contracts/RegulatedAssetFactory.sol`
- `contracts/RegulatedAssetToken.sol`
- `frontend/integration/compliance.test.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/AppLayout.tsx`
- `frontend/src/components/AssetCreationForm.tsx`
- `frontend/src/components/IssuerManagement.tsx`
- `frontend/src/config/abi/ComplianceLite.json`
- `frontend/src/config/abi/IdentityRegistryLite.json`
- `frontend/src/config/abi/RegulatedAssetFactory.json`
- `frontend/src/config/abi/RegulatedAssetToken.json`
- `frontend/src/config/addresses.json`
- `frontend/src/config/contracts.ts`
- `frontend/src/pages/CompliancePage.tsx`
- `frontend/src/pages/InvestorPortfolio.tsx`
- `frontend/src/pages/SubscriptionPage.tsx`
- `frontend/src/services/blockchain.ts`
- `frontend/src/services/compliance.ts`
- `frontend/src/services/subscriptions.ts`
- `frontend/src/test/compliance.test.tsx`
- `frontend/src/test/fixtures.ts`
- `frontend/src/types.ts`
- `frontend/src/utils/compliance.ts`
- `frontend/src/utils/errors.ts`
- `package.json`
- `scripts/demoCompliance.ts`
- `scripts/deployCompliance.ts`
- `scripts/syncFrontend.mjs`
- `test/compliance/Compliance.test.ts`

## Documentation and audit

- `CLAUDE.md`
- `docs/AI_Audit_Report.md`
- `docs/ai-logs/INDEX.md`
- `docs/ai-logs/compliance-session.md`
- `docs/compliance-engine-design.md`
- `docs/compliance-test-results.md`
- `docs/compliance-threat-model.md`
- `docs/erc3643-comparison.md`
- `docs/erc3643-lite-specification.md`
- `docs/identity-registry-design.md`
- `docs/issues/AUD-017-subscription-transaction-mocks-break-the-productio.md`
- `docs/issues/AUD-018-compliance-checker-retains-issuer-sender-during-wa.md`
- `docs/issues/INDEX.md`
- `docs/spec/erc3643-lite-requirements.md`

## Evidence

Reproducible commands, results and verification limits are in [compliance-test-results.md](compliance-test-results.md). `docs/evidence/compliance/` retains baseline failures, final test/build logs, the demonstration receipts, measured bytecode sizes, LCOV, scanner output and before/after issue logs. `source-manifest.json` hashes the changed source/documentation files (excluding itself and this inventory); `results.json` records the measured totals.
