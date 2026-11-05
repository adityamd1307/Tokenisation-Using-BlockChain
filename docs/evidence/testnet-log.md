# Sepolia testnet log (Phase 5)

Evidence for Phase 5's completion criteria ([phase5-requirements.md](../spec/phase5-requirements.md)): "Record testnet transaction hashes, test outputs and screenshots." Fill this in from the script output and from MetaMask. Explorer links use `https://sepolia.etherscan.io/tx/<hash>` and `https://sepolia.etherscan.io/address/<address>`.

Never paste a private key, seed phrase or keyed RPC URL here. Wallet addresses and transaction hashes are public and fine to record.

Status: **template, not yet filled in.** Nothing below has been run on Sepolia yet.

## Wallets (D12)

| Wallet | Role | Address |
|---|---|---|
| A | Platform administrator, deployer | |
| B | Authorised issuer | |
| C | Approved investor | |
| D | Initially unapproved investor | |

## Main deployment (`npm run deploy:sepolia`, Task 5.2, D11)

| Field | Value |
|---|---|
| Date (UTC) | |
| Commit | |
| AssetFactory | |
| Deployment transaction | |
| Deployment block | |
| Record file | `deployments/sepolia.json` |
| Factory empty after deploy (`getAssetCount() == 0`) | |

## Scripted replay (`npm run replay:sepolia`, D11, D13, D17)

Output file: `docs/evidence/phase5/replay-sepolia-<timestamp>.json`. It holds every hash; copy the main ones here.

| Field | Value |
|---|---|
| Date (UTC) | |
| Replay factory | |
| CPT token / sale | |
| DLP token / sale | |

| Step | Task 5.1 scenario | Wallet | Transaction hash(es) | Result |
|---|---|---|---|---|
| 0 | Replay factory deployed (D11) | A | | |
| 1 | A authorises B as issuer | A | | |
| 2 | B creates CPT, 10,000 units | B | | |
| 3 | B whitelists the sale, approves and deposits 5,000 | B | | |
| 4 | B whitelists C | B | | |
| 5 | C buys 100 CPT for 0.1 ETH | C | | |
| 6 | C's balance is 100 CPT (on-chain check) | — | — | |
| 7 | C → D 20 CPT fails: reverted transaction, `RecipientNotWhitelisted` (D13) | C | | status 0 expected |
| 8 | B whitelists D | B | | |
| 9 | C → D 20 CPT succeeds | C | | |
| 10 | C 80 / D 20 CPT, events present (on-chain check) | — | — | |
| 11 | B withdraws 0.1 ETH proceeds | B | | |
| 12 | B creates DLP, funds 1,000, C buys 10 DLP; separate balances (D17) | B, C | | |

## Live MetaMask demo on the main factory (Task 5.1)

Screenshots go in `docs/evidence/phase5/screenshots/`, named `<step>-<short-name>.png`.

| Step | Scenario | Transaction hash | Screenshot | Result |
|---|---|---|---|---|
| 1 | A authorises B | | | |
| 2 | B creates CPT, 10,000 units | | | |
| 3 | B whitelists the sale, approves, deposits 5,000 | | | |
| 4 | B whitelists C | | | |
| 5 | C buys 100 CPT for 0.1 ETH | | | |
| 6 | Portfolio shows C's 100 CPT | — | | |
| 7 | C → D 20 CPT blocked by the UI before signing (D13) | — | | |
| 8 | B whitelists D | | | |
| 9 | C → D 20 CPT succeeds | | | |
| 10 | Portfolio and history: C 80, D 20 | — | | |
| 11 | B withdraws proceeds | | | |
| 12 | B creates a second asset; separate balances | | | |

## Task 5.3 manual checks

| Check | What was done | Observed result | Screenshot |
|---|---|---|---|
| Wrong network | | | |
| Wallet refuses a transaction | | | |
| Buyer has insufficient ETH | | | |

The other seven Task 5.3 cases have automated tests; see `docs/phase5-implementation.md`.

## Transaction index

The evidence pipeline's original table (commit a652487), kept for any testnet transaction not covered above.

| Date | Who | Network | Contract | Address | Tx hash | Purpose | Commit | Issue |
|---|---|---|---|---|---|---|---|---|
