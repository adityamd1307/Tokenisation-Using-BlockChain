# AssetToken — Tokenisation Using Blockchain

React + Ethereum academic dApp for NTU SC4053. Phase 4 implements the marketplace,
wallet integration, administration, issuance, purchases, portfolio and transfers
against the existing Phase 2/3 contracts. Solidity contracts are unchanged.

**Implemented and automated-tested locally. Genuine MetaMask signing and responsive
browser verification remain manual; no browser was connected during this session.**

Use Node 22.18.0 or a compatible Node version supported by the locked Hardhat 3
toolchain. Install from the repository root:

```bash
npm ci
npm ci --prefix frontend
npm run compile
```

Run the application in three terminals, all starting in the repository root:

```bash
# Terminal 1: leave the local blockchain running
npm run node
```

```bash
# Terminal 2: deploy to that persistent chain and sync ABIs/configuration
npm run deploy:local

# Optional: explicitly seed CPT/DLT for exploration, only on an empty local registry
npm run demo:local
```

```bash
# Terminal 3: start the frontend
npm run dev --prefix frontend
```

Open **http://127.0.0.1:5173**. Browse without a wallet, or connect MetaMask and switch
to **Local Ethereum**, chain **31337**, RPC **http://127.0.0.1:8545**, symbol **ETH**.
The app supports adding this network after a user-requested switch.

Use Hardhat local accounts 0–4 for admin, issuer, investor 1, investor 2 and an
unapproved investor. Only import local development accounts into a separate
development wallet/profile. Hardhat prints their publicly known keys in your
terminal; never use them for real funds or commit them. This application never
asks for, stores, or reads wallet private keys or seed phrases.

`deploy:local` now targets persistent `localhost`; the old throwaway deployment is
available as `npm run deploy:ephemeral`. Every deployment generates
`frontend/src/config/addresses.json` and synchronises the three compiled ABIs.
After restarting/resetting the blockchain, deploy again and restart Vite. A local
address alone is insufficient evidence of the correct deployment: the app also
checks its block hash and runtime bytecode hash.

Validation:

```bash
npm test                              # 108 existing contract tests
npm test --prefix frontend            # 112 frontend behavior tests
npm run build --prefix frontend       # TypeScript + production Vite build
npx tsc --noEmit                      # root scripts / contract tests
npm run test:integration              # needs Terminal 1; isolated fixture, no reset
```

The integration suite uses the production frontend services and actual local
contracts with an EIP-1193 adapter over Hardhat's unlocked accounts. It does not
verify MetaMask. It deploys its own factory without modifying the seeded UI
registry. No public RPC access is required for test execution.

See [Phase 4 implementation, workflows and manual checklist](docs/phase4-implementation.md),
[validation evidence](docs/evidence/phase4/README.md),
[AI-assisted development audit](docs/ai-logs/phase4-session.md), and
[the complete changed-file manifest](docs/evidence/phase4/changed-files.md).
Earlier [Phase 2](docs/phase2-implementation.md) and [Phase 3](docs/phase3-implementation.md)
reports remain historical evidence.

Academic demonstration only. Assets and token prices are simulated. Tokens do
not represent legally enforceable ownership or investment claims. Public testnet
deployment and final end-to-end verification belong to Phase 5.
