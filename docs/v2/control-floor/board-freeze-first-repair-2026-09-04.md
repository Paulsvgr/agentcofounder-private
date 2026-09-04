# Board freeze: first-repair diagnosis (2026-09-04)

## Frozen diagnosis

One-shots are overwhelmingly **MULTIPLE**; expensive loops are **failed first oracle repairs** on TEXT / ROLE / journey-state TEST_BUGS.

| Cohort | n | Composition |
|--------|--:|-------------|
| ONE-SHOT | 39 | **95% MULTIPLE** |
| STILL-RED | 23 | **61% TEXT / ROLE / OTHER** |

- MULTIPLE evidence is doing its job → **KEEP** (do not add another VERIFY hint / reporter field).
- Expensive tails are **not** about choosing product vs test.
- They are Pi making a **bad first repair of its own test oracle**.

Failed first-repair modes (STILL-RED n=23): invented-copy partial 6 · off-target 5 · diagnosis-only 3 · partial scope 3 · rewrite/no-hunk/product-for-copy/ignored-state 6.

Sources: `measurement-first-test-repair-miss-2026-09-04.md`, `measurement-test-bug-vs-product-bug-2026-09-04.md`.

## Constraint on next direction

**Pi remains the exact required/spec version** — no changes to Pi internals, loop, tools, planner, or model.

Investigate **environment-side** test authoring only (template helpers). Analysis first: `design-test-helpers-addressable-still-red-2026-09-04.md`.
