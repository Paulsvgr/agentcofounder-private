# Audit: repair tails for `rtl_text` and `rtl_multiple`

**Status:** COMPLETE — forensics + next fix **implemented** as `VERIFY_RTL_MULTIPLE_EVIDENCE_V1` (offline proof; cohort deferred)  
**Prereg:** [experiment-verify-rtl-multiple-evidence-v1-preregistration.md](./experiment-verify-rtl-multiple-evidence-v1-preregistration.md)  
**Date:** 2026-09-04  
**Raw extract:** `artifacts/forensic/repair-tail-rtl-text-multiple.raw.json`  
**Prior art:** [forensic-207k-verify-oracle.md](./forensic-207k-verify-oracle.md) (role+name truncate → KEEP `VERIFY_RTL_EVIDENCE_V1`)

## Question

> Is there factual information the harness already has, but throws away, that would let Pi distinguish cases immediately?

Not “how do we fix RTL text?” — whether another **truth-preserving mechanical** improvement exists, same class as role+name evidence.

## Historical volume (spot re-scan, 136 session runs)

| Family | Runs with family | ≥100k weighted | Median weighted |
|--------|-----------------:|---------------:|----------------:|
| `rtl_multiple` (text) | 73 | 32 | ~90k |
| `rtl_text` (miss) | 59 | 30 | ~100k |
| `rtl_multiple` (role) | 25 | 10 | ~92k |
| `rtl_role_name` | 22 | 16 | ~112k |
| import/runtime | 9 | 4 | ~99k |

Import/runtime is rare; existing root-error-first already surfaces module/resolve/`ReferenceError` headlines. **No new track** unless a later forensic shows a remaining gap.

---

## Smoking gun (shared mechanism)

Compact reporter `extractMatches()` in `app-template-base/compactFailureReporter.ts`:

```ts
const elementRe = /<[^>\n]{1,200}>/g;
```

Testing Library already prints full matching elements, e.g.:

```text
Here are the matching elements:

<option value="Fiction">Fiction</option>

<span class="badge">Fiction</span>
```

After prettyDOM line-breaks, the regex keeps only **tag tokens**. Proven offline:

```text
input:  <option…>Fiction</option>  +  <span…>Fiction</span>
output: </option>  ,  </span>
```

So VERIFY’s `MATCHES` section for text/role multiples is **systematically destroyed** — the same class of bug as 12-line role-dump truncation for role+name.

For text **misses**, the same path dumps unrelated container tags (`<body>`, `</h1>`, `</p>`) and keeps RTL’s stock **advice** (“provide a function for your text matcher”), which is not a fact.

`VERIFY_RTL_EVIDENCE_V1` only rewrites **role+name misses**. Text miss and multiple-elements still use legacy line-count + broken `MATCHES`.

---

## Selected forensics

Diverse expensive runs (not only absolute worst; avoid centering Error Memory outliers).

### A. `rtl_text`

#### A1 — Empty / split copy · `2026-09-02T22-27-48-249Z`

221k · 41 calls · green@39 · arm `tail-sweep-v1`

```text
FAIL @12  2/6
VERIFY: Unable to find text "Your library is empty."
        + stock function-matcher tip
        MATCHES: <body> <div> <h1> </h1> </span> </p>   ← useless
Product fact (already in tree): 
  "Your library is empty. Click <strong>+ Add a book</strong> …"
  (full string lives on parent; exact getByText misses)

Pi: "broken up by <strong>" → regex TEST_FIX
→ @14 better (5/6)

FAIL @14  text /Lent to.*Dad/
MATCHES still body junk → function matcher TEST_FIX
→ @16 same score (different remaining fail)

FAIL @27–36  /On shelf/i still missing
MATCHES still body junk → misread as matcher issue
→ eventually PRODUCT_FIX (onReturn id wiring) + more TEST_FIX
→ green @39
```

| Cycle | Class | Notes |
|-------|-------|-------|
| @12→14 | **TEST_FIX** | Correct; harness never showed parent textContent |
| @14→16 | **TEST_FIX** | Split borrower markup |
| @27→39 | **PRODUCT_FIX** + **NO_PROGRESS** | Real callback bug; matcher tip + empty MATCHES delayed finding it |

**Thrown away:** actual empty-state / status strings sitting in the DOM dump RTL already had.

---

#### A2 — Wrong book under filter · `2026-09-02T07-55-36-143Z`

207k · 27 calls · green@21 · arm `q2-early-verify-v1`

```text
FAIL @12  12/13
VERIFY: Unable to find text "Lent Book."
        function-matcher tip
        MATCHES: </span> </div> </button> </li> </ul>
        (container dump starts showing <ul aria-label="Book list"> then truncated)

Pi: assumes split text / wrong list → classList function matcher
→ FAIL @15 SAME miss (function printed as “text”)
→ bash archaeology → realizes prepend order; wrong Lend-out index
→ TEST_FIX click the correct row
→ green @21
```

| Cycle | Class | Notes |
|-------|-------|-------|
| @12→15 | **NO_PROGRESS** | Tip steered to function matcher; title was fine |
| @15→21 | **TEST_FIX** + **USEFUL_DIAGNOSTIC** | Order bug; ~30k after knowable point |

**Thrown away:** which titles **were** present in the list (dump started, then MATCHES replaced useful content with closing tags). Distinguishes “absent” vs “wrong row lent” vs “split text.”

---

#### A3 — Count/copy grammar · `2026-09-02T16-21-29-036Z`

149k · 17 calls · green@14 · arm `ss2-scope-sequence-v2`

```text
FAIL @11  4/8
TEXT: "1 are currently lent out." / "1 books on the shelf."
MULTI: role button name "Lend out"
MATCHES: body/h1 junk + </button>

Product (authored earlier):
  `${n} ${n===1?"is":"are"} currently lent out`  → "1 is …"
  `${n} ${n===1?"book":"books"} on the shelf`   → "1 book …"

Pi reads source → TEST_FIX grammar + scoped Lend out
→ green @14 in 3 calls (~46k cycle — mostly read/edit size)
```

| Cycle | Class | Notes |
|-------|-------|-------|
| @11→14 | **TEST_FIX** | Copy mismatch + multi button; no WRONG_PRODUCT |

**Thrown away:** visible header strings that would show `is` vs expected `are` without opening `App.tsx`.

**Realities under `rtl_text` (confirmed):**

| Reality | Example | Right move |
|---------|---------|------------|
| Exact string vs parent textContent | empty-state sentence | TEST_FIX (regex / weaker matcher) or accept product sentence |
| Copy/grammar drift | is/are, book/books | TEST_FIX (usually) |
| Element present, wrong query scope / wrong row | “Lent Book” after wrong lend | TEST_FIX interaction |
| Genuinely absent / broken handler | “On shelf” until onReturn fixed | PRODUCT_FIX |
| Split across elements | Lent to **Dad** | TEST_FIX matcher |

Harness today cannot tell these apart from VERIFY alone.

---

### B. `rtl_multiple`

#### B1 — Fiction + Lend out spiral · `2026-09-03T10-32-16-577Z`

177k · 45 calls · green@41 · arm `css-persistence-v1`

```text
FAIL @10  13/17
MULTI text "Fiction"     MATCHES: </option> </span> …
MULTI role "Lend out"    MATCHES: </button> …
MULTI text "Title"       MATCHES: body junk

Pi: rewrite tests with within() + UNIQUE product placeholders (edit form)
→ @14 still Lend out multi (15/17)

FAIL @14–32  same "Lend out" multi, score stuck 15/17
MATCHES always: </button> + page chrome tags
→ findBookItem rewrites × many (NO_PROGRESS)
→ bash debug attempts
→ @35 WRONG_PRODUCT: rename form submit "Lend out" → "Confirm loan"
→ test updates → green @41
```

| Cycle | Class | Notes |
|-------|-------|-------|
| @10→14 | **TEST_FIX** + light product placeholder | Partial; Fiction/Title cleared |
| @14→35 | **NO_PROGRESS** (~5 VERIFY stalls) | within() archaeology without candidate identity |
| @35→41 | **WRONG_PRODUCT** + **TEST_FIX** | Renamed valid “Lend out” submit to uniquify |

**Thrown away:** for Fiction, the two matching elements **are** option vs span — already in RTL’s matching-elements dump. For Lend out, N buttons with row context — dump exists, MATCHES keeps one `</button>`.

---

#### B2 — Novel option vs badge · `2026-09-02T09-33-44-044Z`

213k total (mostly later journey growth) · multi fail short · arm `q2-harness-owned-test-structure-v1`

```text
FAIL @12  0/1
MULTI text "Novel"
MATCHES: </option> </span> …

Pi (lucky, 1 call): option + badge collision → within(listitem)
→ TEST_FIX → green that test @14
```

| Cycle | Class | Notes |
|-------|-------|-------|
| @12→14 | **TEST_FIX** | Correct in 2 calls; tags barely hinted option/span |

**Counterfactual:** structured candidates would make this immediate without relying on Pi noticing `</option>`.

---

#### B3 — Science option vs badge · `2026-09-03T19-22-51-374Z`

145k · green@27 · arm `root-error-first-v1-1`

```text
FAIL @25  14/15
MULTI text "Science"
MATCHES: </option> </span> …

Pi: option + badge → scoped query TEST_FIX
→ green @27 (2 calls · ~6.5k)
```

Same structure as B2; short when Pi guesses right, expensive when it doesn’t (B1).

**Realities under `rtl_multiple` (confirmed):**

| Reality | Example | Right move |
|---------|---------|------------|
| Category in `<option>` + row badge | Fiction / Novel / Science | TEST_FIX scope (listitem / within) |
| N identical action buttons | “Lend out” per row | TEST_FIX getAll / within(row) |
| Form submit + row action same name | “Lend out” submit + row | TEST_FIX or intentional unique names — **product rename is a choice**, not forced |
| Label text duplicated | “Title” on add+edit | placeholders / within(form) |

---

## Import/runtime check

9 runs with import/runtime signatures in VERIFY. Spot checks show headlines already factual (`Failed to resolve import "./books"`, `vi is not defined`, `Cannot find module`). No evidence the compact reporter is stripping the root error the way it strips RTL candidates. **Park** — do not open a track.

---

## Answer to the key question

**Yes.** For `rtl_multiple`, Testing Library already emits matching-element dumps; the harness **throws them away** via `extractMatches`, leaving `</option>` / `</button>`. That is the same “facts discarded by compaction” failure mode as role+name — and it directly blocks distinguishing option-vs-badge vs N-row-buttons vs form+row collision.

For `rtl_text`, the miss path keeps a **non-factual matcher tip** and replaces useful container text with chrome tags, so Pi cannot tell copy-drift vs split vs absent vs wrong-row without reading source or burning diagnostics.

Role+name evidence (KEEP) does **not** cover these paths.

---

## Exactly one next fix

### `VERIFY_RTL_MULTIPLE_EVIDENCE_V1` — **IMPLEMENTED** (offline; cohort deferred)

See [experiment-verify-rtl-multiple-evidence-v1-preregistration.md](./experiment-verify-rtl-multiple-evidence-v1-preregistration.md).

**Scope:** When MESSAGE matches `Found multiple elements with the text…` or `Found multiple elements with the role … and name …`, and a `Here are the matching elements:` section exists:

1. Stop emitting tag-token `MATCHES` from `extractMatches` for that failure.
2. Emit **facts only**, e.g.:

```text
Found multiple elements with the text: Fiction

QUERY
text="Fiction"

MATCHES PRESENT
1. <option> text="Fiction"
2. <span> text="Fiction" class="badge"
```

Parent/near text beyond attributes in the dump is **not** invented. No “use within()” advice.

3. Toggle: `HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1` (default ON when unset).

**Why this one (not text-miss first):**

- Destruction is **proven** offline (`</option>`/`</span>` from a full Fiction dump).
- Short vs long repairs (B2/B3 vs B1) show the missing distinction is exactly candidate identity.
- Same mechanical class as KEEP role+name evidence — high confidence, no product judgment.
- Text-miss needs a second design (strip tip + surface nearby visible strings / closest textContent). Do that **after** multiples evidence lands; do not bundle.

**Out of scope for this fix:** Error Memory, cohorts until scheduled, prompt hints, teaching `within()`, renaming buttons in the template.

---

## Classification summary (audited cycles)

| Tag | Where seen |
|-----|------------|
| **TEST_FIX** | Dominant end-state for text miss + category multiples |
| **NO_PROGRESS** | Function-matcher chase (A2); findBookItem spiral (B1) |
| **WRONG_PRODUCT** | B1 rename “Lend out” → “Confirm loan” after evidence-starved stall |
| **PRODUCT_FIX** | A1 onReturn id bug (real) |
| **USEFUL_DIAGNOSTIC** | Rare; bash only when MATCHES empty |

---

## Next step (after this doc)

Offline proof for `VERIFY_RTL_MULTIPLE_EVIDENCE_V1` → decide KEEP vs scheduled cohort. No Error Memory, no `rtl_text` treatment, until multiples evidence is judged.
