# Offline: 257k `startEdit(book.id)` — which signal exposes the bug?

**Canonical run:** `2026-09-04T09-25-09-799Z` (verify-rtl-multiple-evidence-v1-treatment rep2, ~257k)  
**Date:** 2026-09-04  
**Status:** **KEEP** — hard 257k seed proved behavioral value (`verify-typecheck-on-fail-v1`)

## Failure chain (historical)

```text
VERIFY: Unable to find an element with the display value: Dune.
→ Pi: React / userEvent / timing / stale DOM / debug sidecars
→ eventually: startEdit(book.id) → startEdit(book)
→ green, then ~29k post-green polish
```

Product had:

```ts
function startEdit(book: Book) { ... }
// ...
onClick={() => startEdit(book.id)}  // string ≠ Book
```

## Offline repro

Minimal typed App with the same mismatch → `npx tsc --noEmit`:

```text
src/App.tsx(24,62): error TS2345: Argument of type 'string' is not assignable to parameter of type 'Book'.
```

After `startEdit(book)`: tsc clean.

VERIFY/`npm test` alone never emits that line — only the display-value miss.

## Decision

**Treatment = one factual typecheck signal on VERIFY FAIL** (when tsc fails), not `rg`, not Error Memory, not advice.

Next step: build sealed fixture from this bug + seeded control/treatment Pi repair (same pattern as MULTIPLE seed).
