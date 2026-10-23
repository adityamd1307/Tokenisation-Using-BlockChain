#!/usr/bin/env bash
# Usage: scripts/evidence.sh [label]
#
# Runs build, tests, gas report, coverage and (if installed) Slither, and saves
# every output under docs/evidence/runs/<utc time>_<commit>[-dirty][_label]/ so
# each result is tied to a commit. Failing steps are recorded, not hidden: a
# "before fix" run is supposed to show a failing test.
#
# Ported from Foundry to Hardhat 3 after audit-1 F-13: the project never used
# forge, so every earlier run recorded exit 127 for each step.

set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "Run this inside the git repo." >&2; exit 1; }
cd "$root"

label="${1:-}"
sha=$(git rev-parse --short HEAD 2>/dev/null || echo nocommit)
dirty=""
if [ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]; then
  dirty="-dirty"
fi
ts=$(date -u +%Y%m%dT%H%M%SZ)
out="docs/evidence/runs/${ts}_${sha}${dirty}${label:+_$label}"
mkdir -p "$out"

{
  echo "utc: $ts"
  echo "commit: $(git rev-parse HEAD 2>/dev/null || echo none)"
  echo "uncommitted changes: ${dirty:+yes}${dirty:-no}"
  echo "label: ${label:-none}"
  echo "run by: $(git config user.name 2>/dev/null || echo unknown)"
  echo "node: $(node --version 2>/dev/null)"
  echo "hardhat: $(npx hardhat --version 2>/dev/null | tail -n 1)"
  echo "slither: $(slither --version 2>/dev/null || echo 'not installed')"
} > "$out/meta.txt"

: > "$out/summary.txt"

step() {
  local name=$1; shift
  echo ">> $name: $*"
  { echo "\$ $*"; echo; } > "$out/$name.log"
  "$@" >> "$out/$name.log" 2>&1
  local code=$?
  printf '%-10s exit %-4s %s\n' "$name" "$code" "$*" >> "$out/summary.txt"
}

step build    npx hardhat compile
step test     npx hardhat test --no-compile
# Gas stats and coverage each need their own instrumented build. With
# --no-compile they print an empty table or 0% and still exit 0.
step gas      npx hardhat test --gas-stats
step coverage npx hardhat test --coverage

if command -v slither >/dev/null 2>&1; then
  # Slither prints the build commands it runs on stdout too; those lines start
  # with a quote and are dropped from the checklist.
  echo ">> slither: slither . --json $out/slither.json --checklist"
  slither . --json "$out/slither.json" --checklist 2> "$out/slither.log" \
    | grep -v "^'" > "$out/slither-checklist.md"
  printf '%-10s exit %-4s %s\n' slither "${PIPESTATUS[0]}" "slither . --checklist" >> "$out/summary.txt"
else
  printf '%-10s skipped    (slither not installed)\n' slither >> "$out/summary.txt"
fi

cat >> "$out/summary.txt" <<'EOF'

Notes: gas and coverage re-run the suite, so they exit non-zero whenever any
test fails; on a "before fix" run that is expected. Slither exits non-zero when
it reports findings; it only failed to run if slither.json says "success": false.
EOF

echo
echo "Saved to $out"
cat "$out/summary.txt"
if [ -n "$dirty" ]; then
  echo "WARNING: uncommitted changes. Commit first if you will cite this run in the report."
fi
