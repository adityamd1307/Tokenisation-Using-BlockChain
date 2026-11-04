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

## Decisions

Open. See the readiness review in session 069871d2; decisions will be recorded here as D11 onward, in the same form as D1–D10 in [phase3-requirements.md](phase3-requirements.md).
