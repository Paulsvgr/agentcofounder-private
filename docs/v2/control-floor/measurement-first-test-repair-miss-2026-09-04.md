# Measurement: first TEST_BUG repair — one-shot vs still-red (2026-09-04)

**Status:** MEASURED  
**Question:** Among **TEST_BUG** first fails, what distinguishes repairs that go **green on the next VERIFY** from those that stay **red** (and often become vf≥3 tails)?

**Prior:** Expensive tails ≈64% TEST_BUG; one-shots ≈87% TEST_BUG (`measurement-test-bug-vs-product-bug-2026-09-04.md`). Product-vs-test locus is settled — this is the remaining mechanism.

---

## Sample

From the prior labeled set, keep **TEST_BUG** only:

| Cohort | n | Definition |
|--------|--:|------------|
| **ONE-SHOT** | **39** | First fail → edit(s) → next VERIFY **PASS** |
| **STILL-RED** | **23** | First fail → edit(s) → next VERIFY still **FAIL** (includes most expensive TEST_BUG tails) |

---

## Headline (strongest split)

| First-fail class | ONE-SHOT (n=39) | STILL-RED (n=23) |
|------------------|----------------:|-----------------:|
| **MULTIPLE** | **37 (95%)** | 9 (39%) |
| TEXT_MISS | 2 (5%) | **9 (39%)** |
| ROLE_NAME_MISS | 0 | 2 (9%) |
| OTHER | 0 | 3 (13%) |

**One-shot TEST_BUG repairs are almost entirely MULTIPLE.**  
**Still-red TEST_BUG repairs are mostly TEXT_MISS / ROLE_NAME_MISS / OTHER** (copy, split text, wrong journey state) — with MULTIPLE a minority that was fixed incompletely.

Locus of the first repair (both cohorts mostly test-only): one-shot test 31 / both 7 / prod 1; still-red test 19 / both 2 / prod 2.

---

## What one-shots do (success modes)

Manual pattern on the ONE-SHOT pack — dominant successful first repair:

| Success mode | Typical edit | Approx share of one-shots |
|--------------|--------------|---------------------------|
| **SCOPE_FIX** | `within(row\|listitem\|form)`, `closest("li")`, summary `getByLabelText` | **~70%+** (nearly all MULTIPLE) |
| **DISAMBIGUATE** | category `selector: "span.…"`, `getByRole("heading")`, tighter button name `/^Cancel$/` | common secondary |
| **PARENT_TEXT** | `toHaveTextContent` on summary / parent instead of child `getByText` for split nodes | the 2 TEXT_MISS one-shots |

These are **local, on-primary-failure** edits: they change the failing query, then VERIFY passes.

---

## What still-red first repairs do wrong (miss modes)

Closed taxonomy for the **23** STILL-RED first repairs (one primary miss mode each):

| Miss mode | n | Meaning |
|-----------|--:|---------|
| **OFF_TARGET** | 5 | Edited a *different* assert/test than the primary FAIL (e.g. soften Fiction while primary is `Save changes` MULTIPLE; Hobbit path while primary is another title) |
| **INVENTED_COPY_PARTIAL** | 6 | Softened regex / scoped container but **kept wrong expected wording** (`2 total books`, `/out with someone/`, empty-state invent) — still misses real DOM |
| **PARTIAL_SCOPE** | 3 | Added `within` for one step but primary query unfixed or another fail remains in same VERIFY |
| **DIAGNOSIS_ONLY** | 3 | `debug.test.tsx` / recon only — **no** material fix to the failing App journey assert |
| **WRONG_STATE_IGNORED** | 1 | COMPLETE PRESENT shows already-lent buttons; still chasing `Lend out` (`14-48-25`) |
| **PRODUCT_FOR_COPY** | 1 | Edited product markup for a TEXT_MISS invent (`14-37-34`) instead of fixing the oracle |
| **FULL_REWRITE_MISS** | 2 | Large/full test rewrite; next VERIFY still red |
| **NO_MATERIAL_HUNK** | 2 | First-repair window had no usable App.test hunk against the primary fail |

### Examples

| Run | Miss mode | First repair in one line |
|-----|-----------|--------------------------|
| `10-24-10` | OFF_TARGET | Softens Fiction / empty-state; primary was MULTIPLE `Save changes` |
| `09-25-09` | INVENTED_COPY_PARTIAL | Scopes to summary label but still expects `"2 total books"` |
| `07-43-23` | INVENTED_COPY_PARTIAL | `/1 is out with someone/` → `/out with someone/` (still invented) |
| `19-22-51`, `23-25-12` | DIAGNOSIS_ONLY | Only `debug.test.tsx` writes |
| `14-48-25` | WRONG_STATE_IGNORED | PRESENT = Mark returned/Edit/Remove; chase `Lend out` |
| `14-37-34` | PRODUCT_FOR_COPY | Tweaks `<strong>` / author spans for `"2 books total"` miss |
| `10-38-48` | PARTIAL_SCOPE | `within` on Lend out; primary was `"1 book total"` text miss |

---

## Mechanism (why loops happen)

```text
TEST_BUG first FAIL
  ├─ MULTIPLE / ambiguous selector
  │     └─ first repair = SCOPE_FIX  → usually ONE-SHOT (95% of one-shots)
  └─ TEXT_MISS / ROLE_NAME_MISS / wrong journey / invented copy
        └─ first repair = soft regex | debug dump | off-target edit | ignore PRESENT
              → STILL RED → another VERIFY → expensive vf tail
```

So the expensive path is **not** “Pi forgot to edit the test.” It is:

> **First repair fails to correct the primary oracle** — especially when the disease is **copy / split text / journey state**, not mere missing `within`.

MULTIPLE evidence + scoping is a **solved enough** first-repair pattern.  
COPY / state TEST_BUGS still burn cycles because the first edit is **partial, off-target, diagnostic, or invents a new wrong string**.

---

## Link to cost model

- Cost ≈ calls × ~4.6k; expensive ≈ many VERIFY after first FAIL.
- ONE-SHOT ⇒ repair window ≈ **1 VERIFY fail** (cheap).
- STILL-RED ⇒ at least **2** fails before any progress; TEST_BUG tails often vf 3–8+.
- Attributable lever is **raising first-repair hit rate on non-MULTIPLE TEST_BUG**, not more product scaffolding.

---

## Verdict

1. **MULTIPLE TEST_BUG ≈ one-shot disease** when Pi scopes — KEEP MULTIPLE evidence is earning its keep.
2. **Still-red / expensive TEST_BUG ≈ failed first oracle repair** on TEXT/ROLE/journey — miss modes: **off-target, invented-copy partial, diagnosis-only, ignore PRESENT state**.
3. **Do not** add a broad “always edit tests” rule (already true).
4. **Next experiment (if any)** must target **first-repair quality on COPY/state misses** (use PRESENT / visible text already in FAIL; fix the primary assert; no debug sidecar as the only move) — falsifiable on still-red rate after first repair, not on eventual green.

---

## What this does *not* authorize yet

- Auto-mutating tests in the harness  
- Another AGENTS one-liner  
- Salience footer (already KILL)  
- Wrong-locus / product locks  

Measure or probe only a **narrow** first-repair assist for COPY/state TEST_BUG if we choose to intervene.
