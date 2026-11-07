# Compliance Lite security review

Scope: five new contracts, shared AssetFactory registration helper, existing direct/subscription integrations, frontend services and deployment/demo scripts. Reviewed by the same Codex session that implemented them; no independent professional audit or formal proof is claimed. Sources of evidence: [contract tests](evidence/compliance/contracts.log), [real-chain integration](evidence/compliance/integration.log), [Slither output](evidence/compliance/slither.json), [demo receipts](evidence/compliance/demo.json).

## Trust boundaries

| Actor / input | Authority and residual risk | Enforcement / evidence |
|---|---|---|
| Platform administrator | Selects issuers, delegates identity administration, trusts attestors, selects subscription registry once | Unauthorized issuance/role/registry calls revert; configured registry is a trusted administrative choice |
| Trusted attestor | Can issue false simulated credentials or revoke another attestor's record | Explicit role; no self-attestation; current trust checked for every verification; cannot prove real-world truth |
| Policy issuer | Can tighten country/accreditation/cap and thereby delay claims | Cannot alter allocated amounts, withdraw refunds or seize regulated escrow; restoration may require this trusted actor |
| Investor / spender | May attempt delegated, self, zero-value or multiple-wallet bypass | Token hook, actual balances, ERC20 allowance; 60 seeded direct/delegated operations preserve supply/caps |
| Operational escrow | May hold inventory above investor cap | Exact sale binding; offering membership and token/issuer matching; no arbitrary exemptions or removal |
| Validator contracts | Reverting validators could block transfers | Factory-created fixed code, immutable references, bounded static reads; no upgrade or attacker-provided callbacks |
| Browser / RPC | Stale reads, account switching, wrong chain or deployment | Keyed state invalidation, receipt refresh, polling, signing fingerprint checks; on-chain enforcement remains authoritative |

Credentials and per-wallet holdings do not prevent Sybil splitting, attestor collusion or compromised privileged keys. Original administrators are intentionally permanent recovery authorities. All metadata is public and synthetic; this must not be deployed as real identity storage. Lost wallet recovery, credential disputes, real legal ownership and issuer solvency are outside the implementation.

## Custody and financial invariants

1. Fixed token supply is conserved; no public mint, burn, forced-transfer or replacement-validator selector exists.
2. Every ordinary transfer rechecks both endpoint identities and recipient policy; `transferFrom` cannot bypass it.
3. Operational custody is permanent and specific to factory-created contracts. It cannot be revoked to strand outstanding allocations.
4. Failed purchases retain neither ETH proceeds nor token movement. Failed claims retain the original entitlement and `claimed == false`.
5. Expired/revoked investors retain refund access. Identity and policy changes never modify pro-rata allocation or payment liabilities.
6. Inventory reserved for unsettled/unclaimed allocations cannot be recovered by the issuer. No claim expiry was added.

Stricter sender identity checking intentionally blocks outgoing movement after expiry/revocation. Renewing a credential can restore access. Country/accreditation changes affect recipients; a still-verified sender can reduce existing holdings. A lowered maximum does not confiscate excess existing holdings. Permanent custody classification avoids a separate removal/remediation state machine, but does not permit retiring an escrow's exemption.

## Static-analysis triage

Slither 0.11.6 analyzed 43 contracts with 102 detectors and reported **17 results**: 2 high, 3 medium, 10 low and 2 informational. Severity is the scanner's classification, not a confirmed exploit count.

| Detector | Count | Assessment |
|---|---:|---|
| arbitrary-send-erc20 (high) | 2 | Existing sale allocation and offering inventory deposit intentionally transfer from the immutable issuer. Issuer-only access and allowance are required; the caller cannot select another source. Existing/new funding tests cover this. |
| incorrect-equality (medium) | 3 | Zero-recoverable checks in sale recovery, sale forced-ETH sweep and subscription inventory recovery. Zero means nothing is payable; a positive donation remains recoverable subject to reserves. These checks do not require a manipulable balance to equal a target. |
| reentrancy-events (low) | 3 | Two existing sale withdrawal event order reports plus new factory event ordering. Sale payouts use checks-effects-interactions. New factory calls only its immutable constructor-created helper, which deploys known contracts without issuer callbacks. No attacker-controlled call path was found. |
| reentrancy-benign (low) | 1 | New factory inserts registry state after the immutable helper returns. Helper is factory-only and nonreplaceable; created constructors/read-only getters do not call attacker code. No reachable adversarial reentry was found. |
| timestamp (low) | 6 | Four prior offering stage/window comparisons plus registry future-expiry validation and expiration. Chain timestamp is intentional; exact-expiry tests cover the boundary. No claim of precise wall-clock scheduling. |
| low-level-calls (informational) | 2 | Existing issuer ETH payouts; failed calls revert and accounting is zeroed before transfer. |

Additional targeted checks reject forged sale/standalone offering enrollment, arbitrary role escalation, factory rebinding, unknown mint/recovery selectors, unsupported country data, false KYC, expired credentials, untrusted attestors and self-attestation. Current contracts have no externally writable compliance hooks, and validators execute through static calls. This reduces callback reentrancy exposure; it is not a proof against every possible deployment error.

No confirmed critical/high production vulnerability was found in this review. Confirmed issues were an existing frontend build blocker ([AUD-017](issues/AUD-017-subscription-transaction-mocks-break-the-productio.md)) and an asynchronously initialized sender field ([AUD-018](issues/AUD-018-compliance-checker-retains-issuer-sender-during-wa.md)). Both have before/after evidence. A Solidity stack-depth compile error was corrected by structured creation arguments before runnable deployment; it is not represented as a security exploit.

## Gas and deployment size

Runtime sizes: regulated factory 15,716 bytes, helper 18,697, registry 3,523, policy 2,810, token 4,701. Each is below EIP-170's 24,576-byte limit; factory creation bytecode before constructor arguments is 34,771 bytes, below 49,152. [Measured sizes](evidence/compliance/bytecode-sizes.json) include the old factory and subscription contracts. The helper keeps creation bytecode out of the factory runtime without mutable external deployers.

Transfer-time validation performs a fixed number of mapping reads and static calls. No investor enumeration is on-chain. [Demo receipts](evidence/compliance/demo.json) record gas for actual creation, attestation, transfer and claim transactions. Absolute local measurements are not a benchmark against full ERC-3643 or a promised network fee. Rejected estimates are labeled separately and have no invented receipts.
