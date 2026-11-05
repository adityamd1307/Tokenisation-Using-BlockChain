# AssetToken: Tokenisation Using Blockchain

An academic dApp for NTU SC4053. Authorised issuers tokenise fictional real-world and digital assets as ERC-20 tokens and sell them at a fixed price to whitelisted investors. All ownership records and compliance rules live on Ethereum. The repository is also graded on how the AI-written code was audited, so every change carries an evidence trail (see [Audit trail](#audit-trail)).

**Status (5 November 2026):** contracts, frontend and local tests are complete. The Phase 5 Sepolia deployment and replay scripts are built and verified locally ([Phase 5](docs/phase5-implementation.md)). Two things remain: a genuine MetaMask browser check, which is the D14 local rehearsal ([AUD-002](docs/issues/AUD-002-frontend-dashboards-and-wallet-integration-are-uni.md)), and running the deployment on Sepolia ([AUD-003](docs/issues/AUD-003-deployment-and-verification-tooling-are-incomplete.md)).

## What it does

| Contract | Role |
|---|---|
| `AssetFactory` | The platform admin authorises or revokes issuers. An authorised issuer creates an asset, which deploys an `AssetToken` and an `AssetSale` and records them in the registry (`getAsset`, `getAssetCount`). |
| `AssetToken` | A fixed-supply ERC-20 with 0 decimals. Every transfer requires a whitelisted sender and recipient. Revoking an investor keeps their balance but blocks sending, receiving and buying. The issuer can **pause** all token movement and **force-transfer** tokens out of a revoked address, for example to recover a lost key (decision D5). |
| `AssetSale` | Holds sale inventory and sells it at a fixed price, with exact ETH payment. The issuer withdraws proceeds, closes the sale and recovers unsold tokens. ETH forced in from outside can be swept. |

The frontend (React 18, Vite, ethers 6) has a marketplace, an investor portfolio with transfers, issuer and admin dashboards, and on-chain transaction history. The specification is [`docs/spec/spec-v1.md`](docs/spec/spec-v1.md). Where the later phase requirements in [`docs/spec/`](docs/spec/) differ from it, those requirements and their recorded decisions (D1–D18) govern.

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

# Optional: seed CPT/DLT for exploration, only on an empty local registry
npm run demo:local
```

```bash
# Terminal 3: start the frontend
npm run dev --prefix frontend
```

Open **http://127.0.0.1:5173**. You can browse without a wallet. To sign transactions, connect MetaMask and switch to **Local Ethereum**: chain **31337**, RPC **http://127.0.0.1:8545**, symbol **ETH**. The app offers to add this network when you ask to switch.

Use Hardhat local accounts 0–4 for the admin, the issuer, investor 1, investor 2 and an unapproved investor. Only import these development accounts into a separate development wallet or profile. Hardhat prints their publicly known keys in your terminal; never use them for real funds or commit them. The application never asks for, stores or reads wallet private keys or seed phrases.

Every deployment writes `frontend/src/config/addresses.json` and syncs the three compiled ABIs. After restarting or resetting the chain, deploy again and restart Vite. The app checks the deployment's block hash and runtime bytecode hash, not just its address. `npm run deploy:ephemeral` deploys to a throwaway in-process chain instead.

The UI has no pause or forced-transfer controls (spec-v1 §7 does not require them). The issuer calls them directly on the token contract. Forced transfers do appear in the transaction history.

## Tests

```bash
npm test                              # 142 contract and script tests
npm test --prefix frontend            # 118 frontend behaviour tests
npm run build --prefix frontend       # TypeScript + production Vite build
npx tsc --noEmit                      # root scripts and contract tests
npm run test:integration              # needs `npm run node` running; deploys its own fixture
npm run replay:ephemeral              # the 12 Task 5.1 steps in-process, Hardhat accounts 0-3 as Wallets A-D
bash scripts/evidence.sh <label>      # build, test, gas, coverage (slither if installed) into docs/evidence/runs/
```

The integration suite runs the production frontend services against real local contracts. It signs through an EIP-1193 adapter over Hardhat's unlocked accounts, so it does not test MetaMask. It covers the full lifecycle, including a forced transfer and a pause. The counts above are from 5 November 2026. Contract line coverage is 98.79%.

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
| [`docs/issues/INDEX.md`](docs/issues/INDEX.md) | AUD-001 to AUD-015. AUD-001 to AUD-003 are tracking issues; the rest are defects. Each defect has before/after evidence and an analysis of why the AI made the mistake. Defects from AUD-005 onward, except AUD-009 and AUD-010 (Phase 4, uncommitted at the time), also have a separate failing-test commit and fix commit |
| [`docs/ai-logs/INDEX.md`](docs/ai-logs/INDEX.md) | Every AI session: tool, model, context given and outcome. Transcripts are in `docs/ai-logs/raw/` (emails and Hardhat dev keys redacted, decisions D9 and D10) |
| Tags `ai-baseline-phase2`, `-phase3`, `-phase4`, `-d5`, `-phase5` | Each first complete AI generation, never edited afterwards. The pre-AI spec is tagged `spec-v0` in the local repository but has not been pushed |
| [`docs/evidence/`](docs/evidence/) | Evidence runs and per-issue logs |
| [`docs/report/REPORT-MAP.md`](docs/report/REPORT-MAP.md) | Which evidence backs each section of the AI Audit Report |

Commit prefixes show who wrote what: `ai:`, `human:`, `test(AUD-NNN):`, `fix(AUD-NNN):`, `docs:`, `evidence:`, `chore:`. Implementation notes: [Phase 2](docs/phase2-implementation.md), [Phase 3](docs/phase3-implementation.md), [Phase 4](docs/phase4-implementation.md), [D5](docs/d5-implementation.md), [Phase 5](docs/phase5-implementation.md).

Academic demonstration only. Assets and token prices are simulated. Tokens do not represent legally enforceable ownership or investment claims.
