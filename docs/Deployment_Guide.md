# Deployment Guide

Validated commands are recorded in `docs/audit/`. This phase executed local deployment/seeding, both compiler profiles, contract/frontend tests, builds and demo scripts. No mainnet or Sepolia transaction was submitted.

## Dependencies and installation

Use a Node version supported by the installed Hardhat release. This audit ran Node 22.18.0, npm 10.9.3 and Python 3.13.2 on macOS. Historical Windows evidence used Node 24.15.0/npm 11.12.1. Python is needed only for optional Slither tooling, not the application.

From the repository root:

```bash
npm ci
npm ci --prefix frontend
npm run compile
```

Use the committed lockfiles. This audit used the existing installation and checked lock metadata/regressions; it did not repeat clean installs on all operating systems. Hardhat may need initial network access and write access to its compiler cache. The sandboxed first compile timed out on the cache lock; normal cache access resolved it. Do not replace compiler versions to work around filesystem permissions.

## Persistent local chain

Terminal 1:

```bash
npm run node
```

This binds Hardhat to `127.0.0.1:8545`, chain 31337. It prints public development keys: use them only for local testing and do not include them in evidence logs.

Terminal 2:

```bash
npm run deploy:local
```

The script deploys an empty main factory and writes `frontend/src/config/addresses.json`, `deployments/localhost.json` and compiled frontend ABIs. The local record is intentionally gitignored. The frontend checks chain ID, factory runtime hash and deployment block hash through both read and signing providers. After a chain reset, deploy again and restart Vite; address equality alone does not prove the same deployment.

For a pre-funded exploration fixture, optionally run:

```bash
npm run demo:local
```

This requires an empty registry and localhost chain 31337. It creates CPT (10000 units, 0.001 ETH) and DLT (5000 units, 0.002 ETH), funds inventory with 5000 CPT and 2000 DLT, and approves demo investors as printed by the script. For the manual creation presentation, skip this command and follow Final_Demo_Guide.md instead.

Terminal 3:

```bash
npm run dev --prefix frontend
```

Vite's normal local URL is `http://127.0.0.1:5173`; use its printed port if that port is occupied. `predev` syncs ABIs from already compiled artifacts. The audit verified the production build, not browser rendering.

## Wallet connection

Configure MetaMask Local Ethereum: chain 31337, RPC `http://127.0.0.1:8545`, native currency ETH. Use a separate development-only wallet profile. The application can request network switching/addition but never reads wallet keys. Local account roles for Phase 6 are 0 admin, 1 issuer, 2 Investor A, 3 Investor B, 4 unapproved investor. The network offers unlocked local accounts for scripted tests; the real MetaMask rehearsal remains pending.

## Validation and reproducible evidence

```bash
npm test
npx tsc --noEmit
npm test --prefix frontend
npm run build --prefix frontend
npm run test:integration
npx hardhat run scripts/auditDemo.ts --network hardhatMainnet
npm run replay:ephemeral
npx hardhat run scripts/setupDemo.ts --network hardhatMainnet
npx hardhat test --gas-stats
npx hardhat test --coverage
npm run compile -- --force
```

Integration requires the persistent node. The other two demo scripts and auditDemo use their own ephemeral factories; they do not prepare the frontend's persistent deployment. auditDemo overwrites `docs/audit/final-demo.json` with genuine local receipts/checks. Phase 5 replay writes a timestamped file under `docs/evidence/phase5/`. Recompile normal artifacts after instrumented gas/coverage runs before deployment, size measurements or ABI synchronization. No frontend lint script exists.

For Slither reproduction, use the exact isolated-environment commands in [slither-summary.md](audit/slither-summary.md). Final result exit 255 means findings were emitted; inspect JSON success and triage. Do not report all nonzero exits as tool failures or suppress warnings to obtain a zero exit.

## Environment and Sepolia (configured, not verified)

Hardhat uses `configVariable` and does not automatically load .env. Required names for Sepolia are `TESTNET_RPC_URL` and `SEPOLIA_KEY_A`, `SEPOLIA_KEY_B`, `SEPOLIA_KEY_C`, `SEPOLIA_KEY_D`; supply them through your environment or the Hardhat encrypted keystore. `.env.example` describes names only. Never put wallet keys into frontend variables, source files, screenshots or report text.

Existing project commands:

```bash
npx hardhat keystore set TESTNET_RPC_URL
npx hardhat keystore set SEPOLIA_KEY_A
npx hardhat keystore set SEPOLIA_KEY_B
npx hardhat keystore set SEPOLIA_KEY_C
npx hardhat keystore set SEPOLIA_KEY_D
npm run deploy:sepolia
npm run replay:sepolia
```

These interactive setup/public deployment commands were **not executed in Phase 6**. D14 requires local MetaMask rehearsal first. Use funded testnet-only burner accounts: A deployer/admin, B issuer, C approved investor, D initially unapproved. The Phase 5 replay uses its own separate factory, so it does not populate the main demo registry. Both scripts explicitly select the optimized production profile. Record actual deployment/receipts in `deployments/sepolia.json` and `docs/evidence/testnet-log.md`; do not substitute local hashes.

The frontend runs locally against the selected deployment. Sepolia public reads default to the keyless PublicNode endpoint configured in networks.ts. `VITE_RPC_URL` may override it, but its value is bundled publicly and must not contain credentials. No public hosting is required or configured by this audit.

## Troubleshooting and limits

Missing factory, mismatched code or old block hash means stale configuration or mismatched RPCs: redeploy on the intended chain, sync artifacts and restart the frontend. Eligibility requires approval of both issuer and sale before inventory movements; restoring only the investor cannot fix a revoked sale. Closure is irreversible. Pause blocks normal movements, including recovery; unpause/reapprove through the authorised issuer where appropriate.

Loss of issuer/admin keys has no universal recovery mechanism. Development dependency advisories and residual compiler applicability concerns remain documented in dependency-review.md. This guide supports academic reproduction, not production deployment approval.
