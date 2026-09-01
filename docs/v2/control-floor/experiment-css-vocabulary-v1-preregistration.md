# Experiment CSS Vocabulary v1 — preregistration

**Status:** PREREGISTERED — treatment frozen (2026-09-01)  
**Experiment:** `css-vocabulary-v1`  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) (VERIFY v1.1, frozen)  
**Cost decomposition context:** [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md)

---

## Hypothesis

Providing Pi with a preinstalled CSS vocabulary — a large implementation stylesheet plus a tiny, trustworthy class contract — will remove the single-call CSS authoring step observed in the v2.2 baseline (~299 lines / ~1,646 output tokens per run) without making runs more expensive or app quality worse.

**Modest claim for KEEP:**

> The CSS system removed CSS-authoring work without making runs more expensive.

We do **not** preregister a claim that CSS reduces total weighted cost by X%. That stronger claim would need more runs or later replication.

---

## Treatment (frozen — implemented 2026-09-01)

v2.2 plus a preinstalled CSS design system in the app template (`app-template/src/styles.css`, `app-template/AGENTS.md` CSS vocabulary section, seed `App.tsx` on vocabulary classes):

- Large implementation stylesheet (hundreds to ~2,000 lines) shipped in the template
- Tiny contract (~20 classes, ~400–600 tokens) describing class names Pi may use
- Pi must use the CSS vocabulary; Pi should not need to read the implementation stylesheet
- Escape hatch: custom CSS only when the vocabulary genuinely cannot express the requirement
- Contract instruction: **Accept the default appearance. Do not customise merely to make it prettier.**
- Vocabulary covers **generic interface concepts** (layout, form, button, card, list, etc.), not domain-specific names (`book-card`, `borrower-row`, …)

**Generality limitation:** This experiment tests one app idea (home library). A win here does not prove the vocabulary works across unrelated app domains without later replication.

**Explicitly out of scope:** test-quality fixes (hollow persistence tests, query guards, etc.). Those belong in a future Q2 experiment.

---

## Control

Identical to v2.2 except for the CSS treatment above. Same prompt, same harness toggles, same VERIFY v1.1, same app template seed structure (minus the preinstalled CSS system).

### Frozen baseline cohort (5 runs)

| Rep | Run ID | Weighted | Calls |
|-----|--------|----------|-------|
| 1 | `2026-08-31T21-16-45-263Z` | 78,009 | 18 |
| 2 | `2026-08-31T21-19-44-728Z` | 60,852 | 15 |
| 3 | `2026-08-31T21-22-09-667Z` | 49,449 | 16 |
| 4 | `2026-08-31T21-24-11-541Z` | 108,708 | 27 |
| 5 | `2026-08-31T21-28-10-966Z` | 50,364 | 12 |

**Baseline median weighted:** 60,852 (49k – 109k)

### Baseline CSS behaviour

All five baseline runs follow the same pattern:

```text
read seed (966 B, once) → write ~300 CSS lines in ONE call → never touch CSS again
```

No CSS repair spiral. Pi spends one fairly expensive call generating the stylesheet from scratch.

---

## Frozen CSS classifier

Defined **before** treatment runs. Measures **CSS that Pi itself writes**, not the final `styles.css` file on disk. Final-file LOC is invalid as a cross-arm metric because a preinstalled 2,000-line stylesheet would inflate it in every treatment run regardless of Pi behaviour.

### Data sources

| Source | Used for |
|--------|----------|
| `artifacts/analysis/<runId>/ledger.json` | write/edit metrics, proportional output attribution |
| `artifacts/runs/<runId>/events.jsonl` | `css_read_calls`, `css_read_bytes` (ledger truncates read output to ~200 chars) |

### Per-call definitions

For each model call:

```text
per-file bytes written  = parse "wrote N bytes to PATH" from write/edit tool output
                          (fallback: byte length of written content in tool.paths)

css_bytes(call)         = sum of bytes written to *.css
total_write_bytes(call) = sum of bytes written to all files

css_attributable_output(call) = call.output_tokens × css_bytes / total_write_bytes
```

Proportional byte attribution resolves mixed calls (e.g. App.tsx + styles.css in one call).

### Metrics

| Metric | Definition | Baseline median | Baseline range |
|--------|------------|----------------:|---------------:|
| `css_lines_written` | newlines in all `.css` content written by Pi across the run (repeated rewrites count repeatedly) | 299 | 291–390 |
| `css_bytes_written` | total bytes written to `.css` | 4,789 | 4,502–5,979 |
| `css_attributable_output` | proportional output tokens (formula above) | 1,646 | 1,227–2,100 |
| `css_attributable_weighted` | `css_attributable_output × 3` | 4,938 | 3,681–6,300 |
| `css_context_carry_weighted` | CSS bytes/4 × later calls × 0.1 (reporting only) | — | 718–2,691 |
| `css_write_calls` | calls containing any `.css` write | 1 | 1–1 |
| `css_read_calls` | calls reading a `.css` file (events.jsonl) | 1 | 0–1 |
| `css_read_bytes` | total bytes returned by read tool for `.css` paths (events.jsonl) | 966 | 0–966 |
| `inline_style_edits` | occurrences of `style={{` in write/edit details | 0 | 0–0 |

### True CSS cost (baseline, reporting)

Including context carry (CSS content re-sent as cache reads on subsequent calls):

| Rep | CSS write (weighted) | Context carry (weighted) | Total CSS | Run total | Share |
|-----|---------------------:|-------------------------:|----------:|----------:|------:|
| 1 | 5,892 | 1,597 | 7,489 | 78,009 | 9.6% |
| 2 | 4,938 | 718 | 5,656 | 60,852 | 9.3% |
| 3 | 4,653 | 1,130 | 5,783 | 49,449 | 11.7% |
| 4 | 6,300 | 2,691 | 8,991 | 108,708 | 8.3% |
| 5 | 3,681 | 900 | 4,581 | 50,364 | 9.1% |

**Mean CSS share of total weighted cost:** 9.6% (range 8.3–11.7%). Ceiling saving ≈ 5,900 weighted tokens per run.

---

## Frozen visual / quality baseline

Recovered from existing human overlay reviews (`artifacts/runs-overlay.json`, author: paul). No new visual scoring session.

| Rep | Run ID | app_rating | usability_ux | data_state_persistence | robustness |
|-----|--------|----------:|-------------:|-----------------------:|-----------:|
| 1 | `2026-08-31T21-16-45-263Z` | 69 | 29 | 20 | 20 |
| 2 | `2026-08-31T21-19-44-728Z` | 69 | 29 | 20 | 20 |
| 3 | `2026-08-31T21-22-09-667Z` | 68 | 28 | 20 | 20 |
| 4 | `2026-08-31T21-24-11-541Z` | 48 | 28 | 0 | 20 |
| 5 | `2026-08-31T21-28-10-966Z` | 67 | 27 | 20 | 20 |

**Cohort summary:** app_rating median 68 (range 48–69); usability_ux median 28/30 (range 27–29).

The 48/100 run (rep 4) is a known persistence failure (hollow test), not a visual-quality failure. It is **not** used as a quality floor.

**No “CSS wins because UI looks better” route.** UX rubric is saturated at 28–30/30 and cannot reliably measure visual improvement.

---

## Success criteria

### 1. CSS mechanism (primary proof)

All three must pass:

| Criterion | Threshold |
|-----------|-----------|
| Median `css_lines_written` | **≤ 60** (≥80% reduction from baseline median 299) |
| Median `css_attributable_output` | **≤ 330** (≥80% reduction from baseline median 1,646) |
| Anti-bimodality | **≥ 4/5 runs ≤ 100 CSS lines** |

Specificity: 0/5 baseline runs pass any of these thresholds (lowest baseline observation: 291 lines, 4.8× above the 60-line threshold).

### 2. Cost non-inferiority (regression guard only)

Total weighted cost **cannot** prove the ~6k saving at n=5. Power at the 5,900w ceiling is ~68%. Cost metrics are guardrails, not proof of mechanism.

| Criterion | Threshold | Rationale |
|-----------|-----------|-----------|
| Median weighted total | **≤ 80,000** | 1.32× baseline median; ~5.4% false-alarm rate under true equality (pooled log-sd 0.319 from 25 runs across 5 cohorts; lognormal fit) |
| Hard regression tripwire | **0/5 runs > 140,000** | ~2.3% spurious fire rate under true equality |

**Not used:** median ≤ 75,000 (10.9% false-alarm rate — too tight for a guardrail).

**Directional only (relocation signal, not a verdict gate):** total output tokens. If CSS output drops but total output stays flat, styling work may have relocated into JSX/class deliberation rather than disappeared.

### 3. Quality floors (must not regress)

| Criterion | Threshold |
|-----------|-----------|
| Median `app_rating` | **≥ 68** |
| Median `usability_ux` | **≥ 28** |
| Individual UX floor | **no run < 27** |
| Persistence failures | **≤ 1/5** (no worse than baseline) |
| Robustness failures | **0/5** (no worse than baseline) |

Reviewed post-run using the same human overlay rubric as baseline.

### 4. Contract tripwires (separate from cost outcomes)

| Tripwire | Threshold | Rationale |
|----------|-----------|-----------|
| `css_read_bytes` | **> 5,000 in any run = contract failure** | Baseline reads 966 B (full seed). A read of the huge implementation stylesheet would be tens of KB. |
| Inline styling | **Repeated or substantive inline styling used as replacement for the CSS vocabulary = contract failure** | Baseline = 0. A single trivial inline style is tolerated; the rule targets evasion, not one-off exceptions. |

---

## Verdict table

Evaluated in order. First matching row wins.

| # | CSS mechanism | Cost | Quality | Verdict |
|---|---------------|------|---------|---------|
| 1 | ✅ thresholds met | ✅ median ≤80k, 0/5 >140k | ✅ no regression | **KEEP** |
| 2 | ✅ thresholds met | ✅ median ≤80k, 0/5 >140k | ❌ regression | **REVERT** |
| 3 | ✅ thresholds met | ❌ median >80k or any run >140k | any | **RELOCATED** |
| 4 | ❌ thresholds missed, partial adoption | any | any | **RELOCATED** |
| 5 | ❌ thresholds missed, no adoption | any | any | **REVERT** |
| 6 | Contract tripwire fired (`css_read_bytes` >5k or substantive inline-style evasion) | any | any | **REVERT** (contract failed) |

### Verdict meanings

- **KEEP** — CSS authoring work removed; runs not worse; quality intact. Ship the CSS vocabulary into the control floor.
- **RELOCATED** — CSS metric improved but cost rose or adoption was partial; styling work moved elsewhere rather than disappearing.
- **REVERT** — No mechanism win, quality regression, contract failure, or catastrophic cost regression. Remove treatment.

---

## Protocol

1. Implement CSS treatment per spec above (after this preregistration is reviewed).
2. Run **5 treatment reps** against v2.2 + CSS vocabulary.
3. Apply frozen classifier to all 5 treatment runs.
4. Human overlay review of all 5 treatment apps (same rubric as baseline).
5. Apply verdict table. No post-hoc threshold changes.

---

## What this experiment does not test

- Total weighted cost reduction as a primary outcome (underpowered at n=5)
- Visual quality improvement (UX rubric saturated; no KEEP route via “looks better”)
- Test authoring quality (hollow/brittle tests — future Q2 / query-guard experiment)
- Cross-app generality (single app idea only)

---

## References

- Baseline: [control-floor-v2.2-baseline.md](./control-floor-v2.2-baseline.md)
- Cost decomposition: [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md)
- Human overlay source: `artifacts/runs-overlay.json`
