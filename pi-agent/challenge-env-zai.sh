# Source from an Ubuntu shell before `npm run challenge`.
# Does not contain secrets. Set ZAI_API_KEY in the same shell, or
# keep it in ~/.pi/agent/zai-api-key (mode 600).
#
# Z.ai Coding Plan (global) — same GLM-5.2 family as contest, cheaper than Berget.
# Override model if needed: export ZAI_CHALLENGE_MODEL=glm-5-turbo

if [ -n "${CHALLENGE_NODE_BIN:-}" ]; then
  export PATH="$CHALLENGE_NODE_BIN:$PATH"
fi

if [ -z "${ZAI_API_KEY:-}" ] && [ -f "$HOME/.pi/agent/zai-api-key" ]; then
  ZAI_API_KEY="$(tr -d '\n\r' < "$HOME/.pi/agent/zai-api-key")"
  export ZAI_API_KEY
fi

# Do not honor a stale CHALLENGE_MODEL from Berget/OpenAI runs.
export CHALLENGE_PROVIDER="zai"
export CHALLENGE_MODEL="${ZAI_CHALLENGE_MODEL:-glm-5.2}"
export CHALLENGE_THINKING="off"
