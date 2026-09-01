# Experiment A v2 — frozen verdict

**Status:** CLOSED (2026-08-30)  
**Experiment:** `resource-slice-ui-v2`  
**Runs:** 5 reps — 4 harness-success, 1 partial (port-3000 dev check only)

## Results

| Measure | Outcome |
|---------|---------|
| Adoption | ✅ Pi used `@/components/agent/*` in every run; zero `@/components/ui/*` |
| Quality | ✅ 40/40 journey tests passed across all reps |
| Cost | ❌ Median ~279k weighted vs control ~94k (~3×) |
| Machinery | ✅ No Vitest alias / Radix polyfill repairs (vs v1 pilot) |

Run IDs: `2026-08-30T19-20-45-229Z` … `2026-08-30T19-50-36-109Z`  
Artifacts: `artifacts/runs/2026-08-30T19-*`, `artifacts/experiments/resource-slice-ui-v2/`

## Verdict

**Small UI agent-components: REJECT for cost.**

We gave Pi eight agent components + family contracts + RESOURCES.md + smoke tests. Pi still built domain, forms, lend flow, localStorage, validation, and journey tests. Context and API cost exceeded work removed.

> **Resources must remove more agent work than they add in context, API, and decision cost.**

## Design rule (carried forward)

| Level | Policy |
|-------|--------|
| Small primitives (button, input, stat, empty box) | Pi or ordinary UI library — **not** registry resources |
| High-leverage patterns (persistence, CRUD, auth, Stripe) | **Registry candidates** |

## Removed from active V2

The following are **archived**, not assembled into `app-template`:

- ActionButton, FormField, SelectField, ConfirmDialog, DataRow, DataList, EmptyState, Stat
- Preset `ui-v2`, family contracts, agent smokes in Pi workspace

Implementation preserved under `resources/files/agent/`, `resources/registry/agent/`, `resources/smoke/`, and [archive/experiment-a-v2/](./archive/experiment-a-v2/).

## Comparisons (do not mix cohorts)

| Baseline | Label | Median weighted |
|----------|-------|-----------------|
| Control floor v1 | Exp1+2+3+Exp6, pre-PASS line | ~94k |
| Experiment A v2 | Pre-harness-fix treatment | ~279k |
| Control floor v2 | Exp1+2+3+Exp6b + D1 smoke separation | TBD (relock) |

Experiment B (`local-storage-collection`) compares against **control floor v2 only**.

## Next

1. Exp6b — explicit `PASS N/N` from Vitest reporter  
2. D1 — resource smoke verified by assembler; not copied into Pi workspace  
3. Relock 5 control reps  
4. Experiment B

No ActionButton fixes. No replacement UI slice. No new patterns before control v2 is measured.
