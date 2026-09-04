# Experiment Tail Sweep v1 — preregistration

**Status:** PREREGISTERED (2026-09-03)  
**Experiment ID:** `tail-sweep-v1`  
**Short label:** Harness-owned final sweep after `report.partial.json`  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) — same config except `HARNESS_TAIL_SWEEP_V1=1`

> **Scope boundary.** This experiment changes **only end-of-run behavior**:
>
> After Pi writes `report.partial.json`, the harness runs **test + build + localhost:3000 probe** in one sweep and steers Pi to stop immediately.
>
> **Out of scope:** CSS vocabulary, persistence template, robustness prompts, scope/sequence, convergence, early verify, test structure, or any other overlay.

---

## Problem statement

Post-green tail calls on v2.2 cost roughly **~9k weighted median (~10%)** after the last product mutation:

- Pi re-runs `npm run build` for “final confirmation”
- Pi writes a closing “here’s what I built” summary

These calls add little product value and often break prompt cache (`cacheRead=0` on tail turns).

---

## Treatment

When `HARNESS_TAIL_SWEEP_V1=1`:

1. Prompt: after `verify` PASS, write `report.partial.json` immediately — do **not** run build/dev manually.
2. On `report.partial.json` write (`tool_result`): harness runs the same sweep as post-Pi `verifyGeneratedApp` (vitest JSON + build + dev probe).
3. Harness steers compact PASS/FAIL result and instructs Pi to **stop immediately** (no summary, no re-verify).
4. Post-report `npm run build` / `npm run dev` bash is blocked.
5. Export `tail-sweep.v1.json` per run.

Pi still writes `report.partial.json` (schema-required partial report). Harness still runs post-Pi verification for audit parity.

---

## Primary gates (5-run cohort vs v2.2 control)

| Gate | Metric | Pass |
|------|--------|------|
| **A — Mechanism** | `tail-sweep.v1.json` fired on 5/5 successful reps | 5/5 |
| **B — Functional** | `status: success` on ≥4/5 reps | ≥4/5 |
| **C — Cost** | Median weighted ≤ v2.2 control (~61k) | ≤ baseline |
| **D — Tail reduction** | Median post-last-mutation weighted cost ↓ vs control | measurable ↓ |
| **E — Cache** | Median `cachedOfPrev` ≥ control or tail `cacheRead=0` turns ↓ | non-regress |

---

## Verdict table

| Verdict | Condition |
|---------|-----------|
| **KEEP** | A + B pass and C shows ≥10% median savings without B regression |
| **REVERT** | B fails, or C regresses >10% vs control, or mechanism misfires |
| **RELOCATED** | B passes, tail savings real, but total median inconclusive — carry as engineering note |

---

## Run command

```bash
npm run experiment:tail-sweep-v1
```

Environment:

```bash
HARNESS_OWNED_VERIFY=1
HARNESS_TAIL_SWEEP_V1=1
# all other experiment flags OFF
```

---

## Related docs

- [No-summary prose change](./tail-sweep-no-summary-prose.md) — documented separately from sweep mechanics
