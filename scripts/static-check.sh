#!/usr/bin/env bash
# Static gate — posted-sdk-react-native. No native build (CI does that). Correctness blocks; style does not.
set -euo pipefail
corepack enable >/dev/null 2>&1 || true
echo "▶ install deps"
pnpm install --frozen-lockfile
echo "▶ correctness: typecheck (BLOCKING)"
pnpm --filter @posted-sdk/react-native typecheck
echo "▶ style (non-blocking)"
pnpm exec eslint . --cache || echo "::warn:: eslint findings (non-blocking)"
pnpm exec prettier --check . || echo "::warn:: prettier diffs (non-blocking)"
# Guard: reject stale references to the old GitHub org (postedapp); correct org is thepostedapp.
# The search pattern does not appear in thepostedapp URLs so there are no false positives.
echo "▶ org-url guard: no stale old-org references (BLOCKING)"
STALE_PATTERN='github\.com/postedapp'
if MATCHES=$(git grep -n -- "$STALE_PATTERN" -- ':!scripts/static-check.sh'); then
  echo "✗ stale old-org URL found — update to github.com/thepostedapp:"
  echo "$MATCHES"
  exit 1
fi
echo "✓ static gate passed"
