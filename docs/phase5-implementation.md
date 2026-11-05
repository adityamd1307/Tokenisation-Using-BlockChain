# Phase 5: Sepolia deployment and scripted Task 5.1 replay

Date: 4–5 November 2026, Asia/Singapore. Tool: Claude Code (claude-opus-5-5), directed by Chordia Laksh. Authority: [phase5-requirements.md](spec/phase5-requirements.md), the brief verbatim plus decisions D11–D18. No Solidity changed.

**Status:** the tooling is built and verified locally. Nothing has run on Sepolia, in MetaMask or in a real browser yet. The D14 local MetaMask rehearsal, which closes Phase 4 (AUD-002), comes before any Sepolia transaction.

## Decisions

| # | Decision |
|---|---|
| D11 | `deploy.ts` deploys an empty main factory (Wallet A is admin) for the live demo. `replay.ts` runs all 12 Task 5.1 steps on its own factory. |
| D12 | Sepolia keys are `SEPOLIA_KEY_A` to `SEPOLIA_KEY_D`, read through `configVariable` from environment variables or the Hardhat keystore. |
| D13 | Scenario 7: the UI blocks it before signing (unchanged). The replay sends it with a fixed gas limit, so a reverted transaction is recorded. |
| D14 | The local MetaMask rehearsal comes first and closes Phase 4. |
| D15 | The frontend runs locally against Sepolia. No public hosting. |
| D16 | The Sepolia read RPC is PublicNode (`https://ethereum-sepolia-rpc.publicnode.com`), which needs no key. `VITE_RPC_URL` overrides it. |
| D17 | Step 12 creates DLP (5,000 units at 0.002 ETH), deposits 1,000, and has C buy 10. |
| D18 | Every persistent deploy writes `deployments/<network>.json` (address, chain ID, block, ABIs). `addresses.json` keeps the latest deployment. |

## What was built (tag `ai-baseline-phase5`, 3be10c0)

| Requirement | Implementation |
|---|---|
| Task 5.2: deploy the factory and assign the admin; D11 | `scripts/lib/phase5.ts` `deployMainFactory`. One transaction from Wallet A, nothing else. |
| Task 5.2: save the address, chain ID and ABIs; configure the frontend; D18 | `writeDeploymentOutputs` writes `frontend/src/config/addresses.json` and `deployments/<network>.json`. `deploy.ts` then syncs the frontend ABIs. `deployments/localhost.json` is gitignored, as local anvil broadcasts were. |
| Task 5.2: "runs the demo setup using testnet wallets"; D11, D13, D17 | `runReplay`: step 0 deploys a separate factory, then steps 1–12 run with 34 on-chain checks. Scenario 7 is first simulated (`staticCall`) to get the reason `RecipientNotWhitelisted`, then sent with a 100,000 gas limit and recorded with its status-0 receipt. Step 3 also whitelists the sale contract, which Phase 3 §3.3 requires. The output goes to `docs/evidence/phase5/replay-<network>-<timestamp>.json`. |
| Keys outside the repository; D12 | `hardhat.config.ts` `sepolia.accounts` holds four `configVariable`s. `chainId: 11155111` is pinned. `.env.example` lists the names. |
| Frontend for Sepolia; D15, D16 | `frontend/src/config/networks.ts` `networkFor()`: chain 11155111 is named "Sepolia testnet" and reads through PublicNode unless `VITE_RPC_URL` is set. |
| Evidence template | [`docs/evidence/testnet-log.md`](evidence/testnet-log.md) |
| Run both locally (work plan) | `npm run replay:ephemeral`, `npm run deploy:ephemeral` and `npm run deploy:local`. The Sepolia variants use the `production` profile (AUD-012). |

Not in the spec, so flagged here: `checkFunding` stops the replay before its first transaction if any wallet cannot pay for its part, and `totalsByWallet` reports gas per wallet. Both serve the work plan's funding estimate and D11's aim of reproducible hashes: a replay that runs out of ETH halfway leaves an incomplete record.

## Local verification

| Check | Result | Evidence |
|---|---|---|
| `npm test` | 142 passing (132 earlier + 10 in `test/Phase5.scripts.test.ts`) | `evidence/phase5/contract-tests.log` |
| `npm test --prefix frontend` | 117 at the baseline (113 + 4 network tests); 118 after AUD-015 | `evidence/phase5/frontend-tests.log`, `evidence/aud-015/frontend-tests-after.log` |
| Frontend build, root typecheck | Pass | `frontend-build.log`, `root-typecheck.log` |
| `npm run test:integration` against `npm run node` | 1 passed | `integration.log` |
| `npm run replay:ephemeral` | 12 steps, 34 checks passing | `replay-ephemeral.log`, `replay-hardhatMainnet-*.json` |
| `npm run deploy:local` | Writes `addresses.json` and `deployments/localhost.json` | `deploy-local.log` |
| EIP-170 (AUD-012 rule) | AssetFactory 13,545 bytes (55.1%), AssetToken 4,124, AssetSale 3,132, in both profiles | `bytecode-sizes.txt` |
| Mutation check | 5 of 5 valid mutants killed (one malformed mutant recorded as invalid) | `mutation.log` |

Measured replay gas: A 3,018,538 (the factory deployment is 2,973,114 of it), B 4,500,345, C 265,618, D 0. C also pays 0.12 ETH (0.1 CPT + 0.02 DLP).

## Review before merge

This review was done by the session that wrote the code, so it is **not independent**. It covered the diff against phase5-requirements.md and the CLAUDE.md rules, and checked by mutation that the new tests fail when the property each names is broken (AUD-005 rule).

| Finding | Outcome |
|---|---|
| Frontend unit tests took their target chain from the committed `addresses.json`. Under D18 that file points at Sepolia, and 39 tests then fail. | [AUD-015](issues/AUD-015-frontend-unit-tests-fail-once-the-committed-deploy.md), fixed in a36b1e9. CLAUDE.md rule added. |
| Scenario 7 behaves differently on the two network types. In-process, the failing send throws but is mined, and the error carries the hash. Over HTTP with local keys, the send returns and the receipt has status 0. | Handled in `runReplay`. Only the in-process path has been run. |
| D11: does the replay touch the main factory? | No. Tested ("runs on its own factory and leaves the main factory empty"). |

Observations, not changed and not verified on Sepolia:
- **Read-after-write on a load-balanced RPC.** The replay checks state right after each receipt. If `TESTNET_RPC_URL` balances requests across nodes that lag each other, a check could read stale state and stop the replay. The replay stops at the first failed check, and a re-run starts a fresh factory, which costs the gas again.
- **PublicNode's `eth_getLogs` limits are unknown.** The history view already splits block ranges when a provider rejects a large range. Whether PublicNode needs this was not checked.
- **Error wording.** If the Sepolia configuration were wrong, some frontend errors would still talk about a "local chain reset". This is cosmetic.
- **This session's transcript was not archived** by the Stop hook during the session (no `raw/` file appeared). It needs archiving or exporting by hand before the AI-log row's link is valid.

## Task 5.3 coverage

| Case | Automated test (local) | Manual on Sepolia |
|---|---|---|
| Wrong network | `frontend/src/test/wallet.test.tsx` "warns on the wrong network…", `configuration.test.ts` "rejects a wallet on the wrong network…" (mocked wallet) | Yes (checklist) |
| Wallet refuses a transaction | `wallet.test.tsx` "handles wallet rejection", `ui.test.tsx` "reports Rejected by user…" (mocked wallet) | Yes |
| Insufficient ETH | `services.test.ts` "blocks insufficient ETH" (mocked provider) | Yes |
| Inventory exhausted | `test/AssetSale.test.ts` "investor buys more than inventory: reverts"; `ui.test.tsx` "blocks insufficient inventory" | — |
| Zero purchase | `AssetSale.test.ts` "buy of zero quantity reverts" | — |
| Recipient not whitelisted | `AssetToken.test.ts` "rejects an unapproved recipient…"; replay scenario 7 (D13) | Replay plus a UI screenshot |
| Revocation before a transfer | `Phase3.regression.test.ts` "a revoked holder keeps its balance but cannot send, receive or buy…" | — |
| Attacker uses another issuer's admin functions | `AssetFactory.test.ts` "issuer isolation"; `AssetToken.D5.test.ts` invariant 7 tests | — |
| Withdrawal with no funds | `AssetSale.test.ts` "withdrawProceeds with zero balance reverts" | — |
| ETH withdrawal to a contract that rejects it | `AssetSale.test.ts` "a failed payout reverts and leaves the proceeds claimable" | — |

## Not verified

Everything on Sepolia, MetaMask signing, PublicNode reads, any real browser, and the D14 rehearsal. Sepolia transaction hashes go into `docs/evidence/testnet-log.md` once the user has run the scripts.
