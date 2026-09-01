# Control floor v2.2 — frozen VERIFY baseline

**Status:** **ACTIVE BASELINE** (2026-08-31)  
**Supersedes:** [control-floor v2.1](./control-floor-v2.1-analysis.md) for all new experiments  
**Verdict source:** [experiment-verify-v1.1-analysis.md](./experiment-verify-v1.1-analysis.md) — **KEEP**

---

## Definition

Control floor **v2.2** is exactly Control v2.1 plus harness-owned VERIFY v1.1. Nothing else.

```text
v2.2 = v2.1 + harness_owned_verify: true
```

### Included (unchanged from v2.1)

| Piece | Doc |
|-------|-----|
| Exp1 RTL cleanup | [exp1-rtl-cleanup.md](./exp1-rtl-cleanup.md) |
| Exp2 stop rule | [exp2-stop-rule.md](./exp2-stop-rule.md) |
| Exp3 test policy | [exp3-test-policy.md](./exp3-test-policy.md) |
| Exp6b compact reporter | [exp6-compact-reporter.md](./exp6-compact-reporter.md) |
| Exp6c false-pass fix | [exp6c-false-pass-fix.md](./exp6c-false-pass-fix.md) |
| D1 smoke separation | [d1-smoke-separation.md](./d1-smoke-separation.md) |
| Port hygiene | baseline lock scripts |

### Added (VERIFY v1.1)

| Piece | Location |
|-------|----------|
| `verify` tool | `solution/extensions/harness-owned-verify.ts` |
| Block piped/direct test bash | same extension |
| `tests_run` normalizer alias | `src/result.ts` |
| Config default | `HarnessConfig.harness_owned_verify: true` |

### Explicitly not included

Resource slices (B/C), browser tests, new recipes, stop-logic rewrite, server-lifecycle fix, error-memory agent.

---

## Config identity

| Field | v2.1 | v2.2 |
|-------|------|------|
| `harness_owned_verify` | `false` | **`true`** |
| All other toggles | same | same |
| `config_hash` | `85c84b69…` | **`10fc1b13…`** |

Reproduce v2.1 control runs: `HARNESS_OWNED_VERIFY=0 npm run challenge`

---

## Locked cohort (5/5 OK)

VERIFY v1.1 experiment reps **are** the v2.2 baseline lock — no re-run required.

| Rep | Run ID | Weighted | Calls |
|-----|--------|----------|-------|
| 1 | `2026-08-31T21-16-45-263Z` | 78,009 | 18 |
| 2 | `2026-08-31T21-19-44-728Z` | 60,852 | 15 |
| 3 | `2026-08-31T21-22-09-667Z` | 49,449 | 16 |
| 4 | `2026-08-31T21-24-11-541Z` | 108,708 | 27 |
| 5 | `2026-08-31T21-28-10-966Z` | 50,364 | 12 |

**Median weighted:** **60,852** (49k – 109k)  
**Tail >120k:** 0/5  
**Log:** `artifacts/experiments/harness-owned-verify-v1.1/2026-08-31T21-16-39Z.log`

---

## Scorecard vs v2.1

| Metric | v2.1 | v2.2 |
|--------|------|------|
| Median weighted | ~78k | **~61k** |
| Worst run | 155k | 109k |
| Tail >120k | 1/5 | **0/5** |
| Piped tests (median) | 2 | **0** |
| Debug sidecars (max) | 1 | **0** |
| Harness success | 5/5 | 5/5 |

---

## Locking new runs

Default `npm run challenge` now uses v2.2 (verify on).

Explicit baseline lock script (5 reps):

```bash
export RUN_EXPERIMENT="phase-f-control-floor-v2.2"
export RUN_ARM="control"
export RUN_INTERVENTION="control-floor-verify"
npm run baseline:lock
```

Log directory: `artifacts/baseline-lock-v2.2/`

Treatment-only script (same config, treatment metadata):

```bash
npm run experiment:verify
```

---

## Comparison rule

All future experiments compare against **v2.2 (~61k median)**, not v2.1 (~78k).

Historical cohorts (v2.1, B, C, VERIFY v1) remain frozen for reference — do not mix config hashes in the same arm.

---

## Code freeze checklist

- [x] `DEFAULT_CONFIG.harness_owned_verify = true` — `src/v2/config.ts`
- [x] Extension + normalizer unchanged from VERIFY v1.1 cohort
- [x] Plain `app-template` (no resource slice)
- [x] Metrics v2 + ledger header preservation
- [x] Frozen verdict doc
- [x] Baseline lock script → v2.2 metadata

**STOP** — no next experiment until preregistered against v2.2.

---

## Cost decomposition (frozen)

Where the ~61k median still goes: [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md) — **FROZEN ANALYSIS** (2026-08-31). Q1 vs Q2 not selected.
