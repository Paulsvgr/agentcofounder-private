# Local development (WSL + Windows)

## Canonical workspace

Use the **WSL Ubuntu** clone only:

```text
/home/codemaster/hackathon/agentcofounder
```

Remote:

```text
origin  https://github.com/Paulsvgr/agentcofounder-private.git  (private)
```

The old public fork `Paulsvgr/agentcofounder` was deleted. Do not clone or push to it.

## Fix remotes after migration

From the repo root in Ubuntu/WSL:

```bash
chmod +x scripts/fix-local-git-remotes.sh
./scripts/fix-local-git-remotes.sh
```

## Cursor / VS Code on Windows

Open the **WSL folder**, not a copy under `C:\`:

- **File → Open Folder →** `\\wsl$\Ubuntu-22.04\home\codemaster\hackathon\agentcofounder`
- Or use the **Ubuntu-22.04 (hackathon)** terminal profile (see `.vscode/settings.json`)

Git, Node, Pi, and challenge runs should all use WSL. The Windows-side path is only the editor shell into WSL.

## If you have a stale Windows clone (`C:\...`)

Either delete it and use WSL only, or repoint it:

```powershell
cd C:\path\to\agentcofounder
git remote set-url origin https://github.com/Paulsvgr/agentcofounder-private.git
git fetch origin
git checkout track-a-minimal
git pull
```

You need GitHub access to the private repo (`gh auth login` or a PAT with `repo` scope).

## GitHub CLI (push / private repo)

```bash
~/.local/bin/gh auth login -h github.com -p https -w
gh auth status
```

## Branches

| Branch | Purpose |
|---|---|
| `track-a-minimal` | Active Track A harness (`89ffe97`, tag `baseline-v1-hardened`) |
| `main` | Upstream starter alignment |
| `experiments/run-logging` | Run logging experiment (optional) |
