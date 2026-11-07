# Issue index

Inventory for Report Section 5. AUD-001 to AUD-003 are tracking issues for unbuilt phase work, not AI defects (audit-1 F-14). AUD-004 onward are defects. `scripts/new-issue.sh` appends a row here; update Status and Severity as you go.

| ID | Title | Severity | Category | Status |
|---|---|---|---|---|
| [AUD-001](AUD-001-core-contracts-and-compliance-controls-are-unimple.md) | Core contracts and compliance controls are unimplemented | high | tracking (unbuilt phase work) | fixed (714366d; freeze dropped by D5) |
| [AUD-002](AUD-002-frontend-dashboards-and-wallet-integration-are-uni.md) | Frontend dashboards and wallet integration are unimplemented | high | tracking (unbuilt phase work) | accepted 2026-11-07 (manual MetaMask rehearsal, user-reported; screenshots pending) |
| [AUD-003](AUD-003-deployment-and-verification-tooling-are-incomplete.md) | Deployment and verification tooling are incomplete | high | tracking (tooling) | open (Sepolia deploy outstanding) |
| [AUD-004](AUD-004-assettoken-does-not-enforce-transfer-eligibility.md) | AssetToken does not enforce transfer eligibility | high | access control / logic | fixed (4faf156; test+fix in one commit) |
| [AUD-005](AUD-005-invariant-1-contradicts-revocation-with-balance-an.md) | Invariant 1 contradicts revocation-with-balance and its test cannot detect it | medium | spec gap | fixed (0f9ce3f) |
| [AUD-006](AUD-006-issuer-can-renounce-or-lose-the-admin-role-permane.md) | Issuer can renounce or lose the admin role, permanently locking sale inventory | medium | access control | fixed (12f8cd2) |
| [AUD-007](AUD-007-eth-forced-into-assetsale-is-unrecoverable.md) | ETH forced into AssetSale is unrecoverable | low | logic | fixed (3659cce) |
| [AUD-008](AUD-008-platform-admin-can-authorise-itself-as-an-issuer.md) | Platform admin can authorise itself as an issuer | low | access control / spec gap | fixed (118d13b) |
| [AUD-009](AUD-009-issuer-inventory-form-loses-quantity-after-allowan.md) | Issuer inventory form loses quantity after allowance confirmation | low | frontend state | corrected; targeted before/after evidence |
| [AUD-010](AUD-010-receipt-timeout-incorrectly-reported-as-transactio.md) | Receipt timeout incorrectly reported as transaction failure | medium | transaction correctness | corrected; targeted before/after evidence |
| [AUD-011](AUD-011-frontend-lockfile-omits-non-macos-platform-binarie.md) | Frontend lockfile omits non-macOS platform binaries so npm ci fails on Windows and Linux | medium | build tooling | fixed (cdea4e9) |
| [AUD-012](AUD-012-assetfactory-is-exactly-at-the-eip-170-size-limit-.md) | AssetFactory is exactly at the EIP-170 size limit because the Sepolia deploy uses the unoptimised profile | low | deployment / contract size | fixed (74af940) |
| [AUD-013](AUD-013-transaction-history-shows-a-forced-transfer-as-an-.md) | Transaction history shows a forced transfer as an ordinary transfer sent by the holder | low | frontend | fixed (7da8dda) |
| [AUD-014](AUD-014-default-build-profile-leaves-assetfactory-at-the-e.md) | Default build profile leaves AssetFactory at the EIP-170 limit so local deploys and tests break on any contract growth | low | build configuration / contract size | fixed (e1fc698) |
| [AUD-015](AUD-015-frontend-unit-tests-fail-once-the-committed-deploy.md) | Frontend unit tests fail once the committed deployment is on Sepolia | low | test isolation / build configuration | fixed (a36b1e9) |
| [AUD-016](AUD-016-signing-wallet-deployment-is-not-checked-against-t.md) | Signing wallet deployment is not checked against the public RPC | medium | frontend transaction correctness | fixed in Phase 6 working tree (SEC-013) |
