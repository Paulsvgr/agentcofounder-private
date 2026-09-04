# Results: factual TYPECHECK on VERIFY FAIL

**Status:** **KEEP CLOSED** — [keep doc](./experiment-verify-typecheck-on-fail-v1-keep.md)  
**Checkpoint:** `artifacts/exports/checkpoint-verify-typecheck-on-fail-keep-2026-09-04.zip`

Hard 1+1 (same fail, same one-line fix):

| | Control | Treatment |
|--|--|--|
| Weighted | 57,303 | **19,278** |
| Repair weighted | 49,434 | **14,508** |
| Correct fix / green | @15 / @17 | **@4 / @5** |

Locked claim: factual TS diagnostics shortened this 257k-class repair path. Magnitude is **this pair**, not a universal 67% harness saving.

Next lever: **hard-stop-after-green** (post-green tail), not more TYPECHECK reps.
