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

**Power check:** if control shows 0–1/5 DOM leaks, pause before treatment.

## Revert-rule template

```text
CHANGE            [exact diff]
EXPECTED MECHANISM [why]
PRIMARY COUNTER    [what moves]
QUALITY GATE       [must not regress]
KEEP IF            [counter + quality]
REVERT IF          [no effect or regression]
```
