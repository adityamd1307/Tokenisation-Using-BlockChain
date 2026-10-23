#!/usr/bin/env bash
# Usage: scripts/new-issue.sh "Short title of the issue"
#
# Creates docs/issues/AUD-NNN-<slug>.md from the template, with the next free
# number, and adds a row to docs/issues/INDEX.md.

set -euo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "Run this inside the git repo." >&2; exit 1; }
cd "$root"

title="${1:-}"
if [ -z "$title" ]; then
  echo 'Usage: scripts/new-issue.sh "Short title"' >&2
  exit 1
fi

dir=docs/issues
last=$(ls "$dir" 2>/dev/null | sed -n 's/^AUD-\([0-9][0-9]*\)-.*\.md$/\1/p' | sort -n | tail -n 1)
next=$(printf '%03d' $(( 10#${last:-0} + 1 )))
id="AUD-$next"
slug=$(printf '%s' "$title" | tr '[:upper:]' '[:lower:]' | sed -e 's/[^a-z0-9]\{1,\}/-/g' -e 's/^-//' -e 's/-$//' | cut -c1-50)
file="$dir/$id-$slug.md"

sed -e "s/AUD-XXX/$id/g" -e "s/TITLE/$(printf '%s' "$title" | sed 's/[&/\]/\\&/g')/" "$dir/TEMPLATE.md" > "$file"
echo "| [$id]($id-$slug.md) | $title | | | open |" >> "$dir/INDEX.md"

echo "Created $file"
