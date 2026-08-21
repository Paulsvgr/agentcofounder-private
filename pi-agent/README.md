# Pi + Berget setup (teammates)

Pi reads provider configuration from `~/.pi/agent/` on your machine. This folder is a **template** you copy there once. The repo never contains real API keys.

Default challenge model: **Berget `zai-org/GLM-5.2`** with thinking **off** (required for token efficiency).

Use **WSL Ubuntu**, not PowerShell.

---

## Copy-paste: full one-time setup

Run this block from an **Ubuntu** terminal after cloning the repo. Change the clone path and your name as needed.

```bash
# --- clone (skip if you already have the repo) ---
git clone https://github.com/Paulsvgr/agentcofounder.git
cd agentcofounder

# --- repo dependencies (Node 22.19.x required) ---
node -v
npm ci --ignore-scripts
npm --prefix app-template ci --ignore-scripts
npm run check

# --- Pi config into ~/.pi/agent/ ---
chmod +x pi-agent/setup.sh
./pi-agent/setup.sh

# --- YOUR Berget API key (one line, no quotes) ---
# Paste into ~/.pi/agent/berget-api-key in your editor, or:
printf '%s\n' 'YOUR_BERGET_KEY' > ~/.pi/agent/berget-api-key
chmod 600 ~/.pi/agent/berget-api-key

# --- optional: VS Code / Cursor tasks (run challenge, dev server, …) ---
chmod +x pi-agent/install-vscode-tasks.sh
./pi-agent/install-vscode-tasks.sh

# --- quick auth test ---
source ~/.pi/agent/challenge-env.sh
echo "${BERGET_API_KEY:+API key loaded}"
./node_modules/.bin/pi --mode json \
  --provider berget \
  --model zai-org/GLM-5.2 \
  --thinking off \
  "Reply with exactly: ok"
```

If Node 22.19 is not on your PATH, add this **before** `source` (adjust the path to your install):

```bash
export CHALLENGE_NODE_BIN="$HOME/.local/toolchain/node-v22.19.0-linux-x64/bin"
```

Or use nvm in the repo root: `nvm use`

---

## Copy-paste: every challenge run

```bash
cd agentcofounder
git pull

source ~/.pi/agent/challenge-env.sh
export CHALLENGE_AUTHOR=yourname

npm run challenge
```

Prepare-only (no model call):

```bash
source ~/.pi/agent/challenge-env.sh
npm run challenge -- --prepare-only
```

Open the generated app after a run:

```bash
cd output/app
npm run dev
# open http://localhost:3000
```

---

## VS Code / Cursor tasks

Tasks let you run common commands from the editor instead of typing them each time.

### Install tasks (one time)

From the repo root:

```bash
chmod +x pi-agent/install-vscode-tasks.sh
./pi-agent/install-vscode-tasks.sh
```

This copies `pi-agent/tasks.json` → `.vscode/tasks.json` (local only, safe to gitignore or commit per team preference).

### Run a task

1. Open the repo in **Cursor** or **VS Code**
2. **Terminal → Run Task…** (or `Ctrl+Shift+P` → “Tasks: Run Task”)
3. Pick a task:

| Task | What it does |
|------|----------------|
| **Challenge: run (GLM 5.2)** | Sources `challenge-env.sh`, runs `npm run challenge` |
| **Challenge: prepare-only** | Setup check without calling the model |
| **App: start dev server (localhost:3000)** | `npm run dev` in `output/app/` |
| **Challenge: run (Qwen 3.8)** | Optional cheaper practice run (Berget) |
| **Challenge: run (Z.ai GLM-5.2)** | Practice / cheaper GLM-5.2 via Z.ai |
| **Ubuntu: open repo shell** | Opens a WSL bash terminal in the repo |

**Default build task:** `Ctrl+Shift+B` runs **Challenge: prepare-only**.

### Windows + WSL

Tasks use `wsl.exe -d Ubuntu-22.04`. If your distro name differs, edit `.vscode/tasks.json` after install:

```bash
wsl.exe -l -v          # list distro names
# then edit .vscode/tasks.json and replace Ubuntu-22.04 with yours
```

Ensure Node 22.19 is on PATH inside WSL (`node -v` in an Ubuntu terminal).

### Manual install (without the script)

```bash
mkdir -p .vscode
cp pi-agent/tasks.json .vscode/tasks.json
```

---

## What you get from the repo

| File | Purpose |
|------|---------|
| `models.json` | Berget provider + GLM 5.2 thinking config |
| `auth.json` | Pi auth entries (`$BERGET_API_KEY`, `$ZAI_API_KEY`, `$OPENAI_API_KEY`) |
| `challenge-env.sh` | Berget GLM 5.2 (contest-shaped default) |
| `challenge-env-qwen.sh` | Optional cheaper Berget Qwen 3.8 practice |
| `challenge-env-zai.sh` | Z.ai Coding Plan GLM-5.2 (cheaper practice) |
| `challenge-env-openai.sh` | Optional OpenAI practice |
| `setup.sh` | Copies Pi config into `~/.pi/agent/` |
| `tasks.json` | VS Code task definitions (copy via `install-vscode-tasks.sh`) |

## What you must do yourself

1. Get an API key from [berget.ai](https://berget.ai) and/or [z.ai](https://z.ai).
2. Paste into `~/.pi/agent/berget-api-key` and/or `~/.pi/agent/zai-api-key` after running setup.
3. **Never commit** those key files.

Each teammate uses their own key. Do not share keys in chat or git.

---

## What `source challenge-env.sh` means

```bash
source ~/.pi/agent/challenge-env.sh
```

Runs the env script **in your current terminal** so `BERGET_API_KEY`, `CHALLENGE_PROVIDER`, and `CHALLENGE_MODEL` are set for the next command. You must run this once per terminal session before `npm run challenge`.

Shorthand (same thing):

```bash
. ~/.pi/agent/challenge-env.sh
```

---

## Optional: Qwen practice run

```bash
source ~/.pi/agent/challenge-env-qwen.sh
npm run challenge
```

Official judging still uses GLM 5.2 via `challenge-env.sh` (Berget) unless organizers say otherwise.

---

## Optional: Z.ai GLM-5.2 (cheaper practice)

Same model family as contest judging (`glm-5.2` on provider `zai`).

```bash
# one-time: write key (single line, no quotes) — or open ~/.pi/agent/zai-api-key in Cursor
printf '%s\n' 'YOUR_ZAI_KEY' > ~/.pi/agent/zai-api-key
chmod 600 ~/.pi/agent/zai-api-key

# each run
source ~/.pi/agent/challenge-env-zai.sh
./node_modules/.bin/pi auth check --provider zai --model glm-5.2
npm run challenge
```

Override model: `export ZAI_CHALLENGE_MODEL=glm-5-turbo` before sourcing (or after, then re-export `CHALLENGE_MODEL`).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Auth / 401 error | Check `~/.pi/agent/berget-api-key` or `~/.pi/agent/zai-api-key` — one line, `chmod 600` |
| `node: command not found` or wrong version | Install Node 22.19.x or set `CHALLENGE_NODE_BIN` |
| Model burns tokens on hidden thinking | Re-run `./pi-agent/setup.sh` to refresh `models.json` |
| Forgot to source env | Run `source ~/.pi/agent/challenge-env-zai.sh` (or berget/openai) before `npm run challenge` |
| Port 3000 in use | Stop leftover Vite: `fuser -k 3000/tcp` (Linux) |
| Task fails on Windows | Check WSL distro name in `.vscode/tasks.json` |
| Stale provider/model from prior shell | `unset CHALLENGE_PROVIDER CHALLENGE_MODEL` then source the env script again |

---

## Do not commit

- `~/.pi/agent/berget-api-key`
- `~/.pi/agent/zai-api-key`
- `~/.pi/agent/openai-api-key`
- Any `.env` file containing real credentials

The repo only tracks `*-api-key.example` placeholders.
