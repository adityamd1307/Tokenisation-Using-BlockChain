# Evidence

Evidence for Report Section 6 and for section 4 of every issue file.

## Runs

`scripts/evidence.sh [label]` creates a folder in `runs/` named `<utc time>_<commit>[-dirty][_label]` containing:

| File | Contents |
|---|---|
| `meta.txt` | Commit, user, tool versions |
| `summary.txt` | Exit code of each step |
| `build.log` | `forge build` |
| `test.log` | `forge test -vvv` |
| `gas.log` | `forge test --gas-report` |
| `coverage.log` | `forge coverage --report summary` |
| `slither.json`, `slither.log` | Slither findings, machine-readable and console |
| `slither-checklist.md` | Slither findings as a readable checklist |

A `-dirty` run was made with uncommitted changes, so it can't be reproduced from a commit. Use those for quick checks only. Commit first for anything you will cite in the report.

Label convention: `AUD-007-before`, `AUD-007-after`, `baseline`, `final`.

## Testnet

Record every deployment and every transaction you might cite in `testnet-log.md`.
