# Phase 4 AI-assisted implementation and audit

Date: 28 October 2026. Tool: Codex. This is a curated session summary, **not a verbatim transcript**. The user's complete initial specification is preserved at [phase4-requirements.md](../spec/phase4-requirements.md). No human-authored code changes, Git commits, independent audit or manual browser validation are claimed.

## Context and prompt chain

The user explicitly requested implementation rather than a plan: inspect the existing Phase 3 contracts and artifacts; retain the React/Vite/ethers toolchain and Solidity; implement wallet, marketplace, role dashboards, lifecycle and activity; run meaningful automated/local integration tests; preserve AI audit evidence; do not commit or deploy Phase 5.

The agent inspected repository instructions, specs, implementation reports, all three production contracts, tests, deployment scripts and installed dependencies. The initial frontend build was actually executed and failed with a missing tsconfig. The historical specification names were reconciled with the real ABIs, including `admin`, `authorisedIssuers`, `allocate`, `buyTokens` and `recoverUnsoldTokens`. No subsequent user prompt revisions were received; implementation refinements below were driven by observed source and test results, not invented user instructions.

The Sites skill was used in its explicitly local-only mode; it did not create or publish a hosted site. Browser skill discovery found no connected browser, so no screenshots or MetaMask interactions were claimed. Network/cache sandbox permissions were needed for npm downloads, Hardhat compiler cache access and local listeners. Successful approved commands are logged; the first sandboxed compiler attempt failed on its lock outside the writable workspace.

## Significant implementation decisions

- Retain React 18/TypeScript/Vite 6/ethers 6. Add routing and a small Vitest + jsdom + Testing Library harness with a lockfile. Do not rewrite the contracts or add a database/indexer.
- Use a public configured RPC for browsing and an EIP-1193 wallet signer for writes. Support EIP-6963 selection and clean up provider listeners. Never read wallet secrets or `.env` files.
- Use session generations and keyed reads to clear private account-derived UI immediately and reject delayed responses from a previous account. Recheck actual account/network before signing.
- Generate ABI files from Hardhat artifacts. Write deployment block/hash and runtime-code hash to detect resets even if the same address is reused. Make persistent local deployment the default `deploy:local` workflow.
- Use only zero-decimal `BigInt` token units and wei; reject invalid/overflowing values. Never multiply ETH floats.
- Treat receipt status 1 as success; handle rejected/reverted/replaced and unknown-confirmation transactions separately.
- Keep issuer creation authority separate from ownership of existing token/sale instances. Read real token compliance/admin roles, rather than assuming the issuer always retains COMPLIANCE_ROLE.
- Preserve separate exact allowance and deposit transactions, with no unlimited approval and no automatic second transaction.
- Query real logs in bounded ranges, deduplicate primary purchase transfers and distinguish contract ETH balance from accounted proceeds.
- Keep local integration verification separate from real browser/MetaMask evidence. The local adapter signs only through Hardhat's unlocked development accounts and never reads private keys.

## Observed issues and corrections

| Observation | Evidence / impact | Correction and validation |
|---|---|---|
| Existing frontend lacked build config and all interactions | Original build failed TS5083; placeholders visible in repository. This was unfinished phase work, not evidence of a causal AI coding error. | Added tsconfig, routing, services and UI. Final build and 112 behavior tests pass. AUD-002 updated with manual verification outstanding. |
| First dependency selection included advisory-affected older router/test versions | `npm audit` reported router, Vitest/mocker and tinypool advisories. This does not establish exploitability of this application. | Selected Router 7.18.5 and Vitest 4.1.12 while retaining Vite 6.4.5. Final clean install/audit: zero reported vulnerabilities. |
| npm resolver failed while upgrading Vitest; a peer dependency was omitted by legacy resolution | First test harness run found no `@testing-library/dom`; zero tests executed. | Declare DOM peer directly. Final default `npm ci` from lock succeeds; no legacy flag is needed by documented setup. |
| Deposit quantity was lost after approval confirmation | AUD-009: `frontend-tests-third.log`, 1 failed/102 passed. The component unmounted while public registry refresh loaded. | Retain public registry during refresh and keep issuer manager mounted; never retain account-derived reads across identities. Regression now executes approval then deposit with the original 5,000 quantity. |
| Receipt timeout was labelled failed and would re-enable another submission | AUD-010: targeted `receipt-timeout-before.log` shows missing unknown-confirmation state. This error was found by reviewing the receipt path, then reproduced in a failing test. | Add unconfirmed state and manual receipt recheck; keep writes blocked until a receipt resolves; status 0 and 1 remain distinct. Regression passes in final suite. |
| TypeScript declaration missing for the ABI sync script import | Root typecheck reported TS7016 for `syncFrontend.mjs` during development. | Added the side-effect module declaration; final root typecheck succeeds. |
| General event-query catch would split ranges even for an outage | Source review found unconditional recursive splitting; an outage would cause avoidable retries. No on-chain data corruption was observed. | Split only range/size-limit errors and add outage regression requiring a single request. |

## Evidence and limits

See [Phase 4 evidence index](../evidence/phase4/README.md), [implementation report](../phase4-implementation.md), [AUD-009](../issues/AUD-009-issuer-inventory-form-loses-quantity-after-allowan.md) and [AUD-010](../issues/AUD-010-receipt-timeout-incorrectly-reported-as-transactio.md). Both new defects retain actual failing-before and passing-after tests. The project-wide `scripts/evidence.sh` commit workflow was not used for these frontend changes; targeted command outputs were preserved instead, with no fabricated commit hashes.

All 108 existing Solidity tests pass and `git diff -- contracts` is empty. The service integration test verifies the full local lifecycle with real contract calls and rejects unapproved direct calls that bypass UI preflight. Unit/component tests mock providers; they are not wallet-extension tests. HTTP route checks are not rendered-layout tests. Browser/MetaMask and responsive visual acceptance remain manual because runtime browser discovery returned an empty list.

Lessons: a returned hash is not a confirmed outcome; an unknown receipt is not a failed transaction; account identity must be part of every dependent cache key; a successful data refresh must not erase the second half of a multi-transaction form; and administrative authority must be read from the actual contract rather than inferred from metadata.
