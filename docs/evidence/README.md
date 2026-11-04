# Evidence

Evidence for Report Section 6 and for section 4 of every issue file.

## Runs

`scripts/evidence.sh [label]` creates a folder in `runs/` named `<utc time>_<commit>[-dirty][_label]` containing:

| File | Contents |
|---|---|
| `meta.txt` | Commit, user, tool versions |
| `summary.txt` | Exit code of each step |
| `build.log` | `npx hardhat compile` |
| `test.log` | `npx hardhat test --no-compile` (contract suite only; frontend tests are not part of a run) |
| `gas.log` | `npx hardhat test --gas-stats` |
| `coverage.log` | `npx hardhat test --coverage` |
| `slither.json`, `slither.log` | Slither findings, machine-readable and console (only if Slither is installed; otherwise `summary.txt` says "skipped") |
| `slither-checklist.md` | Slither findings as a readable checklist |

The pipeline ran `forge` until commit d87cd66 ported it to Hardhat 3. From e1fc698 (AUD-014) onward, contracts compile with the optimizer on, so gas figures in later runs are not comparable with earlier ones.

A `-dirty` run was made with uncommitted changes, so it can't be reproduced from a commit. Use those for quick checks only. Commit first for anything you will cite in the report.

Label convention: `AUD-007-before`, `AUD-007-after`, `baseline`, `final`.

## Testnet

Record every deployment and every transaction you might cite in `testnet-log.md`.
