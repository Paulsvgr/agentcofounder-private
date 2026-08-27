#!/usr/bin/env bash
# Run the harness once per evaluation idea, to check it does not depend on the
# domain of the public development prompt. Judging uses an unseen idea.
# Usage: ./eval.sh
set -euo pipefail

if ! wsl -d Ubuntu -e true 2>/dev/null; then
  echo "WSL Ubuntu is not reachable." >&2
  exit 1
fi

wsl -d Ubuntu -e bash -lc "
  rsync -a \
    --exclude node_modules --exclude .git --exclude runs \
    --exclude 'artifacts/runs' --exclude 'output/app' --exclude dist \
    '/mnt$(pwd)/' \$HOME/agentcofounder/
"
export SKIP_SYNC=1

./wrun.sh >/dev/null 2>&1 || true                                    # public book prompt
for idea in eval-ideas/*.txt; do
  echo "═══ $idea ═══"
  ./wrun.sh --idea-file "$idea" >/dev/null 2>&1 || true
done

node compare.js
