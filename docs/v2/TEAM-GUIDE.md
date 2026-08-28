# Agent Cofounder V2 — team guide

This document is the **narrative source of truth** for what we built, why, and how to use it. Update this file whenever we add a new tool or milestone. The root [README](../../README.md) stays a short command reference and links here.

**Hackathon spec:** [agentcofounder.stockholm.ai](https://agentcofounder.stockholm.ai/)

---

## Branch map (read first)

| Branch | Purpose | Who uses it |
|--------|---------|-------------|
| **`main`** | Clean hackathon starter + run replay | Submission baseline |
| **`setup/measure`** | Phase F experiments (Exp1–6, 5b) and historical runs | Frozen evidence — do not stack new experiments here |
| **`v2`** | Experiment foundation + analysis platform | **Start here** for new work |

**Rules:**

- Phase F history lives on `setup/measure`. Do not delete it.
- New measurement and analysis work goes on `v2`.
- Do not mix experiment patches into `v2` without a deliberate merge plan.
- Raw run artifacts under `artifacts/runs/` are immutable evidence. Derived analysis goes under `artifacts/analysis/` or `artifacts/replay/`.

---

## 1. Environment setup

**Requirements:** Node 22.19.x, npm 10.9.3 (see `.nvmrc`).

```bash
git clone <repo-url>
cd agentcofounder
git checkout v2

npm ci --ignore-scripts
npm --prefix app-template ci --ignore-scripts
npm run check
```

**Pi / Berget credentials** (once per machine):

```bash
./pi-agent/setup.sh
# add API key to ~/.pi/agent/berget-api-key
source ~/.pi/agent/challenge-env.sh   # before each challenge run
```

**Optional runtime env:**

```bash
export CHALLENGE_PROVIDER="zai"
export CHALLENGE_MODEL="glm-5.2"
export CHALLENGE_THINKING="off"    # default — lower output token cost
export CHALLENGE_MAX_TOKENS="8192"          # recorded in run manifest (optional)
export CHALLENGE_CONTEXT_WINDOW="128000"    # recorded in run manifest (optional)
export CHALLENGE_TIMEOUT_MS="900000"        # default 15 minutes

# Optional experiment metadata (written into run-manifest.json)
export RUN_COHORT="v2-baseline-lock"
export RUN_ARM="control"
export RUN_REP="1"
export RUN_INTERVENTION="baseline"
```

**Run the challenge** (costs model tokens):

```bash
npm run challenge
```

After a successful run:

- App: `http://localhost:3000` via `cd output/app && npm run dev`
- Artifacts: `artifacts/runs/<run-id>/`

Each complete run folder contains:

| File / dir | Role |
|------------|------|
| `events.jsonl` | Raw Pi telemetry (immutable) |
| `result.json` | Official totals — **written by harness, not agent** |
| `run-manifest.json` | V2 provenance — config, template/prompt hashes, model, experiment (see §13) |
| `sessions/` | Pi session JSONL |
| `idea.txt` | Prompt used |
| `app-template/` | Template snapshot (new runs only — for replay) |

---

## 2. Why the `v2` branch exists

Phase F on `setup/measure` stacked six interventions on one prompt with flawed comparisons (wrong controls, agent-owned quality signals, cumulative stacks). We decided:

1. **Freeze Phase F** as reference evidence.
2. **Build V2** on clean `main` as a proper experimental platform.
3. **Measurement before optimization** — no new “Planner + components + …” claims until M2–M4 exist.

Roadmap detail: [PLAN.md](./PLAN.md).

---

## 3. Run replay — rebuild apps without AI

**Problem:** Re-running Pi to inspect an old app costs tokens and may differ stochastically.

**Solution:** Deterministically replay `write` and `edit` tool calls from session logs.

```bash
npm run replay:run -- artifacts/runs/<run-id>
npm run replay:run -- artifacts/runs/<run-id> --compare-only   # skip test/build
npm run replay:all                                             # every run with a saved app
npm run replay:all -- --with-checks                            # also run test/build
```

**Output:** `artifacts/replay/<run-id>/report.json`, batch summary in
`artifacts/replay/batch-summary.json`.

### Verdicts

| Verdict | Meaning |
|---------|---------|
| `identical` | Replayed tree matches the saved app byte for byte |
| `diverged` | Files differ for a reason template drift does not explain |
| `unverified` | Fidelity could not be established — never treat as a pass |

`unverified` covers three cases: no saved app to compare against, a saved app
with no source files, and a run whose only differences are template drift.
Absence of a comparison is not evidence of fidelity, so it never reports as a match.

### Known limits

- **Bash is not replayed.** Only `write` and `edit` calls are. Commands that
  mutate source (`sed -i`, `rm src/…`, redirects) are counted and surfaced as a
  warning, but their effect is missing from the replayed app.
- **Historical runs have no template snapshot.** Runs made before the snapshot
  landed seed from the current `app-template`, so any template change since then
  shows up as drift. New runs snapshot the template into the run folder.
- Edits are applied with a function replacer — a string replacement would expand
  `$&` and corrupt generated regex-escaping code. Guarded by `test/replay-run.test.ts`.
- Unparseable session lines are counted in `malformed_jsonl_lines` and raised as
  a warning, since a dropped line can be a dropped file write.
- Source-path and mutation predicates live in `src/v2/source-paths.ts`, kept
  apart from the activity classifier so a classifier rewrite cannot change what
  replay considers a source mutation.

### V1 validation (Aug 2026)

`npm run replay:all` over the 57 runs with saved apps:

| | |
|---|---|
| identical | 5 |
| diverged | 9 — 6 failed edits, 3 bash mutations, 0 unexplained |
| unverified | 43 — 36 template drift, 7 saved apps without source |

Every divergence has a named cause. The engine reproduces write/edit sequences
faithfully; what blocks verification on old runs is missing template evidence,
not the replay logic.

**On branches:** `main` and `v2` (merged from `main`).

---

## 4. Reconcile — verify token accounting

**Problem:** If `result.json` totals do not match a independent sum from `events.jsonl`, all cost analysis is untrustworthy.

**Solution:** Re-sum tokens from events using the same logic as the harness (`src/usage.ts`) and diff against `result.json`.

```bash
# One run
npm run reconcile:run -- <run-id>

# All complete runs under artifacts/runs/
npm run reconcile:all
```

**Exit code:** 0 = all complete runs match; 1 = at least one mismatch.

**Current baseline (Aug 2026):** 66 OK, 0 mismatches, 24 skipped (early runs missing `result.json`).

**When to use:** After harness changes, before publishing analysis, or when a run’s numbers look wrong.

**Does not modify:** `result.json` or any submission artifact.

---

## 5. Normalize — per-call analysis ledger

**Problem:** `result.json` has run-level totals and a flat `call_log`, but not tools, paths, or weighted cost per call.

**Solution:** Build a rich ledger from `events.jsonl`.

```bash
npm run normalize:run -- <run-id>
```

**Output:** `artifacts/analysis/<run-id>/ledger.json`

Each call includes:

- Token breakdown (input, output, cache read/write, reasoning)
- **Weighted cost** per call: `input×1 + output×3 + cacheRead×0.1` ([hackathon formula](https://agentcofounder.stockholm.ai/))
- Cumulative weighted total
- Tools invoked that turn (bash, read, write, edit) with paths/commands
- **`activity`** heuristic per call: `recon`, `source`, `css`, `test`, `build`, `finalize`, `repair`, `mixed`, `other`
- **`activity_summary`** rollup (calls + weighted cost share per activity)
- Embedded reconciliation vs `result.json`

**Does not modify:** `result.json`. Safe for submission repo.

**Schema:** `agentcofounder.call_ledger.v1` — see `src/v2/normalize.ts`.

---

## 6. Analysis station — interactive run report

**Problem:** `ledger.json` is rich but hard to scan in an editor — teammates need a quick visual breakdown without writing ad-hoc scripts.

**Solution:** Build ledger + a self-contained HTML report in one command.

```bash
npm run analyze:run -- <run-id>
npm run analyze:run -- <run-id> --compare <other-run-id>
```

**Output** (under `artifacts/analysis/<run-id>/`):

| File | Role |
|------|------|
| `ledger.json` | Per-call ledger (same as `normalize:run`) |
| `station.json` | Structured report for tooling |
| `station.html` | Open in browser — stats, activity bars, cumulative chart, call table |

The HTML page includes:

- Weighted total, token breakdown, reconciliation status
- Activity cost share (`activity_summary`)
- Cumulative weighted cost over run time
- Filterable call table — expand any row to see tools/paths
- With `--compare`: side-by-side activity deltas vs another run

**Does not modify:** `result.json` or run artifacts. Read-only analysis.

**Schema:** `agentcofounder.analysis_station.v1` — see `src/v2/station.ts`.

---

## 7. Phase F experiments (frozen on `setup/measure`)

Seven cumulative interventions on the public book-lending prompt. Full write-up: [`docs/phase-f-strategy.md`](../phase-f-strategy.md) on `setup/measure`.

| Exp | Intervention | Verdict (short) |
|-----|--------------|-----------------|
| 1 | RTL test cleanup | KEEP |
| 2 | Stop rule after green | KEEP |
| 3 | Test policy in prompt | KEEP |
| 4 | Failure digest prompt | REVERT |
| 5 | Template primitives | WEAK KEEP |
| 6 | Compact Vitest reporter | WEAK KEEP |
| 5b | Storage hardening | KEEP for **predictability**, not mean cost savings |

**5b replication (2026-08-28):** 5 control + 5 treatment, interleaved. No significant mean savings (p≈0.75). **4.5× lower variance** in model calls (p≈0.012). Original “47% cheaper” used the wrong control and lucky clean reps.

**Published runs:** ~90 on [agentcofounder-hackathon.vercel.app](https://agentcofounder-hackathon.vercel.app/)

---

## 8. Hackathon rules we must not break

From the [official spec](https://agentcofounder.stockholm.ai/):

- **`result.json`** is harness-owned — agent must not write or invent token totals.
- App must serve at **`http://localhost:3000`**.
- Efficiency ranking: **Input + Output×3 + CacheRead×0.1**.
- Local schema (stricter): `contract-public/result.schema.json` — includes `harness_checks`, `port_reclamation`, etc.

All V2 analysis tools are **read-only** on run artifacts.

---

## 9. Documentation maintenance

When adding a feature:

1. Add a numbered section here (problem → solution → commands → output → what it does *not* touch).
2. Add CLI one-liner to root README if teammates will run it.
3. Update [PLAN.md](./PLAN.md) milestone status.
4. Commit docs in the **same change** as the code.

Do **not** duplicate long explanations in README — link here instead.

---

## 10. Activity classification (M2 complete)

Each ledger call gets a heuristic **`activity`** label from tools and paths (`src/v2/classify.ts`):

| Activity | Typical signal |
|----------|----------------|
| `recon` | read / ls / inspect only |
| `source` | write/edit `.ts` / `.tsx` under `src/` |
| `css` | write/edit `.css` |
| `test` | `npm test`, vitest, `.test.tsx` |
| `build` | `npm run build`, dev server startup |
| `finalize` | `report.partial.json`, verification |
| `repair` | tool returned error |
| `mixed` | multiple categories in one call |

**Not ground truth** — one call can mix work; use for aggregates, not single-call verdicts.
The classifier is spec-breaking (~38% `mixed`); **do not use activity shares to pick the
next improvement.** See [PLAN.md](./PLAN.md) (M6).

Re-run normalize after classifier changes; ledger is derived and recomputable.

---

## 11. What's next

Phase 1 experiment foundation status: [PLAN.md](./PLAN.md).

| Step | Topic | Status |
|------|-------|--------|
| 4–7 | HarnessConfig, run manifest, shared run storage | **Done** |
| 8 | Experiment runner (interleaved arms) | **Next** |
| 9 | Analysis Station reads config + manifest + replay | Planned |
| 10 | Lock V2 baseline (5 runs, costs tokens) | After runner |
| 11 | First real intervention | After baseline |

**Do not** start template/CSS/planner work before step 10. Classifier percentages must
not drive the roadmap — see §10 and PLAN (M6).

---

## 12. HarnessConfig — experiment toggles and identity

**Problem:** Saying “baseline” without a hash lets runs pool incorrectly and makes
one-intervention-at-a-time comparisons ambiguous.

**Solution:** Every run records a full `HarnessConfig` in `run-manifest.json`.
Comparison identity is the pair **`config_schema_version` + `config_hash`** (not
the hash alone). See `src/v2/config.ts`.

**Baseline today** (`DEFAULT_CONFIG`): all boolean toggles `false` except
`agent_test_authoring: true`; `template: "baseline"`;
`execution_strategy: "single_session"`.

```bash
npm run config:show                              # baseline config + identity
npm run config:show -- path/to/treatment.json   # resolve a treatment file
```

**Interventions:** A named change declares which config fields it may touch.
`validateIntervention()` checks baseline → treatment diffs stay inside those fields
(e.g. turning on `component_assembly` and `docs_retrieval` together can still be
one intervention if both are declared).

**Important:** Config is **recorded in the manifest** but **not yet read by the
runtime harness** — `npm run challenge` behaviour is unchanged until a toggle is
deliberately wired in for an experiment.

**Does not modify:** `result.json` or Pi behaviour (today).

---

## 13. Run manifest — per-run provenance

**Problem:** `result.json` is harness measurement truth, not “what template,
config, and prompts produced this app?” Historical exports only carried git +
approach labels.

**Solution:** Internal research metadata in `artifacts/runs/<run-id>/run-manifest.json`
(schema `agentcofounder.run_manifest.v1`). Written **before** Pi starts, finalized
with **outcome** after the run.

| Block | Contents |
|-------|----------|
| `config` + `config_hash` | Full harness config at run time |
| `template` | Template id + `tree_sha256` of snapshotted `app-template/` |
| `prompt` | SHA-256 of system prompt, journeys, `AGENTS.md` |
| `model` | Provider, model, thinking, `max_tokens`, `context_window`, timeout |
| `git` | Branch, commit, dirty flag |
| `experiment` | From `RUN_COHORT` / `RUN_ARM` / `RUN_REP` / `RUN_INTERVENTION` |
| `versions` | Null slots for future planner/assembler/guards |
| `outcome` | Status, tokens, weighted cost, wall time (null until run completes) |

```bash
# Inspect after a run (no extra command — file is on disk)
cat artifacts/runs/<run-id>/run-manifest.json
```

**Does not modify:** `result.json`. **`--prepare-only`** does not write a manifest.

Code: `src/v2/manifest.ts`, wired in `src/run-challenge.ts`.

---

## 14. Shared run storage — export, publish, and `data.manifest`

**Problem:** Local `artifacts/runs/` is not shared across the team; we already have
a runs UI and API for comparing ~90 historical runs.

**Solution:** Keep the existing stack — **no new run server**. Publish **derived**
export JSON; the API stores measurement and provenance separately.

```text
v2 harness (this repo)
  artifacts/runs/<id>/run-manifest.json + events + result
        ↓
ac-control branch v2-manifest-export
  npm run export:run -- <id>     → artifacts/exports/<id>.json
        ↓  (top-level "manifest" on paste — transport only)
seed script → POST https://admin.coretechs.se/hackathon/api/v1/runs/
        ↓
DB:  data.export   (meta, harness, efficiency — measurement)
     data.manifest (full run_manifest.v1 — provenance)
UI:  https://agentcofounder-hackathon.vercel.app
```

**Publish one run** (from `ac-control`, needs `HACKATHON_ACCESS_CODE`):

```bash
export AGENTCOFOUNDER_ROOT=/path/to/harness-with-artifacts   # often ac-control clone
export RUNS_APP_ROOT=/path/to/agentcofounder-hackathon
npm run publish:run -- <run-id> [--approach <label>]
```

Or export only: `npm run export:run -- <run-id>` and paste JSON in the UI.

**Legacy runs** without `run-manifest.json` export with `"manifest": null` — normal.

**After ingest:** `data.manifest` exists on the run record; **`data.export.manifest`
does not** — Django strips manifest from export on save. That is intentional.

**Two different “manifest” names in the UI:**

| Name | What |
|------|------|
| `runs-classification.json` overlay | Historical experiment labels, human ratings |
| `data.manifest` | Harness V2 provenance (config, template, experiment arm) |

Run detail page shows `RunManifestPanel` when `data.manifest` is present.

---

## 15. Experiment metadata (until the V2 runner lands)

**Problem:** Phase F used ad-hoc `RUN_APPROACH` strings per arm. V2 needs structured
cohort/arm/rep metadata that survives export and lands in `data.manifest.experiment`.

**Solution (today):** Set env vars before `npm run challenge`; they are copied into
`run-manifest.json` and flow through export → `data.manifest.experiment`.

```bash
export RUN_COHORT="v2-baseline-lock"
export RUN_ARM="control"          # or treatment arm name
export RUN_REP="3"
export RUN_INTERVENTION="baseline"
npm run challenge
```

**Next (step 8):** An experiment runner will schedule **interleaved** control/treatment
reps, validate interventions via `HarnessConfig`, and set these fields automatically.
Until then, set env manually or via shell wrapper.

Phase F one-arm runner (reference only, frozen on `setup/measure`):
`ac-control/scripts/run-experiment.ts` — do not extend for V2.

---

## Quick command reference

```bash
npm run challenge                  # run agent (costs tokens)
npm run challenge -- --prepare-only
npm run config:show                # baseline HarnessConfig + identity
npm run replay:run -- <run-id>     # rebuild app from logs, no AI
npm run replay:all                 # replay fidelity across all saved apps
npm run reconcile:run -- <run-id>  # audit one run's token math
npm run reconcile:all              # audit all complete runs
npm run normalize:run -- <run-id>  # build analysis ledger
npm run analyze:run -- <run-id>    # ledger + HTML analysis station
npm run check                      # typecheck + unit tests + app template
```

**Publish to shared runs UI** (from `ac-control` on branch `v2-manifest-export`):
`npm run export:run -- <run-id>` then paste, or `npm run publish:run -- <run-id>`.
See [§14](#14-shared-run-storage--export-publish-and-datamanifest).
