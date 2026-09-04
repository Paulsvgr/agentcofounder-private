# Measurement: first-VERIFY fail classes (PRE_TEST UI evidence gate)

**Status:** FROZEN (2026-09-04)  
**Purpose:** Gate whether `PRE_TEST_UI_EVIDENCE_V1` (UI facts before test authoring) is worth a cohort.  
**Corpus:** Natural bookshelf idea, **persist + Tailwind** stack (ship-like), **n = 38**.  
**Unit:** **Primary** failure on the **first** VERIFY FAIL only (first compact FAIL block). Runs with first VERIFY PASS → `NO_FAIL_FIRST`.

Related: [measurement-call-count-first-repair-2026-09-04.md](./measurement-call-count-first-repair-2026-09-04.md).

---

## Rubric (closed)

| Tag | Meaning |
|-----|---------|
| `COPY_NAME_MISS` | Test asserts copy / role name / label **not present** (or present with **different wording**). Invented oracle. |
| `MULTIPLE` | Element **exists** but query matches **>1** node (`Found multiple elements…`). Ambiguous selector / missing `within`. |
| `PRODUCT_OR_FLOW` | App state, missing behavior, syntax/runtime in product, or journey step vs UI mismatch (e.g. expects `Lend out` while only `Mark returned` is present). |
| `OTHER` | Typecheck, suite transform, fake RTL API (`getByPrompt`), unit-store assertions, harness/module errors. |
| `NO_FAIL_FIRST` | First VERIFY passed. |

**Not used:** final test-file size, post-repair outcome, whole-run cost as the classifier input.

---

## Headline

| Tag | Runs (n=38) | Share of runs | Share of first fails (n=32) |
|-----|------------:|--------------:|----------------------------:|
| `MULTIPLE` | 14 | 37% | **44%** |
| `COPY_NAME_MISS` | 7 | 18% | **22%** |
| `OTHER` | 7 | 18% | 22% |
| `NO_FAIL_FIRST` | 6 | 16% | — |
| `PRODUCT_OR_FLOW` | 4 | 11% | 13% |

**Ship-keep-full-green only (n=10):** among 9 first fails → `COPY_NAME_MISS` 3, `MULTIPLE` 3, `PRODUCT_OR_FLOW` 2, `OTHER` 1.

---

## Gate verdict

**Conditional GO for PRE_TEST UI evidence — narrowed claim.**

1. **`COPY_NAME_MISS` is real and material** (~1/5 of first fails on ship-like stack; ~1/3 on the 10 ship-keep runs). Enough **not** to dismiss approach A.
2. **It is not the dominant first-fail class.** **`MULTIPLE` is #1 (~44% of fails).** Empty-page UI facts do **not** fix ambiguous queries.
3. **Empty-only snapshot is incomplete for the motivating example.** Several `COPY_NAME_MISS` cases are **post-action** count/borrower wording (`2 books total`, `1 book in total`, `Borrower name for …`). An initial empty dump does not contain those strings. **Multi-state** (empty → after add → after lend) or code-extracted visible strings are required if that disease is the target.
4. **Ceiling:** even a perfect COPY fix only addresses ~22% of first-fail modes. Median cost still mostly tracks verify-fail **count** / first-repair quality.

**Do not promote A as “the” cost fix.** Promote it only as: *reduce invented copy/name oracles before first VERIFY*.

---

## `COPY_NAME_MISS` cases (all 7)

| Run | Weighted | Primary miss |
|-----|----------:|--------------|
| `2026-09-04T14-37-34-690Z` | 72k | Expects `2 books total`; visible split `books total` |
| `2026-09-04T07-22-42-694Z` | 75k | Expects `/1 book in total/` — not in DOM |
| `2026-09-04T07-12-40-958Z` | 77k | Invented list accessible name `Book list` |
| `2026-09-04T14-40-05-738Z` | 86k | Invented list accessible name `Book list` |
| `2026-09-03T23-25-12-555Z` | 104k | Invented label `Borrower name for …` |
| `2026-09-04T16-43-18-945Z` | 116k | Expects `/0 of 0 books/`; UI: `of 0 books currently lent out` + empty state |
| `2026-09-04T09-25-09-799Z` | 257k | Expects `2 total books`; received split `total books` |

**Empty-only PRE_TEST likely helps:** invented aria/`Book list`, empty-state invent (`0 of 0 books`).  
**Needs multi-state / richer facts:** post-add totals, borrower labels.

---

## What this means for experiment design

If running `PRE_TEST_UI_EVIDENCE_V1`:

```text
CONTROL = current ship stack
TREATMENT =
  gate: app renders, no product tests authored yet
  harness injects compact accessible UI facts
  then Pi writes tests → VERIFY
```

**Prereg must lock:**

- **Snapshot shape:** `empty-only` vs `multi-state` (empty → +1 book → lent). Prefer **multi-state** if targeting the count-copy disease.
- **Primary metric:** rate of first-fail `COPY_NAME_MISS` (should drop).  
- **Secondary:** vf-before-green, calls, weighted cost, quality.  
- **Non-goal:** fixing `MULTIPLE` (separate lever: locality / query discipline — not this experiment).
- **Facts only:** no `getByRole` coaching, no “don’t invent copy.”

**Park for now relative to A:** B (test contract steering), C (file split), E (phased tests). Revisit **MULTIPLE** as its own measurement if A’s COPY rate drops but median does not.

---

## Method notes

- Overlay filter: `persistence_primitive` ∧ `tailwind` (includes ship-keep and prior RTL/tailwind persist cohorts).
- First FAIL text from first `verify` tool `FAIL` in `events.jsonl`.
- Primary = first compact `FAIL` / `TEST` block (not “any secondary failure in the same VERIFY”).
- Tags assigned manually from queried vs PRESENT / message; frozen in this note.

---

## Feasibility freeze: how to get multi-state facts?

**Question (must answer before GO):** Can multi-state UI facts be obtained **generically** without (a) a bookshelf-scripted journey or (b) another LLM call?

### Empirical: no free piggyback on Pi “using the app”

On persist+tw natural runs (**n=40**), before the first product `*.test.*` write:

| Live interaction before first test | Count |
|------------------------------------|------:|
| `curl` localhost / port | **0** |
| `npm run dev` / vite serve | **0** |
| playwright / puppeteer | **0** |

Pi builds by **editing source**, then writes tests, then VERIFY. There is **no already-observed rendered multi-state trail** to capture and replay.

So “capture states Pi already produced while clicking the app” is **not available** on this stack.

### Options if we still want PRE_TEST facts

| Option | Generic? | Extra LLM? | Multi-state? | Verdict |
|--------|----------|------------|--------------|---------|
| Piggyback on Pi live UI ops | n/a | no | would be | **DEAD** — ops don’t happen |
| Hardcoded add/lend journey | **no** | no | yes | **STOP** — scaffold generalization fail |
| Second agent to operate/classify UI | yes-ish | **yes (~4.6k+)** | yes | **STOP** — same tax as killed planners |
| Harness **empty mount** only (jsdom render `<App />`) | yes | no | **no** | Weak vs gate (misses post-action COPY) |
| Minimal static extract (buttons/labels/aria/static sentences) | yes | no | no | **STOP after audit** — see § Source-recoverability (0/7 clear prevent) |
| Composition-aware AST (count/template patterns + aria role) | yes | no | partial patterns | **Parked** — only reopen with explicit prereg; not “minimal SOURCE UI FACTS” |

### Updated GO rule

```text
Rendered multi-state PRE_TEST     → STOP
Minimal SOURCE UI FACTS           → STOP (audit)
Composition-aware source patterns → PARKED (optional later prereg only)
```

**Keep out of scope:** `MULTIPLE` (separate 44% problem).

---

## Source-recoverability audit (COPY_NAME_MISS × 7)

**Question:** Of the 7 `COPY_NAME_MISS` first fails, how many could a **zero-call** source extractor have prevented, using product source **immediately before the first product test write**?

### Rubric

| Class | Meaning |
|-------|---------|
| `SOURCE_RECOVERABLE` | Correct button / label / aria / static empty copy is a literal (or fixed aria string) in source. |
| `PARTIALLY_RECOVERABLE` | Useful pieces exist (template / conditional / split JSX text) but full matched string needs composition or runtime data. |
| `RUNTIME_ONLY` | Only data-dependent rendered wording; no useful static/template pieces. |

### Per-case (replayed pre-test `App.tsx`)

| Run | Wrong expectation | Class | What source already had |
|-----|-------------------|-------|-------------------------|
| `14-37-34` | `2 books total` | **PARTIAL** | `{books.length}` + `"book"\|"books"` + `" total"` (split across nodes) |
| `07-22-42` | `/1 book in total/` | **PARTIAL** | same pattern with `" in total"` |
| `09-25-09` | `2 total books` | **PARTIAL** | `{books.length}` + literal `" total books"` in separate `<span>` |
| `16-43-18` | `/0 of 0 books/` | **PARTIAL** | `{lentCount} of {books.length} book(s) currently lent out` + empty `"No books yet…"` |
| `23-25-12` | `Borrower name for Salt Fat Acid Heat` | **PARTIAL** | `` aria-label={`Borrower name for ${book.title}`} `` (title is runtime) |
| `07-12-40` | list name `Book list` | **SOURCE**† | `<section aria-label="Book list">` — name real; fail is **role=list** pairing |
| `14-40-05` | list name `Book list` | **SOURCE**† | same — `<section aria-label="Book list">` |

† Re-tag note: these two are closer to **role mismatch on a real name** than “invented copy.” They stay in the COPY sample for continuity but weaken the “invented string” story.

**Counts:** SOURCE 2/7 · PARTIAL 5/7 · RUNTIME_ONLY **0/7**.

### Preventability under a realistic zero-call extractor

**Minimal dump** (button text, `<label>`, `aria-label` strings, static sentences only — no JSX composition, no coaching):

| Outcome | n | Why |
|---------|--:|-----|
| Clearly prevented | **0–1 / 7** | Count cases still invite `getByText("2 books total")`; digits aren’t in source. `Book list` cases already contain the string — fail is wrong **role**, which a flat aria list does not fix. Template case needs open lend UI + flexible matcher. |
| Addressable only with **composition-aware** AST | **5 / 7** | Emit patterns like `COUNT_COPY: "{n} book(s) total"` / `"{n} book(s) in total"` / `"… currently lent out"`. Still zero LLM, still generic — but a **different, harder** treatment than a string list. |

### Gate on SOURCE UI FACTS

```text
COPY_NAME_MISS bucket: 7 cases
RUNTIME_ONLY:            0
SOURCE static literals:  2 (but role-mismatch, not invent)
PARTIAL compose/template: 5  ← the real mass
```

**Verdict:**

1. **Do not build minimal SOURCE UI FACTS** (flat button/label/aria/static list). Addressable prevent share ≈ **0** on this sample — not worth a cohort.
2. **Do not claim “most COPY is runtime-only.”** It isn’t — it’s **split/conditional JSX composition** (PARTIAL).
3. **Only reopen** if someone preregisters a **composition-aware** extractor (explicit count/template patterns + element role for aria) with primary metric still `COPY_NAME_MISS` — and accepts that this is AST engineering, not “rendered UI.”
4. Default: **kill the entire pre-test-evidence direction** until that stronger design exists. Prefer separate work on **`MULTIPLE` (44%)** or first-repair quality.

---

## Final freeze (2026-09-04 evening)

**DROP** `PRE_TEST_UI_EVIDENCE` entirely (rendered multi-state **and** minimal source facts).

```text
Reason: 0/7 COPY_NAME_MISS clearly preventable by zero-call dump.
COPY mass = composed JSX / role semantics, not missing literals.
Do NOT jump to composition-aware AST (complexity ≫ n=7, unclear $).
```

**Next research question (not an experiment yet):**

> Why does first repair still fail on **`MULTIPLE`** first fails when RTL multiple evidence is already KEEP / on?

Keep causally separate from pre-test evidence.

---

## One-line decision

> **DROP all PRE_TEST UI evidence; next measure MULTIPLE first-repair miss rate despite shipped reporter.**
