# D1 — Assembler smoke separation

**Type:** resource pipeline (domain-neutral)

## Principle

> Everything verified by the assembler that Pi does not need to understand must **not** enter the Pi workspace.

## Problem

Experiment A v2 copied `src/resource-smoke/` into `app-template`. Pi's `npm test` ran **app + resource smokes** (e.g. 21 = 7 + 14). Pi read smoke tests as examples; harness counts mixed unrelated tests.

## Change

1. Resource smoke tests live in `resources/smoke/` (repo only).
2. Assembler runs smoke via `resources/smoke/vitest.config.ts` with `SMOKE_TEMPLATE_DIR` pointing at the assembled template **before** Pi starts.
3. `app-template` has **no** `src/resource-smoke/` and **no** `smoke:resources` npm script.
4. Pi's `npm test` runs **only** product journey tests Pi writes.

## Files

| File | Role |
|------|------|
| `resources/smoke/vitest.config.ts` | Smoke runner config; `@` → assembled template `src/` |
| `scripts/assemble-resources.ts` | `ensureNoResourceSmokeInTemplate`, external smoke gate |

## Applies to

Experiment B (`local-storage-collection`) and future pattern resources — same D1 rule.
