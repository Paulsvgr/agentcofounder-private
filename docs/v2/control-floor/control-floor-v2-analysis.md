# Control floor v2 — analysis

**Locked:** 2026-08-30 (5/5 harness-success)  
**Baseline:** Exp1 + Exp2 + Exp3 + **Exp6b** + **D1** + port hygiene  
**Compare to:** Control floor v1 (Exp6, pre-PASS line, pre-D1) — afternoon lock 2026-08-30

---

## Headline numbers

| Cohort | Median weighted | Range | Median calls |
|--------|-----------------|-------|--------------|
| **v1 control** | **94k** | 71k – 112k | 22 |
| **v2 control** | **106k** | 42k – 232k | 23 |

v2 median is **~13% higher** than v1, not lower. Spread **widened** (42k–232k vs 71k–112k). Harness changes did not magically compress cost — they changed **feedback** and **what Pi sees in the workspace**.

---

## Per-run scorecard (v2)

| Rep | Run ID | Weighted | Calls | Test % | Recon % | FAIL markers | ✅ PASS lines | Journeys |
|-----|--------|----------|-------|--------|---------|--------------|---------------|----------|
| 1 | `20-35-50-494Z` | 106k | 23 | 10% | 7% | 6 | 14 | 9/9 |
| 2 | `20-39-17-043Z` | **42k** | **11** | 8% | 6% | **0** | 6 | 7/7 |
| 3 | `20-41-12-016Z` | 140k | 33 | **26%** | 12% | **24** | 19 | 8/8 |
| 4 | `20-45-53-916Z` | 84k | 20 | 6% | 5% | 6 | 6 | 8/8 |
| 5 | `20-49-19-145Z` | **232k** | **55** | 18% | **32%** | 12 | 20 | 9/9 |

All reps: quality ✅ (harness 3/3, all journeys green).

---

## What Exp6b changed (measurable)

| Signal | v1 (mean) | v2 (mean) |
|--------|-----------|-----------|
| `✅ PASS N/N` in events | **0** | **13** |
| `--reporter=verbose` | some | **0** |
| FAIL markers (`FAILURES N`) | 12 | 10 |

**On clean runs (rep 2):** one test bash, one build bash, zero failure markers, PASS line visible → **42k / 11 calls** (best control run recorded).

**On repair runs (rep 3):** 24 failure markers, 9× `npm test` bash, 10× grep/tail → PASS line did not prevent the loop; **failures still drive cost**.

### Conclusion on Exp6b

> Exp6b **fixes silent-green uncertainty**. It does **not** fix **failure-driven spirals**. That needs Exp4-class failure digest (deferred).

---

## Variance drivers (same as before, clearer evidence)

### 1. Test repair loops (rep 3)

- 26% of weighted cost in `test` activity (8 model calls)
- 24 compact FAIL blocks in event stream
- 9 explicit `npm test` bash invocations vs **1** on rep 2

Same failure class as Experiment A rep 4: RTL/query ambiguity, multiple matching elements, test rewrites — not harness breakage.

### 2. Repair snowball + false PASS (rep 5 — `20-49-19-145Z`, 232k, 55 calls)

- **32% recon** (17 calls) — high, but driven by multi-phase repair not idle re-reads
- **5 failures → repository singleton leak → syntax error → `PASS 0/0` → default reporter → TS import chain**
- Compact reporter emitted `✅ PASS 0/0` on transform failure (`Unexpected "export"` in `App.tsx`); Pi only saw the real error after `--reporter=default`
- 11× test, 5× build; post-green tail: dev server, pkill, final test+build re-run despite stop rule
- Extra product scope: duplicate-book prevention, 9 journeys

> Rep 5 is the **most expensive v2 control** and the run that exposed **Exp6c** — a harness **correctness** bug, not an optimization gap. See [exp6c-false-pass-fix.md](./exp6c-false-pass-fix.md).

### 3. Cheap path still exists (rep 2, rep 4)

| Pattern | Rep 2 (42k) | Rep 4 (84k) |
|---------|-------------|-------------|
| Calls | 11 | 20 |
| Test bash | 1 | 2 |
| Failure markers | 0 | 6 |
| Recon | 6% | 5% |
| Features / journeys | 11 / 7 | 11 / 8 |

**Floor ~42–84k** with current harness when Pi takes the short path.

---

## What did NOT change

| Work item | Every run |
|-----------|-----------|
| localStorage persistence | Pi builds repository/storage from scratch (~1 persist file) |
| Book domain + forms | Full source phase (27–50% of cost on normal reps) |
| Journey test authoring | 7–9 RTL journeys per run |

This is why **Experiment B** (`local-storage-collection`) remains the next resource hypothesis — not more UI primitives.

---

## v1 vs v2 — fair comparison notes

**Do compare:** quality (all green), adoption of PASS line, absence of resource-smoke in Pi tests (D1).

**Do not over-interpret:** median 106k vs 94k — within noise given **2.5× wider spread** on v2.

**Rep 5 (232k) alone** pulls v2 mean to 121k. Without it, v2 median of remaining four ≈ **96k** — essentially v1.

---

## Trajectory models

```text
CHEAP PATH (rep 2, 42k)
  read AGENTS → write app + storage → 1× test (PASS) → 1× build → report

NORMAL (rep 1/4, ~85–106k)
  source-heavy → few test repairs → PASS confirms green → done

REPAIR PATH (rep 3, 140k)
  tests fail → compact FAIL (good) → Pi still loops test/edit → many PASS+FAIL cycles

REPAIR/SPIRAL PATH (rep 5, 232k)
  test failures → false PASS 0/0 on syntax error → more repair → TS/build chain → post-green waste
```

---

## Implications for Experiment B

**Blocked** until control floor **v2.1 relock** (Exp6c implemented 2026-08-31). Do not compare B against v2 while the cohort predates the fix.

When unblocked:

1. **Compare B vs v2.1 control**, not v2 (106k) or v1 (94k).
2. **Success for B:** median below control **and** fewer source+test calls on persistence — not just “imports useCollection.”
3. **Exp6b is necessary but insufficient** — Exp6c fixes correctness; Exp4-class failure digest remains deferred.
4. **Rep 2 is a case study**, not the benchmark — use full cohort distributions.

---

## Open harness gaps (observed in v2 controls)

| Gap | Evidence | Priority |
|-----|----------|----------|
| **False PASS 0/0 (Exp6c)** | rep 5 (`20-49-19-145Z`): transform failure → `✅ PASS 0/0` | **Fixed** — v2.1 relocked 2026-08-31 ([exp6c-false-pass-fix.md](./exp6c-false-pass-fix.md)) |
| Harness-owned VERIFY (no pipes) | rep 5: `vitest \| tail/grep` masks exit code | High |
| Failure digest (query vs bug) | rep 3: 24 FAIL markers | High (Exp4) |
| Stop rule after PASS | rep 1/3/5: multiple test runs after green | Medium (harness enforcement) |
| Pi-owned dev server | rep 3/5: npm run dev, pkill, pgrep after green | Medium |
| Real browser refresh proof | journeys say “refresh”; harness only Vitest | Medium (browser journey) |

---

## Artifacts

- Log: `artifacts/baseline-lock/2026-08-30T20-35-45Z.log`
- Analysis stations: `artifacts/analysis/2026-08-30T20-*`
- v1 reference runs: `2026-08-30T15-21-28-842Z` … `2026-08-30T15-38-43-466Z`
