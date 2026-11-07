# AssetToken: Tokenisation Using Blockchain

An academic dApp for NTU SC4053. Authorised issuers tokenise fictional assets as restricted ERC-20 tokens. Investors can buy immediately with ETH or commit simulated mUSD to a subscription offering, then settle an allocation, withdraw refunds and claim tokens after its window closes. All token balances and transfer rules live on Ethereum. The repository also records how AI-written code was tested and audited.

**Status (7 November 2026):** subscription issuance is implemented and locally validated: 194 contract tests, 131 frontend tests and two real-chain service integration tests pass. Existing direct ETH sales remain compatible. Real MetaMask/browser and responsive visual acceptance are still pending; no browser was connected. Public subscription deployment is not claimed, and the original Phase 5 Sepolia execution remains outstanding. See [validation and acceptance](docs/subscription-testing-results.md).

## What it does

| Contract | Role |
|---|---|
| `AssetFactory` | The platform admin authorises or revokes issuers. An authorised issuer creates an asset, which deploys an `AssetToken` and an `AssetSale` and records them in the registry (`getAsset`, `getAssetCount`). |
| `AssetToken` | A fixed-supply ERC-20 with 0 decimals. Every transfer requires a whitelisted sender and recipient. Revoking an investor keeps their balance but blocks sending, receiving and buying. The issuer can **pause** all token movement and **force-transfer** tokens out of a revoked address, for example to recover a lost key (decision D5). |
| `AssetSale` | Holds sale inventory and sells it at a fixed price, with exact ETH payment. The issuer withdraws proceeds, closes the sale and recovers unsold tokens. ETH forced in from outside can be swept. |
| `MockUSD` | Six-decimal simulated currency, minted only by its owner. No real backing. |
| `SubscriptionFactory` | Links subscription offerings to existing asset IDs; only the currently authorised asset issuer can create them. Pins the platform's payment currency. |
| `SubscriptionOffering` | Escrows inventory and mUSD commitments, permits oversubscription, finalises after a deadline, computes proportional whole-token allocations and separates settlement, pull refunds, token claims and recognised issuer proceeds. |

The frontend (React 18, Vite, ethers 6) has a marketplace, an investor portfolio with transfers, issuer and admin dashboards, and on-chain transaction history. The specification is [`docs/spec/spec-v1.md`](docs/spec/spec-v1.md). Where the later phase requirements in [`docs/spec/`](docs/spec/) differ from it, those requirements and their recorded decisions (D1–D18) govern.

The additive [subscription specification](docs/subscription-offering-specification.md) governs the new engine. The marketplace distinguishes direct ETH sales from mUSD subscription offerings. Issuers create offerings in their existing dashboard; `/offerings/:address` provides funding, subscription, finalisation and settlement actions.

## Setup

Validated with Node 22.18.0 (Phase 4 session) and Node 24.15.0 with npm 11.12.1 on Windows. From the repository root:

```bash
npm ci
npm ci --prefix frontend
npm run compile
```

## Run locally

Use three terminals, all started in the repository root:

```bash
# Terminal 1: leave the local blockchain running
npm run node
```

```bash
# Terminal 2: deploy to that persistent chain and sync ABIs/configuration
npm run deploy:local

# Optional advanced issuance: adds MockUSD and a subscription registry to this factory
npm run deploy:subscriptions:local

# Optional: seed CPT/DLT for exploration, only on an empty local registry
npm run demo:local
```

```bash
# Terminal 3: start the frontend
npm run dev --prefix frontend
```

Open **http://127.0.0.1:5173**. You can browse without a wallet. To sign transactions, connect MetaMask and switch to **Local Ethereum**: chain **31337**, RPC **http://127.0.0.1:8545**, symbol **ETH**. The app offers to add this network when you ask to switch.

Use Hardhat local accounts 0–4 for the admin, the issuer, investor 1, investor 2 and an unapproved investor. Only import these development accounts into a separate development wallet or profile. Hardhat prints their publicly known keys in your terminal; never use them for real funds or commit them. The application never asks for, stores or reads wallet private keys or seed phrases.

Persistent deployments write `frontend/src/config/addresses.json`; frontend ABI synchronization includes all six production contracts. After restarting or resetting the chain, deploy again and restart Vite. The app checks deployment fingerprints; subscription writes check both public and signing RPCs. `npm run deploy:ephemeral` deploys to a throwaway in-process chain instead. The subscription setup is local-only and allocates 10,000 mUSD to local accounts 2–5. It preserves an existing valid configured factory and refuses to replace a live subscription registry.

The UI has no pause or forced-transfer controls (spec-v1 §7 does not require them). The issuer calls them directly on the token contract. Forced transfers do appear in the transaction history.

## Tests

```bash
npm test                              # 194 contract and script tests
npm test --prefix frontend            # 131 frontend behaviour tests
npm run build --prefix frontend       # TypeScript + production Vite build
npx tsc --noEmit                      # root scripts and contract tests
npm run test:integration              # needs `npm run node` running; deploys its own fixture
npm run replay:ephemeral              # the 12 Task 5.1 steps in-process, Hardhat accounts 0-3 as Wallets A-D
npm run demo:subscriptions            # actual oversubscribed and failed offerings; ephemeral local chain
bash scripts/evidence.sh <label>      # build, test, gas, coverage (slither if installed) into docs/evidence/runs/
```

The integration suites run production frontend services against real local contracts, including direct sales and subscription creation, funding, settlement, refunds and claims. They sign through an EIP-1193 adapter over Hardhat's unlocked accounts, so they do not test MetaMask. Counts are from 7 November 2026; measured aggregate contract line coverage is 98.02% including harnesses. See the [detailed results and limits](docs/subscription-testing-results.md).

## Subscription offering example

Offer 1,000 CPT at 2 mUSD per token, with a 1,200 mUSD soft cap and derived 2,000 mUSD hard cap. Commitments of 1,800/1,400/800 mUSD are all accepted during the window. After finalisation, investors receive allocations of 450/350/200 CPT and refunds of 900/700/400 mUSD. Issuer proceeds total 2,000 mUSD only after settlement. A second demo with 700 mUSD fails and refunds everything. [Actual local receipts and balances](docs/evidence/subscription/demo.json) back these values.

Success uses a conservative lower bound on accepted funding after integer rounding; gross demand alone is insufficient. This may reject some fundable offerings, and whitelisted wallet splitting can lower the bound. Claims have no expiry; refunds remain independent of token eligibility. Existing issuer pause/revocation/forced-transfer powers remain trusted. [Allocation mathematics](docs/subscription-allocation-mathematics.md) explains the rule and reserves.

- [Architecture, function reference and UI walkthrough](docs/subscription-offering-architecture.md)
- [Security analysis and scanner triage](docs/subscription-security-analysis.md)
- [Testing results and remaining manual acceptance](docs/subscription-testing-results.md)
- [AI Audit Report, eight course sections](docs/AI_Audit_Report.md)
- [Changed-file manifest](docs/subscription-changed-files.md)

## Sepolia deployment (Phase 5)

Four testnet burner wallets play the Task 5.1 roles: A is the platform admin and deployer, B the issuer, C an approved investor and D an initially unapproved investor (decision D12). `hardhat.config.ts` reads `TESTNET_RPC_URL` and `SEPOLIA_KEY_A` to `SEPOLIA_KEY_D` with `configVariable`, from environment variables or Hardhat's encrypted keystore. Nothing loads a `.env` file automatically; [`.env.example`](.env.example) lists the names. `PRIVATE_KEY` is no longer used.

```bash
npx hardhat keystore set TESTNET_RPC_URL    # and SEPOLIA_KEY_A, _B, _C, _D
npm run deploy:sepolia    # empty main factory for the live demo; writes addresses.json and deployments/sepolia.json
npm run replay:sepolia    # all 12 Task 5.1 steps on a separate factory; hashes in docs/evidence/phase5/
```

Both build with the optimised `production` profile (AUD-012). Every profile has the optimizer on (AUD-014), because `AssetFactory` embeds the other two contracts. The replay checks every wallet's balance before its first transaction. The frontend then runs locally against Sepolia (D15) and reads through PublicNode's keyless endpoint (D16); `VITE_RPC_URL` overrides it, but never put a keyed URL there, because Vite compiles it into the browser bundle. Record the results in [`docs/evidence/testnet-log.md`](docs/evidence/testnet-log.md). See [Phase 5](docs/phase5-implementation.md).

## Audit trail

AI tools (Claude Code, Codex, claude.ai) generated the contracts, tests and frontend. Commit prefixes record who wrote each change. [`CLAUDE.md`](CLAUDE.md) sets the rules every AI session follows, including rules learned from each audit finding.

| Where | What |
|---|---|
| [`docs/issues/INDEX.md`](docs/issues/INDEX.md) | AUD-001 to AUD-016. AUD-001 to AUD-003 are tracking issues; the rest are defects. AUD-016 preserves the subscription compatibility regression without commits. Each defect has before/after evidence and an analysis of why the AI made the mistake. Defects from AUD-005 onward, except AUD-009 and AUD-010 (Phase 4, uncommitted at the time), also have a separate failing-test commit and fix commit |
| [`docs/ai-logs/INDEX.md`](docs/ai-logs/INDEX.md) | Every AI session: tool, model, context given and outcome. Transcripts are in `docs/ai-logs/raw/` (emails and Hardhat dev keys redacted, decisions D9 and D10) |
| Tags `ai-baseline-phase2`, `-phase3`, `-phase4`, `-d5`, `-phase5` | Each first complete AI generation, never edited afterwards. The pre-AI spec is tagged `spec-v0` (pushed on 6 November 2026) |
| [`docs/evidence/`](docs/evidence/) | Evidence runs and per-issue logs |
| [`docs/report/REPORT-MAP.md`](docs/report/REPORT-MAP.md) | Which evidence backs each section of the AI Audit Report |

Commit prefixes show who wrote what: `ai:`, `human:`, `test(AUD-NNN):`, `fix(AUD-NNN):`, `docs:`, `evidence:`, `chore:`. Implementation notes: [Phase 2](docs/phase2-implementation.md), [Phase 3](docs/phase3-implementation.md), [Phase 4](docs/phase4-implementation.md), [D5](docs/d5-implementation.md), [Phase 5](docs/phase5-implementation.md).

Academic demonstration only. Assets and token prices are simulated. Tokens do not represent legally enforceable ownership or investment claims.
