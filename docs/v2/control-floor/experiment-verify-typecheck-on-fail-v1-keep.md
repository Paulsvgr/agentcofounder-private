# KEEP: HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1

**Decision:** **KEEP** (2026-09-04) — **experiment CLOSED**  
**Default:** ON when unset (explicit `0` / `false` / `no` disables).  
**Checkpoint:** `artifacts/exports/checkpoint-verify-typecheck-on-fail-keep-2026-09-04.zip`  
**Hard compare:** `artifacts/experiments/verify-typecheck-257k-hard/seeded-repair-compare.json`

## Locked interpretation

| Feature | What KEEP means |
|---------|-----------------|
| **MULTIPLE** | Reporter-quality fix; KEEP — **do not** claim old 83k→12k efficiency |
| **TYPECHECK-on-VERIFY-FAIL** | Harness intervention with clean causal evidence; KEEP, default ON |

Hard-seed evidence is what matters: **same app, same failure, same eventual one-line fix**, treatment reaches it at call **4/5** instead of **15/17**.

The ~3× saving is a **result of this hard pair**, not a universal expected reduction. Do **not** say “TYPECHECK makes the harness 67% cheaper.” Say:

> For this 257k-class type-error failure, exposing factual TypeScript diagnostics caused a dramatically shorter repair path.

## Hard 1+1 (KEEP evidence)

| | Control `…11-05-05-042Z` | Treatment `…11-07-36-411Z` |
|--|--|--|
| Weighted | **57,303** | **19,278** (~66% cheaper) |
| Calls | **20** | **8** |
| Repair weighted | **49,434** | **14,508** (~71% cheaper) |
| Repair calls | **16** | **4** |
| Correct fix | @**15** | @**4** |
| First green | @**17** | @**5** |
| Final fix | `startEdit(book)` | `startEdit(book)` (same one line) |

Both final apps differ from the seed by **exactly**:

```diff
- onClick={() => startEdit(book.id)}
+ onClick={() => startEdit(book)}
```

No test rewrite, no alternate workaround, no unrelated product edits.

### Causal path

Both saw `Unable to find an element with the display value: Dune.`  
Treatment alone also saw:

```text
TYPECHECK
src/App.tsx(330,54): error TS2345:
Argument of type 'string' is not assignable to parameter of type 'Book'.
```

Facts only — no advice, no Error Memory.

```text
CONTROL:   Dune → editDraft/DOM/debug/VERIFY loop… → notice book.id @15 → PASS @17
TREATMENT: Dune + TS2345 → identify @3 → fix @4 → PASS @5
```

Savings compound from **eliminating agent-loop turns** (cache-read dropped ~82%, output ~74%) — not merely “Pi talked less.”

## Why the feature is conservative enough to KEEP

- Only after VERIFY **FAIL**; PASS unchanged  
- Only real `tsc` errors; capped at 12 diagnostics  
- Facts, not repair advice  

## Caveat (does not invalidate KEEP)

Both arms recorded `status: "partial"` despite journeys/Vitest/build/dev green and `pi_exit_code: 0`. Same condition both arms — forensics use green@call / verify sequence, **not** `status == success`. Reporting-semantic cleanup is separate.

## Toy seed

Invalid for behavioral KEEP (answer-key comments). Mechanism-only.

## Code

`solution/extensions/verify-typecheck-on-fail-core.ts`  
Fixture: `fixtures/verify-typecheck-257k-hard` (from `2026-09-04T09-25-09-799Z` + `startEdit(book.id)`)
