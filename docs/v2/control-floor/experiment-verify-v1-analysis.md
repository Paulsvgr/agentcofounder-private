# Experiment VERIFY v1 — deep analysis

**Completed:** 2026-08-31 (0/5 harness-exit success, 5/5 app-quality pass)  
**Experiment:** `harness-owned-verify-v1`  
**Arm:** treatment — `harness_owned_verify=true`  
**Compare baseline:** control floor v2.1 (median **~78k**, 5/5 success)  
**Log:** `artifacts/experiments/harness-owned-verify-v1/2026-08-31T15-39-35Z.log`

---

## Cohort summary

| Rep | Run ID | Weighted | Calls | Harness Vitest | Pi `verify` (fail→pass) | Report snapshot | Harness exit |
|-----|--------|----------|-------|----------------|-------------------------|-----------------|--------------|
| 1 | `15-39-40-550Z` | **178k** | 41 | 6/6 | 7→2 | success / 6 journeys | ❌ partial |
| 2 | `15-45-36-928Z` | 108k | 33 | 9/9 | 3→1 | success / 9 journeys | ❌ partial |
| 3 | `15-51-10-217Z` | 79k | 15 | 9/9 | 2→1 | success / 9 journeys | ❌ partial |
| 4 | `15-54-07-890Z` | **50k** | 14 | 5/5 | 1→1 | success / 5 journeys | ❌ partial |
| 5 | `15-57-09-094Z` | 92k | 19 | 17/17 | 0→1 | success / 17 journeys | ❌ partial |

| Metric | Control v2.1 | VERIFY v1 |
|--------|--------------|-----------|
| Median weighted | **~78k** | **~92k** (+18%) |
| Mean weighted | ~95k | ~101k |
| Range | 72k – 155k | **50k – 178k** |
| Median calls | 20 | 19 |
| Harness app quality | 5/5 | **5/5** (Vitest + build + dev) |
| Harness exit (`success`) | 5/5 | **0/5** |
| Piped `npm test` bash (trajectory) | 13 total / med 2 | **1 total** / med 0 |
| `verify` tool invocations | 0 | **19 total** / med 3 |
| Post-full-green calls (median) | 3 | **0**¹ |
| Debug sidecar files | 0 | 0 |

¹ Trajectory metrics only count **bash** `npm test` for time-to-green; `verify` is invisible to `trajectory.json` today (measurement gap — see §Measurement gaps).

**Corrected exit (with `name`/`status` normalizer):** 5/5 would record `success` — apps and snapshots are fine; the runner stripped `tests_run` at compose time (§Reporting failure).

Without rep 1 (spiral): VERIFY median ≈ **86k** (+10% vs control). Rep 4 at **50k** beats every control rep except none — it is the **cheapest successful app build in the entire v2.1+ series**.

---

## Hypothesis vs outcome

| Layer | Hypothesis | Result |
|-------|------------|--------|
| **Piped tests eliminated** | Pi stops `npm test \| tail` bash | ✅ **1 piped bash** in 5 reps (rep 1 edge case); **0** direct test bash |
| **Real exit codes** | Pi sees authoritative PASS/FAIL | ✅ Every `verify` end event includes `exit_code=0\|1`; rep 1: 7 FAIL then 2 PASS |
| **Repair tails shorter** | Fewer false-progress / re-run loops | ⚠️ Rep 1 still **9 verify calls** (7 failures) — real failures, not false greens; reps 3–5: 1–3 verify total |
| **Post-green waste** | Stop rule + no double-check | ✅ **0** post-full-green calls all reps (trajectory bash metric; verify-only green invisible) |
| **Cost vs control** | Median weighted ≤ ~78k | ❌ Median **~92k** (+18%); cheap tail exists (50k) |
| **Quality** | Same journey coverage | ✅ 46/46 harness Vitest across reps; rep 5 wrote hook + RTL suite (17 tests) |
| **Harness exit** | 5/5 success | ❌ **0/5** — reporting schema bug, not app failure |

**Verdict preview:** VERIFY **works as a mechanism** but v1 cohort is **inconclusive on cost** and **invalid as a formal A/B** until reporting is fixed and trajectory counts `verify`. See [experiment-verify-v1-verdict.md](./experiment-verify-v1-verdict.md).

---

## Critical finding — reporting failure (not VERIFY failure)

All five runs **failed harness exit** with `status: partial` and `tests_run: []` in `result.json`. Post-hoc inspection of snapshotted `app/report.partial.json` tells a different story:

| Rep | Snapshot `status` | Snapshot `tests_run` | Schema Pi used |
|-----|-------------------|----------------------|----------------|
| 1 | success | 6 | `name`, `status`, `journey` |
| 2 | success | 9 | `name`, `status` |
| 3 | success | 9 | `name`, `result` |
| 4 | success | 5 | `name`, `status` |
| 5 | success | 17 | `name`, `status` |

The runner's `normalizePartialResult()` (pre-fix) required `{ command, journey, result }` per `contract-public/result.schema.json` and **silently dropped** every entry. `composeResult()` then saw zero product journeys → forced `partial` even though:

- Pi exit code **0** all reps  
- Harness Vitest **passed** all reps  
- Build + dev server **passed** all reps  

The SKILL.md example shows the correct shape; Pi drifted to Vitest-style `name`/`status` under VERIFY. **Fix applied:** `normalizeTestRun()` now accepts `name`+`status`/`result` alias; extension prompt updated to require `command`/`journey`/`result`.

**Implication:** Do not compare VERIFY v1 exit codes to control. Re-run as **VERIFY v1.1** after fix for a clean cohort.

---

## What VERIFY actually changed in the trajectory

### Before (control v2.1)

```text
Pi → bash "npm test 2>&1 | tail -40"
     → truncated text, hidden exit code
     → parse ❌ FAIL N/M from tail
     → repair loop (sometimes dbg.test.tsx spiral)
     → post-green bash re-runs (median 3 calls)
```

### After (VERIFY v1)

```text
Pi → verify tool
     → harness runs npm test, returns exit_code + full compact reporter
     → Pi sees verify exit_code=1 (FAIL) or 0 (PASS)
     → edit code → verify again
     → bash npm test BLOCKED (reps 1–2 saw blocks)
```

### Event-level verify summary

| Rep | verify FAIL | verify PASS | Blocked test bash |
|-----|-------------|-------------|-------------------|
| 1 | 7 | 2 | 1 |
| 2 | 3 | 1 | 2 |
| 3 | 2 | 1 | 0 |
| 4 | 1 | 1 | 0 |
| 5 | 0 | 1 | 0 |

**Total:** 13 failing verify calls, 6 passing — **68% of verify invocations were failure-driven repair**, concentrated in reps 1–2. Reps 4–5 show the intended steady state: **1–2 verify calls total**, zero blocked bash.

---

## Activity mix shift

| Activity (median share) | Control v2.1 | VERIFY v1 |
|-------------------------|--------------|-----------|
| **test** | **10%** | **0%**¹ |
| source | 37% | 24% |
| mixed | 27% | 33% |
| finalize | 12% | 9% |
| css | 5% | 9% |

¹ Classifier tags **bash** `npm test` as `test`; `verify` tool calls classify as **`other`**. VERIFY reps show elevated **`other`** (6–15%) — that is mostly verify output ingestion, not slack.

**Interpretation:** VERIFY moved test verification spend from the `test` bucket to `other`. It did **not** obviously shrink total verification weighted cost on expensive reps — rep 1 **`other` = 15% (26k)** plus implicit repair in `mixed`/`source`.

---

## Rep 1 — Verify repair spiral (178k / 41 calls)

**Session:** ~79 turns · `sessions/2026-08-31T15-39-41-547Z_*.jsonl`

### Timeline

```text
recon → write types.ts, useBooks.ts, monolithic App.tsx + CSS
→ write App.test.tsx (233 LOC, 6 journey tests)
→ verify ×7 (all exit_code=1) — RTL/query failures
→ verify ×2 (exit_code=0) — green
→ blocked bash test attempt ×1
→ build (bash) → dev → report.partial.json
```

### Root causes (verify output, not piped tail)

Real test failures across seven verify cycles — same **class** of problems as control rep 1 (155k / 37 calls):

- Query vs UI label mismatch  
- Lent-count / filter sync  
- Test needed code fixes, not reporter ambiguity  

**Difference from control:** Pi got **full compact FAIL blocks + real exit code** each time — no false `PASS` from truncated tail. **No `dbg.test.tsx` sidecar** (0/5 reps).

**Cost:** 41 calls vs control spiral 37 — **more expensive**, not less. VERIFY did not shorten this tail in v1.

### Architecture

Monolithic `App.tsx` + `useBooks.ts` hook + `types.ts` — mirrors control cheap/ mid reps (~564 LOC product, 233 LOC tests).

---

## Rep 2 — Mega-write + verify debug (108k / 33 calls)

### Timeline

```text
recon → read seed files
→ call 5: write App.tsx + styles.css together (14k weighted single call)
→ call 6–10: test file writes/edits (App.test.tsx churn)
→ verify ×4 (3 fail → 1 pass)
→ 2× blocked direct test bash
→ finalize
```

**Pattern:** Large batched writes (`mixed` **75%** of weighted on one call) + test file thrash. Not a piped-test problem — a **generation-shape** problem (oversized turns).

---

## Rep 3 — Near-control path (79k / 15 calls)

```text
build → single App.test.tsx → verify ×3 (2 fail → 1 pass) → report
```

**15 calls** — matches control cheap rep 3 (72k / 18 calls). Verify failures **2**, not 7. Competitive with baseline on cost **when repair is shallow**.

---

## Rep 4 — Cheapest run in series (50k / 14 calls)

```text
minimal recon → compact App + useBooks → 5 journey tests
→ verify ×2 (1 fail → 1 pass) → done
```

- **14 calls** — fewest in VERIFY **and** beats control v2.1 floor (17 calls / 72k)  
- **5 tests** — smallest sufficient suite (Exp3 policy compliant)  
- **520 LOC** product — lean monolith  

**Proof point:** VERIFY does not **force** expensive trajectories. When Pi takes the cheap path, harness-owned verify is **compatible with ~50k**.

---

## Rep 5 — Hook unit tests inflate suite (92k / 19 calls)

```text
useBooks.ts + useBooks.test.ts (7 hook tests)
→ App.tsx + App.test.tsx (10 RTL journeys)
→ verify ×1 (immediate PASS)
```

- Harness: **17/17** Vitest — highest count in cohort  
- Pi wrote **speculative hook tests** beyond journey minimum  
- Only **1 verify call** — best verify efficiency  
- Cost **92k** — hook tests added source tokens without verify repair  

**Lesson:** VERIFY stops piped bash spirals; it does **not** stop over-testing.

---

## Comparisons (correct cohort labels)

| Cohort | Label | Median weighted | Harness exit |
|--------|-------|-----------------|--------------|
| Control v2.1 | Exp6b+Exp6c+D1, piped bash | **~78k** | 5/5 |
| Experiment B v1 | + data slice | ~114k | 5/5 |
| Experiment C v1 | + UI + data | ~150k | 5/5 |
| **VERIFY v1** | + harness verify tool | **~92k** | 0/5¹ |

¹ Reporting artifact only; 5/5 app quality.

---

## Measurement gaps (fix before v1.1)

| Gap | Impact |
|-----|--------|
| `trajectory.json` ignores `verify` tool | `first_test_green_call`, `post_full_green_calls` all **null/0** — cannot compare time-to-green vs control |
| Activity classifier | `test` share reads as 0% — misleading dashboards |
| `config:show` without env | Log shows `harness_owned_verify: false` even during treatment (cosmetic) |
| Compose-time vs snapshot | `result.json` stale vs `app/report.partial.json` in artifact snapshot |

**Recommended:** extend `trajectory-metrics.ts` with `verify_runs[]` (call index, exit_code, pass ratio from compact output).

---

## Harness gaps still observed

| Gap | VERIFY v1 | Control v2.1 |
|-----|-----------|--------------|
| Piped vitest bash | ≈ eliminated | 13/5 reps |
| Post-green test re-runs | 0 (bash metric) | median 3 |
| Debug sidecar tests | 0 | 0 (except rare) |
| Pi dev server + pkill | Present | Present |
| Wrong `tests_run` schema | **5/5** | 0/5 |
| Oversized hook test suites | 1/5 (rep 5) | occasional |

---

## Cost interpretation

```text
                    CHEAP ◄────────────────────────────► EXPENSIVE
Control v2.1:       [72k] [72k] [78k] [100k]     [155k]
VERIFY v1:          [50k] [79k] [92k] [108k]     [178k]
                         ▲
                    rep 4 — VERIFY cheapest ever
```

- **Mechanism validated:** real exit codes, no piped bash, blocking works  
- **Cost hypothesis not validated:** median +18%; rep 1 worse than control spiral  
- **Tail improved:** rep 4 **50k** proves floor; reps 3–5 cluster 79–92k (near control)  
- **Formal A/B blocked:** reporting bug invalidates exit comparison  

---

## Files and artifacts

| Artifact | Path |
|----------|------|
| Experiment log | `artifacts/experiments/harness-owned-verify-v1/2026-08-31T15-39-35Z.log` |
| Run snapshots | `artifacts/runs/2026-08-31T15-{39,45,51,54,57}-*/` |
| Report snapshots (correct) | `artifacts/runs/*/app/report.partial.json` |
| Analysis script | `scripts/analyze-verify-cohort.ts` |
| Extension | `solution/extensions/harness-owned-verify.ts` |
| Spec | [harness-owned-verify.md](./harness-owned-verify.md) |

---

## Next steps

1. **VERIFY v1.1 rerun** — after `tests_run` normalizer + extension prompt fix; target 5/5 harness exit  
2. **Trajectory v2** — count `verify` tool in metrics  
3. **Do not merge v1 cost with control** — label cohort `harness-owned-verify-v1-invalid-exit` in catalog  
4. If v1.1 median ≤ 78k with rep 1 spiral rate unchanged → **KEEP** verify; if median ~90k+ → pair with stop-rule enforcement or test-count policy
