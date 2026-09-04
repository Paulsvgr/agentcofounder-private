# Experiment results: pre-green single-test v1

**ID:** `pre-green-single-test-v1`  
**Decision:** **REVERT**  
**Flag:** `HARNESS_PRE_GREEN_SINGLE_TEST_V1` remains **OFF**  
**Prereg:** [experiment-pre-green-single-test-v1-preregistration.md](./experiment-pre-green-single-test-v1-preregistration.md)  
**Bait:** `fixtures/pre-green-single-test-143k-pretest/` from `2026-09-04T12-51-52-540Z` pre-call-7

## Pair

| Arm | Run | Calls | Weighted | Green @ | V-fails | Final src tests | Blocks |
|-----|-----|------:|---------:|--------:|--------:|-----------------|-------:|
| Control | `2026-09-04T14-11-43-128Z` | **19** | **~106k** | **16** | **3** | `books.test.ts` + `App.test.tsx` | n/a |
| Treatment | `2026-09-04T14-14-21-043Z` | **28** | **~227k** | **25** | **4** | `books.test.ts` only | **4** |

Both: harness 3/3; journeys present (control 3, treatment 6).

## KEEP checklist

| Requirement | Result |
|-------------|--------|
| Control second test path before PASS | **PASS** (same-call write of both suites) |
| Treatment blocks second path | **PASS** (`write src/App.test.tsx` + rename thrash) |
| Treatment PASS/build | **PASS** |
| Treatment cheaper / earlier green | **FAIL** — ~106k→~227k, green 16→25 |
| No block-thrash | **FAIL** — mv to `.tsx`, repeated rewrites of allowed file |

## What happened

```text
CONTROL
  write books.test.ts + App.test.tsx (same call)
  → VERIFY fails → repair → PASS @16 (~106k)

TREATMENT
  write books.test.ts  (latches allowed)
  → BLOCK App.test.tsx
  → bash mv …test.ts → …test.tsx (blocked)
  → rewrite thrash on books.test.*
  → PASS @25 (~227k)
```

Mechanism engaged. Economics failed: forcing one suite after the agent chose the **wrong** first file (`books.test` unit suite before journeys) caused rename/rewrite tax worse than control’s two-file path.

## Decision

**REVERT.** Do not default-on. Same family lesson as Q2-E: constraining test authoring shape without controlling **which** file comes first inflates cost.

Still invalid as primary: pure `max_tokens` (cheap App.tsx writes also ~3k).

## Next root (if continuing)

Prefer levers that shrink **FAIL→PASS** / evidence quality without forbidding productive authoring shapes — or stop and ship the frozen KEEP stack for the deadline.
