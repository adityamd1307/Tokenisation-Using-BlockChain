# Phase 4 validation evidence

Validation date: 28 October 2026 (Asia/Singapore). These are actual command outputs from this working tree, not a claim of public deployment or browser signing.

| File | Meaning |
|---|---|
| `baseline-build.log` | Original frontend fails with TS5083: missing `tsconfig.json`. |
| `baseline-contract-tests.log` | Initial sandboxed Hardhat attempt fails accessing its external compiler-cache lock. This is not a contract regression. |
| `compile.log`, `contract-tests.log` | Successful compile and all 108 existing contract tests after allowing compiler-cache access. |
| `build-first.log`, `build-second.log`, `build.log` | Successful frontend builds; final output splits ethers and React into separate bundles. |
| `frontend-tests-first.log` | First harness run: missing `@testing-library/dom` peer; resolved by declaring it explicitly. No tests passed in this run. |
| `frontend-tests-second.log` | Initial 87 behavior tests pass. |
| `frontend-tests-third.log` | AUD-009 reproduced: allowance confirmation clears the deposit form; 102 pass, 1 fails. |
| `frontend-tests-after-refresh-fix.log` | AUD-009 corrected: 103 pass. |
| `receipt-timeout-before.log` | AUD-010 reproduced: a submitted transaction with an unknown receipt is incorrectly labelled failed. |
| `frontend-tests.log` | Final automated frontend suite, including both audit regressions. |
| `integration-first.log`, `integration.log` | Production frontend services against actual local contracts via an EIP-1193 adapter over unlocked Hardhat accounts. This is not MetaMask. |
| `deploy-local.log`, `seed-local.log` | Persistent local deployment, generated config, and explicit CPT/DLT fixture. Only public account addresses are logged. |
| `root-typecheck.log` | `npx tsc --noEmit`; empty file on successful exit. |
| `http-smoke.log` | HTTP 200 for all five routes; does not verify rendered layout. |
| `npm-ci.log`, `npm-audit.json` | Clean locked install and final advisory report. |
| `format.log` | Formatter file list. |
| `versions.json` | Installed toolchain versions. |
| `changed-files.md` | Every changed tracked/untracked deliverable and its purpose. |

Browser discovery returned **no connected browsers**. No genuine browser screenshot, responsive visual QA, MetaMask connection, wallet popup, rejection, account switch or signing flow was manually verified. The manual checklist is in [the implementation report](../../phase4-implementation.md).

Initial compiler-cache errors and targeted regression failures are retained deliberately. Root contracts are unchanged. No commits, private keys, seed phrases, public-network transactions or Phase 5 deployments were made.
