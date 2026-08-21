#!/usr/bin/env bash
# Snapshot output/app into saved-apps/ without node_modules.
# Usage:
#   ./scripts/save-app.sh <label> [run-id]
# If run-id is omitted, uses the newest artifacts/runs/* directory name.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL=${1:?label required e.g. a-autotest-3}
RUN_ID=${2:-}

cd "$ROOT"

if [[ -z "$RUN_ID" ]]; then
  RUN_ID=$(ls -1dt artifacts/runs/*/ 2>/dev/null | head -1 | xargs -r basename)
fi
if [[ -z "$RUN_ID" ]]; then
  echo "No run id and no artifacts/runs/* found" >&2
  exit 2
fi

APP_SRC="$ROOT/output/app"
if [[ ! -d "$APP_SRC" ]]; then
  echo "Missing $APP_SRC — nothing to save" >&2
  exit 2
fi

DEST="$ROOT/saved-apps/${LABEL}-${RUN_ID}"
mkdir -p "$ROOT/saved-apps"

# Fresh copy each time for the same label+run.
rm -rf "$DEST"
mkdir -p "$DEST"

# Prefer rsync if available (excludes cleanly); else cp + rm.
if command -v rsync >/dev/null 2>&1; then
  rsync -a \
    --exclude node_modules \
    --exclude .git \
    "$APP_SRC/" "$DEST/"
else
  cp -a "$APP_SRC/." "$DEST/"
  rm -rf "$DEST/node_modules"
fi

# Keep audited result next to the app and in the run folder.
if [[ -f "$ROOT/result.json" ]]; then
  cp -f "$ROOT/result.json" "$DEST/result.json"
  mkdir -p "$ROOT/artifacts/runs/$RUN_ID"
  cp -f "$ROOT/result.json" "$ROOT/artifacts/runs/$RUN_ID/result.json"
fi

# Tiny opener note
cat >"$DEST/HOW-TO-OPEN.md" <<EOF
# ${LABEL} (${RUN_ID})

\`\`\`bash
cd saved-apps/${LABEL}-${RUN_ID}
npm ci --ignore-scripts
npm run dev
# open http://localhost:3000
\`\`\`

Port 3000 must be free. Do not leave \`npm run dev\` running during a challenge.
EOF

echo "Saved app → $DEST"
ls -la "$DEST" | head -20
