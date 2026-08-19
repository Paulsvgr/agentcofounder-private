#!/usr/bin/env bash
set -euo pipefail

GH="${GH:-$HOME/.local/bin/gh}"
REPO_NAME="${REPO_NAME:-agentcofounder-private}"
PUBLIC_FORK="${PUBLIC_FORK:-Paulsvgr/agentcofounder}"

cd "$(git rev-parse --show-toplevel)"

if ! "$GH" auth status -h github.com >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run:"
  echo "  $GH auth login -h github.com -p https -w"
  exit 1
fi

OWNER="$("$GH" api user -q .login)"
PRIVATE_REPO="$OWNER/$REPO_NAME"

echo "Creating private repository: $PRIVATE_REPO"
if "$GH" repo view "$PRIVATE_REPO" >/dev/null 2>&1; then
  echo "Repository already exists."
else
  "$GH" repo create "$REPO_NAME" --private --description "Private AgentCofounder competition development"
fi

if git remote get-url private >/dev/null 2>&1; then
  git remote set-url private "https://github.com/$PRIVATE_REPO.git"
else
  git remote add private "https://github.com/$PRIVATE_REPO.git"
fi

echo "Pushing all branches..."
git push private --all

echo "Pushing all tags..."
git push private --tags

echo "Verifying remote branches..."
git ls-remote --heads private

echo "Verifying tag baseline-v1-hardened..."
git ls-remote --tags private | grep baseline-v1-hardened || true

echo ""
echo "Private repo ready: https://github.com/$PRIVATE_REPO"
echo ""

DELETE_FORK="${DELETE_FORK:-}"
if [[ "$DELETE_FORK" == "yes" ]]; then
  confirm=y
else
  read -r -p "Delete public fork $PUBLIC_FORK? [y/N] " confirm
fi
if [[ "$confirm" =~ ^[Yy]$ ]]; then
  "$GH" repo delete "$PUBLIC_FORK" --yes
  echo "Deleted public fork: $PUBLIC_FORK"
  if git remote get-url origin >/dev/null 2>&1; then
    git remote remove origin
    echo "Removed local remote: origin"
  fi
  git remote rename private origin
  echo "Renamed remote private -> origin"
else
  echo "Skipped fork deletion. Your private remote is: private"
fi

echo "Done."
