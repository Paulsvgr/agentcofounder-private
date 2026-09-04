# Forensic: 207k VERIFY oracle inversion

**Status:** COMPLETE — evidence only; no treatment / prereg  
**Run:** `2026-09-03T20-49-19-219Z` (css-ab-persist-v1-a / Tailwind A′ rep 4)  
**Totals:** 207,193 weighted · 45 calls · first VERIFY @11 · first green VERIFY @34  
**Raw extract:** `artifacts/forensic/a4-207k-verify-oracle-cycles.raw.json`  
**Parent framing:** [next-lever-test-as-oracle.md](./next-lever-test-as-oracle.md)

## Setup (before FAIL #1)

| Call | Action |
|-----:|--------|
| 4–8 | Product: `books.ts`, `App.tsx`, dialogs, `styles.css` |
| 9–10 | Tests: `App.test.tsx` (10 journeys) |
| 11 | First canonical VERIFY → **0/10** |

Product button copy (authored @5): `+ Add book`  
Test query (authored @10): `getByRole("button", { name: "Add book" })`  
Exact accessible-name mismatch from the start.

---

## Causal chain (compressed)

```text
FAIL #1 @11 — 0/10
signature: getByRole(button, name="Add book") → TestingLibraryElementError
reporter MESSAGE shows only main + banner (12-line truncate) — no button names

→ C12 Pi: "toolbar isn't rendering" / crash after header
         ALSO briefly: accessible name should be "+ Add book"
         THEN discards + theory because dump shows "no buttons at all"
→ debug sidecar + blocked vitest bash
→ FAIL #2–4 unchanged (still 1/11 or 1/11; same signature)
→ more crash theories, reads App, debug asserts same bad name
→ FAIL #5 @26 — 0/11 same signature
→ C28 WRONG_PRODUCT: "+ Add book" → "Add book"  (valid UI copy sacrificed)
→ FAIL #6 @30 — 9/11 (name mismatch gone; 2 split-text test bugs remain)
→ C31–32 TEST_FIX assertions
→ PASS @34 — 10/10
```

---

## Per-FAIL tables

Weighted Δ = cumulative at next VERIFY − cumulative at this FAIL.  
Class tags apply to **actions inside the cycle** (after FAIL, before next VERIFY).

### FAIL #1 → VERIFY @13

| Field | Value |
|-------|-------|
| Call | **11** |
| Score | **0/10** (10 failed) |
| Signature | `TestingLibraryElementError` @ `addBookThroughUI` · Unable to find role `"button"` name `"Add book"` |
| Reporter artifact | MESSAGE keeps first ~12 lines of roles dump → **only `main` + `banner`**; button `Name "+ Add book"` never shown |
| Pi diagnosis | Product/render: toolbar not rendering / crash after header. Briefly considers `+` name, then rejects it because “no buttons at all” |
| Next edits | **No App/test product fix.** Bash heredoc → `debug.test.tsx` (DIAGNOSTIC) |
| Product damage? | No (yet) |
| Next VERIFY | **Better count only** (1/11 — debug file counted as pass); **same** App failures (10) |
| Cost | **2 calls · ~15.9k** (cum 66.8k → 82.7k) |

| Call | Action | Class |
|-----:|--------|-------|
| 12 | Misread truncated dump as missing toolbar; almost-correct `+` insight discarded; start debug | **NO_PROGRESS** (wrong branch) + aborted **DIAGNOSTIC** |

---

### FAIL #2 → VERIFY @19

| Field | Value |
|-------|-------|
| Call | **13** |
| Score | **1/11** (10 failed) |
| Signature | **Identical** name `"Add book"` |
| Pi diagnosis | Need DOM / debug output (still assuming render failure) |
| Next edits | Blocked piped vitest ×2; rewrite `debug.test.tsx`; blocked node+vitest; edit debug |
| Product damage? | No |
| Next VERIFY | **Same** 1/11 |
| Cost | **6 calls · ~18.0k** (82.7k → 100.7k) |

| Call | Action | Class |
|-----:|--------|-------|
| 14–15 | Piped vitest (blocked) | **NO_PROGRESS** |
| 16–18 | Debug test iterations / blocked exec | **DIAGNOSTIC** (no new info reaching Pi — compact reporter swallows `console.log`) |

---

### FAIL #3 → VERIFY @22

| Field | Value |
|-------|-------|
| Call | **19** |
| Score | **1/11** |
| Signature | **Identical** |
| Pi diagnosis | Runtime crash after header; dual `useState` import / store init theories |
| Next edits | `tsc` check; rewrite debug to list buttons |
| Product damage? | No |
| Next VERIFY | **Same** 1/11 |
| Cost | **3 calls · ~10.6k** (100.7k → 111.3k) |

| Call | Action | Class |
|-----:|--------|-------|
| 20 | Wrong crash/import theory | **NO_PROGRESS** |
| 20 | `tsc` (clean) | **DIAGNOSTIC** |
| 21 | Debug lists buttons (console still suppressed) | **DIAGNOSTIC** |

---

### FAIL #4 → VERIFY @26

| Field | Value |
|-------|-------|
| Call | **22** |
| Score | **1/11** |
| Signature | **Identical** |
| Pi diagnosis | Still “only header renders”; import placement / error boundary theories |
| Next edits | **Read** `App.tsx` ×2; rewrite debug to `getByRole(..., "Add book")` |
| Product damage? | No |
| Next VERIFY | **Worse** 0/11 (debug now fails same way → 11 failed) |
| Cost | **4 calls · ~19.8k** (111.3k → 131.1k) |

| Call | Action | Class |
|-----:|--------|-------|
| 23–24 | Read App (structure fine) | **DIAGNOSTIC** |
| 23–25 | Crash theories despite clean App | **NO_PROGRESS** |
| 25 | Debug asserts exact `"Add book"` | **DIAGNOSTIC** (makes failure visible on debug file; still wrong target) |

---

### FAIL #5 → VERIFY @30  ← collapse trigger

| Field | Value |
|-------|-------|
| Call | **26** |
| Score | **0/11** |
| Signature | **Identical** (now on App + debug) |
| Pi diagnosis | Still crash theories → finally reconsider: name is `"+ Add book"` not `"Add book"` |
| Next edits | **`App.tsx`:** `+ Add book` → `Add book`; more debug |
| Product damage? | **Yes** — removed intentional `+` prefix to satisfy exact name query |
| Next VERIFY | **Much better** **9/11** (2 remaining = split-text assertions) |
| Cost | **4 calls · ~19.4k** (131.1k → 150.4k) |

| Call | Action | Class |
|-----:|--------|-------|
| 27 | Crash theories after debug also fails | **NO_PROGRESS** |
| 28 | Strip `+` from product button label | **WRONG_PRODUCT** |
| 29 | Debug empty-state checks | **DIAGNOSTIC** |

---

### FAIL #6 → VERIFY @34 (green)

| Field | Value |
|-------|-------|
| Call | **30** |
| Score | **9/11** (2 failed) |
| Signatures | (1) `getByText("1 lent out")` — text split across `<strong>` + node; (2) `getByText("Correct Author")` — actual text `by Correct Author` |
| Pi diagnosis | **Correct:** test matchers wrong for split / prefixed text |
| Next edits | **Test only** — function matcher + regex; delete debug |
| Product damage? | No |
| Next VERIFY | **PASS 10/10** |
| Cost | **4 calls · ~15.2k** (150.4k → 165.6k) |

| Call | Action | Class |
|-----:|--------|-------|
| 31–32 | Fix brittle text queries | **TEST_FIX** |
| 33 | Remove debug sidecar | **DIAGNOSTIC** (cleanup) |

**No `PRODUCT_FIX` anywhere in FAIL#1–#6.** The only product edit in the repair window was **WRONG_PRODUCT**.

---

## Cost map

| Window | Calls | Weighted |
|--------|------:|---------:|
| Pre–first VERIFY (≤11) | 11 | ~66.8k |
| FAIL#1→green (11→34) | 23 | **~98.9k** |
| After C12 `+` insight discarded → green | 22 | **~86.5k** |
| C12→C28 until WRONG_PRODUCT | 16 | **~61.1k** |
| Post-green (35–45) | 11 | ~41.6k |
| **Run total** | 45 | **207.2k** |

Class mix in repair window ( qualitatively): heavy **NO_PROGRESS** + futile **DIAGNOSTIC**, one **WRONG_PRODUCT**, then two **TEST_FIX**. Zero genuine product defects found.

---

## Answers to the four questions

### 1. At which FAIL could Pi first have known the test—not the product—was wrong?

**FAIL #1 (call 11→12).**

Evidence already present:

- Test demanded name `"Add book"`.
- Product (written by Pi @5) rendered `+ Add book`.
- At **C12** Pi literally stated: *“the accessible name should be `+ Add book`”* — then abandoned it because the **truncated roles dump** showed no buttons.

So the test-vs-product mismatch was knowable immediately; the harness report actively steered Pi away from it.

### 2. How many calls/tokens were burned after that point?

From end of C12 (cum ~79.2k) to first green @34 (cum ~165.6k):

- **22 calls**
- **~86.5k weighted**

(If measured from FAIL #1 @11: **23 calls · ~98.9k**.)

### 3. How many product edits were caused by bad test assumptions?

**One** in the repair spiral: C28 stripping `+` from the Add button (**WRONG_PRODUCT**).

Post-green App edits (C37–41 import/export cleanup) are unrelated hygiene after PASS — not counted as oracle damage.

### 4. What smallest harness intervention would have prevented this exact spiral without coaching Pi broadly?

**Fix compact FAIL reporting for `getByRole` / accessible-name misses** so the MESSAGE retains **role + `Name "..."` lines for the queried role** (here: `button` → `Name "+ Add book"`), instead of the first 12 lines of the roles dump (which stop at `banner`).

Proven mechanism in `app-template/compactFailureReporter.ts` → `primaryMessage()`:

```text
.slice(0, 12)  // cuts mid-header; hides later button names
```

Reproduction: same RTL dump with `Name "+ Add book"` under `button:` → primaryMessage output contains **no** `+ Add` and looks like “only main/banner exist.”

That single report defect is what turned a one-line **TEST_FIX** (`name: /Add book/` or `/\+?\s*Add book/`) into a ~87k crash-hunt + **WRONG_PRODUCT**.

Not required for *this* spiral: Error Memory, repair-first prompts, authoring guards, or product-freeze windows.

---

## What class distribution implies for the next causal target

| Class | Role in this run |
|-------|------------------|
| **NO_PROGRESS** | Dominant early — same FAIL signature repeated while theories wander |
| **DIAGNOSTIC** | Much of it **information-starved** (console suppressed; roles truncated) |
| **WRONG_PRODUCT** | Single decisive bad edit after long thrash |
| **TEST_FIX** | Only after product was bent; FAIL #6 done correctly |
| **PRODUCT_FIX** | **Absent** |

For **this** failure mode, the primary causal target is **failure reporting** (misleading evidence → wrong diagnosis), not broader test-vs-product coaching and not repeated-no-progress detection alone (though no-progress was the symptom).

Secondary (would have helped after reporting is fixed, or if Pi still chased product): make exact `name: "…"` vs nearby accessible name an explicit **test-side** signal — still reporting-shaped, not prompt-shaped.

---

## Non-claims

- Does not claim every expensive run is this truncate→crash-hunt pattern.
- Does not select or preregister a treatment.
- Does not authorize Error Memory or re-running Q2-B/C/D.
