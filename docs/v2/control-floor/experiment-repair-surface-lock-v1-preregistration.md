# Experiment: repair-surface-lock v1

**ID:** `repair-surface-lock-v1`  
**Status:** **REVERT** — see [results](./experiment-repair-surface-lock-v1-results.md)  
**Flag:** `HARNESS_REPAIR_SURFACE_LOCK_V1` — default **OFF**  
**Depends on:** KEEP stack (VERIFY + root-error-first + persistence + Tailwind + RTL evidence + TYPECHECK)  
**Orthogonal to:** FULL_GREEN_GATE (post-green stop); hard test-budget limiters

## Corpus correction (important)

Deep mining of expensive successes shows:

| Pattern | Frequency post-FAIL |
|---------|---------------------|
| New hook / component / second suite | **Rare** — almost always authored **before** first VERIFY |
| `debug.test.tsx` sidecar | Common (long tails) |
| Path reshape (`mv` to new `src/` path) | Occasional (e.g. 143k quality treatment) |

So this lock does **not** attack pre-VERIFY overbuilding. It attacks **post-FAIL creation of new surface paths** (including `mv` destinations and debug sidecars). Soft typecheck seed never expanded → latch-only proof.

## Locked claim (narrowed)

> After first VERIFY FAIL, blocking new surface paths forces repair of the frozen set instead of path/file expansion that lengthens FAIL→PASS.

## Arms

```text
Control (0): FAIL → may create/mv new src/test paths
Treatment (1): FAIL → new destinations blocked; edit frozen files only
```

## Bait seed (historical)

Reconstructed filesystem **immediately before first VERIFY FAIL** from:

`2026-09-04T12-51-52-540Z` (product-quality-contract treatment, ~143k)

```text
fixtures/repair-surface-lock-143k-postfail/
```

Provenance: `SEED_META.json`

Historical FAIL→PASS expansion:

```text
FAIL @9 (import "./books" but file at src/lib/books.ts)
  ↓
C11  mv src/lib/books.ts src/books.ts   ← new path
  ↓
C12  edit useBooks imports
  ↓
C15–19 App.test thrash
  ↓
PASS @20
```

Viable treatment path without new files: **edit imports** to `./lib/books` on frozen files.

```bash
npm run experiment:repair-surface-lock-seeded-repair -- both 1
```

## KEEP requirements (all)

| Requirement | Why |
|-------------|-----|
| Control creates ≥1 new `src/`/`test/` path after FAIL | target behavior reproduced |
| Treatment attempts expansion and is **mechanically blocked** | intervention engaged |
| Treatment repairs via edits to frozen files | viable alternate path |
| Both reach equivalent PASS/build | safety |
| Treatment lowers FAIL→PASS calls/weighted | efficiency |
| No journey/persistence regression | safety |

## Critical failure mode → REVERT / narrow

```text
blocked new file → retry other new names → block thrash → call tax
```

If treatment `blocks[]` grows without progressing to PASS cheaper than control: **REVERT or narrow**, do not force KEEP.
