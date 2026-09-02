# Experiment B v1 — deep analysis

**Completed:** 2026-08-31 (5/5 harness-success)  
**Experiment:** `resource-slice-data-v1`  
**Arm:** treatment — `local-storage-collection` only  
**Compare baseline:** control floor v2.1 (median **~78k**, 2026-08-31)  
**Log:** `artifacts/experiments/resource-slice-data-v1/2026-08-31T13-27-22Z.log`

---

## Cohort summary

| Rep | Run ID | Weighted | Calls | Journeys | Trajectory |
|-----|--------|----------|-------|----------|------------|
| 1 | `13-27-27-135Z` | **84k** | 19 | 10/10 | Direct store — cheap |
| 2 | `13-32-02-109Z` | 125k | 30 | 8/8 | Layered UI + RTL label spiral |
| 3 | `13-36-25-474Z` | 114k | 23 | 10/10 | Filter-test debug spiral |
| 4 | `13-40-40-215Z` | 100k | 25 | 8/8 | Normal + monolith |
| 5 | `13-44-58-268Z` | **156k** | 35 | 8/8 | Domain sidecar + repair spiral |

| Metric | Control v2.1 | Experiment B |
|--------|----------------|--------------|
| Median weighted | **~78k** | **~114k** (+46%) |
| Mean weighted | ~95k | ~116k |
| Range | 72k – 155k | 84k – 156k |
| Median calls | 20 | 25 |
| Quality | 5/5 success | 5/5 success |
| Resource adoption | 0/5 (hand-rolled storage) | **5/5** (`createCollectionStore` / `useCollection`) |
| Hand `localStorage` mock | 5/5 control | **0/5** treatment |

Without rep 5, B median ≈ **114k**. Without rep 1 (control) or rep 5 (either cohort), medians stay separated — B does not beat control on typical runs.

---

## Hypothesis vs outcome

| Layer | Hypothesis | Result |
|-------|------------|--------|
| **Adoption** | Pi uses preinstalled store/hook; no custom repository | ✅ **5/5** — all imports from `@/lib/collectionStore`, `@/lib/useCollection`; tests use `createMemoryStorage()` per RESOURCES.md |
| **Benefit (cost)** | Skip writing persistence plumbing → lower weighted cost vs v2.1 | ❌ Median **114k vs 78k** — treatment **more** expensive |
| **Benefit (repairs)** | Fewer storage/cache debug spirals (cf. control rep 1) | ❌ Expensive reps still hit RTL/query spirals; B5 ≈ C1 (~156k) |
| **Quality** | Same journey pass rate | ✅ 44/44 product journeys + harness 3/3 all reps |

**Verdict preview:** adoption strong, cost hypothesis **not supported**. See [experiment-b-v1-verdict.md](./experiment-b-v1-verdict.md).

---

## What the resource actually changed

### Preinstalled (158 LOC, not counted in Pi “source”)

| File | Role |
|------|------|
| `collectionStore.ts` | JSON array load/save + lazy storage (Exp5b) |
| `useCollection.ts` | React CRUD hook |
| `text.ts` | `normalizeText`, `createId` |
| `memoryStorage.ts` | Map-backed `Storage` for tests |

### Pi still wrote (every rep)

| Work | B reps | Control reps |
|------|--------|--------------|
| `parseBook` + domain types | ✅ 83–96 LOC | ✅ similar in `types.ts` / `domain.ts` |
| Lend/return/filter/validation logic | ✅ in `books.ts`, `domain.ts`, or inline in `App.tsx` | ✅ same |
| Full UI (forms, list, filter, CSS) | ✅ monolithic `App.tsx` **340–392 LOC** | ✅ split components **80–221 LOC** App |
| Journey RTL tests | ✅ 136–210 LOC | ✅ 116–175 LOC |
| Custom `repository.ts` | ❌ 0/5 | ✅ 4/5 (51–141 LOC) |

**Net:** the slice removed `repository.ts` but Pi **reallocated** effort to domain modules and **larger** single-file UI. Total product+test LOC is not lower:

| Rep | Preinstalled | Product+tests | Control analogue |
|-----|--------------|---------------|------------------|
| B1 | 158 | 621 | C5: 0 / 687 |
| B2 | 158 | 641 | C2: 0 / 842 |
| B5 | 158 | 755 | C1: 0 / ~900+ |

The resource shifted *where* persistence lives, not *how much* code Pi generates.

---

## Activity mix (median share of weighted cost)

| Activity | Control v2.1 | Experiment B |
|----------|--------------|--------------|
| source | 37.1% | 29.0% |
| mixed | 27.1% | 25.8% |
| test | 10.0% | **11.6%** |
| recon | 9.3% | 8.2% |
| finalize | 12.7% | 12.4% |
| css | 4.9% | 6.7% |

Source share dropped (~8 pts) — consistent with not writing `repository.ts`. But **test + mixed + finalize did not shrink enough**; expensive reps still paid for RTL repair, failed edits, and oversized report/finalize calls.

---

## Rep 1 — Direct store, cheap path (84k / 19 calls)

**Session:** 56 turns · `sessions/2026-08-31T13-27-28-160Z_*.jsonl`

### Timeline

```text
recon (SKILL + AGENTS + RESOURCES.md + find src)
→ read preinstalled lib files
→ write books.ts (parseBook + bookStore singleton)
→ write monolithic App.tsx + CSS
→ write App.test.tsx (createMemoryStorage in beforeEach)
→ npm test ×2 (piped) → build → dev → report
```

### Adoption (exemplary)

- Read `RESOURCES.md` on call 1
- `bookStore = createCollectionStore({ key: "books.v1", parse: parseBook })` — direct boundary
- Tests: `createMemoryStorage()` — no hand localStorage mock
- **No** extra repository or `useBooks` wrapper

### Cost profile

- Only **2** Pi test invocations (vs 3–9 on expensive B reps)
- 29% source, 26% mixed — balanced build
- **84k** — closest to control cheap path (C5 72k) but still +12k

### Why not cheaper than C5?

Monolithic `App.tsx` (373 LOC) + 10 journeys (control rep 5 had 9). RESOURCES.md context on every rep (+recon tokens). Preinstalled files still read/held in context during build.

---

## Rep 2 — Layered architecture + label spiral (125k / 30 calls)

**Session:** 72 turns

### Timeline

```text
recon + RESOURCES.md
→ domain/book.ts + domain/useBooks.ts (wrapper — violates RESOURCES constraint)
→ components: BookForms, FilterBar + App + CSS
→ write App.test.tsx (first draft: broken TestApp/StorageGate scaffold)
→ rewrite App.test.tsx (createMemoryStorage pattern)
→ npm test FAIL: duplicate "Category" label (add vs edit forms)
→ edit spiral on BookForms (failed multi-occurrence edits, calls 13–25)
→ npm test ×3 → report
```

### First test failure (call 12)

```text
TYPE  TestingLibraryElementError
MESSAGE Found multiple elements with the text of: Category
```

Same failure class as control v2.1 (duplicate **Title** / **Category** labels across add vs inline edit forms). **Resource did not prevent RTL ambiguity.**

### RESOURCES.md constraint violated

Registry constraint: *“Do not add repository/service wrapper layers.”*  
Pi added `domain/useBooks.ts` (32 LOC) wrapping `createCollectionStore` + `useCollection`.

### Recon spiral (calls 14–24)

After failed `edit` (non-unique oldText), Pi entered **read → edit → read** loop on `BookForms.tsx` (~30k weighted). This is edit-mechanics + architecture cost, not persistence cost.

---

## Rep 3 — Filter-test debug spiral (114k / 23 calls)

**Session:** 64 turns

### Timeline

```text
build books/domain.ts + bookStore.ts (12 LOC factory) + App + tests
→ npm test FAIL → filter journey
→ vitest -t "filters the list" × multiple piped runs (calls 8–20)
→ dev server probes between tests (6 dev-related bash)
→ finalize spike (call 22: ~19k weighted — report.partial)
```

### Test activity

- **9** piped test/bash invocations — highest in cohort
- Targeted `npx vitest run src/App.test.tsx -t "filters…"` — sidecar debugging on one journey
- **31%** of weighted cost in `test` activity — resource did not reduce test repair

### Adoption note

Thin `bookStore.ts` factory — acceptable pattern. Domain logic still fully Pi-authored (`domain.ts` 87 LOC).

---

## Rep 4 — Normal monolith (100k / 25 calls)

**Session:** 55 turns

### Timeline

```text
cat RESOURCES.md (bash, not read tool) + build books.ts/types + App
→ 5× test (4 piped) with matcher fixes
→ report
```

Comparable to control rep 4 (100k / 23 calls). Direct store usage in `books.ts`. No wrapper layer. Cost driven by **source-heavy monolith** (45% source share) and CSS, not persistence debug.

---

## Rep 5 — Domain sidecar spiral (156k / 35 calls)

**Session:** 83 turns

### Timeline

```text
recon + read preinstalled libs
→ books/types.ts + books/domain.ts + domain.test.ts (sidecar unit tests)
→ App.tsx with injectable store prop (good test ergonomics)
→ App.test.tsx with renderWithStorage() — createMemoryStorage + createCollectionStore
→ npm test FAIL: "Lend out" button not found (call 16)
→ many App.tsx / App.test.tsx edits (calls 17–29)
→ npm test ×6 → report (call 35: ~22k weighted finalize)
```

### Sidecar pattern

Pi wrote **`domain.test.ts`** (76 LOC) — pure domain tests separate from journeys. This passed quickly but added generation cost before RTL repair started. Similar structural cost to control rep 1 `dbg.test.tsx` sidecars (different intent, same token tax).

### Injectable store (positive)

```tsx
export function App({ store = defaultStore }: { store?: CollectionStore<Book> })
```

Tests inject `createCollectionStore({ storage: createMemoryStorage() })` — **best-in-cohort** alignment with Exp5b lazy storage semantics. Did not reduce total cost.

### Ceiling match

**156k / 35 calls** ≈ control rep 1 **155k / 37 calls** — preinstalled persistence did **not** cap repair-spiral ceiling.

---

## Cross-cohort comparison (B vs control v2.1)

### Paired by trajectory shape

| Shape | Control | B treatment |
|-------|---------|-------------|
| Cheap | C5: 72k / 17 | B1: 84k / 19 |
| Normal | C2–C4: 72–100k | B4: 100k |
| Repair spiral | C1: 155k / 37 | B5: 156k / 35 |

Resource moved the **failure mode**, not the **price**:

| Control expensive driver | B equivalent |
|--------------------------|--------------|
| Hand-rolled `repository.ts` cache bug | **Absent** — store hook used |
| `dbg.test.tsx` sidecars | `domain.test.ts` sidecar (B5) |
| RTL duplicate labels | **Same** (B2) |
| Filter/lent-count matchers | **Same** (B3, B2) |
| Post-green test reruns | Milder in B (no rep as bad as C1) |

### RESOURCES.md engagement

| Rep | Read RESOURCES.md (read tool) | Notes |
|-----|-------------------------------|-------|
| B1 | ✅ call 1 | |
| B2 | ✅ call 2 | |
| B3 | ✅ call 1 | |
| B4 | ❌ (bash `cat`) | Still used store correctly |
| B5 | ✅ call 1 | |

4/5 explicit reads; 5/5 behavioral adoption.

### Harness gaps (unchanged from v2.1)

| Gap | B evidence |
|-----|------------|
| Piped vitest (`\| tail`) | **All reps** — every Pi test bash piped |
| Pi-owned dev server | B1, B2, B3 (×6), B4, B5 |
| Stop rule | No catastrophic post-green rerun like C1; B3 continued filter debugging |
| Real browser reload | All reps — unmount/remount + same storage |

### Persistence test honesty

Treatment reps correctly use `createMemoryStorage()` instead of mocking `localStorage` manually. Journey labelled “page refresh” still implemented as **remount** (same as control).

---

## Trajectory models

```text
CHEAP-DIRECT (B1, 84k/19)
  RESOURCES → read libs → books.ts + monolith App → 2× test → ship

LAYERED+RTL (B2, 125k/30)
  domain wrapper + components → duplicate label FAIL → edit-mechanics spiral

FILTER DEBUG (B3, 114k/23)
  domain + bookStore → vitest -t filter spiral → heavy test share

NORMAL MONOLITH (B4, 100k/25)
  books.ts + App → moderate test fixes → ~control rep 4

DOMAIN SIDECAR SPIRAL (B5, 156k/35)
  domain.test.ts + injectable store → RTL lend button FAIL → edit storm → huge finalize
```

---

## Why cost went up despite good adoption

1. **Slice is too low-level.** Store + hook remove ~50–140 LOC of `repository.ts` but not `parseBook`, validation, lend/return, UI, or tests (~600–750 LOC still generated).
2. **Context tax.** RESOURCES.md + 4 preinstalled files increase recon reads; Pi still reads them every run.
3. **Constraint ignored.** Wrappers (`useBooks`, `bookStore`) add files RESOURCES.md told Pi to skip — extra architecture tax without benefit.
4. **Dominant cost is product+RTL, not storage.** Median test share **rose** slightly; expensive reps match control spiral shapes.
5. **Monolith bias.** Several B reps put UI in 340–392 LOC `App.tsx` vs control’s split components — larger single write/edit payloads.

---

## Design implications

### For registry / assembler

| Finding | Action |
|---------|--------|
| Adoption works | Keep `local-storage-collection` in registry; planner can select for persistence apps |
| Cost does not work at this granularity | Do **not** expect v1 slice alone to beat control median |
| Need higher-level slice | Future: **recipe** resource (Book tracker = store + parseBook scaffold + form patterns) or test-pattern for RTL label conventions |
| RESOURCES.md | Tighten anti-wrapper language; fix AGENTS.md pointer (still says “UI components”) |
| Provenance | `resource-selection.json` written per assembly — record in run overlay |

### For Experiment C

C adds UI slice on top of B’s failure mode — **risk compounding context cost** without proven single-slice win. Interpret C as: does UI+data beat control, and does it beat **max(A,B)**? With B cost ❌ and A cost ❌, C needs a different mechanism (synergy or selection), not repetition.

### Harness backlog (still open)

Same as v2.1 — piped vitest, stop rule, Pi dev server, real reload. None blocked B adoption; all still inflate both arms.

---

## Artifacts

| Kind | Path |
|------|------|
| Experiment log | `artifacts/experiments/resource-slice-data-v1/2026-08-31T13-27-22Z.log` |
| Runs | `artifacts/runs/2026-08-31T13-27-27-135Z` … `2026-08-31T13-44-58-268Z` |
| Analysis stations | `artifacts/analysis/2026-08-31T13-*` |
| Assembly record | `app-template/resource-selection.json` |
| Control baseline | [control-floor-v2.1-analysis.md](../control-floor/control-floor-v2.1-analysis.md) |
| Verdict | [experiment-b-v1-verdict.md](./experiment-b-v1-verdict.md) |
