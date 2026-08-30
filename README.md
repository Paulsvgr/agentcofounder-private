# AgentCofounder starter

**Team working on analysis / V2:** read [`docs/v2/TEAM-GUIDE.md`](docs/v2/TEAM-GUIDE.md) first (branch map, what we built, and how to run each tool). Milestone plan: [`docs/v2/PLAN.md`](docs/v2/PLAN.md).

A forkable baseline for the AgentCofounder challenge. It gives every team the same pinned Pi runtime, neutral web application seed, execution command, telemetry collector, and public contract while leaving the actual agent strategy participant-owned.

This repository installs Pi as a local dependency at exactly `@earendil-works/pi-coding-agent@0.84.1`. Do not use the floating shell installer and do not run `pi update` during the challenge.

## Repository boundary

- `solution/` is the main participant surface: change the prompt, extension, skill, or replace the runner strategy.
- `app-template/` is the neutral application seed copied into a fresh generated workspace for every run.
- `contract-public/` contains the replaceable public idea, domain-neutral journey guidance, and the result schema.
- `src/` is the baseline runner and auditable result assembly.
- `output/app/` is disposable generated application code and is reset before every run.
- `artifacts/runs/` contains Pi JSON events, session JSONL files, stderr, and the run input.

Official hidden prompts, hidden tests, model credentials, and final scoring code must remain outside participant repositories.

> **Organizer release requirement:** `contract-public/development-idea.txt` is a development placeholder. Replace it with the finalized public prompt before sharing this repository with participants. Never place hidden judging material in this file.

## Prerequisites

- Node.js 22.19.x. The repository deliberately rejects other major versions.
- npm 10.9.3, matching the committed lockfiles and container image.
- Provider authentication supported by Pi, or organizer-provided provider/model environment variables.

## Setup

```bash
npm ci --ignore-scripts
npm --prefix app-template ci --ignore-scripts
npm run check
```

**Team Berget / Pi setup:** see [`pi-agent/README.md`](pi-agent/README.md). Run `./pi-agent/setup.sh` once, add your own API key to `~/.pi/agent/berget-api-key`, then `source ~/.pi/agent/challenge-env.sh` before each challenge.

Provider-specific credentials are read by Pi. The optional challenge variables select the organizer's runtime configuration:

```bash
export CHALLENGE_PROVIDER="provider-name"
export CHALLENGE_MODEL="model-id"
export CHALLENGE_THINKING="off"
```

Never commit credentials. `.env.example` documents variable names, but the runner intentionally does not load `.env` files.

The default thinking level is `off` to avoid multiplying output-token cost in the efficiency ranking. Raise it only when measurements show the extra reasoning improves completion quality.

The strict Node engine is intentional. `npm ci` fails on Node 23+ (including Node 26); use `.nvmrc` or the provided container rather than regenerating the lockfile with a newer runtime.

The Docker build runs the full check suite, including short-lived Vite servers over the builder's loopback interface. The image declares port 3000 for organizer-controlled browser evaluation; publishing that port still requires an explicit container port mapping or shared container network.

## Run the public challenge

The runner uses `contract-public/development-idea.txt` by default. During template development it contains a placeholder; organizers must replace that file with the finalized public prompt before participant distribution.

```bash
npm run challenge
```

Use `--idea-file /path/to/idea.txt` to override the default for organizer testing or hidden evaluation.

For a setup-only check that does not call a model:

```bash
npm run challenge -- --prepare-only
```

After a complete run:

```bash
cd output/app
npm run dev
```

The app must be available at `http://localhost:3000`. In another terminal, validate the machine-readable result:

```bash
npm run validate:result -- output/app/result.json
```

## Replay a past run (no AI)

See [TEAM-GUIDE §3](docs/v2/TEAM-GUIDE.md#3-run-replay--rebuild-apps-without-ai) for context. Replays `write`/`edit` from Pi logs — no model calls.

```bash
npm run replay:run -- artifacts/runs/<run-id>
npm run replay:run -- artifacts/runs/<run-id> --compare-only
npm run replay:all
```

Writes `artifacts/replay/<run-id>/report.json` and `artifacts/replay/batch-summary.json`.
Each report carries a verdict of `identical`, `diverged` or `unverified` — a run
that cannot be checked is never reported as a match.

## Reconcile token totals (audit)

See [TEAM-GUIDE §4](docs/v2/TEAM-GUIDE.md#4-reconcile--verify-token-accounting).

```bash
npm run reconcile:run -- <run-id>
npm run reconcile:all
```

## Normalize a past run (analysis ledger)

See [TEAM-GUIDE §5](docs/v2/TEAM-GUIDE.md#5-normalize--per-call-analysis-ledger). Writes `artifacts/analysis/<run-id>/ledger.json` only — does not modify `result.json`.

```bash
npm run normalize:run -- <run-id>
```

## Analyze a past run (interactive report)

See [TEAM-GUIDE §6](docs/v2/TEAM-GUIDE.md#6-analysis-station--interactive-run-report). Builds ledger + HTML report under `artifacts/analysis/<run-id>/`.

```bash
npm run analyze:run -- <run-id>
npm run analyze:run -- <run-id> --compare <other-run-id>
```

Open `artifacts/analysis/<run-id>/station.html` in a browser.

## V2 Control App (local browser + launcher)

Browse runs, compare experiments, edit metadata, inspect per-call token shape, trigger
analyze/reconcile/replay, and launch configured challenge runs from a local UI.

```bash
cd control-app
npm install
npm run dev
```

- UI: http://localhost:5174 · API: http://localhost:4319
- Default env profile: **Z.ai** (`challenge-env-zai.sh`) — see [CONTROL-APP.md](docs/v2/CONTROL-APP.md)
- App README: [control-app/README.md](control-app/README.md)

**UI highlights:**

| Page | What it does |
|------|----------------|
| **Runs** (`/`) | Filterable run table, insights KPIs (on filtered set), comparison charts, URL-synced filters |
| **Experiments** (`/experiments`) | Catalog + used-only slugs, create/edit/materialize, link runs to experiments |
| **Run detail** (`/runs/:id`) | Station charts, metadata overlay, analyze/reconcile/replay, **publish to team** |
| **New run** (`/new`) | Launch challenge with env profile + cohort/arm overrides |

**Human metadata** lives in `artifacts/runs-overlay.json` (author, app rating, experiment
link, comments). **Experiment catalog** lives in `artifacts/experiments/<id>/experiment.json`.

Seed helpers (from repo root):

```bash
npm run seed:overlay        # authors + taxonomy defaults
npm run seed:experiments      # experiment catalog from taxonomy
```

**Weighted cost** (used in insights and charts): `input + output×3 + cache_read×0.1`

## Harness config (V2 experiments)

See [TEAM-GUIDE §12](docs/v2/TEAM-GUIDE.md#12-harnessconfig--experiment-toggles-and-identity).

```bash
npm run config:show
npm run config:show -- path/to/treatment.json
```

## Run manifest and shared run storage

Each challenge run writes `artifacts/runs/<run-id>/run-manifest.json` (provenance;
`result.json` unchanged). To publish runs to the team UI:

- **Control app (recommended):** run detail → **Publish to team** — merges overlay +
  catalog into export and POSTs to the hackathon API. See
  [control-app/README.md](control-app/README.md) and [TEAM-GUIDE §14](docs/v2/TEAM-GUIDE.md#14-shared-run-storage--export-publish-and-datamanifest).
- **CLI:** `ac-control` `npm run publish:run -- <run-id>` or export JSON + paste.

## Result and telemetry ownership

The model writes `report.partial.json`, containing the product summary, assumptions, features, and tests. The runner writes `result.json` after parsing Pi's completed `message_end` events. This prevents the model from inventing headline token totals.

The runner appends the canonical domain-neutral journey guidance from `contract-public/journeys.md` to Pi's built-in system prompt. The protected-paths extension removes only Pi's documentation-reference block, retaining its tool list and usage guidance without steering the model toward package internals. The challenge guidance prevents implied behaviors from being dropped for simplicity while explicitly rejecting unrelated substitute features; the input idea remains authoritative.

The runner independently executes the pinned Vitest binary, requires at least one completed passing test with no skipped or todo tests, runs `npm run build`, starts the application, probes the published `http://localhost:3000` URL only while the spawned server is alive, and terminates the full process group. Product-journey records remain in the specification-defined `tests_run` field; `success` requires at least one such journey and no failed entries. Independent Vitest, build, and startup evidence is recorded in `harness_checks`. The runner also owns `app_url` and a location-aware `start_command`, so harmless formatting differences in the partial report cannot invalidate a run.

The runner records whether port 3000 was occupied before Pi starts. If Pi leaves a listener behind, cleanup only targets same-user listener processes whose working directory is the generated app; Linux uses `/proc`, while macOS uses bounded, non-blocking `lsof` calls. A listener that predates Pi is never reclaimed. The `port_reclamation` result field records whether cleanup was considered, attempted, and successful, plus the affected process IDs.

A provisional result is written before app verification starts. Verification failures degrade a completed model run to `partial`; Pi startup or telemetry failures remain `failed`. Equivalent final results are emitted at the generated app root (`output/app/result.json`) and repository root (`result.json`); only `start_command` differs so each command works from the directory containing its result. Failure to write either required destination makes the harness exit non-zero. Port 3000 must be free on both IPv4 and IPv6 loopback addresses before verification begins.

The raw event stream and Pi session files are retained for audit. Official judging must independently recompute usage and compare it with `result.json`; the participant-controlled report is never the final scoring authority.

`reasoning_tokens` and `cost_total` are included as additional audit fields. No efficiency score is calculated here because the public specification must first define the cache-write weighting and whether ranking uses the custom token formula or Pi's monetary cost.

## Develop the harness

The starter deliberately makes one autonomous Pi invocation. Possible participant improvements include:

- a shorter or more reliable prompt;
- specialized extensions or tools;
- reusable but domain-neutral application primitives;
- test-and-repair orchestration;
- deliberate prompt caching;
- a different Pi integration through its SDK or RPC mode.

Do not add a challenge idea's domain vocabulary or expected records to reusable code. The official judging idea will be different.

## Security

Pi and participant extensions execute with the permissions of the current process. The included extension rejects direct `write` and `edit` calls outside the generated app, but shell commands and symlink tricks can bypass an in-process guard. It is not a sandbox. Official evaluation must run each frozen submission in an isolated container or VM with a read-only harness mount and bounded CPU, memory, disk, time, and network access.

See `docs/organizer-checklist.md` before publishing the template or running a judged submission.
