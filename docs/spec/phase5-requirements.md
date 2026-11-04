# SC4053 Blockchain Technology — Phase 5: End-to-End Integration and Testnet Deployment

The text below is the user's Phase 5 request, given to Claude Code on 4 November 2026 (session 069871d2). The table and checklist formatting were lost when it was pasted and are restored as Markdown; the wording is unchanged. Decisions raised by Claude Code about conflicts with the current code and earlier specs are in the final section.

---

Deliverable: Working deployed application + reproducible demo

Objective: Ensure the complete application works when all contracts, wallets and interfaces interact.

## Task 5.1 — Run the complete demonstration

Use four distinct MetaMask accounts.

| Wallet | Assigned role |
|---|---|
| A | Platform administrator |
| B | Authorised issuer |
| C | Approved investor |
| D | Initially unapproved investor |

Run these scenarios in order:

Integration test checklist

- [ ] Wallet A authorises Wallet B as an asset issuer
- [ ] Wallet B creates Campus Property Token with 10,000 units
- [ ] Wallet B approves the sale contract and deposits 5,000 units
- [ ] Wallet B whitelists Wallet C
- [ ] Wallet C purchases 100 CPT for 0.1 testnet ETH
- [ ] Portfolio dashboard displays Wallet C's 100 CPT
- [ ] Wallet C tries transferring 20 CPT to Wallet D; transaction fails
- [ ] Wallet B whitelists Wallet D
- [ ] Wallet C transfers 20 CPT to Wallet D successfully
- [ ] Portfolio and event history show 80 CPT for C and 20 CPT for D
- [ ] Wallet B withdraws the ETH proceeds
- [ ] Wallet B creates a second asset and verifies separate balances

This should become your main evaluation demonstration.

## Task 5.2 — Deploy contracts to Sepolia

Create a deployment script that:

- Deploys the factory.
- Assigns the initial platform administrator.
- Saves the factory address, chain ID and contract ABIs.
- Runs the demo setup using testnet wallets.
- Configures the frontend to connect to the deployed addresses.

Keep deployment private keys outside the repository, using environment variables.

## Task 5.3 — Validate security and edge cases

Test unexpected situations, including:

- Wrong network.
- Wallet refuses a transaction.
- Buyer has insufficient ETH.
- Sale inventory is exhausted.
- Purchase amount is zero.
- Recipient is not whitelisted.
- Compliance administrator revokes permission before a transfer.
- An attacker attempts another issuer's administrative functions.
- Issuer withdraws proceeds while no funds remain.
- ETH withdrawal to a contract that rejects payment.

## Phase 5 completion criteria

All core acceptance scenarios succeed on the intended testnet, and the same contract functionality has passing automated tests locally.

Record testnet transaction hashes, test outputs and screenshots. These will become evidence for your final report.

---

## Decisions made by the user (4 November 2026)

Claude Code raised these conflicts between this request and the current code before any Phase 5 code was written. Claude Code proposed each option, and the user chose the recommended one each time. Numbering continues from D1–D10 in [phase3-requirements.md](phase3-requirements.md).

| # | Question | Decision |
|---|---|---|
| D11 | Task 5.2 says the deploy script "runs the demo setup using testnet wallets", but Task 5.1's live MetaMask demo starts from "Wallet A authorises Wallet B". Running the setup on the factory the frontend uses would leave the live demo nothing to do. | **Clean factory plus scripted replay.** The deployment script deploys the main factory, with Wallet A as platform administrator, saves the factory address, chain ID and ABIs, and configures the frontend. It leaves the factory empty for the live Task 5.1 demo. A separate replay script runs all 12 Task 5.1 steps on its own factory with the four testnet wallets, producing reproducible transaction hashes for the report. |
| D12 | The Sepolia network config has one key (`PRIVATE_KEY`), and `setupDemo.ts` needs at least three signers. Task 5.1 uses four wallets. | **Four named variables:** `SEPOLIA_KEY_A` to `SEPOLIA_KEY_D`, read with `configVariable` from environment variables or Hardhat's keystore, never from a committed file. Wallet A deploys and is the platform administrator. The same four accounts are imported into MetaMask. This replaces `PRIVATE_KEY` for Sepolia, and README and AUD-003 must be updated when it is implemented. |
| D13 | Scenario 7 ("Wallet C tries transferring 20 CPT to Wallet D; transaction fails"): the frontend checks the recipient's eligibility before asking MetaMask to sign (`frontend/src/services/blockchain.ts:310`), so no transaction or hash exists. | **UI block plus on-chain revert.** The live demo records the UI's rejection (screenshot). The replay script also sends the same transfer directly, with a fixed gas limit so that gas estimation does not stop it, so a reverted transaction (`RecipientNotWhitelisted`) is recorded on Sepolia. The frontend's preflight is unchanged. |
| D14 | Phase 4's 13 manual MetaMask and browser scenarios (`docs/phase4-implementation.md`) are all Pending, and the roadmap says not to start a phase before the previous phase's acceptance criteria are met. | **Local rehearsal first.** Before any Sepolia transaction, run Phase 4's manual checklist with MetaMask on the local chain and record the results and screenshots as Phase 4 acceptance (AUD-002). Then run Task 5.1 on Sepolia. |

Still open (not blocking the start of Phase 5):
- "Working deployed application": whether the frontend must be hosted publicly or only run locally against the Sepolia contracts.
- The frontend's read RPC (`VITE_RPC_URL`) is compiled into the browser bundle. It must be a keyless public endpoint, or a key the team accepts as public.
