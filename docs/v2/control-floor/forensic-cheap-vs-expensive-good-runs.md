# Forensic: cheap good (~40–50k) vs expensive good (~80–140k)

**Date:** 2026-09-04  
**Question:** We kept persistence reliability but lost cheap-path efficiency. What did cheap agents *not* do?  
**Scope:** `persistence_primitive=true` + `tailwind=true` + `result.status=success` (exclude product-quality-contract confound unless noted).

## Verdict

**Persistence is not the +50k.** Cheap successes with persistence+Tailwind already exist at **~40–52k**. Expensive successes keep similar product size / App.tsx LOC; they burn cost on **later first-green**, **more VERIFY FAILs**, and sometimes **test bloat / recon**.

```text
CHEAP GOOD (persistence ON)
  first VERIFY @7–8, often PASS first try
  ~10–14 calls, ~1 test file, ~4–9 cases
  product ~600–650 LOC — done

EXPENSIVE GOOD (persistence ON)
  product still ~650–700 LOC (similar!)
  BUT green @13–28, 2–3+ VERIFY attempts
  more test mutations / sometimes 2nd test file
  → 80–140k+
```

## Matched close-up (3+3)

| Run | W | Calls | 1st V | Green | V-fail | Tests | Test LOC | Product LOC | App.tsx |
|-----|--:|------:|------:|------:|-------:|-------:|---------:|------------:|--------:|
| `07-34-36` cheap | 40k | 11 | 8 | 8 | 0 | 9 | 133 | 616 | 403 |
| `09-09-19` cheap | 47k | 10 | 7 | 7 | 0 | 4 | 115 | 602 | 385 |
| `07-20-21` cheap | 50k | 14 | 8 | 11 | 1 | 6 | 129 | 658 | 438 |
| `12-48-50` expensive† | 85k | 16 | 13 | 13 | 1 | 18‡ | 286 | 632 | 393 |
| `09-41-08` expensive | 84k | 13 | 10 | 10 | 1 | 7 | 186 | 614 | 371 |
| `12-51-52` expensive† | 143k | 24 | 20 | 20 | 2 | 32‡ | 393 | 819 | 483 |

† quality-contract pair (treatment had extra “build quality” pressure). ‡ includes helper `*.test.ts` cases, not just journeys.

**Product LOC median barely moves. Test LOC / cases and time-to-green do.**

### Call shape (archetypes)

**Cheap 40k** (`07-34-36`):

```text
recon (bash cat) → write types/store/App → write App.test → VERIFY PASS → build → report
```

**Cheap 47k** (`09-09-19`):

```text
recon → write books + App → write App.test → VERIFY PASS → build → report
```

**Expensive 85k** (`12-48-50`):

```text
recon → books + App → books.test + App.test → VERIFY FAIL → edit App+tests → VERIFY PASS → …
```

**Expensive 143k** (`12-51-52`):

```text
heavy read recon → books + useBooks + App + 2 test files
→ FAIL → move files / edit hooks → FAIL → test thrash → PASS @20 → …
```

## Cohort bands (excl. quality-contract; n=27)

| Band | n | Med W | Med calls | Med 1st V | Med green @ | Med V-fails | Med test cases | Med test LOC | Med product LOC | Med post-green calls |
|------|--:|------:|----------:|----------:|------------:|------------:|---------------:|-------------:|----------------:|---------------------:|
| ≤55k | 7* | 40k | 10 | 7 | 7 | 0 | 4 | 127 | 645 | 2 |
| 55–80k | 10 | 70k | 16.5 | 9 | 13.5 | 1 | 12.5 | 205 | 667 | 2 |
| ≥80k | 9 | 104k | 25 | 8 | **20** | **2** | 10 | 201 | 683 | 2 |

\* includes some seeded hard-stop / full-green micro-runs; natural cheap path still visible at 40–52k (`07-34`, `09-09`, `07-20`, `07-28`).

### Correlations with weighted cost (excl. quality)

| Pair | corr |
|------|-----:|
| weighted ↔ first green call | **0.95** |
| weighted ↔ model calls | **0.95** |
| weighted ↔ VERIFY fails before green | **0.86** |
| weighted ↔ verify tool count | **0.84** |
| weighted ↔ pre-first-VERIFY weighted | 0.51 |
| weighted ↔ test cases / test LOC | **~0.18–0.24** (weak alone) |
| pre-VERIFY weighted ↔ test cases | 0.67 |

**Reading:** Cost is dominated by **how long until green** (repair / multi-VERIFY), not by product size and not primarily by persistence. Test bloat shows up more in the mid band and as a *contributor* to pre-VERIFY weight; the heavy tail is often a **FAIL→repair spiral** after an early-ish first VERIFY.

**Post-green calls ≈ 2 in every band** → FULL_GREEN_GATE already targets that slice; it will not by itself restore 40–50k totals.

## What cheap did *not* do

1. **Did not keep failing VERIFY** — 0 fails before green (vs 1–3 on heavy).  
2. **Did not linger after first FAIL** — green at first VERIFY or +0–3 calls, not +10–20.  
3. **Did not add a second domain test file** (`books.test.ts`) before green.  
4. **Did not invent extra abstractions** (`useBooks` + path reshuffles) mid-flight.  
5. **Did not turn recon into many `read` tool storms** (cheap often one bash cat pass).  
6. **Did ship similar App size** — cheap is not “tiny unfinished UI.”

## What this is *not*

- Not “persistence costs +50k” (counterexamples at 40–52k with persistence ON).  
- Not fixed by more quality prompts (quality-contract REVERT: same score, +cost).  
- Not mainly post-green waste (already ~2 calls; FULL_GREEN KEEP handles that).
- **Correction (2026-09-04 deep mine):** post-FAIL *new hook / second suite* creation is **rare** in this corpus. Expensive redesign is usually **pre-first-VERIFY**. Post-FAIL growth is mostly `debug.test.tsx` sidecars or occasional path `mv`. Repair-surface-lock therefore targets a **narrower** post-FAIL expansion class; recovering 40–50k also needs a pre-VERIFY cheap-path attack.

## Next harness root (recommended)

**Primary:** shrink **time-to-first-canonical-green** / kill **multi-FAIL repair spirals** without forbidding persistence.

Concrete candidates (pick one narrow flag):

1. **Test authoring budget before first green** — e.g. block / steer when a second `*.test.*` appears before first PASS, or when authored cases exceed a small journey cap (cheap median ~4–9).  
2. **First-FAIL stop-the-bleed** — after first VERIFY FAIL, restrict to minimal repair surface (one product file + matching test), block new feature/files until PASS (stronger than parked convergence).  
3. **Early VERIFY latch** — after first product write + first test write, auto/require VERIFY (prior early-verify work exists; re-check against this cheap/expensive split before redesign).

**Do not** start another product-quality / polish prompt.

## Suggested follow-up pair

Seed or select:

- Control: current KEEP stack, FULL_GREEN optional OFF for isolation  
- Treatment: **one** of the roots above  

Measure: first green call, VERIFY fails before green, weighted total — on natural or lightly seeded bookshelf runs with persistence ON. KEEP only if green arrives earlier **without** regressing persistence harness checks.
