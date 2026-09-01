# Trajectory cohort retro-analysis

**Generated:** 2026-08-31 (automated via `npm run analyze:cohort-trajectory`)  
**Raw output:** `artifacts/analysis/trajectory-cohorts/2026-08-31T15-39-17-110Z.md`

Retro pass over control v2.1 (5 reps), Experiment B (5), and Experiment C (5) using the new `trajectory.json` metrics.

---

## Headline

| Cohort | Median weighted | Median piped tests | Median post-full-green calls | Debug sidecars (max) |
|--------|-----------------|--------------------|-----------------------------|----------------------|
| Control v2.1 | **~78k** | **2** | **3** | 0 |
| Experiment B | ~114k | 3 | 3 | 0 |
| Experiment C | ~150k | **8** | 3 | 1 |

Resource slices did not reduce piped-test behavior or post-green tail calls. Experiment C made piped tests **worse** (median 8 vs 2).

---

## Control v2.1

| Run | Weighted | Calls | 1st test pass | 1st full green @ | Post-full-green | Piped |
|-----|----------|-------|---------------|------------------|-----------------|-------|
| rep 1 (spiral) | 155k | 37 | — | 30 | 7 | 5 |
| rep 2 | 78k | 20 | — | 17 | 3 | 2 |
| rep 3 | 72k | 18 | 100% | 16 | 2 | 1 |
| rep 4 | 100k | 23 | — | 18 | 5 | 2 |
| rep 5 (cheap) | 72k | 17 | — | 14 | 3 | 3 |

**Takeaway:** Even cheap control reps still pipe tests (1–3×) and burn 2–7 calls after full green. Rep 1’s spiral correlates with 5 piped runs and 7 post-green calls — the VERIFY hypothesis target.

---

## Experiment B (data slice only)

Median weighted ~114k (+46% vs control). Piped tests slightly higher (3 vs 2). Post-full-green unchanged at 3. No debug sidecars.

Resource adoption worked; trajectory shape did not improve.

---

## Experiment C (UI + data slice)

Median weighted ~150k. **Median piped tests = 8** — worst cohort. One rep (`14-23-34`) created a debug sidecar file. Rep 1 (`14-10-21`) never reached full green in ledger (10 piped test attempts, 0 post-full-green because never green).

Full slice added UI context **and** more piped verification — no synergy.

---

## Implications for VERIFY (Experiment D1)

1. **Piped tests are universal** in control/B/C — VERIFY should drive `piped_test_command_count → 0`.
2. **Post-full-green calls (~3 median)** persist across all cohorts — VERIFY + stop rule may reduce this if Pi trusts harness exit codes.
3. **Debug sidecars are rare** (1/15 runs) but costly when they happen — VERIFY’s structured output may prevent false-progress spirals.
4. **B/C are not baselines for VERIFY** — next treatment uses plain control template only.

Run treatment:

```bash
npm run experiment:verify
```

Compare trajectory + weighted cost vs control v2.1 table above.
