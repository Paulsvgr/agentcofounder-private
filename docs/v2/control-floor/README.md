# V2 control floor (Phase F subset)

This folder documents the **domain-neutral control floor** ported into `agentcofounder` before any V2 product experiments (planner, component assembly, etc.).

## What is in the baseline

| Doc | Phase F | What it does | Code touched |
|-----|---------|--------------|--------------|
| [exp1-rtl-cleanup.md](./exp1-rtl-cleanup.md) | Exp1 | Unmount React trees after each test | `app-template/src/test/setup.ts` |
| [exp2-stop-rule.md](./exp2-stop-rule.md) | Exp2 | Stop re-running tests/build after green | `solution/system-prompt.md`, `solution/skills/mvp-builder/SKILL.md`, `app-template/AGENTS.md` |
| [exp3-test-policy.md](./exp3-test-policy.md) | Exp3 | Smallest journey suite + safer queries | `solution/system-prompt.md`, `solution/skills/mvp-builder/SKILL.md` |
| [exp6-compact-reporter.md](./exp6-compact-reporter.md) | Exp6b | PASS N/N + compact FAIL output | `app-template/compactFailureReporter.ts`, `app-template/vitest.config.ts` |
| [exp6c-false-pass-fix.md](./exp6c-false-pass-fix.md) | Exp6c | No false `PASS 0/0` on suite/transform failure | `app-template/compactFailureReporter.ts` |
| [d1-smoke-separation.md](./d1-smoke-separation.md) | D1 | Resource smoke before Pi; not in workspace | `resources/smoke/`, `scripts/assemble-resources.ts` |
| [harness-owned-verify.md](./harness-owned-verify.md) | D1 | Harness-owned test verification (VERIFY) | `solution/extensions/harness-owned-verify.ts`, `HarnessConfig.harness_owned_verify` |
| [experiment-verify-v1-analysis.md](./experiment-verify-v1-analysis.md) | VERIFY v1 | Deep analysis (5 reps, invalid exit) | — |
| [experiment-verify-v1-verdict.md](./experiment-verify-v1-verdict.md) | VERIFY v1 | Frozen verdict — superseded by v1.1 | — |
| [experiment-verify-v1.1-analysis.md](./experiment-verify-v1.1-analysis.md) | VERIFY v1.1 | **KEEP — promoted to v2.2 baseline** | — |
| [control-floor-v2.2-baseline.md](./control-floor-v2.2-baseline.md) | **v2.2** | **Active VERIFY baseline** | `src/v2/config.ts` (default verify on) |
| [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md) | **v2.2** | **Frozen cost decomposition** — Q1/Q2 open | — |
| [trajectory-cohort-retro.md](./trajectory-cohort-retro.md) | Retro | Control + B + C trajectory metrics | `scripts/analyze-cohort-trajectory.ts` |

## What is deliberately **not** in the baseline

See [not-included-exp5-primitives.md](./not-included-exp5-primitives.md).

Template seed libraries (`collectionStore`, `useCollection`, `text`, `memoryStorage`) and the Exp4 NL failure digest prompt are **future experiments**, not baked into this floor.

## Locking runs

```bash
# v2.2 active baseline (VERIFY on by default)
export RUN_EXPERIMENT="phase-f-control-floor-v2.2"
export RUN_ARM="control"
export RUN_INTERVENTION="control-floor-verify"
npm run baseline:lock
```

Reproduce v2.1 (no verify): `HARNESS_OWNED_VERIFY=0 npm run challenge`

Historical cohorts stay as-is for comparison.

| Cohort | Locked | Median weighted | Notes |
|--------|--------|-----------------|-------|
| **v1** | 2026-08-30 | ~94k | Exp6, pre-PASS line, pre-D1 |
| **v2** | 2026-08-30 | ~106k (42k–232k) | Exp6b + D1; [analysis](./control-floor-v2-analysis.md) |
| **v2.1** | 2026-08-31 | ~78k (72k–155k) | + Exp6c; superseded by v2.2 |
| **v2.2** | **2026-08-31** | **~61k** (49k–109k) | **+ VERIFY v1.1; active baseline** |

### v2.2 scorecard (5/5 OK) — locked via VERIFY v1.1 cohort

| Rep | Run ID | Weighted | Calls |
|-----|--------|----------|-------|
| 1 | `2026-08-31T21-16-45-263Z` | 78k | 18 |
| 2 | `2026-08-31T21-19-44-728Z` | 61k | 15 |
| 3 | `2026-08-31T21-22-09-667Z` | 49k | 16 |
| 4 | `2026-08-31T21-24-11-541Z` | 109k | 27 |
| 5 | `2026-08-31T21-28-10-966Z` | 50k | 12 |

Log: `artifacts/experiments/harness-owned-verify-v1.1/2026-08-31T21-16-39Z.log`

Verdict: [experiment-verify-v1.1-analysis.md](./experiment-verify-v1.1-analysis.md)  
Baseline doc: [control-floor-v2.2-baseline.md](./control-floor-v2.2-baseline.md)

### v2.1 scorecard (historical)

| Rep | Run ID | Weighted | Calls |
|-----|--------|----------|-------|
| 1 | `2026-08-31T12-46-51-224Z` | 155k | 37 |
| 2 | `2026-08-31T12-53-10-136Z` | 78k | 20 |
| 3 | `2026-08-31T12-56-26-048Z` | 72k | 18 |
| 4 | `2026-08-31T12-59-28-147Z` | 100k | 23 |
| 5 | `2026-08-31T13-05-01-562Z` | 72k | 17 |

Log: `artifacts/baseline-lock/2026-08-31T12-46-45Z.log`  
Full analysis: [control-floor-v2.1-analysis.md](./control-floor-v2.1-analysis.md)

Next experiments compare against **v2.2 (~61k median)**. Resource slice experiments (B/C) remain closed.

### Active default candidate (post Tailwind KEEP, 2026-09-04)

```text
HARNESS_OWNED_VERIFY=1
HARNESS_ROOT_ERROR_FIRST_V1=1
TEMPLATE_PERSISTENCE=1
TEMPLATE_TAILWIND=1
TEMPLATE_CSS_VOCABULARY=0
```

Styling track closed. Next lever: [next-lever-test-as-oracle.md](./next-lever-test-as-oracle.md) (bad test must not prove product wrong).  
KEEP: [experiment-verify-rtl-evidence-v1-preregistration.md](./experiment-verify-rtl-evidence-v1-preregistration.md) — role+name evidence (mechanism proven; natural cohort inconclusive).  
KEEP: [experiment-verify-rtl-evidence-v1-preregistration.md](./experiment-verify-rtl-evidence-v1-preregistration.md) — role+name evidence.  
KEEP: [experiment-verify-rtl-multiple-evidence-v1-keep.md](./experiment-verify-rtl-multiple-evidence-v1-keep.md) — MULTIPLE candidates (seeded proof; no more random MULTIPLE cohorts).  
NEXT: [roadmap-repair-tail-2026-09-04.md](./roadmap-repair-tail-2026-09-04.md) — 257k diagnosis seed (`tsc` signal) → hard-stop → rtl_text → prompt.  
Offline signal: [offline-257k-startedit-signal.md](./offline-257k-startedit-signal.md).  
Parked prompt: [parked-product-quality-prompt.md](./parked-product-quality-prompt.md).  
Audit: [audit-repair-tail-rtl-text-multiple.md](./audit-repair-tail-rtl-text-multiple.md).

## Source

Verdicts and original Phase F write-up: `ac-control/docs/phase-f-strategy.md` (frozen on `setup/measure`).

## How the prompts fit together (avoid double-reading)

| File | Role | Canonical for |
|------|------|----------------|
| `solution/system-prompt.md` | Harness system prompt | End-to-end requirements |
| `solution/skills/mvp-builder/SKILL.md` | Pi skill steps | Procedure + `getByRole` detail (Exp3) |
| `app-template/AGENTS.md` | Copied into generated app | **`report.partial.json` success rules** and field list |

Duplication was removed where the same rule appeared twice in one file. Cross-file references (`shape in AGENTS.md`, `per AGENTS.md`) are intentional — one source of truth for report semantics.
