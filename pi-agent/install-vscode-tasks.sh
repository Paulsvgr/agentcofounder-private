#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST="$REPO_ROOT/.vscode/tasks.json"

mkdir -p "$REPO_ROOT/.vscode"
cp "$SCRIPT_DIR/tasks.json" "$DEST"

echo "Installed VS Code tasks to $DEST"
echo "In Cursor/VS Code: Terminal → Run Task… (or Ctrl+Shift+B for prepare-only)"
