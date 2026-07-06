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
echo "✓ static gate passed"
