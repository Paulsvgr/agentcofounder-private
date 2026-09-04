# Forensic Phase 2 — Trajectory Fork — CLOSED

**Status:** FINAL / FROZEN (2026-09-02)  
**Baseline reference:** [Control floor v2.2](./control-floor-v2.2-baseline.md) (OFF/OFF, VERIFY v1.1)  
**Prior phase:** Forensic Phase 1 (failure/repair/snowball) — closed at S1 prereg

---

## Phase scope

Analysis-only investigation of **why S1 cohort runs cost ~90–105k vs v2.2 ~50–60k**, after S1 formal **REVERT** with mechanism PASS.

No new Pi cohort runs in this phase. No code or prompt changes.

---

## Locked discovery

The expensive path begins **before any VERIFY error**, at **calls 4–6**, when Pi selects a build strategy:

```text
CHEAP (≈50–65k)
  build required app
  → write compact journey tests
  → VERIFY (span 1–2)
  → repair if needed
  → finish

EXPENSIVE (≈90–109k)
  keep building
  → polish / invent extra scope
  → write larger or more verbose tests
  → refine tests / tsc
  → VERIFY late
  → larger repair surface
```

**S1 is downstream protection.** It can help when repair stops converging; it cannot prevent Pi from arriving at first VERIFY having already spent ~50–60k.

**Q2 timing/structure arms are closed for this problem class:**

| Arm | Verdict | Why not retried |
|-----|---------|-----------------|
| Q2-D early auto-VERIFY | REVERT (mechanism PASS) | Timing after monolithic write; +median cost |
| Q2-E test structure (+1 guard) | REVERT (mechanism PASS) | Hard structure; +148k median; guard-rejection tax |
| Q2-C pre-VERIFY blocking | REVERT | +118% median pre-allowed |
| Q2-B VERIFY repair coaching | REVERT | Worsened VERIFY→PASS |

---

## Three-cause attribution (cohort level)

| Cause | Verdict | Notes |
|-------|---------|-------|
| **Prompt/contract pressure** | Partial | Empty states/validation supported; “smallest sufficient suite” violated by granular runs |
| **Pi scope expansion** | Strong in tails | search, sort, undo — no idea/prompt support |
| **Model variance** | Strong on timing/verbosity | Same optional feature + immediate VERIFY can still be cheap (v2.2 Rep5) |

**First divergence** is not single-event — it is **strategy at call 4–6**: test-soon vs build-complete vs feature invention.

---

## Evidence artifacts (frozen)

| Document | Content |
|----------|---------|
| [s1-vs-v22-call-comparison.md](./s1-vs-v22-call-comparison.md) | Call-by-call weighted decomposition |
| [s1-first-verify-authoring-forensic.md](./s1-first-verify-authoring-forensic.md) | What Pi authored by first VERIFY |
| [trajectory-fork-forensic.md](./trajectory-fork-forensic.md) | Scope / delay / granularity / prompt map / per-run decision trees |
| `artifacts/forensic/first-verify-authoring-forensic.v1.json` | Machine-readable metrics at first VERIFY |
| `artifacts/forensic/trajectory-fork-analysis.v1.json` | Scope timeline + call classification |

**Runs in evidence set:**

- v2.2 cheap: Rep2/3/5 (49–61k)
- v2.2 tail bridge: Rep4 (109k)
- S1 near-parity: Rep1 (65k)
- S1 expensive: Rep2–5 (89–105k)

---

## Program implication (locked intent)

**Next authorized experiment class:** influence **pre-VERIFY strategy** at calls 4–6 — not CSS reduction, not faster error repair, not raw test-count limits, not Q2-E-style hard structure.

**Preregistration:** [experiment-scope-sequence-v1-preregistration.md](./experiment-scope-sequence-v1-preregistration.md) — design only; **Anchor A + message locked**; **not implemented** at phase close.

**Not authorized by this phase:**

- S2 / Error Memory implementation
- S1 promotion to default baseline
- Q2-D / Q2-E / Q2-C reruns or variants
- Implementation of scope-sequence treatment before prereg freeze + review

---

## Phase 1 artifacts (still valid, upstream)

- `artifacts/forensic/failure-implementation-study-v1.json`
- `artifacts/forensic/error-mutation-tracking-v1.json`
- `artifacts/forensic/matched-repair-strategy-v1.json`
- `artifacts/forensic/first-verify-corpus-v1.json`

Phase 2 does not supersede Phase 1 snowball/convergence findings; it locates **ordinary expensive runs** (89–105k) upstream of S1's lever.
