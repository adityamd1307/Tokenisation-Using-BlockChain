# Final Demonstration Guide

This guide separates executed automation from the **unexecuted manual MetaMask rehearsal**. No screenshots were captured because no browser connection was available. Use fictional assets and local test ETH only.

## Executed automated demonstration

From the repository root:

```bash
npm run compile
npx hardhat run scripts/auditDemo.ts --network hardhatMainnet
```

This uses an isolated in-process chain, rejects public networks, and writes `docs/audit/final-demo.json`. The observed run passed **31 checks, 18 mined transactions and three expected status-0 reverts**. It creates CPT and DLT, verifies permissions, exact payment, failed purchases/transfers, withdrawal, closure/recovery and asset isolation. These addresses/hashes belong to the throwaway local chain and must not be presented as Sepolia transactions.

The frontend services were separately verified through `npm run test:integration` against `npm run node`. This exercises production client services and real contracts through an EIP-1193 adapter; it does not exercise a wallet extension.

## Prepare the manual presentation

Use [Deployment_Guide.md](Deployment_Guide.md) to start a fresh persistent local chain, deploy and start Vite. For the complete creation demonstration **do not run demo:local first**; it pre-creates and funds assets. On a fresh node, use local account 0 as platform admin, 1 as issuer, 2 as Investor A, 3 as Investor B and 4 as the unapproved investor. This is five wallets; the older Phase 5 script uses a different four-wallet scenario.

Import development accounts into a separate local-only wallet profile using the keys printed by your own Hardhat terminal. Do not paste keys/seed phrases into reports or chat. Connect to chain 31337, RPC `http://127.0.0.1:8545`, currency ETH. Open `http://127.0.0.1:5173`. Expected topbar/sidebar network: Local Ethereum; academic disclaimer visible.

## Manual sequence and expected results

| Step | User action / screen | Expected screen and blockchain result |
|---|---|---|
| 1 | Connect admin wallet; Administration | Account and network visible. Look up issuer address, Authorise Issuer, confirm in wallet. Wait for confirmed status; authorisedIssuers is true. |
| 2 | Switch to issuer; Issuer dashboard | Creation form enabled. Create Campus Property Token / CPT / Real-world asset / 10000 / 0.001 ETH. Success shows asset ID, token and sale addresses; issuer balance 10000. |
| 3 | Select CPT; Approve Sale Contract | Sale eligibility becomes approved after confirmation. This is separate from ERC-20 allowance. |
| 4 | Enter deposit quantity 5000; Approve Token Spending | Wallet confirms approval; quantity stays 5000; allowance updates. Tokens have not yet moved. |
| 5 | Deposit Tokens | Inventory 5000, issuer balance 5000, spent allowance 0. |
| 6 | Investor eligibility; approve A and B separately | Each address lookup shows approved after its transaction confirms. Leave account 4 unapproved. |
| 7 | Switch to A; Marketplace → CPT | Purchase 100, total 0.1 ETH plus wallet gas. Portfolio balance 100; history has one purchase row. |
| 8 | Switch to B; CPT purchase | Purchase 50, total 0.05 ETH plus gas. B balance 50; inventory 4850; proceeds 0.15 ETH. |
| 9 | Switch to unapproved wallet; CPT | Purchase control disabled / not authorised notice. UI sends no transaction. The automated demo separately proves direct contract purchase reverts. |
| 10 | Switch to A; My portfolio → transfer | Transfer 20 CPT to B. A balance 80, B balance 70; genuine Transfer event. |
| 11 | A enters unapproved recipient | Recipient-not-authorised message and disabled transfer control; no signing request. Automated direct transfer attempt separately has status 0. |
| 12 | Switch to issuer; Manage proceeds | Withdraw Proceeds, confirm dialog then wallet. Proceeds and contract ETH become 0; issuer gains 0.15 ETH minus withdrawal gas. |
| 13 | Close Offering | Confirm irreversible closure. Closed state appears; further purchase/deposit blocked. Automated direct buy after closure has status 0. |
| 14 | Recover Unsold Tokens | Recover 4850 CPT; issuer balance 9850, sale inventory 0. Issuer and sale must still be eligible and token unpaused. |
| 15 | Issuer creates second asset | Digital Licensing Token / DLT / Digital asset / 5000 / 0.002 ETH. Separate token/sale; issuer owns 5000 DLT. A and B have zero DLT and are not automatically approved. |
| 16 | Verify portfolios and histories | CPT balances remain A 80, B 70, issuer 9850, sale 0. Sum and totalSupply equal 10000. DLT has independent whitelist, supply and open sale. |

Record actual transaction hashes/screenshots only after performing the manual actions. Never populate evidence from expected values alone. For a presentation, use the two contract addresses from the current registry; the checked-in local configuration is not portable across node resets.

## Manual acceptance checklist (still pending)

- [ ] Wallet connection with real MetaMask succeeds; disconnect/reconnect clears prior account information.
- [ ] Switch accounts and verify balances/roles/forms/history update without stale permission.
- [ ] Switch to an unintended chain and verify write controls are blocked; switch back successfully.
- [ ] Reject a wallet signing prompt and verify rejection without false success.
- [ ] Submit a transaction and observe pending versus confirmed states; do not repeat while confirmation is unknown.
- [ ] Check insufficient-ETH behavior, including wallet gas costs.
- [ ] Execute the complete table above and collect real screen/receipt evidence.
- [ ] Check desktop and narrow viewport layout with the actual browser.
- [ ] Complete required Sepolia deployment/rehearsal separately, following the preserved D14 local-first decision and `docs/evidence/testnet-log.md`.

Pause and forced-transfer are contract features without dashboard controls. The integration test exercises them, but the presentation should not claim a UI control exists. Revoked balances remain held until reapproval or privileged recovery.
