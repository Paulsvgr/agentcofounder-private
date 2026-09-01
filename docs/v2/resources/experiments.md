# Resource slice experiments (A / B / C)

Hypothesis (all arms):

> **Does giving Pi a preselected, documented resource slice reduce generation/repair cost while preserving or improving quality?**

This tests the **resource-selection architecture**, not “does shadcn work?”

## Control (locked)

| Field | Value |
|-------|-------|
| Experiment | `phase-f-control-floor` |
| Arm | `control` |
| Intervention | `control-floor` |
| Template | Exp1+2+3+Exp6b+Exp6c + D1 (no resource slice) |
| Runs | 5 (2026-08-31, median **~78k** weighted) — **control floor v2.1** (historical) |

**Control floor v2.2** (v2.1 + VERIFY v1.1): locked 2026-08-31, median **~61k**. **Active baseline** — [control-floor-v2.2-baseline.md](../control-floor/control-floor-v2.2-baseline.md).

**Control floor v2** (Exp6b + D1, pre-Exp6c): locked 2026-08-30, median ~106k. Historical — [analysis](../control-floor/control-floor-v2-analysis.md).

**Control floor v1:** median ~94k. Historical.

Compare Experiment B against **v2.1 (~78k median)** historically. **New experiments compare against v2.2 (~61k median).**

All treatment arms add **only** assembled resources + generated `RESOURCES.md` on top of the active control floor.

Hold constant: idea file, model (zai/glm-5.2), thinking off, timeout, harness config toggles.

---

## Experiment A — UI + theme

### A v1 (retired pilot — raw shadcn)

| Field | Value |
|-------|-------|
| Experiment | `resource-slice-ui-v1` |
| Arm | `treatment` |
| Adds | Raw shadcn components (`@/components/ui/*`) + theme |
| Status | **Retired** — machinery-invalid pilot; do **not** compare to control or v2 |

v1 established assembler/runner plumbing but treatment was half-finished (Vitest alias gap, Radix test polyfills, thin RESOURCES.md). Runs labelled `pilot — machinery invalid`.

### A v2 (CLOSED — agent-contract components)

| Field | Value |
|-------|-------|
| Experiment | `resource-slice-ui-v2` |
| Status | **CLOSED** — see [experiment-a-v2-verdict.md](./experiment-a-v2-verdict.md) |
| Result | Adoption ✅ · quality ✅ · cost ❌ (~279k vs ~94k) |
| Active path | **Removed** — small UI resources archived |

Archived spec: [archive/experiment-a-v2/](./archive/experiment-a-v2/)

---

## Experiment B — data-pattern only

| Field | Value |
|-------|-------|
| Experiment | `resource-slice-data-v1` |
| Arm | `treatment` |
| Adds | `data-patterns/local-storage-collection` only (Exp5b hardened) |
| Does **not** add | UI components or theme |
| Status | **CLOSED** — see [experiment-b-v1-verdict.md](./experiment-b-v1-verdict.md) |
| Result | Adoption ✅ · quality ✅ · cost ❌ (~114k vs v2.1 ~78k) |

**Why separate from A:** book-lending needs persistence; mixing UI + data in A would confound which resource type helped.

### Primary counters

| Layer | Metric |
|-------|--------|
| Adoption | Uses `createCollectionStore` / `useCollection`; no extra repository layer |
| Benefit | Persistence plumbing LOC, repair on storage tests, weighted cost, quality |

Compare: **5 treatment vs 5 control**.

---

## Experiment C — full slice

| Field | Value |
|-------|-------|
| Experiment | `resource-slice-full-v1` |
| Arm | `treatment` |
| Adds | UI v1 shadcn + theme + `local-storage-collection` (preset `full-v1`) |
| Status | **CLOSED** — see [experiment-c-v1-verdict.md](./experiment-c-v1-verdict.md) |
| Result | Adoption ✅ (UI + data) · quality ✅ · cost ❌ (~150k vs v2.1 ~78k) · synergy ❌ (worse than B ~114k) |

**Note:** Uses UI v1 (shadcn), not closed Experiment A v2 agent components.

### Comparisons (both required)

1. **C vs control** — Does the full slice beat baseline?
2. **C vs best of A or B** — Does combining resources beat the best single-type win, or add complexity without benefit?

Interpretation:

| Outcome | Meaning |
|---------|---------|
| C > control, C > max(A,B) | Multi-type assembly worth automating |
| C > control, C ≈ max(A,B) | Combination neutral; pick simpler slice |
| C ≈ control | Full slice not helping; fix selection or docs |

---

## Run labelling

```bash
export RUN_EXPERIMENT="resource-slice-data-v1"
export RUN_ARM="treatment"
export RUN_REP="1"
npm run challenge
```

Compare against **control floor v2.1** (~78k median), not v2 (~106k) or v1 (~94k).

Record in overlay or future `resource-selection.json`:

- `selected_resource_ids`
- per-entry `content_hash`
- `resources_md_sha256`

---

## Quality gate (all arms)

Same as Phase F: harness checks pass, journeys honest, no invented passing tests.

**Cost does not count if quality drops.**

---

## Order of execution

```text
Control v1 (done) → A CLOSED → Harness v2 (done) → Exp6c + v2.1 relock (done)
  ↓
B: data-pattern CLOSED (adoption ✅, cost ❌)
  ↓
C: full slice CLOSED (adoption ✅, synergy ❌, cost ❌)
  ↓
Series complete → recipe-tier / harness backlog
```

Do not skip A/B to run C first — C’s interpretation depends on single-slice results.

---

## After experiments

| Result | Next step |
|--------|-----------|
| A or B KEEP | Automate assembler for that type; expand registry |
| C shows synergy | Planner selects multi-type slices |
| Low adoption | Improve `RESOURCES.md`, visibility in AGENTS, or prompt pointer |
| High adoption, no benefit | Wrong resources or docs; revert or redesign entry |

Future: wire `component_assembly` + `docs_retrieval` harness toggles to automated pipeline.
