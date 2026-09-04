# Measurement: natural test-weakening base rate (2026-09-04)

**Status:** MEASURED — real but **small** natural failure mode; **no intervention yet**  
**Question:** When Pi repairs its own failing tests, how often does it make the test **weaker** (loss of behavioral coverage) vs a correct/brittleness-only fix?

Related: wrong-locus dropped in `measurement-wrong-locus-natural-2026-09-04.md` (0/90). This is the **mirror image**.

---

## Method

- Natural bookshelf runs only (**n=313** with events).
- Unit of analysis: FAIL→VERIFY **repair window** that edits `*.test.*` (**eligible n=318**; **121** of those next VERIFY PASS).
- Mechanical candidate flags (any of): fewer `expect`/`it`, drop `expectTypeOf`, drop `.not.to…`, exact string → broader regex, semantic query → `querySelector`/index, weaker matcher (`toBeTruthy` / `toBeDefined`), block delete, changed expected literal.
- Split: **serious** flags (coverage-shaped) vs **brittle-only** (`exact_to_regex` / `exact_name_to_regex` alone).
- Every serious window manually labeled:
  - **CORRECT** — fixes wrong/brittle assert; intended behavior preserved (often *stronger* via `within`/scoping).
  - **BRITTLE** — selector/matcher loosen or class/index coupling; **same** behavioral intent (harmless brittleness reduction or equivalent rewrite).
  - **WEAKENING** — green easier **without** equivalent coverage (assertion/test/negative/journey check lost).
  - **AMBIGUOUS**.

Cost note: weakening is primarily a **quality** mode. Full-run weighted cost is **not** attributable to the weaken edit (usually one turn ≈ one model call). Report run call counts only as context.

---

## Funnel

| Stage | n |
|-------|--:|
| Natural runs | 313 |
| Eligible test-repair windows | **318** |
| … next VERIFY PASS | 121 |
| Any mechanical flag (incl. full rewrite) | 164 |
| Brittle-only (`exact_*_to_regex`) | **51** |
| Serious-flag windows | **39** / **33** unique runs |
| … next PASS immediately | 16 |

---

## Manual labels (all 39 serious windows)

| Label | Windows | Share of serious |
|-------|--------:|-----------------:|
| **CORRECT** | 21 | 54% |
| **BRITTLE** (harmless / equivalent) | 8 | 21% |
| **WEAKENING** | **7** | **18%** |
| **AMBIGUOUS** | 3 | 8% |

### Rates that matter

| Rate | Value |
|------|------:|
| WEAKENING / eligible test-repair windows | **7 / 318 ≈ 2.2%** |
| Unique natural runs with ≥1 WEAKENING window | **7 / 313 ≈ 2.2%** |
| Those with immediate next VERIFY PASS | **2 / 7** |
| Brittle-only windows (not counted as WEAKENING) | 51 — treat as **harmless brittleness reduction** pending spot-checks (pattern: `"Novel"`→`/Novel/`, scoped name regex) |

---

## WEAKENING examples (all 7)

| Run | What was lost | Immediate green? | Calls (run) |
|-----|---------------|------------------|------------:|
| `2026-09-01T23-38-35-782Z` | Dropped `getByText("Sarah")` (borrower identity); also dropped “1 is out” companion assert | no | 18 |
| `2026-09-02T22-27-48-249Z` | Dropped `queryByText("Dad").not.toBeInTheDocument()` on return | no | 41 |
| `2026-09-03T07-43-23-509Z` | Dropped `getAllByText("Lent out").toHaveLength(2)` (tab+badge) | no | 20 |
| `2026-09-03T08-08-39-499Z` | Dropped category `expect(…"Novel")` entirely | **yes** | 16 |
| `2026-09-03T13-21-38-324Z` | Filter assert `toBeInTheDocument` → `toBeDefined` on ad-hoc find | no | 22 |
| `2026-09-04T16-52-11-769Z` | Dropped `localStorage === "[]"` empty-persistence check | **yes** | 22 |
| `2026-09-04T19-08-49-761Z` | `toBeInTheDocument`→`toBeTruthy`; dropped lent-summary count assert | no | 15 |

**Assertions/tests lost (typical):** 1 assert per window (not whole `it` deletions in this set). No `expectTypeOf` wipe in the serious labeled set (that pattern appeared inside larger authoring noise on older runs, not as a clean weaken→green).

**∑ full-run call×4.6k over the 7 runs ≈ 708k** — **do not** read as “weakening tax”; those runs were expensive for many reasons. Window-attributable cost ≈ **1 model call** each (~4.6k × 7 ≈ **32k** upper bound if every weaken were avoided).

---

## What is *not* weakening (majority)

Most flagged edits are **correct MULTIPLE/scoping repairs** or **harmless regex loosenings**:

- `within(item).getByText(...)` instead of unscoped `getByText` (KEEP stack teaches this).
- `"No books yet"` → `/No books yet/` — same check.
- Fixing which `Lend out` index matches sort order — journey correctness, not coverage loss.
- Replacing ambiguous `getByText("0")` with labeled summary / testids — often **stronger**.

---

## Verdict

1. **Test-weakening is a real natural mode**, unlike Dune wrong-locus — but **rare (~2% of test-repair windows / runs)**.
2. When serious flags fire, **~18%** are true WEAKENING; **~75%** are CORRECT or harmless BRITTLE.
3. **Do not build an intervention yet** on this base rate alone — expected $ save is tiny vs VERIFY-loop tax; quality risk is mild (usually one assert), and FULL_GREEN + public journeys still gate ship.
4. If a later quality audit cares: highest-signal mechanical watches are **`drop_negative`**, **deleted category/borrower/persistence expects**, and **`toBeTruthy`/`toBeDefined` replacing presence asserts** — not blanket “ban regex.”

---

## Follow-up (parked)

- Optional: spot-check sample of 51 brittle-only windows (expect ~0 WEAKENING).
- Optional: ship-KEEP-only subset (two WEAKENING runs already sit on 2026-09-04 evening/ship era: `16-52-11`, `19-08-49`).
- **No harness change** until a quality bar explicitly requires it.
