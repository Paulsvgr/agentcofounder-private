# Experiment VERIFY v1.1 — analysis & frozen verdict

**Status:** CLOSED — **KEEP** (2026-08-31)  
**Verdict:** **Promote VERIFY v1.1 to active baseline (Control floor v2.2).**  
**Experiment:** `harness-owned-verify-v1.1`  
**Treatment:** frozen Control v2.1 + harness-owned VERIFY only — no resource slices, no other harness changes.

> **n=5:** Strong evidence for promotion within this harness series. Not definitive statistical proof; future cohorts should compare against v2.2, not re-litigate v1.1.

---

## Experiment design

```text
Control v2.1 (Exp1 + Exp2 + Exp3 + Exp6b + Exp6c + D1 + port hygiene)
+
Harness-owned VERIFY v1.1
  - verify tool (real exit_code + compact reporter)
  - block Pi piped/direct test bash
  - tests_run normalizer alias (name/status → command/journey/result)
  - extension prompt: correct report.partial.json shape
=
sole treatment
```

**Not in treatment:** B/C resources, new recipes, browser tests, stop-logic changes, server-lifecycle fixes, error-memory agent.

**Log:** `artifacts/experiments/harness-owned-verify-v1.1/2026-08-31T21-16-39Z.log`

---

## Full 5-run distribution (VERIFY v1.1)

| Rep | Run ID | Weighted | Calls | Canon green @ | Fail bef. green | Verify | Piped | Sidecars | Post-valid-green | Status |
|-----|--------|----------|-------|---------------|-----------------|--------|-------|----------|------------------|--------|
| 1 | `2026-08-31T21-16-45-263Z` | 78,009 | 18 | 16 | 2 | 3 | 0 | 0 | 2 | success |
| 2 | `2026-08-31T21-19-44-728Z` | 60,852 | 15 | 11 | 0 | 1 | 0 | 0 | 3 | success |
| 3 | `2026-08-31T21-22-09-667Z` | 49,449 | 16 | 13 | 1 | 2 | 0 | 0 | 2 | success |
| 4 | `2026-08-31T21-24-11-541Z` | 108,708 | 27 | 23 | 2 | 3 | 0 | 0 | 3 | success |
| 5 | `2026-08-31T21-28-10-966Z` | 50,364 | 12 | 9 | 1 | 2 | 0 | 0 | 2 | success |

**Distribution:** 49k · 50k · 61k · 78k · **109k**  
**Median weighted:** **60,852**  
**Range:** 49,449 – 108,708  
**Tail >120k:** **0/5**

### Quality (all reps)

| Gate | Result |
|------|--------|
| Harness Vitest + build + dev | **5/5** |
| `result.status` | **5/5 success** |
| `pi_exit_code` | **5/5 = 0** |
| `tests_run` schema | **5/5** valid `{ command, journey, result }` |

(v1 failed 0/5 on harness exit due to report schema — fixed in v1.1.)

---

## Metrics v2 comparison vs frozen Control v2.1

Control v2.1 run IDs: `2026-08-31T12-46-51-224Z` … `13-05-01-562Z`  
Metrics: `artifacts/analysis/<run-id>/trajectory.v2.json`

| Metric | Control v2.1 | VERIFY v1.1 | Δ |
|--------|--------------|-------------|---|
| **Weighted distribution** | 72k · 78k · 72k · 100k · **155k** | 49k · 50k · 61k · 78k · **109k** | tighter, lower tail |
| **Median weighted** | **77,761** | **60,852** | **~22% lower** |
| **Worst run** | 155,459 | 108,708 | **−30%** |
| **Tail >120k** | 1/5 | **0/5** | tail removed |
| **Median calls to canon green** | 16 | 13 | faster green |
| **Median fail before green** | 1 | 1 | same repair class |
| **Median unknown before green** | 0 | 0 | explicit FAIL visible |
| **Median verify calls** | 0 | 2 | intended mechanism |
| **Median piped tests** | 2 | **0** | mechanism works |
| **Max debug sidecars** | 1 | **0** | no sidecar spirals |
| **Median post-valid-green** | 3 | 2 | slightly less post-green |
| **Harness / success / exit** | 5/5 / 5/5 / 5/5 | 5/5 / 5/5 / 5/5 | no quality loss |

### vs VERIFY v1 (invalid exit — mechanism only)

| Metric | VERIFY v1 | VERIFY v1.1 |
|--------|-----------|-------------|
| Median weighted | ~92k | **~61k** |
| Worst run | **178k** (7 FAIL spiral) | **109k** (2 FAIL) |
| Tail >120k | 1/5 | **0/5** |
| Harness exit OK | 0/5 | **5/5** |
| Debug sidecars | max 1 | **0** |

Rep 4 (109k) trajectory: `@14 fail → @18 fail → @23 pass` — controlled repair, not the v1 `@11–@32` seven-FAIL spiral.

---

## What worked

1. **Mechanism:** Pi used `verify`; piped/direct test bash blocked; real `verify exit_code=N` preserved in ledger for Metrics v2.
2. **Cost:** Median down ~22%; worst case down 30%; no >120k tail in n=5.
3. **Repair feedback:** Explicit FAIL (not UNKNOWN) — agent sees authoritative pass/fail.
4. **Quality:** Full journey coverage, harness green, clean exit — first intervention in this series that improves cost **and** preserves quality.
5. **Experiment hygiene:** Single treatment on plain template; Metrics v2 validated before spend.

---

## What we are not claiming

- n=5 does not prove the median will stay at 61k forever.
- One cohort cannot rule out occasional >120k runs at lower probability.
- VERIFY does not eliminate repair loops when tests genuinely fail — it makes them **shorter and better instrumented**.
- B/C resource slices remain **closed**; do not combine with VERIFY without a new preregistered experiment.

---

## Frozen verdict

**KEEP — promote VERIFY v1.1 to active baseline (Control floor v2.2).**

Rationale:

- Fixes the mechanism we designed (trusted verification, no piped bash).
- Improves cost distribution without quality regression.
- Clean 5/5 procedural success (unlike v1).
- First strong, single-intervention win in the v2.1+ experiment line.

---

## Baseline promotion

| | v2.1 | **v2.2 (active)** |
|---|------|-------------------|
| **Name** | Control floor v2.1 | **Control floor v2.2 / VERIFY baseline** |
| **Contents** | Exp1–Exp6c + D1 | **Same + harness_owned_verify=true** |
| **Locked cohort** | `12-46-51` … `13-05-01` | **`21-16-45` … `21-28-10`** (VERIFY v1.1 reps) |
| **Median weighted** | ~78k | **~61k** |
| **Config** | `harness_owned_verify: false` | **`harness_owned_verify: true`** (default) |

Details: [control-floor-v2.2-baseline.md](./control-floor-v2.2-baseline.md)

---

## Historical references

| Doc | Role |
|-----|------|
| [experiment-verify-v1-verdict.md](./experiment-verify-v1-verdict.md) | v1 closed — invalid exit |
| [experiment-verify-v1-analysis.md](./experiment-verify-v1-analysis.md) | v1 deep dive |
| [harness-owned-verify.md](./harness-owned-verify.md) | Mechanism spec |
| [trajectory-metrics-v2.md](./trajectory-metrics-v2.md) | Measurement spec |
| [control-floor-v2.1-analysis.md](./control-floor-v2.1-analysis.md) | Prior active baseline |

---

## Next (explicitly not started)

Do **not** start the next experiment until a new hypothesis is preregistered against **v2.2 (~61k median)**.
