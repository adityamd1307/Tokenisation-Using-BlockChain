# Issue index

Inventory for Report Section 5. AUD-001 to AUD-003 are tracking issues for unbuilt phase work, not AI defects (audit-1 F-14). AUD-004 onward are defects. `scripts/new-issue.sh` appends a row here; update Status and Severity as you go.

| ID | Title | Severity | Category | Status |
|---|---|---|---|---|
| [AUD-001](AUD-001-core-contracts-and-compliance-controls-are-unimple.md) | Core contracts and compliance controls are unimplemented | high | tracking (unbuilt phase work) | open: pause/freeze/forcedTransfer only, pending D5 |
| [AUD-002](AUD-002-frontend-dashboards-and-wallet-integration-are-uni.md) | Frontend dashboards and wallet integration are unimplemented | high | tracking (unbuilt phase work) | open (Phase 4) |
| [AUD-003](AUD-003-deployment-and-verification-tooling-are-incomplete.md) | Deployment and verification tooling are incomplete | high | tracking (tooling) | open (Sepolia deploy outstanding) |
| [AUD-004](AUD-004-assettoken-does-not-enforce-transfer-eligibility.md) | AssetToken does not enforce transfer eligibility | high | access control / logic | fixed (4faf156; test+fix in one commit) |
| [AUD-005](AUD-005-invariant-1-contradicts-revocation-with-balance-an.md) | Invariant 1 contradicts revocation-with-balance and its test cannot detect it | medium | spec gap | fixed (0f9ce3f) |
| [AUD-006](AUD-006-issuer-can-renounce-or-lose-the-admin-role-permane.md) | Issuer can renounce or lose the admin role, permanently locking sale inventory | medium | access control | fixed (12f8cd2) |
| [AUD-007](AUD-007-eth-forced-into-assetsale-is-unrecoverable.md) | ETH forced into AssetSale is unrecoverable | low | logic | fixed (3659cce) |
| [AUD-008](AUD-008-platform-admin-can-authorise-itself-as-an-issuer.md) | Platform admin can authorise itself as an issuer | low | access control / spec gap | fixed (118d13b) |
