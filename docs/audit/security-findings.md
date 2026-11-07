# Security findings ledger

SEC identifiers are report aliases for the existing AUD issue IDs, not new claims that historical defects remain present. AUD-001–003 track phase completion and are not vulnerabilities. Severity in historical entries includes correctness/reproducibility impact, not only financial exploitability. One new confirmed medium frontend issue (SEC-013) was reproduced and corrected in Phase 6. No new confirmed production-contract exploit was found; no known critical issue is unresolved.

| ID (legacy) | Component | Severity | Problem | Status | Evidence |
|---|---|---|---|---|---|
| SEC-001 (AUD-004) | AssetToken | High | Whitelist existed without transfer enforcement | Fixed historically; regression retained | [AUD-004](../issues/AUD-004-assettoken-does-not-enforce-transfer-eligibility.md) |
| SEC-002 (AUD-005) | Specification/tests | Medium | Contradictory eligibility invariant and ineffective test | Fixed historically; regression retained | [AUD-005](../issues/AUD-005-invariant-1-contradicts-revocation-with-balance-an.md) |
| SEC-003 (AUD-006) | AssetToken / AssetSale | Medium | Issuer admin role loss could strand inventory | Fixed historically; regression retained | [AUD-006](../issues/AUD-006-issuer-can-renounce-or-lose-the-admin-role-permane.md) |
| SEC-004 (AUD-007) | AssetSale | Low | Forced ETH had no recovery path | Fixed historically; regression retained | [AUD-007](../issues/AUD-007-eth-forced-into-assetsale-is-unrecoverable.md) |
| SEC-005 (AUD-008) | Factory policy | Low | Platform admin could authorise itself as issuer | Fixed historically; regression retained | [AUD-008](../issues/AUD-008-platform-admin-can-authorise-itself-as-an-issuer.md) |
| SEC-006 (AUD-009) | Frontend state | Low | Approval refresh erased the deposit quantity | Fixed historically; regression retained | [AUD-009](../issues/AUD-009-issuer-inventory-form-loses-quantity-after-allowan.md) |
| SEC-007 (AUD-010) | Frontend transactions | Medium | Receipt timeout was displayed as transaction failure | Fixed historically; regression retained | [AUD-010](../issues/AUD-010-receipt-timeout-incorrectly-reported-as-transactio.md) |
| SEC-008 (AUD-011) | Build reproducibility | Medium | Frontend lockfile omitted platform packages | Fixed historically; regression retained | [AUD-011](../issues/AUD-011-frontend-lockfile-omits-non-macos-platform-binarie.md) |
| SEC-009 (AUD-012) | Deployment configuration | Low | Sepolia script omitted optimized build profile | Fixed historically; regression retained | [AUD-012](../issues/AUD-012-assetfactory-is-exactly-at-the-eip-170-size-limit-.md) |
| SEC-010 (AUD-013) | Frontend history | Low | Forced transfer was mislabeled as holder transfer | Fixed historically; regression retained | [AUD-013](../issues/AUD-013-transaction-history-shows-a-forced-transfer-as-an-.md) |
| SEC-011 (AUD-014) | Build configuration | Low | Default build retained the factory size risk | Fixed historically; regression retained | [AUD-014](../issues/AUD-014-default-build-profile-leaves-assetfactory-at-the-e.md) |
| SEC-012 (AUD-015) | Frontend test isolation | Low | Unit tests depended on generated deployment network | Fixed historically; regression retained | [AUD-015](../issues/AUD-015-frontend-unit-tests-fail-once-the-committed-deploy.md) |
| SEC-013 (AUD-030) | Frontend signer | Medium | Signing RPC deployment was not verified | Fixed (c7cb0d1) | [AUD-030](../issues/AUD-030-signing-wallet-deployment-is-not-checked-against-t.md) |

## Informational findings and potential risks (separate from confirmed defects)

| ID | Classification | Issue / disposition |
|---|---|---|
| INF-001 | Operational/trust | Issuer/delegated admin can revoke then force-transfer; lost issuer key remains unrecoverable. Approved compliance power can freeze live sale inventory. Intended trust model, with restoration/recovery tested. |
| INF-002 | Unsupported deployment | Direct AssetSale constructor accepts nonzero arbitrary token/EOA; factory only deploys known AssetToken. Generic fee/callback/malicious ERC-20 compatibility is not supported. |
| INF-003 | Scalability | Metadata unbounded on chain, registry UI eventually reads all assets; log timestamps are fetched concurrently. Trusted issuer/gas and RPC scalability limits; no batch-creation feature. |
| INF-004 | Development dependency risk | Root npm audit 16 affected dev nodes; production-only and frontend audits zero. No forced incompatible toolchain downgrade. |
| INF-005 | Potential compiler issue requiring further validation | Compiler 0.8.24 has newer published advisories; no exploit reproduced. Optimized legacy utility-code applicability remains uncertain for SOL-2026-7. Review before production. |
| INF-006 | Verification gap | Browser connection unavailable; MetaMask acceptance and Sepolia deployment evidence absent. Open AUD-002/AUD-003; submission acceptance pending. |
| INF-007 | Frontend limitation | Pending transactions are in-memory per session; reload/account cycling can lose duplicate-submission protection. Wallet review remains necessary. |

All 29 final Slither results have individual classifications and reasons in slither-triage.json and slither-summary.md. High arbitrary-transfer warning is disproved by onlyIssuer/immutable source/allowance; high unchecked-transfer warning belongs only to a test harness. Reentrancy event-order warnings are informational, supported by accounting/callback tests. No detector is silently suppressed.
