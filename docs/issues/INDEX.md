# Issue index

Inventory for Report Section 5. AUD-001 to AUD-003 are tracking issues for unbuilt phase work, not AI defects (audit-1 F-14). AUD-004 onward are defects. `scripts/new-issue.sh` appends a row here; update Status and Severity as you go.

**Numbering (updated 7 November 2026, after merging origin/main).** Several lines of work allocated numbers independently.
- On main, AUD-016 to AUD-018 are the subscription and compliance issues, published through PRs #3 and #4.
- AUD-030 is the Phase 6 signing-RPC issue. Commit c7cb0d1 numbers it AUD-016, and its raw logs and `docs/audit/source-manifest.json` keep that number.
- The unmerged `frontend-redesign` branch has its own local AUD-016 and AUD-017 (pause pre-flight; history labels). The independent review pass planned to start at AUD-018. Both now collide with published numbers and need new ones before they reach main.
- AUD-019 to AUD-029 are free. `scripts/new-issue.sh` takes the highest number plus one, so on any tree that contains AUD-030 it hands out AUD-031; give issues 019 to 029 their numbers by hand.

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
| [AUD-016](AUD-016-disabled-subscription-section-triggers-extra-regis.md) | Disabled subscription section triggers extra registry reads | low | frontend compatibility | fixed; retained before/after logs, no commits |
| [AUD-017](AUD-017-subscription-transaction-mocks-break-the-productio.md) | Subscription transaction mocks break the production type check | low | frontend build | fixed; before/after logs, no commits |
| [AUD-018](AUD-018-compliance-checker-retains-issuer-sender-during-wa.md) | Compliance checker retains issuer sender during wallet connection | low | frontend state | fixed; before/after logs, no commits |
| [AUD-030](AUD-030-signing-wallet-deployment-is-not-checked-against-t.md) | Signing wallet deployment is not checked against the public RPC | medium | frontend transaction correctness | fixed (c7cb0d1; SEC-013; no separate test/fix commits, after-the-fact evidence runs) |
