# Compliance validation and demonstration

Executed 7 November 2026 on branch `auction`, working tree based on `d9ff2f5`. No commits, pushes, mainnet or public testnet deployment were performed for Enhancement C. Exact original request: [preserved prompt](spec/erc3643-lite-requirements.md). [Specification](erc3643-lite-specification.md) records the implementation choices before the contracts were written.

## Baseline and final results

| Check | Initial result | Final evidence |
|---|---|---|
| Existing contracts | 194 passing using existing cached artifacts | **229 passing**: [contracts.log](evidence/compliance/contracts.log) |
| Frontend components/services | 131 passing | **140 passing**: [frontend-tests.log](evidence/compliance/frontend-tests.log) |
| Real-chain frontend integration | Prior subscription report recorded 2 | **3 passing**: [integration.log](evidence/compliance/integration.log) |
| Production frontend build | Failed: pre-existing subscription mock types | Pass: [frontend-build.log](evidence/compliance/frontend-build.log), AUD-017 |
| Root TypeScript | Final verification | Pass, no diagnostics: [root-types.log](evidence/compliance/root-types.log) |
| Contract coverage | Prior report retained separately | 229 passing under instrumentation; **96.11% lines**, 96.93% statements including harnesses: [coverage.log](evidence/compliance/coverage.log), [LCOV](evidence/compliance/coverage.lcov) |
| Static analysis | Prior subscription: 13 reports | 17 reviewed results across 43 contracts: [JSON](evidence/compliance/slither.json), [triage](compliance-threat-model.md) |
| Isolated demonstration | New | Assertions pass, 8 expected rejection checks and actual successful receipts: [demo.json](evidence/compliance/demo.json) |
| Local deployment | New | Fresh regulated factory, CPT, registry/policy, MockUSD and subscription factory: [deployment log](evidence/compliance/local-deployment.log) |
| Browser visual / MetaMask | No connected browser | **Not performed**; discovery returned no browsers |

The initial ordinary `npm test`/compile attempts encountered a compiler-cache permission/lock error. Cached-artifact execution established the 194-test baseline. Authorized compiler access enabled subsequent full compilation and tests. The preserved failed build log is not replaced by a claim that the baseline was clean. An intermediate local-node start was blocked by automatic approval review hitting a usage limit; after the user asked to continue, the retry succeeded.

New-contract line coverage: identity registry 94.74%, compliance policy 87.50%, regulated token 82.14%, regulated deployer 100%, regulated factory 100%. Coverage gaps include defensive constructor branches and compatibility getters. These percentages are measured, not a claim of complete branch coverage or formal correctness.

## Test scope

`test/compliance/Compliance.test.ts` adds 35 cases covering registration and role separation, failed self-attestation, missing/duplicate/invalid data, exclusive expiry, revocation, attestor distrust and re-attestation; independent jurisdiction/accreditation/caps; exact caps, zero and self transfers, lowered caps, direct/delegated enforcement; factory roles and one-time linkage; forged custody rejection; atomic direct purchases; oversubscription, unchanged allocation, delayed claims, independent refunds and protected reserves; nonexistent mint/burn/recovery/rebinding selectors; and 60 seeded transfer operations with supply/cap assertions. The original 194 contract tests remain passing.

Nine new frontend tests exercise public metadata, legacy-only empty state, actual preflight service calls and reason display, edited-result invalidation, wallet switching, role-controlled trust/renewal/policy transactions, wrong-network disabling and ABI custom-error decoding. A real initialization bug was found and fixed as AUD-018.

`frontend/integration/compliance.test.ts` deploys real contracts and calls production Blockchain, Compliance and Subscriptions services through an EIP-1193 adapter over unlocked local accounts. It creates regulated and legacy assets in the same registry, manages credentials/policy, purchases tokens, rejects over-cap delivery, funds an offering, commits, settles, revokes, withdraws a refund, renews and claims. The other two real-chain suites continue to exercise original direct-sale and subscription lifecycles. This is not a MetaMask test.

## Reproduce

```bash
npm test
npm --prefix frontend test
npm --prefix frontend run build
npx tsc --noEmit
npm run demo:compliance
npx hardhat test --coverage
```

For a persistent local browser demonstration:

```bash
npm run node                       # terminal 1; localhost:8545
npm run deploy:compliance:local     # terminal 2; fresh local regulated deployment
npm --prefix frontend run dev       # http://127.0.0.1:5173
npm run test:integration            # deploys separate test fixtures on that node
```

The deployment command changes the frontend's active local registry; it does not upgrade old assets. It backs up the previous config to `deployments/pre-compliance-localhost.json`. Existing contracts stay on their original chain and at their original addresses. Repeating the command creates another fresh registry, so retain the previous config if you need to return to it. Never use actual private keys or personal identity data. Local scripts enforce chain 31337; the time-travel demo additionally requires the isolated `hardhatMainnet` network.

Local account roles: 0 platform admin, 1 issuer, 2 trusted attestor, 3 verified/accredited Singapore investor, 4 non-accredited investor, 5 KYC-denied investor, 6 restricted-country investor. Persistent credentials last 30 chain days. In the isolated scripted demo, F is registered with a short *future* expiry and time advances until expiry; expired-at-registration input is correctly rejected. The demo then renews F before subscribing and revokes it after allocation to demonstrate refund independence.

## Actual demonstration outcomes

CPT supply 10,000; investor cap 500; Singapore allowed; accreditation required. D receives 100 then 350, rejects an additional 100, and accepts 50 to reach exactly 500. E/F/G fail accreditation/expiry/jurisdiction respectively. Revoked D cannot send or receive; renewal restores movement. D returns inventory to make claim capacity. D and renewed F each commit 2,000 mUSD to 1,000 CPT at 2 mUSD; each allocation is 500 CPT and refund 1,000 mUSD. D claims; revoked F cannot claim but receives its refund. F's 500 CPT stay reserved; issuer recovery fails. Renewed F claims later. Final balances: issuer 9,000 CPT, D 500, F 500, reserved 0.

Example recorded gas: create regulated asset 3,540,969; first 100-token transfer 87,469; later transfer to reach cap 70,369; D claim 126,076. These are local absolute measurements, not costs or savings promised on a public network.

## Remaining manual acceptance

Open the local app with MetaMask, choose the local chain and the named development accounts, then rehearse issuer creation, attestor credential registration/renewal, policy administration, a failing purchase/claim and an independent refund. Check desktop/mobile layout, focus/accessibility, signing rejection and account switching. The code and automated tests are implemented; visual acceptance and an independent human/security review remain unverified. Optional pause, freezes and lost-wallet recovery were intentionally not implemented.
