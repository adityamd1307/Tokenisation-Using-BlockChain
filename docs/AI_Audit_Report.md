# SC4053 AI Audit Report

Tokenisation of Real-World and Digital Assets on Ethereum. Updated for subscription issuance and ERC-3643-inspired Lite compliance on 7 November 2026. The current checkout had historical issue records and a report map, but no assembled AI_Audit_Report.md at enhancement start; this report consolidates that evidence and the new work. Official student names/IDs, individual contributions and independent human review must be completed by the team; they are not inferred from AI execution.

## 1. Initial Specification & System Scope

The team's preserved [pre-AI proposal](spec/spec-v0.md) describes asset issuance, wallet holdings, acquisition/transfers, ownership history and compliance. The original implementation uses three contracts with fixed-supply restricted ERC-20 assets and direct ETH purchases. The user confirmed coordinator approval without additional requirements during the scope review.

The later [verbatim enhancement request](spec/subscription-requirements.md) explicitly adds subscription windows, mock stablecoin escrow, soft/hard caps, proportional allocations, settlement, pull refunds, token claims and earned issuer proceeds. It requires preserving direct sales. [Implementation decisions](subscription-offering-specification.md) record the exact semantics before the new contracts were written. Fictional assets and MockUSD establish no real ownership, backing or return.

Enhancement C's [preserved request](spec/erc3643-lite-requirements.md) adds synthetic identities, trusted attestors, per-asset jurisdiction/accreditation/holding policies and token-level enforcement. The coordinator's BYOP approval was unchanged; no new professor requirements are inferred. [Lite specification](erc3643-lite-specification.md) defines the supported scope. The user explicitly requested implementation, tests, frontend integration and audit evidence, while excluding commits and mainnet.

## 2. Development Methodology & AI Tooling Infrastructure

Historical sessions and recorded tool/model names are retained in [ai-logs/INDEX.md](ai-logs/INDEX.md). This enhancement used Codex with repository reads, patching, local shell commands, Hardhat/ethers, React/Vitest, TypeScript, Slither and browser discovery. No other agent was delegated work, no model identity is guessed, and no independent human/professional audit is implied. The user instructed that no Git commits or mainnet deployments be made.

The inspected installation uses Solidity 0.8.24, Hardhat 3.21.0, OpenZeppelin 5.6.1, ethers 6.17.0 and React 18.3.1. Baseline tests/builds preceded implementation. New contracts were added alongside existing ones; staged tests covered economics before frontend integration. Deployment and demo scripts write reviewable output. Compiler-cache permissions were needed for compilation, and local-network permissions for integration; no secrets were inspected.

Human scope approval, team development responsibilities and review are distinct from AI-generated implementation/testing. The team should supply its actual contribution statement and mandatory course peer evaluation. This report does not invent those activities.

## 3. Specification Engineering & Prompt Logs

The original spec and staged phase requirements remain unchanged. The exact subscription request is archived, and the session summary is [subscription-session.md](ai-logs/subscription-session.md). It is labelled a curated summary, not a fabricated verbatim dialogue.

The prompt's most significant constraints were: permit commitments above the hard cap; apply the soft cap to accepted funding after rounding; use constant-cost finalisation and lazy settlement; keep refunds independent of restricted-token claims; and preserve direct sales. These constraints drove the design more than a simple feature list. The chosen lower bound and its false-failure/Sybil trade-offs are made explicit in both documentation and UI.

For compliance, the exact prompt and [curated session](ai-logs/compliance-session.md) distinguish user requirements from AI design choices. The official ERC-3643 and Tokeny interfaces were inspected; [comparison](erc3643-comparison.md) states omissions without claiming full standards compliance. Decisions include per-asset registries, recipient country/accreditation rules plus both-endpoint identity checks, permanent exact custody classification, no external mint/burn/forced transfer, and fixed validation references. An immutable helper keeps deployment sizes bounded.

## 4. AI-Generated Architecture

The implementation adds owner-minted MockUSD, SubscriptionFactory and SubscriptionOffering. At the subscription milestone, the original AssetFactory/AssetToken/AssetSale were unchanged. Enhancement C later extracted a shared AssetFactory registration helper; legacy token and sale behavior remain intact. The subscription registry validates original asset IDs, issuer ownership and authorisation, then deploys independent escrows. The factory pins the actual MockUSD instance used by the local platform deployment.

The engine computes time stages from immutable dates, accepts price-multiple commitments during the window and finalises once after end. Over subscription, allocation is `floor(commitment × supply / totalCommitments)` using Math.mulDiv. Success is based on a conservative lower bound on accepted funding; no global investor loop runs. Settlement records allocation/refund/proceeds without transferring tokens. Claim, refund, issuer withdrawal and unallocated-inventory recovery remain separate guarded operations. See [architecture and API](subscription-offering-architecture.md) and [mathematical derivation](subscription-allocation-mathematics.md).

React reuses the existing wallet/data/transaction contexts. A subscription service verifies public and signing deployment fingerprints. Marketplace, issuer creation and offering pages display real contract state, exact mUSD amounts, demand above 100%, individual entitlements and typed event history.

Enhancement C adds IdentityRegistryLite, ComplianceLite, RegulatedAssetToken, RegulatedAssetDeployer and RegulatedAssetFactory. Future deployments support both legacy and regulated creation in one asset registry. Platform identity administration and issuer policy administration remain distinct from trusted attestation. New regulated tokens use OpenZeppelin v5 `_update` for all ordinary direct/delegated transfers and expose the same reason-based preflight to the browser. Sale and subscription contracts are reused without changing financial accounting. Failed claims retain their allocation and inventory reserves; refunds bypass asset compliance. No generic operational exemption setter exists.

The Compliance route provides credential lookup/administration, role-based attestor and policy actions, connected investor status and transfer diagnostics. Existing issuance, sale, portfolio and subscription UI use the regulated path. Local deployment config and ABI generation were extended; immutable legacy deployments were not modified.

## 5. Problems Discovered & Vulnerability Analysis

Historical AUD-001–003 track phase work rather than invented vulnerabilities. AUD-004–015 record transfer enforcement, specification/test mismatch, role recovery, forced ETH, admin policy, form-state loss, receipt uncertainty, lockfile portability, deployment size, event labelling and deployment-dependent tests. Each historical issue's four-part analysis and evidence remain in the [issue index](issues/INDEX.md); this enhancement does not reclassify them as newly discovered defects.

**Confirmed enhancement compatibility issue: [AUD-016](issues/AUD-016-disabled-subscription-section-triggers-extra-regis.md), disabled subscriptions triggered an extra asset-registry read.**

1. **Why AI made the mistake:** the generated component called useAssets before checking whether the subscription deployment existed. This ordering is directly observable; hidden model reasoning is unknown.
2. **Why problematic:** even legacy-only deployments mounted the extra reader, causing an existing RPC error/retry test to fail and creating unnecessary requests.
3. **Fix:** return from a small wrapper when disabled; mount the data-reading component only when configured.
4. **Evidence:** [frontend-compatibility.log](evidence/subscription/frontend-compatibility.log) records 117 passing/1 failing; [frontend-compatibility-after.log](evidence/subscription/frontend-compatibility-after.log) records all 118 passing. The final expanded suite passes 131.

Other genuine development errors were in generated test/build scaffolding: a removed matcher, a non-mined timestamp assumption, a non-virtual hook override, a dynamic TypeChain overload and a JSX closing brace. Their exact failures and corrections are summarised in [security analysis](subscription-security-analysis.md) with retained logs. None is portrayed as a fund-draining production exploit.

Static analysis initially flagged an implicitly zero lower bound. Solidity's default-zero semantics were safe; explicit initialization improved clarity and removed the warning. Final Slither findings are individually assessed in the security analysis. No confirmed critical production exploit was found; scanner severities are not silently relabelled as proven vulnerabilities or proofs of safety.

**Enhancement C confirmed issues:** [AUD-017](issues/AUD-017-subscription-transaction-mocks-break-the-productio.md) reproduces a pre-existing production TypeScript failure in partial subscription transaction mocks. The fixture-only type declaration fixes the build without weakening services. [AUD-018](issues/AUD-018-compliance-checker-retains-issuer-sender-during-wa.md) records a new sender-prefill bug: account resolution followed session invalidation, leaving the issuer initializer in place. Keying forms by resolved account fixes it. Each issue has the four-part analysis, before/after logs and a learned rule; neither is presented as a fund-loss exploit.

The first generated regulated factory exceeded Solidity's argument stack depth. A structured creation/deployment request resolved compilation without changing compiler semantics or enabling via-IR. TypeChain struct calls were converted from positional arrays to typed objects; frontend tests were corrected to actually connect the wallet and use the established confirmation label. These are observed development/harness corrections, not invented vulnerabilities.

The [compliance threat model](compliance-threat-model.md) reviews 17 Slither reports: previous custody transfer/zero-balance/ETH payout warnings, immutable-helper factory reentrancy warnings and explicit credential expiry comparisons. No confirmed critical/high exploit was found, and no proof of safety is claimed. Trusted attestor dishonesty, administrator control, wallet splitting and credential-dependent claim delays remain explicit trust limitations.

## 6. Validation Process & Testing Strategy

Subscription-milestone baseline: 142 contract tests, 118 frontend tests, successful build and root typecheck. Final: 194 contract tests, 131 frontend tests, two real-chain service integrations, successful typechecks/build and a complete local demonstration. [Testing results](subscription-testing-results.md) links every measured command and limits.

New tests verify access control, subscription deadlines, funding/allowances, gross demand above hard cap, exact examples, rounding-induced soft-cap failure, conservative false failure, zero allocation, huge mulDiv inputs, reverse settlement order, 54 seeded top-ups with accounting checks, safe inventory recovery, incompatible transfers, callbacks, insufficient reserves, contract investors and independent refunds under revoked eligibility. Real-chain integration deliberately withdraws recognised proceeds before refunds to test liability protection, then confirms direct ETH purchases remain operational.

Measured new-contract line coverage: MockUSD 100%, SubscriptionOffering 97.62%, SubscriptionFactory 93.75%; whole measured set 98.02%. No branch-completeness/formal-proof claim is made. Slither analysed 33 contracts using 102 detectors and reported 13 reviewed findings. Optimised runtime sizes remain below EIP-170. Tests that used cached artifacts initially yielded an empty coverage report; only the later instrumented report supports coverage claims.

No browser was connected. Component rendering and an EIP-1193 RPC adapter do not prove MetaMask or responsive visual acceptance. No public subscription deployment or screenshot was fabricated.

Enhancement C baseline: 194 existing contract tests and 131 frontend tests passed; production build failed on the reproduced AUD-017 type mismatch. Final: **229 contracts, 140 frontend tests and 3 real-chain service integrations pass**, along with TypeScript/build, isolated demo assertions and local deployment. [Detailed results and artifacts](compliance-test-results.md) replace any assumption that a prior clean build applied to this checkout. Instrumented aggregate line coverage is 96.11%; individual new-contract coverage is recorded, including gaps. Contract sizes all remain within runtime/init-code limits. Actual receipt gas is reported rather than a guessed overhead percentage.

The automated local demo verifies accreditation, expiry, jurisdiction, exact holding limits, revocation, renewal, delayed claims, independent refunds and protected escrow. UI regression tests cover account resolution/switching and role-controlled writes. A fresh local regulated deployment was configured with a backup of previous UI addresses; no public deployment was performed. Browser discovery again returned no available browser, so real MetaMask and visual acceptance are pending.

## 7. Improvements & Refinements

The enhancement adds a full deferred issuance lifecycle while keeping legacy contracts intact. Its central improvements are explicit liability accounting, recognised proceeds rather than gross escrow withdrawals, independent refund/claim flows, full-precision floor allocation, conservative soft-cap guarantees and reserves protecting unclaimed allocations.

Review refinements include exact transfer deltas, permissionless accounting-only settlement for inactive subscribers, bounded/adaptively split event history, wallet deployment fingerprint checks, account-specific input invalidation, corrected legacy-read behaviour and explicit zero initialization. These are attributed to observed implementation work, not a claimed independently approved design. No new dependency or unmeasured gas saving is asserted.

Compliance improvements include separate identity/policy responsibilities, permanent narrowly validated custody addresses, shared on-chain preflight/enforcement, signed-RPC deployment fingerprint checks, compatibility getters for existing offerings and preserving refunds when credentials expire. The Lite implementation deliberately omits optional emergency token powers to avoid adding seizure/recovery bypasses to the core model. It preserves standard comparison honesty rather than presenting architectural inspiration as certification.

## 8. Lessons Learned

A visually plausible funding progress bar does not establish accepted funding. Whole-token rounding changes both allocation and proceeds, so the success rule must be derived before writing settlement logic. Likewise, money in escrow is not necessarily issuer revenue: unsettled deposits and refunds remain liabilities even after finalisation.

Generated tests need validation too. Installed matcher APIs, TypeChain overloads and block-mining semantics caused real harness failures. Preserving failures and correcting them gives stronger evidence than reporting only the final test count. Static analysis needs current compiler artifacts and finding-specific reasoning; default-value/timestamp warnings are not automatically vulnerabilities.

Constant-cost finalisation trades precision for a conservative success condition. Wallet splitting can exploit that conservatism, and inherited administrator recovery powers can block token delivery. These limitations belong in the product explanation, tests and report. Passing tests do not remove them. The final team rehearsal should focus on real wallet interaction, dates, signing rejection, revoked-investor refunds, successful/failing outcomes and visual clarity.

For compliance specifically, a registered identity is not universal asset eligibility, a holding cap is per wallet rather than per person, and committing funds does not reserve future wallet capacity. Credential revocation must not be confused with forfeiture of economic entitlements. Async wallet session changes also do not imply that an account has already resolved; component keys and tests must model both steps.
