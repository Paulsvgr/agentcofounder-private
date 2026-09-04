# Measurement: natural wrong-locus after COMPLETE evidence (2026-09-04)

**Status:** **DROP direction** — premise falsified on natural corpus  
**Question:** After a COMPLETE-evidence VERIFY fail, how often does Pi change **product** (and not the failing test) to reach green — and how often is that **WRONG LOCUS** (test was wrong; product deformed)?

---

## Method

- Natural bookshelf runs only (`idea.txt` starts with the family-lending prompt). **n=313** with `events.jsonl`.
- Eligible failure: VERIFY FAIL whose compact (or legacy) message already has enough evidence — structured `QUERIED` + `* PRESENT`, **or** legacy full `Here are the accessible roles:` dump. **n=90**.
- Candidate detector (not a verdict): before the next green, Pi edits product and does **not** edit the failing test file.
- Manual labels: **PRODUCT BUG** | **TEST BUG / WRONG LOCUS** | **AMBIGUOUS**.

Seeded Dune probe (`20-10-31`, `setFilter("all")` on return) is **out of corpus** — fixture framing (“do not reinvent the product”) biases locus.

---

## Results

| Metric | Value |
|--------|------:|
| Natural runs | 313 |
| Eligible COMPLETE-evidence failures | **90** (74 ROLE_NAME_MISS, 16 MULTIPLE) |
| Product-before-green, failing test untouched | **4** windows / **3** unique runs (~4% of eligible) |
| Judged **WRONG LOCUS** | **0** |
| Attributable wrong-locus cost | **0** |

### Manual classification (all 3 unique runs)

| Run | Fail | Product edit | Label |
|-----|------|--------------|-------|
| `2026-09-01T08-26-55-487Z` | journey / lend path | `add(fields)` → `add({ ...fields, borrower: null })` | **PRODUCT BUG** |
| `2026-09-03T23-25-12-555Z` | missing form label | add accessible label in `App.tsx` | **PRODUCT BUG** (matches AGENTS a11y contract) |
| `2026-09-04T14-40-05-738Z` | `list` / `Book list` miss | move `aria-label="Book list"` onto `<ul>` | **PRODUCT BUG** |

---

## Context: natural repair locus is the opposite of Dune

Across **354** FAIL→VERIFY windows (all natural, not evidence-gated):

| Locus before next VERIFY | Share |
|--------------------------|------:|
| test-only | **74%** |
| both | 15% |
| product-only | 7% |
| no-edit | 4% |

Pi overwhelmingly edits **its own tests**. The Dune seeded repair idea + “product already built” framing manufactured the product-surgery path; it does **not** generalize to ship.

---

## Verdict

**Drop wrong-locus / behavior-contract interventions aimed at “Pi trusts bad tests and deforms product.”**

Natural wrong-locus base rate after COMPLETE-evidence fails: **0/90**.

Residual (separate question): when Pi *does* edit tests, how often does it **weaken** coverage — see `measurement-test-weakening-2026-09-04.md`.
