# Source from an Ubuntu shell before `npm run challenge`.
# Does not contain secrets. Set BERGET_API_KEY in the same shell, or
# keep it in ~/.pi/agent/berget-api-key (mode 600).
#
# Optional: export CHALLENGE_NODE_BIN=/path/to/node/bin if node is not on PATH.

if [ -n "${CHALLENGE_NODE_BIN:-}" ]; then
  export PATH="$CHALLENGE_NODE_BIN:$PATH"
fi

if [ -z "${BERGET_API_KEY:-}" ] && [ -f "$HOME/.pi/agent/berget-api-key" ]; then
  BERGET_API_KEY="$(tr -d '\n\r' < "$HOME/.pi/agent/berget-api-key")"
  export BERGET_API_KEY
fi

export CHALLENGE_PROVIDER="berget"
export CHALLENGE_MODEL="zai-org/GLM-5.2"
export CHALLENGE_THINKING="off"
