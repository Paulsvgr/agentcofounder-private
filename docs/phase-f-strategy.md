# Phase F — Improve the harness

**Thesis:** prevent repair snowballs. The model usually builds the app fine; expensive runs come from repeated test/debug loops that grow conversation and cache cost.

## Compliance boundary

**Sacred (never modify for optimization):** `src/usage.ts`, `src/result.ts`, `src/validate-result.ts`, `src/verify-app.ts`, `src/run-challenge.ts`, `src/port-owner.ts`, `src/prepare-output.ts`, `src/types.ts`, `contract-public/result.schema.json`, `solution/extensions/protected-paths.ts`.

**Legal:** `app-template/`, `solution/` (prompt, skills — domain-neutral only).

**Measurement-only:** `src/analyze-run.ts`, `src/action-flow.ts`, `src/export-run.ts`, `scripts/`.

Token totals must come from genuine Pi `events.jsonl` telemetry. Do not manipulate `result.json`.

Verify compliance: `./scripts/check-compliance.sh <BASE_SHA> [result.json]`

## Metric hierarchy

1. Quality/reliability gate (Pi exit, real tests, build, :3000, schema)
2. Mechanism-specific counter
3. P(clean) / P(snowball)
4. Weighted cost (secondary)

## Trajectory classification (frozen)

Thresholds live in `artifacts/experiments/classification-thresholds.json`.

```text
CLEAN
- first_green_s != null (full-suite green only)
- repair_loop.call_count <= 2
- test_reinspection_calls <= 1
- post_green_verification_calls <= 1
- harness.status != failed and all harness_checks passed

SNOWBALL
- repair_loop.call_count >= 5 OR test_reinspection_calls >= 3

OTHER
- neither
```

Weighted cost is **not** part of the definition.

## Experiment protocol

One change at a time:

```text
Current best + ONE change → 3–5 matched runs → mechanism counter → KEEP/REVERT
```

Hold constant: provider, model, idea file, timeout, settings.

```bash
# Control or treatment cohort
npm run experiment:run -- --arm rtl-control --reps 5 --provider zai
npm run experiment:report -- rtl-control

# After cohort: re-export, sync manifest, seed prod DB
./scripts/publish-experiment-runs.sh --exp1-rtl --seed
npm run publish:runs -- --exp1-rtl
npm run publish:run -- 2026-08-22T11-17-34-089Z --approach rtl-control-1
npm run experiment:run -- --arm rtl-control --reps 5 --publish
```

Manifest: `artifacts/experiments/<arm>/manifest.json`

## Locked sequence

| Step | Change | Primary counter |
|------|--------|-----------------|
| 0 | Measurement fixes | Run 3 reclassification |
| 1 | RTL cleanup in `app-template/src/test/setup.ts` | `rtl_dom_leak_failures` |
| 2 | Generation-scoped stop rule | `post_green_verification_calls` |
| 3 | Compact robust test policy | generated-test repair |
| 4 | Deterministic failure digest | `test_reinspection_calls` |
| 5 | Domain-neutral template primitives | output tokens |
| 6 | Skill inlining | latency (polish) |
| 7 | Orchestration | only if needed |

## Experiment 1 — RTL cleanup

**Treatment:** add to `app-template/src/test/setup.ts`:

```ts
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
afterEach(cleanup);
```

**Revert rule:**

```text
KEEP IF   rtl_dom_leak_failures materially decreases, quality OK, no worse trajectories
REVERT IF counter unchanged, new failure classes, or quality regresses
```

`P(clean)` is supporting evidence only, not a keep condition.

## Experiment 1 results (2026-08-22)

**BASE_SHA:** `5cf2b6033904eec75a5d560e310a3064d657dfd0`

| Arm | n | P(clean) | P(snowball) | median weighted | median calls | rtl_dom_leak_total |
|-----|---|----------|-------------|-----------------|--------------|-------------------|
| rtl-control | 5 | 0 | 1.0 | 96k | 26 | 0 |
| rtl-cleanup | 5 | 0 | 1.0 | 179k | 44 | 0 |

**Power check:** FAILED — control showed 0/5 `rtl_dom_leak_failures` (classifier found 0; `multiple_element_failures_total` was 1–4/run). Treatment comparison on this counter is **inconclusive**.

**Quality gate:** All 10 runs `success`, all harness checks passed.

**Verdict: KEEP RTL cleanup** — domain-neutral, compliance-safe, no quality regression. Do not attribute token improvement to this experiment. Median weighted rose in treatment (96k → 179k) but n=5 variance dominates; mechanism counter did not move.

**Next:** Experiment 2 (generation-scoped stop rule). Improve failure-classifier signal before re-testing RTL on a cohort with measurable leak incidence.

Run artifacts: `artifacts/experiments/rtl-control/`, `artifacts/experiments/rtl-cleanup/`.

## Experiment 2 — Generation-scoped stop rule

**Hypothesis:** After full-suite green + build, the model re-runs `npm test` / `npm run build` "just to be sure", inflating `post_green_verification_calls`.

**Treatment:** prompt-stack wording in `solution/system-prompt.md`, `solution/skills/mvp-builder/SKILL.md`, and `app-template/AGENTS.md` — once full suite + build pass on current code, stop verifying; if code changes, verify once more then stop.

**Control (proxy):** Experiment 1 `rtl-cleanup` cohort (n=5) — same stack minus stop rule, RTL cleanup kept.

**Primary counter:** `post_green_verification_calls` (secondary: `green_to_exit_s`, weighted tail after first full green)

**Revert rule:**

```text
KEEP IF   post_green_verification_calls materially decreases, quality OK
REVERT IF counter unchanged, quality regresses, or repair loops worsen
```

```bash
npm run experiment:run -- --arm stop-treatment --reps 5 --provider zai --publish
npm run experiment:report -- stop-treatment
npm run publish:runs -- --exp2-stop   # after both arms complete
```

## Experiment 2 results (2026-08-22)

**BASE_SHA:** `5cf2b6033904eec75a5d560e310a3064d657dfd0` · **Treatment commit:** `d65f4e9`

| Arm | n | P(clean) | P(snowball) | median weighted | median calls | post_green (per run) | median post_green |
|-----|---|----------|-------------|-----------------|--------------|----------------------|-----------------|
| rtl-cleanup (control) | 5 | 0 | 1.0 | 179k | 44 | 3, 2, 4, 3, 5 | **3** |
| stop-treatment | 5 | 0 | 1.0 | 110k | 31 | 1, 7, 1, 2, 1 | **1** |

**Primary counter:** Median `post_green_verification_calls` **3 → 1**. Treatment 4/5 reps at ≤1 (clean threshold); control 0/5.

**Quality gate:** All 10 runs `success`, all harness checks passed.

**Caveats:** Rep 2 treatment snowballed (463k weighted, 61 repair calls, post_green=7) — prompt stop rule does not prevent repair spirals once entered. P(snowball) unchanged at 1.0 both arms.

**Verdict: KEEP stop rule** — mechanism counter moved as hypothesized; domain-neutral; no quality regression. Does not fix snowball entry, only trims post-green tail on typical runs.

Run artifacts: `artifacts/experiments/stop-treatment/`.

**Next:** Experiment 3 (compact robust journey-test policy in `SKILL.md`).

## Experiment 3 — Compact robust journey-test policy

**Hypothesis:** Bloated or brittle generated tests (broad `getByText`, duplicate coverage, speculative cases) trigger self-inflicted repair spirals.

**Treatment:** compact test guidance in `solution/skills/mvp-builder/SKILL.md` + `solution/system-prompt.md` — smallest sufficient suite, role/label queries, no speculative journeys.

**Control (proxy):** Experiment 2 `stop-treatment` cohort (n=5) — same stack minus test policy.

**Primary counter:** `repair_loop.call_count`, `test_reinspection_calls`, `query_ambiguity_failures` (secondary: test count, weighted in repair phase)

**Revert rule:**

```text
KEEP IF   repair/test-infra counters improve, journeys still covered, quality OK
REVERT IF counter unchanged, coverage regresses, or quality fails
```

```bash
npm run experiment:run -- --arm test-policy-treatment --reps 5 --provider zai
npm run experiment:report -- test-policy-treatment
npm run publish:runs -- test-policy-treatment
```

## Experiment 3 results (2026-08-22)

**Treatment commit:** `be86ac3`

| Arm | n | P(clean) | P(snowball) | median weighted | median calls | quality |
|-----|---|----------|-------------|-----------------|--------------|---------|
| stop-treatment (control) | 5 | 0 | 1.0 | 110k | 31 | 5/5 success |
| test-policy-treatment | 5 | **0.2** | **0.6** | 86k | 23 | **4/5 success** |

**Highlights:** Rep 4 = **first CLEAN trajectory** in Phase F (43k weighted, 11 calls, 0 repair). Rep 5 failed (Pi exit 1, no first green).

**Primary counters (successful reps):** median repair_loop **14 → 7.5**, median test_reinspection **6 → 3** vs stop-treatment control.

**Verdict: KEEP test policy** — first clean run and improved mechanism counters on successful reps; rep 5 failure is a quality warning but n=1. Rep 4 proves Run-2-like trajectories are achievable with current stack.

Run artifacts: `artifacts/experiments/test-policy-treatment/`.

**Next:** Experiment 4 (deterministic failure digest → `test_reinspection_calls`).

## Revert-rule template

```text
CHANGE            [exact diff]
EXPECTED MECHANISM [why]
PRIMARY COUNTER    [what moves]
QUALITY GATE       [must not regress]
KEEP IF            [counter + quality]
REVERT IF          [no effect or regression]
```
