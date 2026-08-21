# Harness retest protocol (pilot)

Same idea, model, thinking, timeout for every run within a condition cohort.

| Setting | Value |
|---------|-------|
| Idea | `contract-public/development-idea.txt` |
| Default provider | `zai` via `~/.pi/agent/challenge-env-zai.sh` (or `pi-agent/challenge-env-zai.sh`) |
| Default model | `glm-5.2` |
| Thinking | `off` |
| Timeout | 15 min (`CHALLENGE_TIMEOUT_MS=900000`) |
| Runs per condition | **3** (record mean, median, range) |

## Conditions

| Label | Checkout | Tag / note |
|-------|----------|------------|
| A | `d0f0b49` | Locked harness tip (`main`) |
| B | `89ffe97` | Track A guards (historical) |
| C | `2d84660` | Reliability wrappers (historical) |
| A-prompt | `d0f0b49` + prompt "do not start servers" | Cheap prevention experiment |
| A-autotest | `exp/auto-test` | Auto-test hook experiment |

## How to run

```bash
./scripts/retest-condition.sh A-baseline-1 d0f0b49 zai
./scripts/retest-condition.sh A-baseline-2 d0f0b49 zai
./scripts/retest-condition.sh A-baseline-3 d0f0b49 zai
```

Third argument selects provider: `zai` (default), `berget`, or `openai`.

After each run:

```bash
# Find newest run id
ls -1dt artifacts/runs/*/ | head -1

npm run analyze -- <run-id>
./scripts/judge-run.sh <run-id> --harness success|failed|timeout --product great|ok|broken [--note "..."]

# Snapshot the generated app (also runs automatically at the end of retest-condition.sh)
./scripts/save-app.sh <label> <run-id>
```

`scripts/retest-condition.sh` now calls `save-app.sh` after every challenge so `output/app` is copied to `saved-apps/<label>-<run-id>/` (without `node_modules`) before the next run wipes it.

Open a saved build:

```bash
cd saved-apps/<label>-<run-id>
npm ci --ignore-scripts
npm run dev
# http://localhost:3000 — free the port first; do not leave the server up during a challenge
```

## Metrics to record (every run)

- `status` / success rate across the 3-run cohort
- weighted tokens (`input + output*3 + cache_read*0.1`) — mean, **median**, range
- `model_calls`
- wall time and seconds-per-call
- time to first failing test, time to final green (from analyzer)
- `auto_test_trigger_hits` / `npm_test_command_count` (corpus signal for hook design)

## Decision rule

A variant keeps only if:

1. Its weighted improvement clears the measured A variance band, **and**
2. Success rate is not worse than baseline (prefer 3/3).

Reliability outranks a small token reduction.

## Analyzer

```bash
npm run analyze -- <run-id>
npm run analyze -- --all
```

Writes `artifacts/analysis/<run-id>.json` and corpus `artifacts/analysis/index.json`.
