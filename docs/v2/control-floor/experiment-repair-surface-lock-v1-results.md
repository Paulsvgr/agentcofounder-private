# Experiment results: repair-surface-lock v1 (143k bait)

**ID:** `repair-surface-lock-v1`  
**Decision:** **REVERT**  
**Flag:** `HARNESS_REPAIR_SURFACE_LOCK_V1` remains **OFF** (implementation may stay for research; do not promote)  
**Prereg:** [experiment-repair-surface-lock-v1-preregistration.md](./experiment-repair-surface-lock-v1-preregistration.md)  
**Bait:** `fixtures/repair-surface-lock-143k-postfail/` from `2026-09-04T12-51-52-540Z` pre-FAIL

## Pair

| Arm | Run | Calls | Weighted | Green @ | V-fails before green | New path after FAIL | Lock blocks |
|-----|-----|------:|---------:|--------:|---------------------:|---------------------|------------:|
| Control | `2026-09-04T13-58-39-492Z` | **12** | **~58k** | **9** | **2** | **yes** `write src/books.ts` | n/a |
| Treatment | `2026-09-04T14-00-42-217Z` | **22** | **~104k** | **19** | **4** | no (edited imports instead) | **0** |

Both: harness checks 3/3; journeys present (control 7, treatment 4 — report shape differs; product green).

## KEEP checklist

| Requirement | Result |
|-------------|--------|
| Control creates ≥1 new surface path after FAIL | **PASS** (`src/books.ts`) |
| Treatment attempts expansion and is blocked | **FAIL** — never attempted `write`/`mv` of new path (`blocks: []`) |
| Treatment repairs via frozen-file edits | **PASS** (import edits) |
| Both reach PASS/build | **PASS** |
| Treatment lowers FAIL→PASS cost | **FAIL** — ~58k→~104k, 12→22 calls, green 9→19 |
| No quality/journey regression | Soft — both green; journey counts differ |

## What happened

```text
CONTROL (cheap fix for this bait)
FAIL (missing ./books)
  → write src/books.ts   ← intentional new path = correct cheap fix
  → one more FAIL → edit App.test → PASS @9

TREATMENT
FAIL + REPAIR_SURFACE_LOCK (11 files frozen)
  → long recon
  → edit imports on frozen files
  → 4 VERIFY FAILs / thrash
  → PASS @19
```

For **this** seed, creating `src/books.ts` is not wasteful redesign — it is the short path. The lock did not need to fire a block; Pi avoided new files and paid a **repair tax**.

No block-thrash (`blocks: []`), but the economic failure mode still hit: **constraint → longer FAIL→PASS**.

## Decision

**REVERT** as an efficiency KEEP. Soft seed was latch-only; hard bait showed control expansion that was *productive*, and treatment worse.

Do **not** default-on. Prefer next roots aimed at **pre-VERIFY overbuilding** / time-to-green (the 0.95 correlation), not post-FAIL new-path bans that can outlaw the cheap fix.
