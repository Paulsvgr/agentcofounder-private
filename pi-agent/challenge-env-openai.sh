# Source before `npm run challenge`. Secrets: ~/.pi/agent/openai-api-key or OPENAI_API_KEY.
# Override model with OPENAI_CHALLENGE_MODEL (default gpt-5.2).

if [ -n "${CHALLENGE_NODE_BIN:-}" ]; then
  export PATH="$CHALLENGE_NODE_BIN:$PATH"
fi

if [ -z "${OPENAI_API_KEY:-}" ] && [ -f "$HOME/.pi/agent/openai-api-key" ]; then
  OPENAI_API_KEY="$(tr -d '\n\r' < "$HOME/.pi/agent/openai-api-key")"
  export OPENAI_API_KEY
fi

export CHALLENGE_PROVIDER="openai"
# Do not honor a stale CHALLENGE_MODEL from Berget runs.
export CHALLENGE_MODEL="${OPENAI_CHALLENGE_MODEL:-gpt-5.2}"
export CHALLENGE_THINKING="off"
