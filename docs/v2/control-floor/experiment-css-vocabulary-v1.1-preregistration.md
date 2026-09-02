# Experiment CSS Vocabulary v1.1 — preregistration

**Status:** PREREGISTERED — treatment frozen (2026-09-01)  
**Experiment:** `css-vocabulary-v1.1`  
**Prior experiment:** [CSS Vocabulary v1 analysis](./experiment-css-vocabulary-v1-analysis.md) — REVERT (mechanism PASS, contract FAIL)  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) (VERIFY v1.1, frozen)

---

## Hypothesis

v1 proved Pi can build apps using a preinstalled CSS vocabulary with **zero CSS authoring** and materially lower pre-VERIFY cost. v1 failed because:

1. The implementation contained a **19-class shadow API** Pi discovered when it read the stylesheet (rep 4).
2. Contract enforcement was advisory (“do not read”) rather than deterministic.
3. Implementation had **broken dark-mode state styling** and **library-app-specific tuning**.

v1.1 tests whether the **same 21-class public contract** works when:

- The stylesheet implements **only** those 21 classes (no hidden selectors, no `data-state` / `data-tone`, no `ui-sr-only`).
- Pi **cannot read or write** `src/styles.css` (harness-enforced).
- Automatic dark mode and task-specific layout tuning are **removed**.
- No append-CSS escape hatch in AGENTS.md.

**Modest claim for KEEP (unchanged from v1):**

> The CSS system removed CSS-authoring work without making runs more expensive.

---

## Treatment (frozen — implemented 2026-09-01)

v2.2 plus hardened CSS vocabulary:

| Component | v1 | v1.1 change |
|-----------|----|----|
| Public vocabulary | 21 classes in AGENTS.md | **Same 21 classes — unchanged** |
| Implementation stylesheet | ~1,100 lines + 19 hidden classes + attribute modifiers | **21 classes only; no shadow API** |
| Dark mode | `@media (prefers-color-scheme: dark)` | **Removed** (themes become swappable later) |
| Library-app tuning | `ui-form-3col`, header-row helpers, etc. | **Removed** |
| `ui-sr-only` | Undocumented internal utility | **Deleted** (not part of 21-class contract) |
| Read contract | “Do not read styles.css” (advisory) | **Harness blocks `read` of `src/styles.css`** |
| Write contract | Append custom CSS escape hatch | **Removed; harness blocks `write`/`edit` of `src/styles.css`** |
| VERIFY / tests / Q2 | — | **Untouched** |

**Generality limitation:** Same as v1 — single app idea (home library). A win does not prove cross-domain generality.

---

## Control

Identical to v1 control: v2.2 baseline cohort (5 runs, median weighted 60,852). See [v1 preregistration](./experiment-css-vocabulary-v1-preregistration.md#control).

---

## Frozen CSS classifier

Same as v1 — measures CSS Pi writes, not final file LOC. See [v1 preregistration § Frozen CSS classifier](./experiment-css-vocabulary-v1-preregistration.md#frozen-css-classifier).

### Additional v1.1 metric

| Metric | Definition | Contract threshold |
|--------|------------|-------------------|
| `blocked_css_read_attempts` | Count of blocked `read` tool calls targeting `src/styles.css` (from events.jsonl / extension block reason) | **Any successful read = contract failure** (bytes should be 0) |
| `blocked_css_write_attempts` | Count of blocked `write`/`edit` targeting `src/styles.css` | Reporting only (attempts OK; successful writes = failure via `css_lines_written`) |

A blocked read attempt is **not** a contract failure — it proves enforcement works. A **successful** read (`css_read_bytes` > 0) is a contract failure.

---

## Frozen visual / quality baseline

Same human overlay rubric and v2.2 floors as v1. See [v1 preregistration § Frozen visual baseline](./experiment-css-vocabulary-v1-preregistration.md#frozen-visual--quality-baseline).

**v1.1 addition:** No automatic dark mode — dark-mode contrast failures from v1 cannot recur in v1.1. Light-mode token contrast is out of scope for this experiment (single theme, accept default).

---

## Success criteria

### 1. CSS mechanism (primary proof)

Same thresholds as v1:

| Criterion | Threshold |
|-----------|-----------|
| Median `css_lines_written` | **≤ 60** |
| Median `css_attributable_output` | **≤ 330** |
| Anti-bimodality | **≥ 4/5 runs ≤ 100 CSS lines** |

### 2. Cost non-inferiority (regression guard)

Same as v1:

| Criterion | Threshold |
|-----------|-----------|
| Median weighted total | **≤ 80,000** |
| Hard regression tripwire | **0/5 runs > 140,000** |

### 3. Quality floors

Same as v1:

| Criterion | Threshold |
|-----------|-----------|
| Median `app_rating` | **≥ 68** |
| Median `usability_ux` | **≥ 28** |
| Individual UX floor | **no run < 27** |
| Persistence failures | **≤ 1/5** |
| Robustness failures | **0/5** |

### 4. Contract tripwires (v1.1)

| Tripwire | Threshold | Rationale |
|----------|-----------|-----------|
| Successful CSS read | **`css_read_bytes` > 0 in any run = contract failure** | Harness blocks reads; any bytes means enforcement failed |
| Blocked read attempts | Reporting only | High attempt count signals contract confusion, not automatic REVERT |
| Shadow API usage | **Undocumented class names or `data-state`/`data-tone` in Pi-written JSX = contract failure** | Checked post-run in final `App.tsx` / components |
| Inline styling | Same as v1 — substantive evasion = contract failure | Baseline = 0 |
| Stylesheet write | **`css_lines_written` > 0 = contract failure** | No append hatch; writes also blocked by harness |

---

## Verdict table

Evaluated in order. First matching row wins.

| # | CSS mechanism | Cost | Quality | Contract | Verdict |
|---|---------------|------|---------|----------|---------|
| 1 | ✅ | ✅ | ✅ | ✅ | **KEEP → promote to v2.3** |
| 2 | ✅ | ✅ | ❌ | ✅ | **REVERT** |
| 3 | ✅ | ❌ | any | ✅ | **RELOCATED** |
| 4 | ❌ partial | any | any | ✅ | **RELOCATED** |
| 5 | ❌ no adoption | any | any | ✅ | **REVERT** |
| 6 | any | any | any | ❌ | **REVERT** (contract failed) |

---

## Protocol

1. Implement v1.1 treatment (this document + code changes on `app-template/` and `solution/extensions/protected-paths.ts`).
2. Run **5 treatment reps**: `npm run experiment:css-vocabulary-v1.1 -- 5`
3. Apply frozen classifier + shadow-API scan on all 5 runs.
4. Human overlay review (same rubric as baseline).
5. Apply verdict table. No post-hoc threshold changes.

---

## What this experiment does not test

- Total weighted cost reduction as primary outcome (underpowered at n=5)
- Cross-app generality
- Test authoring quality (Q2 — next experiment after CSS promoted or closed)
- Theme selection / interchangeable themes (future architecture)
- Accessibility utility classes (`ui-sr-only` deferred)

---

## References

- v1 analysis: [experiment-css-vocabulary-v1-analysis.md](./experiment-css-vocabulary-v1-analysis.md)
- v1 preregistration: [experiment-css-vocabulary-v1-preregistration.md](./experiment-css-vocabulary-v1-preregistration.md)
- Baseline: [control-floor-v2.2-baseline.md](./control-floor-v2.2-baseline.md)
