# First-VERIFY Authoring Forensic — S1 Expensive vs v2.2 Cheap

**Status:** FINAL / FROZEN (2026-09-02)  
**Phase closure:** [forensic-phase-2-trajectory-fork.md](./forensic-phase-2-trajectory-fork.md)  
**Question:** Why does one run arrive at VERIFY with 6–8 manageable tests at ~30k, while another arrives with 9–15 tests and ~50–60k already spent?

**Data:** Events replay through first canonical VERIFY anchor (same reconstruction as Q2-D prereg).  
**JSON:** `artifacts/forensic/first-verify-authoring-forensic.v1.json`

No new experiment. No code changes.

---

## Cohorts compared

| Cohort | Runs | Role |
|---|---|---|
| **v2.2 cheap** | Rep3 49k, Rep5 50k, Rep2 61k | Target path |
| **S1 expensive** | Rep2 100k, Rep3 90k, Rep4 93k, Rep5 105k | Primary mystery |
| **v2.2 Rep4 109k** | Tail bridge | Same pathology without S1 |

S1 Rep1 (65k) included in per-run table as near-parity anchor.

---

## Per-run metrics at first VERIFY

| Run | Total | Pre-VERIFY | Pre-mutation | Mut→VERIFY | Mut @ | VERIFY @ | Span | Tests | LOC | Vitest fail | App LOC | CSS LOC |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v2.2 Rep3 49k | 49,449 | 30,165 | 22,282 | 3,481 | 7 | 8 | 1 | 6 | 149 | SUITE | 344 | 294 |
| v2.2 Rep5 50k | 50,364 | 30,744 | 19,188 | 8,929 | 5 | 7 | 2 | 8 | 171 | 2 | 285 | 292 |
| v2.2 Rep2 61k | 60,852 | 44,065 | 36,966 | 2,575 | 10 | 11 | 1 | 9 | 171 | 0 | 360 | 300 |
| **v2.2 Rep4 109k** | 108,708 | 61,378 | 45,327 | 11,617 | 11 | 14 | 3 | 10 | 182 | 3 | 399 | 383 |
| S1 Rep1 65k | 64,512 | 38,176 | 30,777 | 3,094 | 8 | 9 | 1 | 6 | 132 | 1 | 340 | 251 |
| S1 Rep2 100k | 100,435 | 49,233 | 31,114 | 19,321 | 7 | 10 | 3 | 7 | 258 | 1 | 398 | 362 |
| S1 Rep3 90k | 89,545 | 61,974 | 44,147 | 19,503 | 9 | 12 | 3 | 8 | 175 | 1 | 345 | 355 |
| S1 Rep4 93k | 93,354 | 48,074 | 37,190 | 5,682 | 9 | 10 | 1 | **15** | **285** | **8** | 367 | 373 |
| S1 Rep5 105k | 105,193 | 42,185 | 36,032 | 8,772 | 8 | 9 | 1 | 9 | 202 | **8** | **542** | **463** |

### Medians

| Metric | v2.2 cheap | S1 expensive | v2.2 Rep4 bridge | Δ (S1 − cheap) |
|---|---:|---:|---:|---:|
| Pre-first-VERIFY | 30,744 | 48,654 | 61,378 | **+17.9k** |
| Pre-mutation (before first test write) | 22,282 | 36,611 | 45,327 | **+14.3k** |
| Mutation → first VERIFY | 3,481 | 14,047 | 11,617 | **+10.6k** |
| First test mutation call | 7 | 9 | 11 | +2 calls |
| First VERIFY call | 8 | 10 | 14 | +2 calls |
| Call span (mutation→VERIFY) | 1 | 2 | 3 | +1 |
| Authored tests at VERIFY | 8 | 9 | 10 | +1 |
| Test LOC at VERIFY | 171 | 230 | 182 | +59 |
| Test files | 1 | 1 | 1 | 0 |
| Journey blocks (App.test.tsx) | 8 | 9 | 10 | +1 |
| Extra-file tests | 0 | 0 | 0 | 0 |
| Helper functions in tests | 0 | 2 | 1 | +2 |
| App.tsx LOC | 344 | 383 | 399 | +39 |
| styles.css LOC | 294 | 368 | 383 | +74 |

---

## Answer to the core question

The gap is **not primarily “15 tests vs 6 tests.”** Median test count at first VERIFY is **8 vs 9** — nearly identical. One outlier (S1 Rep4) authored **15 granular tests** before VERIFY; the rest of the expensive cohort looked like cheap runs on test count alone.

The ~18k pre-VERIFY premium decomposes into **two timing buckets**:

```text
                    v2.2 cheap median    S1 expensive median
Pre-mutation:            22.3k                 36.6k     (+14.3k)
Mutation → VERIFY:        3.5k                 14.0k     (+10.6k)
                      ─────────             ─────────
Pre-VERIFY total:        30.7k                 48.7k     (+18.0k)
```

### Bucket 1 — Pre-mutation (+14k): heavier app build *before* any test exists

Expensive runs spend more calls implementing product + CSS **before writing `App.test.tsx`**, and individual implementation calls cost more (larger writes, more context).

**Matched example — v2.2 Rep3 vs S1 Rep3 (both end with 6–8 tests, similar App.tsx ~345 LOC):**

| Phase | v2.2 Rep3 | S1 Rep3 |
|---|---|---|
| Pre-mutation weighted | 22,282 | **44,147** |
| Calls before first test | 6 | **8** |
| Heaviest pre-mutation call | CSS @6: 8,788 | App @6: **11,180** + CSS @7: **13,142** |
| First test mutation @ | 7 | **9** (2 calls later) |

Same file types (`types.ts`, `App.tsx`, `styles.css`), same single test file — but S1 Rep3 **defers test authoring** while stacking two 11–13k implementation calls.

**v2.2 Rep4 bridge (109k)** shows the same shape without S1: mutation @11, VERIFY @14, **45k pre-mutation** — confirming this is trajectory variance, not intervention overhead.

### Bucket 2 — Mutation → VERIFY (+11k): deferred VERIFY and fat test authoring

Cheap runs typically: **write tests → VERIFY on the very next call** (span = 1).

| Run | Span | Mut→VERIFY | What happened between mutation and VERIFY |
|---|---:|---:|---|
| v2.2 Rep3 | 1 | 3,481 | VERIFY only |
| v2.2 Rep5 | 2 | 8,929 | 1 extra call then VERIFY |
| S1 Rep2 | **3** | **19,321** | More test edits (258 LOC file) before VERIFY @10 |
| S1 Rep3 | **3** | **19,503** | Test write 7.8k + recon + VERIFY @12 |
| S1 Rep4 | 1 | 5,682 | Wrote **15 tests in one shot** then VERIFY (8 fail) |

S1 Rep2 is the clearest “not test count” case: only **7 tests**, but **258 LOC** (vs cheap median 171) and **3 calls** between mutation and VERIFY costing 19k.

---

## What expensive runs authored that cheap runs did not

All runs use a **single `src/App.test.tsx`** — no extra test files, no debug sidecars, no domain.test.ts. The difference is **granularity and verbosity inside App.test.tsx**.

### Test titles present in expensive runs but absent from cheap v2.2 (49–61k)

**S1 Rep4 (15 tests — the test-bloat outlier):**
- Separate empty-title **and** empty-author validation tests (cheap runs combine into one)
- Empty-state message before any books added
- Cancel edit without applying changes
- Cancel lend without recording borrower
- Empty-state for lent filter when nothing is out
- **Sorts books alphabetically by title**
- Separate header count test split from lend flow

**S1 Rep5:**
- **Search books by title, author, or borrower** (extra feature scope)
- Deletes a book **after confirmation** (more complex flow)
- Larger App.tsx (**542 LOC** vs cheap median 344)

**S1 Rep2:**
- Verbose test bodies → **258 LOC for 7 tests** (37 LOC/test vs cheap ~21 LOC/test)

**v2.2 Rep2 61k (cheap cohort but high pre-VERIFY):**
- **Undo/redo** journey — extra product scope, not test-file bloat

### Helper functions

S1 expensive median: **2 helper functions** in test file (e.g. `addBook`, `fillForm`, `renderApp`) vs **0** for cheap v2.2. Helpers add LOC and context weight during test authoring calls but do not add test count.

---

## Does test count/LOC/timing explain repair cost?

**Pre-VERIFY:** Yes, primarily via **timing and call weight**, not test count.
- +14k pre-mutation: deferred test authoring + heavier App/CSS writes
- +11k mutation→VERIFY: extra test-editing calls before VERIFY fires

**Repair (VERIFY→PASS):** Test count/LOC at first VERIFY strongly predicts first-verify failure severity:

| Run | Tests @ VERIFY | First-verify failures | VERIFY→PASS cost |
|---|---:|---:|---:|
| v2.2 cheap median | 8 | 0–2 | ~8.9k |
| S1 Rep4 | **15** | **8** | **30.2k** |
| S1 Rep5 | 9 | **8** | **37.6k** |
| v2.2 Rep4 bridge | 10 | 3 | 30.3k |

Rep4/5 arrive at VERIFY with **8 simultaneous RTL failures** — S1 correctly classifies subsequent `8→3→0` and `8→4→0` as converging, but repair still costs 30–40k. More granular tests = more independent failure surfaces on first VERIFY.

**Post-PASS:** Not explained by test authoring (Rep2: 35k post-PASS build/finalize with only 7 tests).

---

## App structure at first VERIFY

No architectural divergence. All runs:
- **1 test file** (`src/App.test.tsx`)
- **~4 non-test src files** (monolith `App.tsx` + `types.ts` + entry + CSS)
- **0 component splits**, **0 extra test files**

Expensive runs tend toward **larger App.tsx and CSS** (+39 and +74 LOC median), but this is modest compared to the +18k pre-VERIFY cost — the cost is in **token-weighted calls**, not file-count explosion.

---

## Bridge: v2.2 Rep4 (109k) vs S1 expensive

| Signal | v2.2 Rep4 | S1 expensive median |
|---|---|---|
| Pre-mutation | 45,327 | 36,611 |
| Mut→VERIFY | 11,617 | 14,047 |
| Pre-VERIFY total | 61,378 | 48,654 |
| Tests @ VERIFY | 10 | 9 |
| VERIFY path | 3→2→0 | mixed |
| VERIFY→PASS | 30,252 | 23,184 |

**v2.2 Rep4 is the proof point:** the expensive pre-VERIFY and multi-fail repair pattern exists in the control baseline. S1 did not create it. S1 expensive cohort sits between cheap v2.2 and the v2.2 tail.

---

## S1 Rep1 anchor (65k — near parity)

| Metric | S1 Rep1 | v2.2 cheap median |
|---|---:|---:|
| Pre-VERIFY | 38,176 | 30,744 |
| Tests @ VERIFY | 6 | 8 |
| Mut→VERIFY span | 1 | 1 |
| Mut→VERIFY cost | 3,094 | 3,481 |
| First-verify failures | 1 | 0–2 |

Rep1 matches the cheap path shape: **6 consolidated tests, span=1, quick VERIFY**. One stalled re-VERIFY (Tier-1) added ~6k but total stayed ~65k.

---

## Forensic conclusion

1. **Test count alone does not explain the ~18k pre-VERIFY gap.** Median 8 vs 9 tests; single test file in all runs.

2. **The primary drivers are:**
   - **Deferred test authoring** — more product/CSS calls before first test write (+14k pre-mutation)
   - **Deferred VERIFY** — 2–3 extra calls editing verbose tests before VERIFY (+11k mutation→VERIFY)
   - **Test granularity** (Rep4/5 outlier) — 15 granular tests or 8 failures at first VERIFY → expensive converging repair S1 cannot target

3. **What expensive runs authored differently:**
   - More **fine-grained edge-case tests** (empty states, cancel flows, separate validation tests, sorting, search)
   - **Verbose test bodies** and **helper functions** (LOC inflation without test-count inflation)
   - **Larger App/CSS** in some runs (Rep5: 542 LOC App)

4. **v2.2 Rep4 (109k) bridges the gap** — same late-VERIFY, high pre-mutation, multi-fail repair without S1.

5. **Do not design an intervention yet.** The next layer should characterize *why* Pi defers VERIFY and authors granular tests (prompt? ambiguity resolution? model stochasticity?) — not convergence classification.

---

## Related artifacts

- Call-by-call comparison: `docs/v2/control-floor/s1-vs-v22-call-comparison.md`
- S1 cohort export: `artifacts/exports/cohort-s1-convergence-intervention-v1-2026-09-02.zip`
- Raw forensic JSON: `artifacts/forensic/first-verify-authoring-forensic.v1.json`
