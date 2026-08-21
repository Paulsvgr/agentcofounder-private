# Saved challenge apps

Each folder is a snapshot of `output/app` after a run (no `node_modules`).

## Open any build

```bash
cd saved-apps/<folder>
npm ci --ignore-scripts
npm run dev
# http://localhost:3000
```

Free port 3000 first. Do not leave the server running during `npm run challenge`.

New runs are saved automatically by `./scripts/retest-condition.sh` via `./scripts/save-app.sh`.

## Today’s experiment (2026-08-21)

| Label | Weighted | Folder |
|-------|----------|--------|
| A-autotest-3 | ~113k | `A-autotest-3-2026-08-21T17-49-43-616Z` |

Earlier A-baseline / A-prompt / A-autotest-1/2 apps from the same day were **not** snapshotted (only telemetry remains under `artifacts/runs/`).

## Prior Z.ai cohort (still here)

| Label | Folder |
|-------|--------|
| A-zai | `a-prime-zai-2026-08-20T21-51-00-219Z` |
| B-zai | `b-prime-zai-2026-08-20T21-54-53-923Z` |
| C-zai clean | `c-prime-zai-clean-2026-08-20T22-00-59-263Z` |
