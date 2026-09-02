# Control floor v2.1 — deep analysis

**Locked:** 2026-08-31 (5/5 harness-success)  
**Baseline:** Exp1 + Exp2 + Exp3 + Exp6b + **Exp6c** + D1 + port hygiene  
**Log:** `artifacts/baseline-lock/2026-08-31T12-46-45Z.log`

---

## Cohort summary

| Rep | Run ID | Weighted | Calls | Journeys | Trajectory |
|-----|--------|----------|-------|----------|------------|
| 1 | `12-46-51-224Z` | **155k** | 37 | 7/7 | Repair spiral |
| 2 | `12-53-10-136Z` | 78k | 20 | 7/7 | Normal + 1 RTL fix |
| 3 | `12-56-26-048Z` | 72k | 18 | 8/8 | Tests green → TS/build fix |
| 4 | `12-59-28-147Z` | 100k | 23 | 8/8 | Layered arch + RTL triplet |
| 5 | `13-05-01-562Z` | **72k** | **17** | 9/9 | Cheap path |

| Metric | v2 | v2.1 |
|--------|-----|------|
| Median weighted | 106k | **~78k** |
| Range | 42k – 232k | 72k – 155k |
| Median calls | 23 | 20 |
| `PASS 0/0` | 1 (rep 5) | **0** |
| Cheapest | 42k / 11 | 72k / 17 |
| Most expensive | 232k / 55 | 155k / 37 |

Without rep 1, v2.1 median ≈ **72k**. Exp6c verified: zero false greens across cohort.

---

## Rep 1 — Repair spiral (155k / 37 calls)

**Session:** `sessions/2026-08-31T12-46-52-942Z_01a057db-…jsonl` (79 turns)

### Timeline

```text
setup → build (repository, BookForm, App) → write 7 tests
→ first npm test: FAIL 3/7 (4 failure blocks)
→ RTL fixes (Delete vs Remove, aria-labels, dialog)
→ dbg.test.tsx debug spiral (calls ~18–27)
→ repository cache fix → PASS 7/7
→ build → Pi dev server → pkill chain → report
→ post-green npm test reruns
```

### First test failure (call 8)

Four failures on first full suite run:

- `getByRole("button", { name: /Remove/i })` — UI says **Delete**
- Duplicate **Lend out** button ambiguity
- `getByText(/1 book lent out/)` — matcher / derived count sync

### Root causes

1. **Test query vs UI mismatch** — primary driver early
2. **dbg.test sidecar spiral** — Pi wrote/ran isolated `dbg.test.tsx` files to debug lent-count matcher (~35k weighted, calls 18–27). Debug tests without assertions passed while main suite still failed — classic false progress
3. **Real app bug (late)** — repository cache not updating React state after lend; fixed in `repository.ts` (call 28)
4. **Not:** transform error, singleton leak, TS chain

### Exp6c

Not triggered. Honest `❌ FAIL N/M` throughout; final `✅ PASS 7/7`.

### Harness gaps observed

- **Stop rule violated:** 8+ post-green test invocations after 7/7
- **Pi-owned dev server + pkill** (calls 31–35)
- **All 15 test bash commands piped** (`npm test 2>&1 | tail -N`)

### Architecture

Flat `src/`: `repository.ts` (`bookshelf.books.v1`), `BookForm.tsx`, dialog-based lend flow.

---

## Rep 2 — Normal + one RTL fix (78k / 20 calls)

**Session:** 49 turns

### Timeline

```text
recon → build (domain, repository, BookForm, BookList, App)
→ write tests → FAIL 6/7 → fix summary markup + test matchers
→ PASS 7/7 → build → Pi dev (timeout 12) → report
```

### Repair

Single failure: `getByText("1 lent out right now")` failed because count was in `<strong>` inside summary. Fixed by scoping to summary `textContent`.

**2 piped test runs.** No post-green reruns. No pkill.

---

## Rep 3 — Tests first try, build repair (72k / 18 calls)

**Session:** 45 turns

### Timeline

```text
build (types, repository, useBooks hook, components)
→ write 8 tests → PASS 8/8 first try ✅
→ npm run build FAIL: BookInput not exported from types.ts
→ TS import shuffle (calls 11–16) → build green → report
```

### Key insight

**Product tests green ≠ ship-ready.** Pi moved `BookInput` to wrong module; tests passed because they never imported the type at compile boundary the same way `tsc` does.

**No Pi dev server** — harness ran dev check. Largest single call: +11.6k weighted on first build failure.

Extra journey: malformed localStorage recovery.

---

## Rep 4 — Layered architecture (100k / 23 calls)

**Session:** 53 turns

### Timeline

```text
build storage.ts + domain.ts + useBookshelf.ts + Add/Edit forms
→ write tests (iterative) → FAIL 5/8 (3 failures)
→ within(editForm), testid for count, alert role → PASS 8/8
→ build → Pi dev → pkill → report
```

### Repair (all test-query)

- Multiple **Title** labels (add vs edit)
- Lent count regex on split text nodes
- Missing `role="alert"` for validation message

**100k despite one repair round** — cost from richer file tree (37% source + 29% mixed), not test spiral.

---

## Rep 5 — Cheap path benchmark (72k / 17 calls)

**Session:** 50 turns

### Timeline

```text
batch recon → repository + useLibrary + components
→ 9 journey tests → FAIL 8/9 (duplicate Title label)
→ fix test scoping (within form via Save button.closest)
→ PASS 9/9 → build → dev+curl → report
```

### v2 rep 5 contrast (same task, pre-Exp6c)

| | v2 rep 5 | v2.1 rep 5 |
|--|----------|------------|
| Weighted / calls | 232k / 55 | **72k / 17** |
| `PASS 0/0` | Yes (duplicate export) | **No** |
| Failure mode | false green → TS/import snowball | RTL label scoping only |
| Stop rule | Violated | Clean |

This is the clearest proof Exp6c removes the **false-green cascade**, not all repair cost.

---

## Cross-cohort patterns

### What every run still pays for

| Work | All 5 reps |
|------|------------|
| localStorage repository from scratch | ✅ unique `STORAGE_KEY` each run |
| 7–9 RTL journey tests | ✅ |
| Book domain + forms | ✅ 27–45% source activity |

### Exp6c effect (confirmed)

- **0** `PASS 0/0`, **0** `SUITE_ERROR` in tool results
- Ceiling dropped 232k → 155k
- v2.1 rep 5 vs v2 rep 5: **3× cheaper** with same product quality

### What Exp6c did NOT fix

| Gap | Evidence |
|-----|----------|
| RTL query repair loops | Reps 1, 2, 4, 5 |
| dbg.test debug spirals | Rep 1 only |
| Piped vitest (`\| tail`) | **All reps** — every test bash piped |
| Stop rule (post-green rerun) | Rep 1 only in v2.1 |
| Pi-owned dev server | Reps 1, 2, 4, 5 |
| TS/build after test-green | Rep 3 |

### Persistence test honesty

All reps label persistence as "page refresh" but implement **unmount + remount** with same localStorage — not harness `page.reload()`. Same reservation as v2.

---

## Trajectory models

```text
CHEAP (rep 5, 72k/17)
  source → 3× test (2 RTL fixes) → build → dev → report

NORMAL (reps 2–4, 72–100k)
  source-heavy → 1 RTL repair round → done

REPAIR SPIRAL (rep 1, 155k)
  test fail → dbg sidecars → repository fix → post-green waste

BUILD-ONLY (rep 3, 72k)
  PASS 8/8 first try → tsc export fix on build
```

---

## Implications for Experiment B

1. Compare against **v2.1 ~78k median** (or ~72k ex-rep1).
2. Rep 5 (72k, 17 calls, 9 journeys) = cheap-path case study.
3. Rep 1 = repair variance still exists — B must beat median, not best case.
4. **localStorage resource** should reduce rep 1-style repository/debug work — primary B hypothesis.

---

## Open harness backlog (priority)

1. **Harness-owned VERIFY** — no pipes; real exit code (all reps piped vitest)
2. **Failure digest** — query vs bug vs sidecar-debug detection (rep 1 dbg.test)
3. **Mechanical stop-after-green** (rep 1 post-green reruns)
4. **Pi dev server removal** (reps 1, 2, 4, 5)
5. **Real browser reload** journey

**Closed:** Exp6c false PASS 0/0

---

## Artifacts

- Runs: `artifacts/runs/2026-08-31T12-*`, `2026-08-31T13-05-01-562Z`
- Stations: `artifacts/analysis/2026-08-31T*`
- Prior: [control-floor-v2-analysis.md](./control-floor-v2-analysis.md)
- Exp6c: [exp6c-false-pass-fix.md](./exp6c-false-pass-fix.md)
