# Experiment D1 — Harness-owned VERIFY

**Status:** **PROMOTED to v2.2 baseline** (2026-08-31)  
**Type:** harness intervention (Pi extension + config toggle)  
**Active baseline:** [control-floor-v2.2-baseline.md](./control-floor-v2.2-baseline.md)  
**Verdict:** [experiment-verify-v1.1-analysis.md](./experiment-verify-v1.1-analysis.md) — KEEP  
**Compare against (historical):** frozen control v2.1 (median ~78k weighted, 5/5 OK)

---

## Problem

Every control v2.1 rep still runs product tests via **piped bash**:

```bash
npm test 2>&1 | tail -40
```

Piping hides Vitest’s real exit code. Pi must parse truncated text to decide PASS/FAIL. That drives:

- false progress (tail misses failure blocks),
- debug sidecar spirals (`dbg.test.tsx`),
- post-green re-runs (stop rule violated),
- extra model calls on repair tails.

Resource slices (Experiments B/C) did not fix this — they added context cost without reducing piped-test behavior.

---

## Hypothesis

Replacing Pi-authored / piped `npm test` with **harness-owned verification** reduces failure-driven repair tails **without** reducing journey quality.

When `harness_owned_verify=true`:

1. Pi gets a first-class **`verify` tool** that runs `npm test` with no pipes and returns `exit_code` + compact reporter output.
2. Pi **cannot** run `npm test` / `vitest` via bash (piped or direct).
3. Build checks remain Pi-owned (`npm run build` via bash).

---

## Implementation

| Piece | Location |
|-------|----------|
| Pi extension | `solution/extensions/harness-owned-verify.ts` |
| Config toggle | `HarnessConfig.harness_owned_verify` (default **`true`** in v2.2) |
| Env override | `HARNESS_OWNED_VERIFY=0` to reproduce v2.1 control |
| Runner wiring | `src/run-challenge.ts` — extension + manifest config |
| Experiment script | `npm run experiment:verify` |

### Verify tool contract

- **Input:** none
- **Runs:** `npm test` in Pi cwd (`output/app`), stdio captured, real process exit code
- **Output:** `verify exit_code=N (PASS|FAIL)` + full compact reporter text
- **Blocked:** any bash command matching `npm test`, `npm run test`, `vitest`, `npx vitest`, especially with `\| tail|grep|head`

### What this does **not** do

- Does not run build for Pi (build stays bash-owned).
- Does not change journey requirements, template seed, or system prompt (except extension-appended VERIFY guidance).
- Does not ship pre-written tests.
- Does not use resource slices — treatment runs on **plain control template** only.

---

## Measurement

### Primary (same as prior experiments)

- Weighted token cost (median vs control v2.1)
- Harness success (journeys + build)
- Model calls

### Trajectory metrics (retro + treatment)

Written to `artifacts/analysis/<run-id>/trajectory.json` via `npm run analyze:run`:

| Metric | Intent |
|--------|--------|
| `first_test_pass_ratio` | How much work first full suite needed |
| `first_test_green_call` / `first_full_green_call` | Time-to-green |
| `post_full_green_calls` | Stop-rule violations |
| `piped_test_command_count` | Should → 0 under VERIFY |
| `debug_test_files_created` | Sidecar spiral proxy |
| `weighted_per_call` | Efficiency per model turn |

Retro cohort script:

```bash
npm run analyze:cohort-trajectory
```

---

## Treatment protocol

```bash
# Plain control template (no B/C resource slice)
npm run experiment:verify
```

Environment:

| Variable | Value |
|----------|-------|
| `RUN_EXPERIMENT` | `harness-owned-verify-v1.1` |
| `RUN_ARM` | `treatment` |
| `RUN_INTERVENTION` | `harness-owned-verify` |
| `HARNESS_OWNED_VERIFY` | `1` |

**5 reps** vs frozen v2.1: 72k / 72k / 78k / 100k / 155k (median ~78k).

---

## Success gates

| Gate | Pass |
|------|------|
| Harness success | 5/5 |
| Median weighted | ≤ control v2.1 (~78k) with meaningful separation on tails |
| `piped_test_command_count` | 0 in treatment reps |
| `post_full_green_calls` | Lower median than control |
| Journey quality | Same journey pass rate as control |

---

## Revert to v2.1 (historical comparison only)

1. Set `HARNESS_OWNED_VERIFY=0` or `harness_owned_verify: false` in config override.
2. Omit `--extension harness-owned-verify.ts` from Pi args (when verify toggle off).

v2.2 is the active default — revert only for reproducing v2.1 cohorts.
