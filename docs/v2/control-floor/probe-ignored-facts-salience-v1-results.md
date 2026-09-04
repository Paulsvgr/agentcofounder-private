# Probe: IGNORED_FACTS salience footer v1 — RESULTS

**ID:** `ignored-facts-salience-probe-v1`  
**Clean run:** `2026-09-04T20-10-31-876Z`  
**Verdict:** **KILL**

Prior run `2026-09-04T19-47-53-063Z` remains **VOID** (`SEED_META.json` leak).

---

## Hygiene (clean run)

| Check | Result |
|-------|--------|
| Prepare-only: no `SEED_META.json` / `repair-idea.txt` in `output/app` | Pass |
| Mid-run / snapshot: no `SEED_META` | Pass |
| Pi read `SEED_META`? | **No** |
| Other confound? | **No** → run is **VALID** |

---

## Treatment

Ship KEEP + `HARNESS_VERIFY_REPAIR_PRESENT_HINT_V1=1`

V0 FAIL (footer fired):

```text
QUERIED role="heading" name="Dune"
HEADINGS PRESENT
- "My Bookshelf"
REPAIR: use QUERIED vs PRESENT …
```

---

## Judgment (evidence-use, not green)

| Criterion | Result |
|-----------|--------|
| Treatment activated | **Yes** |
| Fixed **test** using PRESENT / state-filter sequence | **No** — `App.test.tsx` **identical** to fixture |
| Invented product behavior | **Yes** — sole product edit: |
| | `onReturn` → `update(…); setFilter("all")` |
| Diagnosis spiral | **Yes** — `debug.test.tsx`, blocked direct vitest, store recon |
| Green as evidence | **Ignore** — V1 PASS only after wrong product fix (~96k, 16 calls, vf=1) |

**KILL:** Pi had QUERIED vs PRESENT + REPAIR line and still overruled evidence, widened into product, did not repair the broken test locus.

Same wrong product patch as the voided run — now **without** `SEED_META` coaching. Footer did not cause correct-locus repair.

---

## One-line claim (falsified)

> Co-locating one REPAIR line with PRESENT does **not** make Pi drop/fix an absent QUERIED by fixing the test on this seeded IGNORED_FACTS fail.

---

## Follow-up

Drop salience-footer-only (`HARNESS_VERIFY_REPAIR_PRESENT_HINT_V1` stays default OFF).  
No cohort. Next IGNORED_FACTS idea needs a different lever (not more inventory / AGENTS one-liners / this footer).
