# Probe: IGNORED_FACTS salience footer v1

**ID:** `ignored-facts-salience-probe-v1`  
**Status:** **KILL** on clean GO `2026-09-04T20-10-31-876Z` (void prior: `19-47-53`)  
**Goal:** Test whether Pi can be made to **use VERIFY facts it already has**, without adding facts.

---

## One causal change

When compact VERIFY FAIL already includes a `* PRESENT` inventory block, append **exactly one footer line** to that FAIL tool result:

```text
REPAIR: use QUERIED vs PRESENT to diagnose the current failure; don't repeat a query for a name absent from the current PRESENT evidence without changing the relevant UI state.
```

| | |
|--|--|
| **Is** | Salience / instruction co-located with existing FAIL |
| **Is not** | New inventory, PRE_TEST, AST, AGENTS rewrite, hard gate, multi-line coaching |

Flag (probe only, default OFF): `HARNESS_VERIFY_REPAIR_PRESENT_HINT_V1=1`

Wording notes: avoids teaching a false universal (“absence from PRESENT ⇒ never query”). For this Dune fixture, current-PRESENT + no UI-state change is the right diagnosis.

---

## Why seeded (not natural)

Natural runs may never hit IGNORED_FACTS. Use the known D case:

**Fixture:** `fixtures/verify-test-context-dune-148k/`  
**Source:** `2026-09-04T14-48-25-378Z` — `Lend out` missing; BUTTONS PRESENT = `Mark returned`, `Edit`, `Remove`.

Historical ignored repair: import/filter churn; next VERIFY still `Lend out`.

---

## Exactly what behavior should change

On the **first model turn after that VERIFY FAIL**:

| | Required |
|--|----------|
| **PASS signal** | Repair removes or replaces the failing `Lend out` query using PRESENT (e.g. scope to already-lent / `Mark returned` / fix journey step) — **before** next VERIFY |
| **Or** | Next VERIFY no longer fails with `Unable to find … name "Lend out"` |

Secondary (report only): whether repair stays in `App.test.tsx` vs widens to product/imports.

---

## Kill condition (locked before run)

**KILL** if any of:

1. Next VERIFY still primary-fails on **`Lend out`** (same IGNORED_FACTS), **or**
2. First repair turn does **not** edit the failing lend assertion / step (only imports, filter regex, unrelated files), **or**
3. Clear widen: large product rewrite with lend query unchanged

**Do not KEEP** on “cheaper than 148k” alone — must show **evidence-use** on this sticky fail.

---

## Run shape

```text
ONE seeded repair continuation
TREATMENT: ship KEEP stack + HARNESS_VERIFY_REPAIR_PRESENT_HINT_V1=1
Script: scripts/run-probe-ignored-facts-salience-v1.sh
```

One run. If kill → stop. No cohort.

---

## One-line claim

> **Co-locating one REPAIR line with existing PRESENT inventory makes Pi drop absent QUERIED names on the Dune IGNORED_FACTS fail — or we kill it.**
