# Experiment CSS Vocabulary v1 — analysis & frozen verdict

**Status:** CLOSED — **REVERT** (2026-09-01)  
**Experiment:** `css-vocabulary-v1`  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) (VERIFY v1.1, frozen)  
**Preregistration:** [experiment-css-vocabulary-v1-preregistration.md](./experiment-css-vocabulary-v1-preregistration.md)

> **Formal verdict: REVERT** (contract tripwire fired in rep 4).  
> **Engineering conclusion:** CSS-authoring mechanism strongly validated; v1 implementation/encapsulation failed in 1/5 runs. See [v1.1 preregistration](./experiment-css-vocabulary-v1.1-preregistration.md).

---

## Headline

The CSS idea worked much better than the formal REVERT suggests.

| Layer | Verdict |
|-------|---------|
| Preregistered CSS v1 | **REVERT** |
| CSS-authoring mechanism | **VERY STRONG PASS** |
| Economic signal | **Very encouraging, not definitive** |
| Integration / API design | **Needs v1.1** |
| CSS implementation quality | **Needs fixes** |
| Core idea | **KEEP INVESTIGATING** |

---

## Cohort comparison (CSS v1 vs v2.2)

| Metric | v2.2 baseline | CSS v1 treatment | Change |
|--------|--------------:|-----------------:|-------:|
| Median weighted | 60,852 | **47,126** | **−22.6%** |
| Median output tokens | 9,326 | **6,043** | **−35%** |
| Median model calls | 16 | 17 | ~same |
| First VERIFY call (median) | 10 | **7** | earlier |
| CSS lines written by Pi | ~299 | **0** | **−100%** |
| CSS attributable output | ~1,646 | **0** | **−100%** |
| Inline `style={{…}}` edits | 0 | **0** | no relocation |
| Harness success | 5/5 | **5/5** | preserved |

### Phase split (Metrics v2, cumulative weighted)

Improvement concentrated in the phase CSS was designed to attack:

| Phase | v2.2 median | CSS v1 median | Notes |
|-------|------------:|--------------:|-------|
| Before first VERIFY | 36,202 | **25,366** | **−30%** — predicted win |
| VERIFY → canonical green | 8,950 | 10,487 | ~not improved |
| Canonical → valid full green | 1,317 | 1,483 | ~same |
| Post valid full green | 7,116 | 6,500 | ~same |

VERIFY→PASS did not improve. CSS attacked the **left side** of the trajectory (`build app → first VERIFY`) and that is exactly where savings appear.

---

## Full 5-run distribution (CSS v1)

| Rep | Run ID | Weighted | Calls | Canon fail | VERIFY | CSS lines | CSS read bytes | Status |
|-----|--------|----------:|------:|-----------:|-------:|----------:|---------------:|--------|
| 1 | `2026-08-31T23-40-44-622Z` | 47,126 | 18 | 1 | 2 | 0 | 0 | success |
| 2 | `2026-08-31T23-43-20-859Z` | **31,921** | **9** | 0 | 1 | 0 | 0 | success |
| 3 | `2026-08-31T23-44-57-302Z` | 85,873 | 28 | 3 | 4 | 0 | 0 | success |
| 4 | `2026-08-31T23-48-07-730Z` | 79,263 | 17 | 2 | 3 | 0 | **24,542** | success |
| 5 | `2026-08-31T23-51-01-441Z` | **36,873** | **10** | 0 | 1 | 0 | 0 | success |

**Distribution:** 32k · 37k · 47k · 79k · **86k**  
**Median weighted:** **47,126** (31,921 – 85,873)  
**Tail >140k:** **0/5**

Rep 2 and rep 5 are near-perfect trajectories: inspect → build → tests → VERIFY PASS → build → finish (9–10 calls, 32–37k).

---

## Per-rep narrative

### Rep 1 — 47k

Zero CSS read, zero CSS write. First VERIFY failed 6/8 (test problems: ambiguous `"Novel"` matching, button label mismatch). Pi repaired tests and made one product tweak (`"Lent out"` → `"Show lent out"`) because its test expected a more specific accessible name. Still only 47k.

### Rep 2 — 32k (best demonstration)

Cleanest CSS hypothesis run. Pi built the app, wrote no CSS, did not inspect CSS, first VERIFY passed 6/6, build passed, finished. **9 calls. 31.9k.**

### Rep 3 — 86k (CSS innocent)

CSS perfect (0 read, 0 write). Expensive because of test-authoring/debug spiral: suite FAIL 0/0 → fix test → VERIFY → expectation failures → debug sidecar → blocked piped vitest → multiple re-reads/edits → PASS. Three canonical VERIFY failures before green; repairs mostly in `App.test.tsx`. Confirms Q2 (test quality) remains the next major bottleneck after CSS.

### Rep 4 — 79k (contract failure)

Second model call read the full implementation stylesheet (~24.5 KB) despite AGENTS.md instruction not to. Immediately used undocumented API:

- Hidden classes: `ui-form-3col`, `ui-field-span-full`, `ui-header-row`, …
- Hidden attributes: `data-state="highlight"`, `data-tone="warning"`, `data-tone="success"`

These exist only in the implementation, not the 21-class public contract. Stylesheet read paid context cost **and** collapsed the abstraction boundary — exactly the B/C failure mode in miniature. Prereg tripwire (`css_read_bytes` > 5,000) correctly fired.

Rep 4 also exposed a CSS quality bug: `.ui-list-item[data-state="highlight"]` defined a light `#fffbeb` background **after** the dark-mode media query, so in `prefers-color-scheme: dark` the later rule wins and text (~#f8fafc) sits on near-white (~1.01:1 contrast).

Metrics v2: `first_valid_full_green_call = null` — Pi edited tests after VERIFY PASS without re-verifying (harness hole, not a CSS issue).

### Rep 5 — 37k

Near-perfect clean run. Same shape as rep 2: 10 calls, 36.9k, zero CSS interaction.

---

## Preregistered criteria scorecard

### 1. CSS mechanism — **PASS**

| Criterion | Threshold | Result |
|-----------|-----------|--------|
| Median `css_lines_written` | ≤ 60 | **0** ✅ |
| Median `css_attributable_output` | ≤ 330 | **0** ✅ |
| Anti-bimodality (≥ 4/5 ≤ 100 lines) | ≥ 4/5 | **5/5** ✅ |

### 2. Cost guardrails — **PASS**

| Criterion | Threshold | Result |
|-----------|-----------|--------|
| Median weighted | ≤ 80,000 | **47,126** ✅ |
| Hard regression | 0/5 > 140,000 | **0/5** ✅ |

Cost guardrails pass, but n=5 cannot prove a durable 22% median reduction.

### 3. Quality floors — **pending human overlay**

Treatment apps were reviewed informally (user: “really good” except rep 4 dark-mode contrast). Formal overlay scores not yet recorded in `artifacts/runs-overlay.json`. Prereg quality gates require post-run human review before a KEEP verdict could apply regardless.

### 4. Contract tripwires — **FAIL**

| Tripwire | Threshold | Result |
|----------|-----------|--------|
| `css_read_bytes` | > 5,000 in any run | Rep 4: **24,542** ❌ |
| Inline styling evasion | substantive use | **0** ✅ |

**Verdict row 6 → REVERT (contract failed).**

---

## Architecture findings (inputs for v1.1)

### Shadow API

AGENTS.md documents **21** public classes. The v1 stylesheet contained **40** distinct `ui-*` selectors — **19 undocumented**, plus `data-state` / `data-tone` attribute modifiers. Rep 4 proves: as long as Pi never reads the stylesheet the shadow API is harmless; one read collapses the boundary.

### AGENTS.md self-conflict

Contract says **do not read** `src/styles.css` but also allows **append custom CSS** to the same file — an escape hatch that names the forbidden path.

### Task-specific tuning

Stylesheet section header: *“Extended responsive tuning for common library-app layouts”* — too tailored to the book-library experiment idea; base CSS should stay domain-neutral.

### Work relocation check

Median non-CSS source did not grow; output tokens fell 35%. No evidence that CSS lines relocated into equivalent JSX volume.

---

## Frozen verdict

**REVERT — do not promote v1 stylesheet to v2.3.**

Rationale:

- Contract tripwire fired (rep 4 full stylesheet read + shadow API usage).
- Formal verdict table row 6 applies regardless of mechanism and cost wins.

**Do not abandon the CSS idea.** Mechanism passed 5/5; failure mode is narrow, understood, and repairable. Follow-up: [experiment-css-vocabulary-v1.1-preregistration.md](./experiment-css-vocabulary-v1.1-preregistration.md).

---

## References

- Preregistration: [experiment-css-vocabulary-v1-preregistration.md](./experiment-css-vocabulary-v1-preregistration.md)
- Baseline: [control-floor-v2.2-baseline.md](./control-floor-v2.2-baseline.md)
- Cost decomposition: [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md)
- Export: `artifacts/exports/cohort-css-vocabulary-v1-2026-09-01.zip`
- Run log: `artifacts/experiments/css-vocabulary-v1/`
