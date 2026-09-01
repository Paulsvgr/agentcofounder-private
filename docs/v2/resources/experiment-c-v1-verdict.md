# Experiment C v1 — frozen verdict

**Status:** CLOSED (2026-08-31)  
**Experiment:** `resource-slice-full-v1`  
**Runs:** 5 reps — 5/5 harness-success

## Slice assembled

**Preset `full-v1`:** shadcn UI v1 (button, input, label, card, dialog, select, theme, lib-utils) + `local-storage-collection`.

Not Experiment A v2 agent components (closed, blocked in assembler).

## Results

| Measure | Outcome |
|---------|---------|
| UI adoption | ✅ 5/5 use `@/components/ui/*` (Button, Card, Dialog, Select); 0 custom button CSS |
| Data adoption | ✅ 5/5 use `createCollectionStore` / `useCollection`; tests use `createMemoryStorage()` |
| Quality | ✅ 40/40 product journeys + harness 3/3 every rep |
| Cost vs control v2.1 | ❌ Median **~150k** vs **~78k** (~2×) |
| Cost vs Experiment B | ❌ **~150k > ~114k** — full slice **worse** than data-only |
| Synergy (C vs max(A,B)) | ❌ No — combining resources **adds** cost |

Run IDs: `2026-08-31T14-10-21-280Z` … `2026-08-31T14-36-58-838Z`  
Deep analysis: [experiment-c-v1-analysis.md](./experiment-c-v1-analysis.md)

## Verdict

**Full UI + data slice v1: REJECT for cost and synergy.**

We gave Pi shadcn components, theme tokens, store/hook, and a 9-section RESOURCES.md. Pi adopted everything and shipped quality apps. Weighted cost landed **between** Experiment B (~114k) and Experiment A v2 (~279k), but **above both control and B**. Integration (Dialog + Select + store), larger context, and shadcn-specific test repair dominated — no compensating reduction in product generation.

> **Multi-type resource assembly is not free: context + integration + test semantics scale with slice size. Combine only when a recipe removes whole app layers, not when it stacks primitives.**

## A / B / C series conclusion

| Exp | Slice | Median | Verdict |
|-----|-------|--------|---------|
| Control v2.1 | None | ~78k | Historical (superseded by v2.2) |
| A v2 | Agent UI | ~279k | REJECT cost |
| B | Data only | ~114k | REJECT cost, KEEP registry |
| **C** | **UI v1 + data** | **~150k** | **REJECT cost; no synergy** |

**Series outcome:** Resource slices at v1 granularity **do not beat control on cost** while preserving quality. Adoption proves the **assembler + RESOURCES.md pipeline works**; benefit requires **higher-level recipes**, **harness fixes** (piped vitest, stop rule), or **different selection policy** — not more preinstalled primitives.

## Design rules (carried forward)

| Policy | Rationale |
|--------|-----------|
| Planner selects **one** slice type by default | B ≤ C on cost; simpler is cheaper |
| Full bundles reserved for **recipe-tier** entries | Must remove app layers, not stack libs |
| Keep data-pattern in registry | Adoption ✅ from B and C |
| UI v1 registry entries | Keep for reference; not auto-bundled with data |
| No `full-v1` in production assembler path | Until recipe redesign |

## Next (recommended order)

1. **Harness backlog** — piped vitest, stop-after-green, Pi dev server removal (helps all arms)
2. **Recipe experiment** — book-lending scaffold (store + parse + form shell) as single entry
3. **Test-pattern resource** — Radix Select/Dialog RTL recipes
4. **Planner v0** — idea → single slice ID; never default full-v1

Do not re-run C v1 expecting a different outcome without material slice or harness change.
