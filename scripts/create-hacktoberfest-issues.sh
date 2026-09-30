#!/usr/bin/env bash
# Script to create all 8 Hacktoberfest issues on GitHub via gh CLI.
# Usage: bash scripts/create-hacktoberfest-issues.sh

set -euo pipefail

REPO="lucasrafaldini/paperdeck"
ISSUES_DIR=".github/hacktoberfest-issues"

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh (GitHub CLI) is not installed."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh is not authenticated. Please run 'gh auth login' first."
  exit 1
fi

echo "Creating Hacktoberfest issues for $REPO..."

for file in "$ISSUES_DIR"/*.md; do
  [ -f "$file" ] || continue
  
  # Extract title from frontmatter
  TITLE=$(grep '^title:' "$file" | sed -E 's/^title:[[:space:]]*"?([^"]*)"?/\1/')
  
  # Extract labels
  LABELS=$(grep '^labels:' "$file" | sed -E 's/^labels:[[:space:]]*\[(.*)\]/\1/' | tr -d '" ' || echo "hacktoberfest")
  
  # Extract body (everything after the second ---)
  BODY=$(awk 'BEGIN{c=0} /^---/{c++; next} c>=2{print}' "$file")
  
  echo "Creating issue: $TITLE"
  gh issue create \
    --repo "$REPO" \
    --title "$TITLE" \
    --label "$LABELS" \
    --body "$BODY"
done

echo "All 8 Hacktoberfest issues created successfully!"
