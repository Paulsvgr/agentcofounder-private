# Experiment Q2 — Test Authoring Guard v1 — preregistration

**Status:** PREREGISTERED — frozen (2026-09-02; Amendment 1 same date)  
**Experiment ID:** `test-authoring-guard-v1`  
**Short label:** Q2-C (harness-only pre-VERIFY guard — **not** template authoring)  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) via assembler **OFF/OFF**  
**Canonical base hash:** `1f897f6388754c98f311031dd79600bd65d1ec476e57a43b67ca70f67dad82f6` ([provenance](./template-base-provenance.json))

> **Scope boundary.** This experiment tests **one harness-only hypothesis**: whether a **deterministic pre-VERIFY RTL/test-quality scanner** — blocking canonical `verify` until forbidden patterns are cleared — improves first-VERIFY reliability and total cost **without** post-failure repair coaching.
>
> **It does NOT include** AGENTS.md changes, `queryHelpers.ts`, `memoryStorage`, structured VERIFY FAIL formatters, or repair-first prompts. Those arms are closed or deferred (see [Relationship to prior work](#relationship-to-prior-work)).
>
> **It does NOT claim** to solve expensive pre-VERIFY **product** work (bucket 1 / Q1), runtime persistence, CSS authoring, hollow browser reload, or harness report finalization (`report.partial.json`).

---

## Relationship to prior work

| Prior arm | Verdict | What it proved | Why this arm is next |
|-----------|---------|----------------|----------------------|
| [Q2 test-isolation v1](./experiment-q2-test-isolation-v1-analysis.md) | REVERT | `memoryStorage` mechanism PASS; storage bleed not the repair bottleneck | Problem is upstream test quality, not storage |
| [Q2 verify-repair v1](./experiment-q2-verify-repair-v1-analysis.md) | REVERT | Structured FAIL mechanism PARTIAL PASS; repair loops **more expensive** (~2.2× VERIFY→PASS) | Post-failure feedback arrives **after** brittle tests are written |
| [Exp3](./exp3-test-policy.md) (prompt RTL guidance) | in v2.2 baseline | Prompt-only authoring insufficient alone | Need **deterministic** enforcement, not more prompt text |
| `test-authoring-v1` (template overlay) | **not this experiment** | AGENTS + helpers deferred | This arm tests harness guard **only** — template overlay remains a separate future prereg if guard KEEPs |

**Cohort evidence motivating this arm** ([Q2-B analysis](./experiment-q2-verify-repair-v1-analysis.md), ZIP review):

- ~**16/18** VERIFY failure items: RTL / Testing Library selector brittleness (ambiguous text, duplicate buttons, split DOM text, missing scoped queries).
- Repair context grew heavier per call (input tokens), not output verbosity — guard must act **before** the expensive VERIFY loop.
- 4/5 `result.json` failures were **report-contract** issues (`tests_run: []`) — tracked separately; does not change this prereg’s causal claim.

---

## Problem statement

### Causal chain (this treatment targets)

```text
Pi writes journey tests
    ↓
cheap deterministic RTL guard
    ├─ FAIL → exact pattern + file:line → Pi fixes (no full VERIFY)
    └─ PASS
         ↓
       canonical VERIFY (full npm test)
```

**Out of scope:** product build/recon/styling before tests exist (bucket 1); post-VERIFY repair orchestration (Q2-B closed).

### What the evidence shows

| Signal | Source | Implication |
|--------|--------|-------------|
| Median VERIFY→PASS **~12.4k** (v2.2) vs **~27.1k** (Q2-B) | Cost decomposition + Q2-B | Post-failure coaching **worsens** repair cost |
| VERIFY failures dominated by `TestingLibraryElementError` | Q2 test-isolation + Q2-B cohorts | Brittle selectors are the repeatable failure mode |
| Median pre-VERIFY **~36.2k**; rep 4 wrote **17 tests / ~372 lines** before first VERIFY | Q2-B analysis | Over-built suites before feedback remain a confound — guard must not **add** unbounded fix cycles |
| Appendix A forbidden patterns present at run end | Q2-B prereg scan definition | Patterns are **detectable statically** before VERIFY |

---

## Hypothesis (narrow, falsifiable)

On exact v2.2 (OFF/OFF, **no assembler overlays**), harness extension **`test-authoring-guard-v1`** will:

1. **Increase first-allowed canonical VERIFY pass rate** — when the guard finally permits VERIFY, the suite is more likely to pass on that first allowed run.
2. **Catch forbidden RTL patterns pre-VERIFY** — documented guard violations per run, without pathological block spirals.
3. **Hold pre-VERIFY cost** — guard/fix cycles do not systematically blow up weighted spend before first allowed VERIFY.
4. **Non-regress total cost** — median weighted and tail bounds vs v2.2 guardrails.

**Not claimed:** median total weighted must beat **60,852**; VERIFY→PASS compression is **downstream report only** (expected to improve if hypothesis holds, but not a co-primary gate).

---

## Treatment (harness-only — frozen at implementation)

**v2.2 + pre-VERIFY guard extension only.** Assembler remains **OFF/OFF** for all overlays.

```text
TEMPLATE_CSS_VOCABULARY=0
TEMPLATE_PERSISTENCE=0
TEMPLATE_TEST_ISOLATION=0
HARNESS_VERIFY_REPAIR_V1=0              # explicit off — Q2-B closed
HARNESS_TEST_AUTHORING_GUARD_V1=1       # new harness toggle at implementation
```

| Component | v2.2 OFF/OFF | Q2-C treatment |
|-----------|--------------|----------------|
| Base template / AGENTS.md | `app-template-base` | **unchanged** |
| All assembler overlays | off | **off** |
| Exp3 test policy (prompt) | in baseline | **unchanged** |
| Harness-owned VERIFY v1.1 | on | **unchanged** |
| `verify-repair-v1` extension | off | **off** |
| **`test-authoring-guard-v1` extension** | absent | **on** (see below) |

### Harness extension: `test-authoring-guard-v1`

Intercept the **`verify`** tool **before** spawning `npm test`.

| Step | Behavior |
|------|----------|
| 1 | Scan all `src/**/*.test.ts` and `src/**/*.test.tsx` with [Appendix A](#appendix-a--forbidden-rtl-patterns-frozen-scan-definition) rules (**F1–F5** blocking; **F6** report-only) |
| 2 | **If any F1–F5 hit:** return guard BLOCKED to Pi — **do not run** vitest. Output is **compact and bounded** (see below) |
| 3 | **If only F6 hits (no F1–F5):** do **not** block — proceed to VERIFY; log F6 to guard export for analysis |
| 4 | **If clean (no F1–F5):** proceed with existing harness-owned VERIFY (unchanged canonical pass/fail parsing) |

**Guard BLOCKED output shape** (frozen — **anti–context-inflation**):

```text
guard_result: BLOCKED
guard_violation: <F1|F2|F3|F4|F5>
file: <path:line>
hint: <one-line fix hint from pattern table>
```

**Bounded message rules (frozen at implementation):**

| Rule | Limit |
|------|-------|
| Total tool response size | **≤ 512 characters** |
| Violations per BLOCK response | **1** (first blocking hit by scan order: F1 → F2 → F3 → F4 → F5) |
| Hint length | **≤ 120 characters**, single line |
| Forbidden in BLOCK body | Full test source, stack traces, reporter dumps, multiple file excerpts |

Rationale: Q2-B showed repair feedback inflated **input context** per call; guard feedback must stay cheaper than a VERIFY run.

**Explicitly NOT in this treatment:**

- New AGENTS.md sections or `queryHelpers.ts` preinstall.
- `TEMPLATE_TEST_ISOLATION=1` / `memoryStorage`.
- Structured VERIFY FAIL formatter or repair-first prompt (`HARNESS_VERIFY_REPAIR_V1`).
- File-scoped vitest, bash test escapes, or changes to canonical/pass parsing.
- Auto-fixing tests in the harness (scan + block only).

---

## Control reference (v2.2 lock — locked numbers)

Historical cohort — **no re-run required** unless base hash drift detected.

### Cost (guardrail reference)

| Metric | v2.2 (5 reps) |
|--------|---------------|
| Median weighted | **60,852** |
| Range | 49,449 – 108,708 |
| Runs >140k | **0/5** |
| Median calls | **16** |

### Trajectory (comparison context — from `trajectory.v2.json` + ledger)

| Rep | Run ID | `verify_fail_before_first_canonical_green` | Weighted | Calls |
|-----|--------|---------------------------------------------|----------|------|
| 1 | `2026-08-31T21-16-45-263Z` | **2** | 78,009 | 18 |
| 2 | `2026-08-31T21-19-44-728Z` | **0** | 60,852 | 15 |
| 3 | `2026-08-31T21-22-09-667Z` | **1** | 49,449 | 16 |
| 4 | `2026-08-31T21-24-11-541Z` | **2** | 108,708 | 27 |
| 5 | `2026-08-31T21-28-10-966Z` | **1** | 50,364 | 12 |

**Locked control aggregates:**

| Metric | Value |
|--------|-------|
| Median `verify_fail_before_first_canonical_green` | **1** |
| Distribution | **0, 1, 1, 2, 2** |
| Reps with **0** verify fails before green | **1/5** |
| Reps with **≥2** verify fails before green | **2/5** |
| Median weighted VERIFY → first canonical PASS | **12,400** (~12.4k) |
| Median weighted before first VERIFY | **~36,200** (~36.2k) |

### Control baseline for Primary A (measurement correction)

v2.2 has **no guard** — every `verify` call runs the full suite immediately.

| Metric | v2.2 control | Notes |
|--------|--------------|-------|
| `guard_blocks_before_first_allowed_verify` | **0** (by definition) | Not applicable on control |
| First `verify` call canonical outcome | **fail on 4/5** reps (only rep 2 first-call pass) | Derived from verify-fail distribution |
| First allowed canonical VERIFY pass rate | **1/5** (rep 2 only) | Same as first-call pass when guard absent |

> **Measurement rule (frozen):** Do **not** score success on “first VERIFY pass rate” alone. Always report **`guard_blocks_before_first_allowed_verify`** alongside **`first_allowed_canonical_verify_pass`**. A treatment that blocks many times then passes once is **not** automatically success unless pass rate **and** block budget both meet gates.

---

## Metric definitions (treatment cohort)

| Metric | Definition |
|--------|------------|
| `guard_block` | A `verify` tool invocation where the guard returns `guard_result: BLOCKED` and **no** canonical vitest run occurs |
| `guard_blocks_before_first_allowed_verify` | Count of `guard_block` events strictly before the first `verify` invocation that proceeds to canonical vitest |
| `first_allowed_canonical_verify` | The first `verify` call after which canonical vitest executes (guard clean) |
| `first_allowed_canonical_verify_pass` | Boolean: first allowed canonical outcome is **pass** per [trajectory-metrics-v2.md](./trajectory-metrics-v2.md) |
| `pre_verify_weighted_to_first_allowed` | Sum of weighted ledger from run start through call index of `first_allowed_canonical_verify`, **inclusive** — includes all guard-block fix cycles |
| `guard_violation_hits` | Per-run list of Appendix A pattern IDs detected (F1–F6); includes report-only F6 |
| `guard_scan_executed` | Boolean: scanner ran on this `verify` invocation before allow/deny |
| `guard_scan_error` | Boolean: scanner crash or malformed result (must be **0/5** runs) |
| `blocking_violations_before_first_allowed` | F1–F5 hits detected on any scan before first allowed VERIFY |
| `blocking_coverage` | For runs with ≥1 F1–F5 hit before first allowed VERIFY: fraction blocked (must be **100%**) |

Export these fields in `trajectory.v2.json` extensions or a companion `guard.v1.json` at implementation time. Full F6 hit list lives in guard export only — **not** in Pi-facing BLOCK messages.

---

## Primary outcomes

### A. First allowed canonical VERIFY pass rate (co-primary)

Treatment **passes A** iff **both**:

| Criterion | v2.2 control | Treatment threshold |
|-----------|--------------|---------------------|
| `first_allowed_canonical_verify_pass` | **1/5** | **≥ 3/5** |
| Median `guard_blocks_before_first_allowed_verify` | **0** | **≤ 2** |

The block ceiling prevents “artificially great” pass rates bought with unbounded cheap guard/fix loops.

Also report (not gates):

- Per-rep: `first_allowed_canonical_verify` outcome sequence (pass/fail/unknown)
- Reps with **0** guard blocks before first allowed VERIFY (guard inert)
- Downstream: `verify_fail_before_first_canonical_green`, VERIFY→PASS (expect improvement if A holds — not co-primary)

### B. Pre-VERIFY weighted cost (co-primary)

Treatment **passes B** iff:

| Criterion | v2.2 median | Treatment threshold |
|-----------|------------:|---------------------|
| `pre_verify_weighted_to_first_allowed` | **~36,200** | **≤ 45,000** |

Rationale: allows modest guard-cycle overhead (~25% headroom) but rejects blowups like Q2-B’s elevated pre-VERIFY (~42k) **plus** unbounded block spirals.

Also report (not gates):

- Median `guard_blocks_before_first_allowed_verify` (full distribution)
- Weighted per guard block (median)
- Rep-level post-mortem if any rep >50k pre-allowed (classify: oversized test suite vs guard spiral)

### C. Guard scanner mechanism (co-primary)

Treatment **passes C** iff **all four**:

| Criterion | Measurement | Threshold |
|-----------|-------------|-----------|
| Scanner executes before first allowed VERIFY | `guard_scan_executed` on first `verify` call per rep | **5/5** runs |
| Scanner reliability | `guard_scan_error` | **0/5** runs |
| Blocking coverage | On runs with ≥1 **F1–F5** hit before first allowed VERIFY: every such hit preceded a BLOCK (no VERIFY bypass) | **100%** |
| Anti-loop gate | `guard_blocks_before_first_allowed_verify` per rep | **≤ 1/5** reps with **> 4** blocks |

> **Not a gate:** requiring ≥N/5 runs to be blocked at least once. If Pi writes clean tests, zero blocks is valid — the guard’s job is to catch bad patterns **when present**, not to guarantee every run contains them.

And per run **report** (required in analysis):

- `guard_violation_hits` by pattern ID (F1–F6, including report-only F6)
- `guard_blocks_before_first_allowed_verify` (full distribution)
- First violation `file:line` per pattern
- Whether final test sources have zero **F1–F5** hits at run end
- Median BLOCK message character count (sanity check vs 512 cap)

**Interpretation:** C confirms the scanner **always runs**, **never crashes**, **blocks every F1–F5 violation when present**, and does not create pathological block spirals.

### D. Total cost non-regression (co-primary guardrail)

| Metric | Threshold |
|--------|-----------|
| Median weighted | **≤ 70,000** |
| Runs >140k | **0/5** |

Failing → **REVERT** regardless of A–C.

---

## Secondary outcomes (report only)

| Metric | Role |
|--------|------|
| Median weighted VERIFY → first canonical PASS | Downstream sanity — expect ≤12.4k if guard works; not a KEEP gate |
| `verify_fail_before_first_canonical_green` distribution | Compare to v2.2 `{0,1,1,2,2}` |
| Median calls | Context — fewer calls with heavier context was Q2-B failure mode |
| Input/output token medians | Confirm guard shifts spend **earlier/cheaper**, not into VERIFY repair |
| `report.partial.json` / `tests_run: []` rate | Harness finalization issue — **orthogonal** to Q2-C verdict |
| Manual hard refresh | Not expected to improve |
| Quality floors | Median `app_rating` ≥ 68, no UX < 27 — regression → **REVERT** |

---

## Verdict table

| Verdict | Conditions |
|---------|------------|
| **KEEP** | Primary **A**, **B**, and **C** pass **and** cost non-regression (**D**) **and** no quality regression |
| **RELOCATED** | Partial signal — e.g. scanner reliable (C) with better pass rate but pre-VERIFY cost fail — publish mechanism evidence; **do not promote** |
| **REVERT** | Any primary fail, cost non-regression failed, or quality regression |

**Post-KEEP:** promote `HARNESS_TEST_AUTHORING_GUARD_V1` default-on in harness config — separate implementation PR. Re-freeze floor as v2.3 or document harness addendum.

**Post-KEEP next candidates (separate preregs):**

- `test-authoring-v1` template overlay (AGENTS + helpers) on new frozen floor — only if guard alone insufficient
- Harness-owned `tests_run` / `report.partial.json` finalization
- `q2-reload-verification` (hollow refresh)

---

## Explicitly out of scope

- Assembler overlays (`test_authoring`, `test_isolation`, persistence, CSS)
- AGENTS.md / `queryHelpers.ts` / `memoryStorage`
- `HARNESS_VERIFY_REPAIR_V1` / structured VERIFY FAIL formatters
- Bucket 1 (pre-test product work) as primary claim
- Combined integration cohort
- New Run UI
- Auto-fix or LLM-based guard (deterministic scan only)

---

## Protocol

1. **This prereg is frozen** (Amendment 1 applied) — no threshold changes without a dated amendment.
2. Implement harness extension + experiment script when authorized.
3. Run 5 reps: `npm run experiment:test-authoring-guard-v1 -- 5` (script added at implementation).
4. Post-run: trajectory v2, guard export, Appendix A end-state scan, optional human quality overlay.
5. Verdict + analysis doc → **FINAL / FROZEN**.

---

## Q2 program position

```text
q2-test-isolation-v1       ← CLOSED (mechanism PASS, REVERT)
q2-verify-repair-v1        ← CLOSED (REVERT)
test-authoring-guard-v1    ← this prereg (Q2-C harness pre-VERIFY guard)
        ↓ if KEEP
test-authoring-v1          ← optional template overlay (separate prereg)
harness-report-finalize    ← optional (report.partial / tests_run)
q2-reload-verification     ← optional later
        ↓
integration prereg
```

---

## Appendix A — Forbidden RTL patterns (frozen scan definition)

**Scan scope:** all `src/**/*.test.ts` and `src/**/*.test.tsx` at guard time (live workspace; re-scan on each `verify` call).

**Test block:** the callback body of an `it(...)` or `test(...)` — from opening `{` of the callback through its matching `}` (brace-balanced parse; nested functions excluded).

**Hit:** a test block contains ≥1 forbidden match below.

Patterns **F1–F4** are unchanged from [Q2-B prereg Appendix A](./experiment-q2-verify-repair-v1-preregistration.md#appendix-a--forbidden-rtl-patterns-frozen-scan-definition). **F5** extends the blocking taxonomy; **F6** is **report-only in v1** (see [Blocking vs report-only](#blocking-vs-report-only-v1)).

### Blocking vs report-only (v1)

| ID | Mode in v1 |
|----|------------|
| F1–F5 | **Blocking** — triggers `guard_result: BLOCKED`; VERIFY does not run |
| F6 | **Report-only** — logged to `guard.v1.json`; does **not** block VERIFY |

F6 may graduate to blocking in a future prereg if report-only cohort data shows low false-positive rate.

### F1 — `bare_risky_getByText_literal`

A line in the test block matches if **all** hold:

1. Contains `getByText(` (optional `screen.` prefix).
2. First argument is a string literal whose trimmed content, case-insensitive, equals one of:

   `title`, `name`, `edit`, `delete`, `remove`, `save`, `cancel`, `add`, `status`, `description`, `email`, `password`, `search`, `filter`, `submit`, `close`, `open`, `yes`, `no`

3. The test block does **not** contain the substring `within(`.

### F2 — `bare_getByText_regex`

A line in the test block matches if **all** hold:

1. Contains `getByText(/` or `getByText(new RegExp`.
2. The test block does **not** contain `within(`.

### F3 — `global_text_matcher`

A line in the test block matches if it contains any of:

- `getByText(document.`
- `querySelector(` followed within 80 chars by `textContent`
- `innerText` used as the primary query input to `expect(` without a preceding `getByRole` / `getByLabelText` on the same line

### F4 — `debug_sidecar`

A line in the test block matches if it contains `screen.debug(` or `.debug()` **and** the file path is not listed in an allowlist of harness smoke tests (none in generated app workspace).

### F5 — `bare_getByRole_interactive` *(new — cohort-motivated)*

A line in the test block matches if **all** hold:

1. Contains `getByRole(` (optional `screen.` / `within(` prefix allowed only if `within(` appears **before** `getByRole` on the same line).
2. First string literal argument is one of: `button`, `link`, `checkbox`, `radio`, `textbox`, `combobox`, `listitem`, `row`, `cell` (case-sensitive quotes).
3. The call has **no** second options argument with `name:` (detected as `, {` or `, { name:` after the role literal on the same line, or closing `)` immediately after role literal with ≤1 arg).
4. The test block does **not** contain `within(` **unless** the matching line itself is scoped via `within(` before `getByRole`.

**Hint:** `Found multiple elements with the role` — add `{ name: '...' }` or scope with `within(row/container)`.

### F6 — `long_literal_getByText_unscoped` *(report-only in v1)*

A line in the test block matches if **all** hold:

1. Contains `getByText(` with a string literal first argument of length **> 12** and **≤ 40** characters.
2. The literal is **not** wrapped in a RegExp (`getByText(/` excluded).
3. The test block does **not** contain `within(`.
4. The line does **not** also contain `getByRole` or `getByLabelText`.

**Rationale:** Q2 cohort failures included domain phrases (`Lend out`, `Lent to Alice`, section titles) that can be ambiguous when queried globally — but long literals may also be **valid** when unique. Blocking F6 risks false positives and pre-VERIFY repair spirals; v1 **reports only**.

**Hint (analysis export only):** Scope with `within(...)` or prefer `getByRole` / `getByLabelText` with accessible name.

### Non-hits (explicit exceptions)

- `getByText` / `getByRole` inside a `within(...)` block (block contains `within(` unless F5 same-line scoping rule applies).
- `getByText` with first argument longer than 40 characters (highly domain-specific — defer to VERIFY).
- `findByRole`, `findByLabelText`, `getByLabelText`, `getByTestId` — never forbidden by this scan.

### Pattern → hint table (frozen)

| ID | Default hint |
|----|--------------|
| F1 | Use `within(container)` or `getByRole` / `getByLabelText` instead of bare short `getByText` |
| F2 | Prefer `getByRole` / scoped query over unscoped regex `getByText` |
| F3 | Do not query via `document` / `textContent` / raw `innerText` — use Testing Library queries |
| F4 | Remove `screen.debug()` from journey tests |
| F5 | Add accessible `name` to `getByRole` or scope with `within` |
| F6 | Long unscoped `getByText` — scope or use role+name query *(report-only)* |

**Reporting:** per-run count of test blocks with ≥1 hit; list pattern IDs and `file:line` of first match per ID. Distinguish blocking hits (F1–F5) from report-only (F6).

---

## Amendment 1 (2026-09-02, pre-implementation)

**Reason:** Review before freeze identified two measurement/design risks.

| Change | Before | After |
|--------|--------|-------|
| Primary **C** gate | ≥4/5 runs blocked ≥1 time | Scanner on **5/5**; **0/5** crashes; **100%** F1–F5 blocking coverage when present; anti-loop ≤1/5 with >4 blocks |
| **F6** mode | Blocking | **Report-only** in v1; F1–F5 remain blocking |
| Guard BLOCK message | Multi-violation dump allowed | **≤512 chars**, **1** violation, rule ID + file:line + one-line hint |

**What does not change:** Primary A/B/D thresholds, F1–F5 definitions, VERIFY→PASS as report-only, verdict table logic.

---

## References

- Q2 test-isolation verdict: [experiment-q2-test-isolation-v1-analysis.md](./experiment-q2-test-isolation-v1-analysis.md)
- Q2 verify-repair verdict: [experiment-q2-verify-repair-v1-analysis.md](./experiment-q2-verify-repair-v1-analysis.md)
- Cost decomposition: [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md)
- Harness-owned VERIFY: [harness-owned-verify.md](./harness-owned-verify.md)
- Trajectory metrics: [trajectory-metrics-v2.md](./trajectory-metrics-v2.md)
- Exp3 baseline policy: [exp3-test-policy.md](./exp3-test-policy.md)

---

**STOP** — prereg only, no implementation.
