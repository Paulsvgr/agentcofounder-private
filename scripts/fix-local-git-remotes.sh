#!/usr/bin/env bash
# Point this clone at the private competition repo and set branch upstreams.
set -euo pipefail

PRIVATE_URL="${PRIVATE_URL:-https://github.com/Paulsvgr/agentcofounder-private.git}"

cd "$(git rev-parse --show-toplevel)"

echo "Repository: $(pwd)"
echo "Setting origin -> $PRIVATE_URL"
git remote set-url origin "$PRIVATE_URL"

echo "Fetching origin..."
git fetch origin

for branch in track-a-minimal main experiments/run-logging; do
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    if git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
      git branch -u "origin/$branch" "$branch"
      echo "Upstream: $branch -> origin/$branch"
    else
      echo "Skip upstream for $branch (not on origin yet)"
    fi
  fi
done

echo ""
git remote -v
echo ""
git branch -vv
echo ""
echo "Done. Active development branch: track-a-minimal"
