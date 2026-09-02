# Experiment VERIFY v1 — frozen verdict

**Status:** CLOSED — **inconclusive / invalid exit** (2026-08-31)  
**Experiment:** `harness-owned-verify-v1`  
**Runs:** 5 reps — **0/5 harness-exit OK**, **5/5 app-quality OK**

## Results

| Measure | Outcome |
|---------|---------|
| VERIFY mechanism | ✅ Pi used `verify` tool; piped/direct test bash ≈ eliminated; real `exit_code` in output |
| App quality | ✅ Harness Vitest + build + dev **5/5** |
| Harness exit | ❌ **0/5** — `tests_run` schema mismatch at compose time |
| Cost | ⚠️ Median **~92k** vs control **~78k** (+18%); floor **50k** (rep 4) |
| Repair spirals | ⚠️ Rep 1: 7 failing verify calls (178k) — VERIFY did not prevent deep repair |

Run IDs: `2026-08-31T15-39-40-550Z` … `2026-08-31T15-57-09-094Z`  
Deep analysis: [experiment-verify-v1-analysis.md](./experiment-verify-v1-analysis.md)

## Verdict

**VERIFY v1: KEEP mechanism, RE-RUN as v1.1 — do not treat v1 as a valid cost comparison.**

The harness-owned verify tool did what we designed: block Pi test bash, run Vitest with a real exit code, return compact output. Apps are good. The cohort failed **procedurally** because Pi wrote `tests_run` entries as `{ name, status }` and the runner dropped them → forced `partial`.

> **Fix the report contract, extend trajectory metrics to count `verify`, then rerun 5 reps. v1 proves the mechanism; it does not prove the cost hypothesis.**

## What we learned

| Finding | Action |
|---------|--------|
| Piped bash nearly gone | ✅ Ship verify extension |
| `trajectory.json` blind to verify | Extend metrics before v1.1 |
| Rep 4 at 50k | VERIFY compatible with cheap path |
| Rep 1 at 178k | Real failures still expensive — verify ≠ fewer fixes |
| Pi schema drift on `tests_run` | Normalizer alias + extension prompt (done) |

## Comparisons (do not mix invalid exit)

| Cohort | Median weighted | Harness exit |
|--------|-----------------|--------------|
| Control v2.1 | **~78k** | 5/5 |
| VERIFY v1 | ~92k | 0/5 (reporting) |
| VERIFY v1 corrected¹ | ~92k | 5/5 |

¹ Re-compose from `app/report.partial.json` snapshots with fixed normalizer.

## Next

1. ~~**VERIFY v1.1**~~ **DONE** — [experiment-verify-v1.1-analysis.md](./experiment-verify-v1.1-analysis.md) — promoted to v2.2  
2. ~~Trajectory metrics v2~~ **DONE**  
3. **STOP** — next experiment preregistered against v2.2 (~61k median)
