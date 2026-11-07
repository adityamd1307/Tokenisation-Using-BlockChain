# Compiler, dependency and configuration review

Pinned through lockfiles: Solidity 0.8.24, Hardhat 3.21.0, OpenZeppelin 5.6.1, ethers 6.17.0, React 18.3.1, React Router 7.18.5, Vite 6.4.5, Vitest 4.1.12. TypeScript is 7.0.2 at root and 6.0.3 in frontend. Lockfile format 3; both manifests and resolved versions inspected. The existing `FrontendLockfile.regression.test.ts` checks optional platform entries and passed. No dependency or lockfile changed in Phase 6. A fresh npm ci on every operating system was not executed.

## npm advisories

Executed `npm audit --json` (exit 1) and `npm audit --prefix frontend --json` (exit 0). Root: **16 affected dependency nodes: 13 high, 3 moderate, 0 critical**. Frontend: **0**. Root `npm audit --omit=dev --json`: **0**. Raw JSON and command exits are retained. The 16 nodes propagate from three advisory families; they are not 16 independent application exploits.

- Zod 3.25.76: oversized constrained-collection validation can exhaust memory; this propagates through Hardhat's development plugins. [Maintainer advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- glob 13.0.6: traversal can continue after cancellation. [Advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4).
- minimatch 10.2.6: amplification of glob parts can cause denial of service. [Advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).

These packages run in development/testing, not inside Solidity bytecode or the frontend bundle. The observed configuration uses local trusted test/configuration inputs. Do not expose development tooling to untrusted jobs. npm proposes major toolbox/Hardhat downgrades for remediation; no forced upgrade/downgrade was applied. This remains a development-tooling risk, not a zero-warning claim. Reassess upstream compatible releases before production development.

## Compiler review

Both profiles enable optimizer runs=200; viaIR is absent (legacy pipeline), target Shanghai. Consulted the [current official compiler bug list](https://docs.solidity.org/en/latest/bugs.html), not only Slither's range heuristics. Version 0.8.24 is within the affected range of SOL-2026-7 (Yul optimizer bookkeeping, low severity), SOL-2026-5 (memory bytes element deletion) and SOL-2025-1 (storage-array wraparound), plus IR recursion advisories. No memory-byte deletion or storage-boundary layout appears in the reviewed code; IR-only conditions are absent. Optimized legacy compiler utility code leaves residual SOL-2026-7 applicability uncertainty; no miscompilation was reproduced. This is a potential compiler risk, not a confirmed contract exploit. No compiler change or safety proof is claimed. Reassess/compare a patched compiler before production use.

Solidity warning: selfdestruct only in the forced-ETH test helper. Production contracts do not expose it. OpenZeppelin's [ERC-20 reference](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20) describes `_update` as the customization point, matching the installed source and token enforcement. [Access control reference](https://docs.openzeppelin.com/contracts/5.x/access-control) supports the role-based review; source and adversarial tests remain the project-specific evidence.

## Secrets and configuration

The baseline heuristic scan of 347 tracked working-tree files found no matching known development keys, development mnemonic, literal private-key assignments or credentialed RPC patterns (`secret-scan-baseline.json`). The final expanded scan examined 436 tracked/untracked submission files with zero matches (`secret-scan.json`). .env-prefixed files were excluded and no .env secrets were read. The scan is not exhaustive and historical blobs were not rescanned; previous redaction evidence is retained in the project history. No secret values were emitted. Environment and keystore configuration are referenced only by variable names. Frontend VITE_RPC_URL is public and must not hold RPC credentials. Testnet records remain absent; `.env` availability was not inferred as deployment evidence.
