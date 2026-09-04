# V2 Control App

Local web UI for browsing harness runs, comparing experiments, editing run metadata,
and launching new challenge runs. It reads from `artifacts/runs/` and shells out to
the same npm scripts the CLI uses (`analyze:run`, `reconcile:run`, `challenge`, etc.).

**Extended reference:** [`docs/v2/CONTROL-APP.md`](../docs/v2/CONTROL-APP.md)

## Quick start

**Requirements:** Node 22.19.x (same engine as the main harness).

```bash
cd control-app
npm install
npm run dev
```

| Service | URL |
|---------|-----|
| **UI** | http://localhost:5174 |
| **API** | http://localhost:4319 |

Port **3000** stays reserved for the generated app during challenge runs.

If the API returns 404 for new routes after a code change, restart the dev server:

```bash
fuser -k 4319/tcp 2>/dev/null
npm run dev
```

Run API and UI separately when debugging:

```bash
npm run dev:server   # API only (:4319)
npm run dev:web      # Vite only (:5174, proxies /api → :4319)
```

## What you can do

### Runs (`/`)

Browse every folder under `artifacts/runs/` with:

- **Filters** — experiment, status (quick pills), provider, model, author, plus advanced
  filters (experiment id, arm, thinking, analyzed, mega-call, date range, min thresholds).
  Primary filters sync to the URL (`?experiment=…&status=success&model=…`) so views are
  shareable.
- **Insights** — KPI strip and token breakdown for the **filtered set** only (success
  rate, median weighted/calls/wall, cache hit ratio, token mix, weighted cost drivers).
- **Compare charts** — cost vs app rating scatter, median weighted and success rate
  by experiment / model / provider / author.
- **Table** — sortable run list with status badges, mega-call highlighting, and links
  to run detail.

**Weighted cost** (scoreboard formula):

```text
weighted ≈ input + output×3 + cache_read×0.1
```

List view reads only small files (`run-manifest.json`, `result.json`, overlay) — never
`events.jsonl`.

### Experiments (`/experiments`)

Catalog of structured experiments under `artifacts/experiments/<id>/experiment.json`:

- List catalog entries plus **used-only** slugs seen on runs but not yet materialized
- Create, edit, and **materialize** used-only slugs into the catalog
- Jump to filtered runs via **View runs** → `/?experiment=<id>`

Seed the catalog from the repo taxonomy:

```bash
# from repo root
npm run seed:experiments
```

### Run detail (`/runs/:id`)

- Summary KPIs, manifest provenance, harness config (read-only)
- Per-call token charts and activity breakdown (when analysis exists)
- **Metadata panel** — author, app rating, experiment link, comments (stored in overlay)
- **Analyze** / **Reconcile** / **Replay** — background jobs with live console (SSE)
- Open generated app, station HTML, verification details
- **Publish to team** — one-click POST to the shared runs DB (overlay + export payload)

### Publish to team runs app

From run detail → **Publish to team**. The server builds a Phase B export record
(overlay author, rating, comments, classification, manifest) and POSTs to the
hackathon API.

**Access key** (team shared — never commit):

| Option | Setup |
|--------|--------|
| **Server env** | `export HACKATHON_ACCESS_CODE='…'` before `npm run dev` — no key prompt in UI |
| **Browser** | Click **Add access key** in the publish panel — stored in `localStorage` only |

Optional env overrides (defaults shown):

```bash
export HACKATHON_API_BASE=https://admin.coretechs.se/hackathon
export FRONTEND_BASE=https://agentcofounder-hackathon.vercel.app
```

After a successful publish, the UI links to the run on the team app. **Restart the
API** (`npm run dev`) after changing server env or adding new API routes.

CLI alternative (legacy): `ac-control` `npm run publish:run -- <run-id>` — see
[TEAM-GUIDE §14](../docs/v2/TEAM-GUIDE.md#14-shared-run-storage--export-publish-and-datamanifest).

### New run (`/new`)

Launch `npm run challenge` with a chosen env profile and overrides:

- Env profile from `~/.pi/agent/challenge-env*.sh` (default: **Z.ai**)
- Provider, model, thinking, timeout, experiment/arm/rep/intervention, idea file
- **Harness / template flag board** (KEEP / PARKED / OFF) with per-launch toggles
- Start / **Stop** / timeout status (`running` · `succeeded` · `failed` · `timed_out` · `stopped`)
- Live job output stream + link to detected `artifacts/runs/<id>` when available

**Recommended local profile:** `challenge-env-zai.sh` · provider `zai` · model `glm-5.2` ·
thinking `high`. Berget can emit mega-calls; see [CONTROL-APP.md](../docs/v2/CONTROL-APP.md).

Runs list shows experiment **arm** badges and a compact KEEP/PARKED board strip.

## Data files

| Path | Purpose |
|------|---------|
| `artifacts/runs/<run-id>/` | Raw run artifacts (manifest, result, events, sessions) |
| `artifacts/analysis/<run-id>/` | Ledger, `station.json`, `station.html` |
| `artifacts/replay/<run-id>/` | Replay reports |
| `artifacts/runs-overlay.json` | Human metadata per run (author, rating, experiment link, comments) |
| `artifacts/experiments/<id>/experiment.json` | Experiment catalog entries |

Seed overlay defaults (authors, taxonomy):

```bash
# from repo root
npm run seed:overlay
```

## Architecture

```text
Browser (React + Vite, :5174)
    │  JSON + SSE
    ▼
API server (Node + tsx, :4319)
    ├── read   artifacts/runs/, analysis/, overlay, experiments
    └── spawn  npm run analyze:run | reconcile:run | replay:run | challenge
               (cwd = repo root)
```

The server does **not** reimplement analysis — [`scripts/analyze-run.ts`](../scripts/analyze-run.ts)
and [`src/v2/`](../src/v2/) remain the source of truth.

## API overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness + repo root |
| `GET` | `/api/runs` | All run summaries |
| `GET` | `/api/runs/:id` | Manifest, result, ledger, station |
| `GET` | `/api/runs/:id/overlay` | Run metadata overlay |
| `PATCH` | `/api/runs/:id/overlay` | Update run metadata |
| `GET` | `/api/experiments` | Merged experiment catalog + usage counts |
| `GET` | `/api/experiments/:id` | Experiment detail + linked run ids |
| `POST` | `/api/experiments` | Create catalog entry |
| `PATCH` | `/api/experiments/:id` | Edit catalog entry |
| `POST` | `/api/experiments/:id/materialize` | Promote used-only slug to catalog |
| `GET` | `/api/authors` | Known authors from overlay |
| `GET` | `/api/overlay/taxonomy` | Classification taxonomy |
| `POST` | `/api/runs/:id/analyze` | → `npm run analyze:run` |
| `POST` | `/api/runs/:id/reconcile` | → `npm run reconcile:run` |
| `POST` | `/api/runs/:id/replay` | → `npm run replay:run` |
| `POST` | `/api/runs/:id/app/open` | Start generated app dev server |
| `GET` | `/api/runs/:id/station.html` | Served analysis HTML |
| `POST` | `/api/challenge` | Launch challenge run |
| `GET` | `/api/challenge/active` | Active challenge job (or null) |
| `GET` | `/api/harness-board` | Frozen KEEP/PARKED/OFF flag board + defaults |
| `GET` | `/api/jobs/:id` | Job status |
| `POST` | `/api/jobs/:id/stop` | Stop a running job |
| `GET` | `/api/jobs/:id/stream` | SSE job output |
| `GET` | `/api/env-profiles` | Available challenge env scripts |
| `GET` | `/api/publish/status` | Publish config (server key set?, API bases) |
| `POST` | `/api/runs/:id/publish` | Publish run to team DB |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | API + Vite together |
| `npm run dev:server` | API only |
| `npm run dev:web` | Vite only |
| `npm run build` | Production UI build → `dist/web/` |
| `npm test` | Vitest (runs, overlay, experiments, export, publish) |
| `npm run typecheck` | Server + web TypeScript |

## Project layout

```text
control-app/
├── server/           # Node API (runs, experiments, overlay, jobs)
├── web/src/          # React UI
│   ├── pages/        # Runs, Experiments, Run detail, New run
│   ├── components/   # Filters, insights, charts, metadata panel
│   └── lib/          # API client, run-stats helpers
└── test/             # Vitest against real artifacts/runs samples
```

## Tests

```bash
cd control-app
npm test
npm run typecheck
```

Tests summarize real runs under `artifacts/runs/` without loading full event logs.

## Related docs

- [TEAM-GUIDE §16](../docs/v2/TEAM-GUIDE.md) — team summary
- [TEAM-GUIDE §6](../docs/v2/TEAM-GUIDE.md) — analysis station CLI
- [TEAM-GUIDE §13](../docs/v2/TEAM-GUIDE.md) — run manifest
- [PLAN.md](../docs/v2/PLAN.md) — V2 roadmap
