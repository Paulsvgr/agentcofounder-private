#!/usr/bin/env bash
# Apply Exp5b storage hardening after Exp6 cohort completes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "Exp5b hardening is already applied when collectionStore.ts uses resolveStorage() lazily."
echo "Verify: grep -q resolveStorage $ROOT/app-template/src/lib/collectionStore.ts"
grep -q resolveStorage "$ROOT/app-template/src/lib/collectionStore.ts"
echo "OK. Run: npm run check && npm run experiment:run -- --arm storage-treatment --reps 5 --provider zai --publish"
