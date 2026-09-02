# Experiment C v1 — deep analysis

**Completed:** 2026-08-31 (5/5 harness-success)  
**Experiment:** `resource-slice-full-v1`  
**Arm:** treatment — `full-v1` preset (UI v1 shadcn + theme + `local-storage-collection`)  
**Compare baselines:** control v2.1 (~**78k**), Experiment B (~**114k**), Experiment A v2 (~**279k**)  
**Log:** `artifacts/experiments/resource-slice-full-v1/`

---

## Cohort summary

| Rep | Run ID | Weighted | Calls | Journeys | Trajectory |
|-----|--------|----------|-------|----------|------------|
| 1 | `14-10-21-280Z` | **193k** | 43 | 9/9 | Import + Select RTL spiral |
| 2 | `14-17-22-430Z` | 150k | 34 | 7/7 | Dialog-heavy + mixed repair |
| 3 | `14-23-34-009Z` | 143k | 32 | 7/7 | `dbg.test` + combobox spiral |
| 4 | `14-30-44-720Z` | 158k | 37 | 9/9 | Dual dialogs + test loop |
| 5 | `14-36-58-838Z` | **124k** | 32 | 8/8 | Best path — still > control |

| Metric | Control v2.1 | Exp B | **Exp C** | Exp A v2 |
|--------|--------------|-------|-----------|----------|
| Median weighted | **~78k** | ~114k | **~150k** | ~279k |
| Mean weighted | ~95k | ~116k | ~154k | ~279k |
| Range | 72k – 155k | 84k – 156k | 124k – 193k | — |
| Median calls | 20 | 25 | **34** | — |
| Quality | 5/5 | 5/5 | **5/5** | 4/5 + 1 partial |
| UI adoption | N/A | N/A | **5/5** shadcn | 5/5 agent components |
| Data adoption | 0/5 | 5/5 | **5/5** | partial |

**Note on UI arm:** Experiment C uses **UI v1 (raw shadcn)** + data, matching `examples/sample-RESOURCES.md`. Experiment A v2 (agent-contract components) remains closed and blocked in the assembler — C is **not** a re-run of A v2 + B.

---

## Synergy interpretation (from protocol)

| Comparison | Result |
|------------|--------|
| **C vs control** | ❌ C median **~150k** vs **~78k** — full slice **~2×** baseline |
| **C vs max(A, B) on cost** | B best single-slice at ~114k; C **~150k > ~114k** — **no synergy** |
| **C vs A v2 alone** | C ~150k < A ~279k — combo cheaper than agent-UI slice alone, but irrelevant (different UI tier) |
| **Adoption** | ✅ Both UI and data used in 5/5 — **full adoption** |
| **Quality** | ✅ 40/40 journeys + harness |

**Protocol outcome:** `C > control, C > max(A,B)` → **failed**. Combination adds context/complexity without beating the best single-type result (B on cost; control overall).

---

## What was assembled

**Preset `full-v1`:** button, card, dialog, input, label, select, theme-default, lib-utils, local-storage-collection (9 registry entries).

| Preinstalled | ~LOC | Role |
|--------------|------|------|
| `@/components/ui/*` | ~409 | shadcn primitives |
| Store/hook/text/memoryStorage | ~158 | Exp5b data pattern |
| `RESOURCES.md` | long | 9 resource sections + constraints |

Pi still generated **608–824 LOC** product+tests per run on top of ~567 LOC preinstalled.

---

## Activity mix (median share)

| Activity | Control v2.1 | Exp B | **Exp C** |
|----------|--------------|-------|-----------|
| source | 37.1% | 29.0% | 26.7% |
| mixed | 27.1% | 25.8% | **33.1%** |
| test | 10.0% | 11.6% | **21.2%** |
| recon | 9.3% | 8.2% | 7.9% |
| finalize | 12.7% | 12.4% | 8.6% |

**C shifts cost from source → mixed + test.** More integration work (wiring shadcn + store + dialogs) and **double the test share** vs control. Preinstalled UI/data reduced raw source generation slightly but **increased repair surface** (Select/combobox queries, dialog scoping, import paths).

---

## Rep 1 — Import + Select RTL spiral (193k / 43 calls)

**Session:** 101 turns

### Timeline

```text
recon (RESOURCES + ui files + lib store)
→ components: BookForm, BookRow, BorrowForm + bookStore + useBookLibrary
→ first npm test: FAIL 0/0 — bad import "../types" from BookForm
→ fix paths → Select option queries fail (role="option" name "Novel")
→ removeBook ReferenceError cascade (8/9 fail)
→ grep-filtered test runs, "at home" duplicate text matcher
→ 11 piped test invocations → report
```

### Failure stack (calls 12–20)

1. **Suite/transform:** `Failed to resolve import "../types" from BookForm.tsx"` — wrong relative path despite preinstalled structure
2. **RTL — shadcn Select:** `Unable to find role="option" and name "Novel"` — tests used native `<select>` patterns; app uses Radix Select
3. **Test code bug:** `removeBook is not defined` in helpers — snowballed to 8/9 failures
4. **RTL — duplicate text:** `Found multiple elements with the text: /at home/i`

### Cost drivers

- **21% recon** — heavy upfront reading of UI + data files
- **21% test** — longest test loop in cohort
- **43 calls** — highest call count

**Full slice did not prevent** the same classes of failure as control/B; added **import-path** and **Select/combobox** failure modes on top.

---

## Rep 2 — Dialog-heavy build (150k / 34 calls)

**Session:** 89 turns

### Timeline

```text
RESOURCES → BookFormDialog + LendDialog (shadcn Dialog)
→ bookStore + books.ts + App
→ 9 piped tests, mixed-heavy repair (37% mixed share)
→ 7 journeys (fewer tests than other reps)
```

### Architecture

- Dual dialog pattern (add book, lend out) — aligns with RESOURCES.md Dialog section
- `bookStore.ts` wrapper over `createCollectionStore`
- **668 LOC** product — leaner than C1

### Cost

150k with **37% mixed** — integration edits dominate, not persistence.

---

## Rep 3 — dbg.test sidecar (143k / 32 calls)

**Session:** 82 turns

### Timeline

```text
build App (dialog + combobox filter)
→ test failures: option `/lent out/i`, button `/returned round trip/i`
→ write dbg.test.tsx (console.log DOM / options) — call 18
→ 12 test invocations, 31.5% test share
→ pkill once
```

### Sidecar debug

Pi wrote `src/dbg.test.tsx` to inspect combobox options and lend/return buttons — same **false-progress pattern** as control rep 1 `dbg.test.tsx` (sidecar passes with `expect(true).toBe(true)` while main suite fails).

### shadcn Select vs test expectations

Filter uses `Select` combobox; tests queried `role="option"` with names that didn't match Radix rendering — **UI resource changed component model** but tests still assumed native select semantics.

---

## Rep 4 — Dual dialogs + test loop (158k / 37 calls)

**Session:** 89 turns

### Timeline

```text
BookFormDialog + LendDialog + useBooks wrapper
→ 12 piped tests, 24% test + 37% mixed
→ 9 journeys
```

Similar shape to C2 with more tests (9 vs 7 journeys) → +8k weighted.

---

## Rep 5 — Best path, still above control (124k / 32 calls)

**Session:** 82 turns

### Timeline

```text
RESOURCES → BookForm + BookRow + LendDialog + useBooks + bookStore
→ shadcn Button, Card, Select in App
→ only 6 piped test runs (lowest in C cohort)
→ 8 journeys, clean report
```

### Why cheapest in C

- Fewest test bash invocations (6 vs 9–12)
- Clear component split (BookForm, BookRow, LendDialog)
- Direct `useBooks` + store — still a wrapper but stable

**124k is C's floor** — still **+59% vs control median** and **+8% vs B median**.

---

## Cross-cohort adoption

| Signal | C1 | C2 | C3 | C4 | C5 |
|--------|----|----|----|----|-----|
| `@/components/ui/button` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Card / Dialog / Select | ✅ | ✅ | ✅ | ✅ | ✅ |
| `createCollectionStore` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `createMemoryStorage` in tests | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom `.btn` CSS | ❌ | ❌ | ❌ | ❌ | ❌ |
| Hand `repository.ts` | ❌ | ❌ | ❌ | ❌ | ❌ |
| RESOURCES.md read | ✅ | ✅ | ✅ | ✅ | ✅ |

**5/5 full adoption** — both resource types used; no fallback to hand-rolled buttons or localStorage mocks.

---

## Why combining UI + data cost more than B alone

1. **Context tax (~567 LOC + long RESOURCES.md)** — Pi reads more before building; 9 sections vs 1 in B.
2. **Integration surface** — wiring Dialog + Select + store + domain in one app; **mixed activity highest** in cohort (33% median).
3. **New failure modes** — Radix Select/combobox queries (C1, C3); import path errors (C1); not present in B-only runs.
4. **No elimination of domain/UI work** — still ~650–820 LOC generated; shadcn replaces button/div styling, not app logic.
5. **Test share doubled vs control** — 21% vs 10%; shadcn semantics ≠ native HTML test patterns.
6. **No synergy** — costs **add** (UI repair + data repair + integration), don't cancel.

---

## A / B / C ladder (cost)

```text
Control v2.1  ~78k   ████████░░░░░░░░  (no resources)
Exp B           ~114k  ███████████░░░░░  (+ data only)
Exp C           ~150k  ██████████████░░  (+ UI + data)
Exp A v2        ~279k  ██████████████████████████  (+ agent UI only, different tier)
```

**Cheapest path remains plain control.** Best resource slice on cost is **B alone** — and B still loses to control. **C is strictly worse than B.**

---

## Trajectory models

```text
INTEGRATION SPIRAL (C1, 193k/43)
  read UI+data → build → import fail → Select RTL → test helper bug → grep test loops

DIALOG BUILD (C2/C4, 150–158k)
  dual dialogs + store → mixed-heavy → moderate test loop

COMBOBOX DEBUG (C3, 143k/32)
  filter Select → dbg.test sidecar → 12 test runs

BEST COMBO (C5, 124k/32)
  split components + 6 tests — still > control/B medians
```

---

## Implications for V2 resource strategy

| Finding | Action |
|---------|--------|
| Full multi-type slice fails cost | Planner should **not** default to “UI + data bundle” |
| B beats C on cost | Prefer **single high-leverage slice** when selecting |
| Adoption at full slice | ✅ Architecture works — assembler + RESOURCES.md scale to 9 entries |
| shadcn + RTL | Add **test-pattern** resource: Radix Select/Dialog query recipes |
| Agent UI (A v2) vs shadcn (C) | Not comparable — keep A v2 archived; any future UI test uses explicit tier |
| Registry | Keep both UI v1 entries and data-pattern; **no full-v1 preset in production path** until recipe-tier exists |

---

## Harness gaps (unchanged)

- All C reps: **piped vitest** (`| tail`, `| grep`)
- C3/C4: pkill
- All reps: Pi-owned dev server
- Sidecar debug tests (C3 `dbg.test.tsx`)
- No real browser reload

---

## Artifacts

| Kind | Path |
|------|------|
| Experiment log | `artifacts/experiments/resource-slice-full-v1/*.log` |
| Runs | `artifacts/runs/2026-08-31T14-10-21-280Z` … `2026-08-31T14-36-58-838Z` |
| Analysis | `artifacts/analysis/2026-08-31T14-*` |
| Assembly | `app-template/resource-selection.json` (preset `full-v1`) |
| Prior | [experiment-b-v1-analysis.md](./experiment-b-v1-analysis.md), [control-floor-v2.1-analysis.md](../control-floor/control-floor-v2.1-analysis.md) |
| Verdict | [experiment-c-v1-verdict.md](./experiment-c-v1-verdict.md) |
