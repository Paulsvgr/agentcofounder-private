# Results: VERIFY test-context evidence v1 (Dune seed)

**ID:** `verify-test-context-evidence-v1`  
**Decision:** **REVERT / NOT KEEP** (mechanism PASS; locus FAIL)  
**Flag:** `HARNESS_VERIFY_TEST_CONTEXT_EVIDENCE_V1` remains **OFF**  
**Prereg:** [experiment-verify-test-context-evidence-v1-preregistration.md](./experiment-verify-test-context-evidence-v1-preregistration.md)  
**Offline proof:** `artifacts/experiments/verify-test-context-dune-148k/message-proof.json` → **PASS**  
**Bait:** `fixtures/verify-test-context-dune-148k/` (mid-spiral `14-48-25` App.test @65 + end-state product)

## Pair

| Arm | Run | Status | Weighted | Calls | Green @ | V-fails | TEST CONTEXT on 1st FAIL |
|-----|-----|--------|--------:|------:|--------:|--------:|--------------------------|
| Control | `2026-09-04T15-25-12-835Z` | partial | **~294k** | 56 | 22 | 4 | no |
| Treatment | `2026-09-04T15-31-35-216Z` | success | **~84k** | 14 | 11 | 1 | **yes** |

Both: harness 3/3, journeys 6/6. Control exited non-zero / partial after long post-green thrash.

## KEEP checklist

| Gate | Result |
|------|--------|
| Mechanism — treatment MESSAGE has `TEST CONTEXT` + fail line | **PASS** (offline + live) |
| No advice / no RECENT ACTIONS | **PASS** |
| Economics — treatment cheaper FAIL→PASS | **PASS** (~294k→~84k; green 22→11) |
| Correct locus — **test fix**, not product surgery | **FAIL** |

## What treatment actually did

`App.test.tsx` **unchanged** from the fixture (still queries Dune on the lent filter after return).

Product edit in `App.tsx`:

```text
onReturn → update borrower null
         + if filter === "lent" → setFilter("all")
```

So VERIFY still “won,” but by making the UI jump to All books on return — **satisfying the bad expectation** instead of correcting the test sequence.

That is still the oracle failure mode:

```text
truthful FAIL + more facts
→ Pi still treats FAIL as product gap
→ product surgery
```

Faster than control’s debug.test spiral, but **not** the prereg success signal.

## Control behavior (for contrast)

Long diagnostic wandering: repeated `src/debug.test.tsx`, later App.test rewrites, App.tsx edits, ~294k, partial finalize.

## Decision

**REVERT.** Do not default-on.

- Mechanism (raw source window) is **validated** and may stay in-tree behind OFF for a redesigned seed/gates.
- Economic win alone is **not** enough when locus is product surgery.
- Do **not** add RECENT TEST ACTIONS yet — would confound what already failed the locus gate.
- Next oracle attempt (if any) needs a KEEP gate that **rejects** product-only fixes on this bait (e.g. require App.test diff / forbid filter auto-switch), or a different evidence shape.

Ship stack unchanged.
