# V2 Control App — local run browser and launcher

The **V2 Control App** is a local web UI for browsing harness runs, inspecting
provenance and per-call token shape, triggering analysis on demand, and launching
new challenge runs with a chosen provider/model/experiment config.

It lives in [`control-app/`](../../control-app/) at the repo root, isolated from
the main harness (`npm run check` does not typecheck it).

---

## Why it exists

During baseline lock we discovered that **Berget `zai-org/GLM-5.2`** and **direct
Z.ai `glm-5.2`** behave very differently: Berget can emit hidden `thinking` blocks
and 10k–27k output in a single call even with `--thinking off`, while Z.ai stays
incremental (~1.5k max per call).

That difference was invisible until we hand-parsed session JSONL. The control app
surfaces **provider**, **thinking**, and **max output per call** as first-class
columns so a bad route is obvious at a glance.

---

## Architecture

```text
Browser (React, :5174)
    │  JSON + SSE
    ▼
API server (Node, :4319)
    ├── read   artifacts/runs/*          (manifest + result.json only — never events.jsonl for list)
    ├── read   artifacts/analysis/*      (ledger, station.json, station.html)
    └── spawn  npm run analyze:run | reconcile:run | challenge   (cwd = repo root)
```

The server **shells out to existing npm scripts** — it does not reimplement
analysis logic. [`scripts/analyze-run.ts`](../../scripts/analyze-run.ts) and
[`src/v2/normalize.ts`](../../src/v2/normalize.ts) remain the single source of truth.

---

## Setup and run

**Requirements:** Node 22.19.x (same as the harness).

```bash
cd control-app
npm install --legacy-peer-deps   # first time only
npm run dev
```

| Service | URL |
|---------|-----|
| **UI** | http://localhost:5174 |
| **API** | http://localhost:4319 |

Port **3000** is reserved for the generated app during challenge runs. The control
app never binds to 3000.

Run server and UI separately if needed:

```bash
npm run dev:server   # API only
npm run dev:web      # Vite only (proxies /api → :4319)
```

---

## UI pages

> **Current feature list:** [control-app/README.md](../../control-app/README.md)

### Runs list (`/`)

Filterable, sortable table of every folder under `artifacts/runs/`, plus an **Insights**
panel (KPIs + token mix on the filtered set) and **Compare** charts (cost vs rating,
median weighted, success rate — groupable by experiment / model / provider / author).

Primary filters sync to the URL (`?experiment=…&status=…`). Rows with **max output ≥ 5000**
are flagged as **mega-call**.

| Column | Source |
|--------|--------|
| Status | `result.json` or `run-manifest.json` outcome |
| Provider / model | manifest `model` |
| Thinking | manifest `model.thinking` |
| Calls, output, weighted | result or manifest outcome |
| Author, rating, experiment | `artifacts/runs-overlay.json` + classification |
| Cohort / arm | manifest `experiment` |

List view reads only small files — never `events.jsonl` (~1.7 MB per run).

### Experiments (`/experiments`)

Catalog under `artifacts/experiments/<id>/experiment.json` — create, edit, materialize
used-only slugs, view run counts, jump to filtered runs.

### Run detail (`/runs/:id`)

- Summary + manifest provenance (config hash, template, git, experiment arm)
- Harness config panel (read-only — toggles not env-wired yet)
- **Metadata panel** — author, app rating, experiment link, comments (`runs-overlay.json`)
- **Output tokens per call** bar chart (from `result.json` call_log when present)
- **Analyze** / **Reconcile** / **Replay** — spawn jobs, stream output in console
- Link to **station HTML** when analysis exists
- **Publish to team** — run detail panel; merges overlay + catalog into export, POSTs to hackathon API

### New run (`/new`)

Launch form with:

- **Env profile** — discovers `~/.pi/agent/challenge-env*.sh` (default: **zai**)
- Provider, model, thinking, timeout overrides (applied after sourcing profile)
- `RUN_EXPERIMENT`, `RUN_ARM`, `RUN_REP`, `RUN_INTERVENTION` (`RUN_COHORT` legacy alias)
- Idea file path
- Live console via SSE

Before launch, the server checks port 3000 is free and refuses a second concurrent
challenge job.

**Recommended for local dev:**

```bash
# profile: challenge-env-zai.sh
# provider: zai
# model: glm-5.2
# thinking: off
```

Berget (`challenge-env.sh`) is kept for contest parity but currently prone to
mega-calls; use Z.ai until Berget GLM thinking config is fixed.

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Repo root path, liveness |
| `GET` | `/api/runs` | All run summaries (cached by runs dir mtime) |
| `GET` | `/api/runs/:id` | Manifest, result, ledger, station |
| `GET` | `/api/runs/:id/overlay` | Run metadata overlay |
| `PATCH` | `/api/runs/:id/overlay` | Update run metadata |
| `GET` | `/api/experiments` | Merged experiment catalog + run counts |
| `GET` | `/api/experiments/:id` | Experiment detail |
| `POST` | `/api/experiments` | Create catalog entry |
| `PATCH` | `/api/experiments/:id` | Edit catalog entry |
| `POST` | `/api/experiments/:id/materialize` | Promote used-only slug |
| `GET` | `/api/authors` | Known authors |
| `GET` | `/api/overlay/taxonomy` | Classification taxonomy |
| `GET` | `/api/runs/:id/station.html` | Served analysis HTML |
| `POST` | `/api/runs/:id/analyze` | → `npm run analyze:run -- <id>` |
| `POST` | `/api/runs/:id/reconcile` | → `npm run reconcile:run -- <id>` |
| `POST` | `/api/runs/:id/replay` | → `npm run replay:run -- <id>` |
| `POST` | `/api/runs/:id/app/open` | Start generated app dev server |
| `POST` | `/api/challenge` | Launch challenge (JSON body, see below) |
| `GET` | `/api/jobs/:id` | Job status + accumulated lines |
| `GET` | `/api/jobs/:id/stream` | SSE: `{type:"line"}` and `{type:"done"}` |
| `GET` | `/api/env-profiles` | Available `challenge-env*.sh` scripts |
| `GET` | `/api/publish/status` | Publish config (server key set?, API bases) |
| `POST` | `/api/runs/:id/publish` | Publish run to team DB (`access_key` optional if `HACKATHON_ACCESS_CODE` set on server) |

**POST `/api/challenge` body:**

```json
{
  "env_profile": "challenge-env-zai.sh",
  "provider": "zai",
  "model": "glm-5.2",
  "thinking": "off",
  "timeout_ms": 900000,
  "experiment_id": "v2-baseline-lock",
  "arm": "control",
  "rep": 1,
  "intervention": "baseline",
  "idea_file": "contract-public/development-idea.txt"
}
```

All fields except `env_profile` are optional; overrides are exported after
`sourcing` the profile so UI values win over stale shell state.

---

## What it does not do (yet)

| Feature | Status |
|---------|--------|
| HarnessConfig toggles in UI | Read-only display; not env-wired |
| Publish to team runs UI | **Yes** — run detail panel; `POST /api/runs/:id/publish` |
| Edit run metadata | **Yes** — metadata panel + `artifacts/runs-overlay.json` |
| Experiments catalog | **Yes** — `/experiments` + `artifacts/experiments/` |
| Runs insights & compare charts | **Yes** — filtered KPIs + charts on `/` |
| Remote / multi-user | Local single-machine only |

---

## Tests

```bash
cd control-app
npm test
```

Tests summarize real runs under `artifacts/runs/` (Z.ai success, Aug 28 reference,
Berget failure) without reading `events.jsonl`.

---

## Related docs

- [TEAM-GUIDE §16](./TEAM-GUIDE.md#16-v2-control-app--local-browser-and-launcher) — team summary
- [TEAM-GUIDE §6](./TEAM-GUIDE.md#6-analysis-station--interactive-run-report) — analysis station CLI
- [TEAM-GUIDE §13](./TEAM-GUIDE.md#13-run-manifest--per-run-provenance) — run manifest
- [PLAN.md](./PLAN.md) — Phase 2 roadmap
