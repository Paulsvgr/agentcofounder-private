# Pi + Berget setup (teammates)

Pi reads provider configuration from `~/.pi/agent/` on your machine. This folder is a **template** you copy there once. The repo never contains real API keys.

Default challenge model: **Berget `zai-org/GLM-5.2`** with thinking **off** (required for token efficiency).

## What you get from the repo

| File | Purpose |
|------|---------|
| `models.json` | Berget provider + GLM 5.2 thinking config |
| `auth.json` | Pi auth entry (references `$BERGET_API_KEY`) |
| `challenge-env.sh` | Sets provider, model, and thinking before each run |
| `challenge-env-qwen.sh` | Optional cheaper practice runs on Qwen 3.8 |
| `setup.sh` | Copies the above into `~/.pi/agent/` |

## What you must do yourself

1. Get your own **Berget API key** from [berget.ai](https://berget.ai).
2. Paste it into `~/.pi/agent/berget-api-key` after running setup.
3. **Never commit** that key file.

Each teammate uses their own key. Do not share keys in chat or git.

---

## One-time setup

Use **WSL Ubuntu**, not PowerShell.

```bash
git clone https://github.com/Paulsvgr/agentcofounder.git
cd agentcofounder

# Node 22.19.x required (.nvmrc in repo root)
node -v

npm ci --ignore-scripts
npm --prefix app-template ci --ignore-scripts
npm run check

chmod +x pi-agent/setup.sh
./pi-agent/setup.sh
```

### Add your API key

```bash
nano ~/.pi/agent/berget-api-key
```

- Paste your key on **one line**
- No quotes, no spaces before/after
- Save and exit

```bash
chmod 600 ~/.pi/agent/berget-api-key
```

If Node 22.19 is not on your PATH, either use nvm (`nvm use` in the repo root) or set before sourcing:

```bash
export CHALLENGE_NODE_BIN="$HOME/.local/toolchain/node-v22.19.0-linux-x64/bin"
```

---

## Quick auth test (recommended)

From the repo root:

```bash
source ~/.pi/agent/challenge-env.sh
echo "${BERGET_API_KEY:+API key loaded}"

./node_modules/.bin/pi --mode json \
  --provider berget \
  --model zai-org/GLM-5.2 \
  --thinking off \
  "Reply with exactly: ok"
```

You should get a JSON response. A `401` or auth error means the key file is wrong or empty.

---

## Every challenge run

```bash
cd agentcofounder
git pull

source ~/.pi/agent/challenge-env.sh
export CHALLENGE_AUTHOR=yourname

npm run challenge
```

Optional experiment label:

```bash
export CHALLENGE_TAG=budget-prompt-v2
```

Prepare-only (no model call):

```bash
source ~/.pi/agent/challenge-env.sh
npm run challenge -- --prepare-only
```

---

## Optional: Qwen practice run

```bash
source ~/.pi/agent/challenge-env-qwen.sh
npm run challenge
```

Official judging still uses GLM 5.2 via `challenge-env.sh`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Auth / 401 error | Check `~/.pi/agent/berget-api-key` — one line, `chmod 600` |
| `node: command not found` or wrong version | Install Node 22.19.x or set `CHALLENGE_NODE_BIN` |
| Model burns tokens on hidden thinking | Re-run `./pi-agent/setup.sh` to refresh `models.json` |
| Forgot to source env | Run `source ~/.pi/agent/challenge-env.sh` before `npm run challenge` |
| Port 3000 in use | Stop leftover Vite: `fuser -k 3000/tcp` (Linux) |

---

## Do not commit

- `~/.pi/agent/berget-api-key`
- Any `.env` file containing real credentials

The repo only tracks `berget-api-key.example` as a placeholder.
