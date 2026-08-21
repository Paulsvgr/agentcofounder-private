#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.pi/agent"

mkdir -p "$DEST"
chmod 700 "$DEST"

cp "$SCRIPT_DIR/models.json" "$SCRIPT_DIR/auth.json" \
  "$SCRIPT_DIR/challenge-env.sh" "$SCRIPT_DIR/challenge-env-qwen.sh" \
  "$SCRIPT_DIR/challenge-env-zai.sh" "$SCRIPT_DIR/challenge-env-openai.sh" \
  "$DEST/"

if [ ! -f "$DEST/berget-api-key" ]; then
  cp "$SCRIPT_DIR/berget-api-key.example" "$DEST/berget-api-key"
  chmod 600 "$DEST/berget-api-key"
  echo "Created $DEST/berget-api-key — paste your Berget API key there (single line)."
else
  echo "Kept existing $DEST/berget-api-key (not overwritten)."
fi

if [ ! -f "$DEST/zai-api-key" ]; then
  cp "$SCRIPT_DIR/zai-api-key.example" "$DEST/zai-api-key"
  chmod 600 "$DEST/zai-api-key"
  echo "Created $DEST/zai-api-key — paste your Z.ai API key there (single line)."
else
  echo "Kept existing $DEST/zai-api-key (not overwritten)."
fi

if [ ! -f "$DEST/openai-api-key" ]; then
  : > "$DEST/openai-api-key"
  chmod 600 "$DEST/openai-api-key"
  echo "Created empty $DEST/openai-api-key (optional OpenAI)."
else
  echo "Kept existing $DEST/openai-api-key (not overwritten)."
fi

echo "Pi config installed to $DEST"
echo "Next: edit ~/.pi/agent/zai-api-key (or berget-api-key), then source the matching challenge-env*.sh"
