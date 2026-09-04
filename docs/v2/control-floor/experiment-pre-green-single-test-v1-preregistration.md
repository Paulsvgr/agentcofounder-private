# Experiment: pre-green single-test budget v1

**ID:** `pre-green-single-test-v1`  
**Status:** **REVERT** — see [results](./experiment-pre-green-single-test-v1-results.md)  
**Flag:** `HARNESS_PRE_GREEN_SINGLE_TEST_V1` — default **OFF**  
**Depends on:** KEEP stack (VERIFY + root-error-first + persistence + Tailwind + RTL evidence + TYPECHECK)  
**Orthogonal to:** FULL_GREEN_GATE; repair-surface-lock (REVERT)

## Why this (not max_tokens)

Cheap good runs also emit **~3.1–3.5k output** on the first `App.tsx` write. A global monster-call / `max_tokens` cap would attack the cheap path’s essential move.

Expensive 143k (`2026-09-04T12-51-52-540Z`) differed by authoring **two** test files before VERIFY (`books.test.ts` then `App.test.tsx`). Cheap paths used **one**.

## Locked claim

> Before first VERIFY PASS, allowing only one `src/**/*.test.*` file forces journey coverage into a single suite and blocks pre-VERIFY second-suite / debug-sidecar expansion that correlates with later green.

## Not this experiment

| Closed / invalid | Why |
|------------------|-----|
| Q2-E owned test structure | Skeleton + Δ≤1 + restore → call tax explosion |
| Q2-C authoring guard | Pre-VERIFY pattern blocking inflated cost |
| Q2-D early VERIFY | Timing alone REVERT |
| Repair-surface lock | Post-FAIL new-path ban REVERT |
| Pure max_tokens | Cheap App.tsx writes are also “monsters” |

## Arms

```text
Control (0): may write books.test.ts + App.test.tsx before VERIFY
Treatment (1): first src *.test.* latches; further test paths blocked until PASS
```

## Bait seed

Product-only snapshot immediately before historical `src/books.test.ts` write:

```text
fixtures/pre-green-single-test-143k-pretest/
  src/lib/books.ts
  src/lib/useBooks.ts
  src/App.tsx
```

Source: `2026-09-04T12-51-52-540Z` pre-call-7.

## KEEP gates (1+1)

1. Control creates ≥1 second `src/*.test.*` before PASS **or** treatment records ≥1 block of a second test path  
2. Treatment reaches PASS/build with harness checks OK  
3. Treatment **lower** weighted and/or earlier green than control on this bait  
4. No block-thrash failure mode (many blocks + worse cost without progress) → REVERT  
5. Mechanism does not force worse journey coverage than control (soft)

## REVERT if

- Treatment more expensive / later green without quality lift  
- Blocks fire but Pi burns more on single-file thrash than control’s two-file path  
- Control never expands (latch-only) and treatment not cheaper

## Run

```bash
npm run experiment:pre-green-single-test-seeded -- both 1
```
