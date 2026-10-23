#!/usr/bin/env bash
# Usage: scripts/evidence.sh [label]
#
# Runs build, tests, gas report, coverage and Slither, and saves every output
# under docs/evidence/runs/<utc time>_<commit>[-dirty][_label]/ so each result
# is tied to a commit. Failing steps are recorded, not hidden: a "before fix"
# run is supposed to show a failing test.

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
  echo "forge: $(forge --version 2>/dev/null | head -n 1)"
  echo "slither: $(slither --version 2>/dev/null)"
} > "$out/meta.txt"

: > "$out/summary.txt"

step() {
  local name=$1; shift
  echo ">> $name: $*"
  "$@" > "$out/$name.log" 2>&1
  local code=$?
  printf '%-10s exit %s\n' "$name" "$code" >> "$out/summary.txt"
}

step build    forge build
step test     forge test -vvv
step gas      forge test --gas-report
step coverage forge coverage --report summary

# One Slither run writes the JSON report and prints the Markdown checklist.
# Slither prints the build commands it runs on stdout too; those lines start
# with a quote and are dropped from the checklist.
echo ">> slither: slither . --json $out/slither.json --checklist"
slither . --json "$out/slither.json" --checklist 2> "$out/slither.log" \
  | grep -v "^'" > "$out/slither-checklist.md"
printf '%-10s exit %s\n' slither "${PIPESTATUS[0]}" >> "$out/summary.txt"

cat >> "$out/summary.txt" <<'EOF'

Notes: gas and coverage exit non-zero whenever any test fails, so on a
"before fix" run that is expected. Slither exits non-zero when it reports
findings; it only failed to run if slither.json says "success": false.
EOF

echo
echo "Saved to $out"
cat "$out/summary.txt"
if [ -n "$dirty" ]; then
  echo "WARNING: uncommitted changes. Commit first if you will cite this run in the report."
fi
