# Design analysis: template journey helpers vs STILL-RED (2026-09-04)

**Status:** READONLY analysis — **do not build yet**  
**Constraint:** Pi stays the exact required/spec version (no Pi internals / loop / tools / planner / model changes). Environment-side only.  
**Prior freeze:** `board-freeze-first-repair-2026-09-04.md`

## Idea under test

Preinstall a **deterministic journey helper API** in the app template so Pi can author tests with stable primitives instead of hand-rolled Testing Library selectors:

```ts
const dune = await addBook(user, { title: "Dune", author: "Frank Herbert", category: "Novel" });
await lendBook(user, dune, "Sarah");
await filterBooks(user, "lent");
expectBookVisible(dune); // or expectBookVisible("Dune")
expectSummary({ total: 1, lent: 1 });
```

Helpers own `within`, role/label lookup, row scoping, form fill, summary reads, etc.

**Adoption assumption (explicit):** addressability counts cases where the *journey would have been expressible via helpers at authoring time*. Helpers cannot force Pi to call them, and cannot stop a diagnosis-only first repair if Pi ignores them.

---

## 1. How many of 23 STILL-RED are structurally preventable?

| Bucket | n | Share of STILL-RED |
|--------|--:|-------------------:|
| **PREVENTABLE** (incremental vs MULTIPLE KEEP) | **10** | **43%** |
| **OVERLAP_MULTIPLE** (helpers help, but same disease one-shots already fix via `within`) | **8** | **35%** |
| **MIXED** (summary/empty contract + partial MULTIPLE) | **2** | **9%** |
| **SEMANTIC** (helpers cannot solve) | **3** | **13%** |

### Addressable shares (interpret carefully)

| Claim | Count | Notes |
|-------|------:|-------|
| Upper bound if helpers used + count OVERLAP+PREVENTABLE+MIXED | **20 / 23 ≈ 87%** | Inflated — 8 are already “solved shape” under KEEP MULTIPLE |
| **Incremental value of helpers** (PREVENTABLE only) | **10 / 23 ≈ 43%** | True new coverage beyond MULTIPLE scoping |
| PREVENTABLE + MIXED (optimistic incremental) | **12 / 23 ≈ 52%** | If `expectEmpty` / `expectSummary` contracts are frozen |
| Unaddressable by helpers | **3 / 23 ≈ 13%** | Semantic / diagnosis |

**Headline for go/no-go:** roughly **~40–50% of STILL-RED first repairs** are the *kind of failure* a small helper layer is designed for (copy/summary/state/testid invent + row text), **beyond** what MULTIPLE evidence already teaches for one-shots.

---

## 2. What helpers cannot solve (SEMANTIC)

| Run | Why not |
|-----|---------|
| `2026-09-01T23-28-52-670Z` | Authoring-guard / chrome heading policy — not bookshelf journey API |
| `2026-09-03T19-22-51-374Z` | First repair was **debug.test only**; helpers don’t block diagnosis spirals. Empty invent only helped if already using `expectEmpty` *and* Pi still repairs the primary file |
| `2026-09-03T23-25-12-555Z` | Invented `"Persists"` + debug-only repair — pure oracle invent + non-helper path |

Also **out of scope even when labeled PREVENTABLE:** mid-repair choices like “only write debug.test” or “edit product for copy” — helpers raise the odds of correct *authoring*, they don’t enforce repair discipline.

---

## 3. Smallest helper surface covering PREVENTABLE cases

One module, e.g. `src/test/bookshelfJourney.ts` (names illustrative):

| Helper | Prevents |
|--------|----------|
| `getBook(title)` → row | Unscoped title/category MULTIPLE; row handle for actions |
| `addBook(user, fields)` | Form label MULTIPLE; returns row |
| `lendBook(user, row, borrower)` | MULTIPLE `Lend out`; invented `data-testid`; wrong raw button chase mid-lend |
| `returnBook(user, row)` | State sequence after lend (`Mark returned` vs `Lend out`) |
| `editBook` / `removeBook` | Edit-form / Save / Remove scoping |
| `filterBooks(user, mode)` | Filter control naming |
| `expectBook(row \| title, { author? })` | Author/title **text split** across nodes (row `textContent` / roles) |
| `expectLentTo(row, borrower)` | `"Lent to X"` split / brittle exact strings |
| `expectSummary({ total?, lent? })` | **Invented summary prose** (`2 total books`, `0 of 0 books`, `1 is out with someone`) |
| `expectEmpty()` | Empty-library asserts without hand-invented sentences (needs a **frozen empty-state contract** in product or helper) |

**Do not need (for this STILL-RED set):** generic RTL wrapper zoo, screenshot helpers, network mocks, persistence dump APIs (except optional `expectPersistedCount` later).

---

## 4. Overlap with already-solved MULTIPLE behavior

**Large overlap — call it out honestly.**

- ONE-SHOT cohort is **95% MULTIPLE**; Pi already one-shots those with `within` under KEEP MULTIPLE evidence.
- **8 / 23 STILL-RED** are the same MULTIPLE shape (Lend out, Save, bare `"1"`, `/lent out/i`, edit labels, botched sort scope). Helpers would help, but they **duplicate** the KEEP MULTIPLE win rather than explain remaining tails.

**Where helpers are *not* redundant:** the **10 PREVENTABLE** cases — mostly **TEXT_MISS / invented summary copy / text-split / wrong lent-state / invent testid**. Those are exactly the STILL-RED majority disease that MULTIPLE evidence does **not** one-shot.

```text
KEEP MULTIPLE  →  one-shot scoping disease (mostly done)
helpers        →  optional attack on STILL-RED copy/state/testid disease (~43% of 23)
```

---

## PREVENTABLE case list (incremental)

| Run | Class | Helper that would have owned it |
|-----|-------|----------------------------------|
| `16-32-14` | TEXT_MISS | `expectLentTo` |
| `09-53-21` | TEXT_MISS | `expectBook(..., {author})` |
| `07-43-23` | TEXT_MISS invent | `expectSummary({lent:1})` |
| `11-15-32` | testid invent | `lendBook` |
| `13-30-53` | TEXT_MISS | `expectBook` author |
| `20-42-30` | TEXT_MISS | `expectSummary({lent:0})` |
| `09-25-09` | invent `"2 total books"` | `expectSummary({total:2,lent:0})` |
| `14-37-34` | `"2 books total"` | `expectSummary` |
| `14-48-25` | wrong state `Lend out` | `returnBook` / lent-state API |
| `16-43-18` | invent `/0 of 0 books/` | `expectSummary` / `expectEmpty` |

---

## Risks / non-goals (before any build)

1. **Adoption risk:** if Pi ignores helpers and keeps raw RTL, addressable share → 0. Template AGENTS one-liner to “prefer helpers” touches *docs*, not Pi — still a behavior bet (prior one-liners died). Prefer: helpers + thin example test in seed, measure adoption rate first.
2. **Contract freeze:** `expectSummary` / `expectEmpty` require stable product a11y (labeled summary region, empty role). That is template/product contract work — OK under “environment-side,” but not zero-cost.
3. **Must not weaken oracles:** helpers should take **structured intents** (`lent: 1`), not accept free-form invented strings.
4. **No VERIFY/reporter changes** (frozen).

---

## Verdict

| Question | Answer |
|----------|--------|
| Preventable share of 23 STILL-RED? | **~43% incremental (10)**; ~87% only if you count MULTIPLE overlap |
| Semantic / unsolvable? | **3 (13%)** — guard + debug-only invent spirals |
| Smallest surface? | ~10 functions: CRUD journey + `expectBook` / `expectLentTo` / `expectSummary` / `expectEmpty` / `filterBooks` |
| Overlap MULTIPLE? | **Yes, 8/23** — don’t sell helpers as a MULTIPLE fix |

**GO to design/spike only if** we accept adoption risk and want the **copy/state STILL-RED** slice.  
**Do not build** until we either (a) confirm Pi will call preinstalled helpers in a tiny seeded probe, or (b) accept measuring adoption as the first experiment — not green rate.

**Pi remains untouched.**
