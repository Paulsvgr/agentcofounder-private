# Experiment B v1 — frozen verdict

**Status:** CLOSED (2026-08-31)  
**Experiment:** `resource-slice-data-v1`  
**Runs:** 5 reps — 5/5 harness-success

## Results

| Measure | Outcome |
|---------|---------|
| Adoption | ✅ 5/5 use `createCollectionStore` / `useCollection`; 5/5 tests use `createMemoryStorage()`; 0 hand-rolled `localStorage` mocks |
| Quality | ✅ 44/44 product journeys + harness 3/3 every rep |
| Cost | ❌ Median **~114k** weighted vs control v2.1 **~78k** (+46%) |
| Constraint compliance | ⚠️ 2/5 added wrapper layers (`useBooks`, `bookStore`) despite RESOURCES.md |

Run IDs: `2026-08-31T13-27-27-135Z` … `2026-08-31T13-44-58-268Z`  
Deep analysis: [experiment-b-v1-analysis.md](./experiment-b-v1-analysis.md)

## Verdict

**`local-storage-collection` v1: REJECT for cost; KEEP in registry for adoption proof.**

We gave Pi a hardened store, hook, test helper, and RESOURCES.md. Pi adopted it reliably and wrote better persistence tests. Pi **still** authored domain types, parse, validation, full UI, and journey tests (~600–750 LOC). Weighted cost **increased** vs the active control floor. Expensive reps hit the same RTL/debug ceilings as control (~156k).

> **A low-level data-pattern removes plumbing tokens but not product-generation tokens. Benefit requires removing more of the app-specific stack — or a higher-level recipe — not just the storage layer.**

## Design rule (carried forward)

| Level | Policy |
|-------|--------|
| Low-level patterns (store, hook, memoryStorage) | Registry **candidate** — proves adoption; **not** sufficient alone for cost win |
| Recipes (domain scaffold + store wired + test setup) | Next candidate for Experiment B v2 or planner selection |
| Hand-rolled repository in baseline | Stay out of control floor ✅ confirmed |

## Comparisons (do not mix cohorts)

| Baseline | Label | Median weighted |
|----------|-------|-----------------|
| Control floor v2.1 | Exp6b+Exp6c+D1 | **~78k** |
| Experiment B v1 | + `local-storage-collection` | **~114k** |
| Experiment A v2 (closed) | + agent UI slice | ~279k |

## Next

1. **Experiment C** — only with eyes open: both A and B failed cost; C tests synergy, not expectation of win  
2. **Registry** — keep `local-storage-collection`; consider recipe-tier entry or test-pattern for duplicate-label RTL  
3. **Assembler/docs** — fix AGENTS.md pointer (data resources, not UI); strengthen anti-wrapper in RESOURCES.md  
4. **Harness** — same backlog as v2.1 (piped vitest, stop rule, dev server)

Do not re-run B v1 expecting different cost without a **material slice change** (recipe, docs, or harness fix).
