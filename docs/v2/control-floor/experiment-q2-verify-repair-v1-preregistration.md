# Experiment Q2 — VERIFY Repair v1 — preregistration

**Status:** PREREGISTERED — frozen (2026-09-01); **Amendment 1** (2026-09-01, pre-run)  
**Experiment ID:** `q2-verify-repair-v1`  
**Short label:** Q2-B (harness-only arm — **not** the full Q2 program)  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) via assembler **OFF/OFF**  
**Canonical base hash:** `1f897f6388754c98f311031dd79600bd65d1ec476e57a43b67ca70f67dad82f6` ([provenance](./template-base-provenance.json))

> **Scope boundary.** This experiment tests **one harness-only hypothesis**: whether **VERIFY repair orchestration** (structured FAIL output, tighter bash blocks, repair-first-test policy) reduces the VERIFY repair spiral (bucket 2) that [Q2 Test Isolation v1](./experiment-q2-test-isolation-v1-analysis.md) confirmed is the real bottleneck.
>
> **It does NOT include** template AGENTS changes, `queryHelpers.ts`, or any assembler overlay. Those belong in a **separate future arm** (`test-authoring-v1`) tested only after this arm closes.
>
> **It does NOT claim** to solve expensive pre-VERIFY product work (bucket 1 / Q1), runtime persistence, CSS authoring, hollow browser reload, or cross-test storage bleed (closed by test-isolation v1).

> **Relationship to prior work.**
> - [Exp3](./exp3-test-policy.md) (prompt-only RTL guidance) is **already in v2.2** — this arm does **not** retest prompt-level authoring.
> - [Harness-owned VERIFY v1.1](./harness-owned-verify.md) fixed observability — repair cost remains (~**12.4k** median VERIFY→PASS on v2.2; **~30.6k** on Q2 test-isolation with storage fixed).
> - [Q2 Test Isolation v1](./experiment-q2-test-isolation-v1-analysis.md): mechanism PASS, experiment REVERT — **do not retest storage**.

---

## Problem statement

### What the evidence shows

| Signal | Source | What it implies |
|--------|--------|-----------------|
| **~39%** of v2.2 spend is test authoring + VERIFY loop | [Cost decomposition](./control-floor-v2.2-cost-decomposition.md) | Repair spiral is a first-class cost surface |
| VERIFY→first canonical PASS median **~12.4k** (v2.2) | Cost decomposition | **Frozen hard gate** for this arm |
| VERIFY→first canonical PASS median **~30.6k** (Q2 test-isolation) | [Q2 analysis](./experiment-q2-test-isolation-v1-analysis.md) | Fixing storage **does not** compress repair |
| VERIFY fail root cause: `TestingLibraryElementError`, ambiguous text | Q2 cohort review | Failures are test/query issues — repair **orchestration** may still help |
| Rep 2: 3 verify fails + `npx vitest run` bash escape | Q2 rep 2 | Harness repair gaps remain under VERIFY v1.1 |
| Exp3 already live | v2.2 baseline | Authoring guidance alone is **out of scope for this arm** |

### Causal chain (this treatment targets)

```text
Pi authors journey tests (unchanged from v2.2)
→ VERIFY FAIL (authoritative exit)
→ Pi inspects failure (sometimes escapes to partial vitest / product edits)
→ VERIFY again (repeat) — expensive repair loop
```

**Out of scope:** the phase before first VERIFY (bucket 1) and **upstream test authoring quality** (deferred to `test-authoring-v1`).

---

## Hypothesis (narrow, falsifiable)

On exact v2.2 (OFF/OFF, **no assembler overlays**), harness extension **`verify-repair-v1`** will:

1. **Reduce VERIFY repair trajectory cost** — median weighted VERIFY→first canonical PASS **≤ 12.4k** and improved verify-fail **distribution** before first green.
2. **Improve repair orchestration behavior** — **0/5** runs with non-canonical or piped test bash before first canonical green.

**Not claimed:** median total weighted cost must beat 60,852. Total cost is a **guardrail**, not co-primary.

---

## Treatment (harness-only — frozen at implementation)

**v2.2 + harness extension only.** Assembler remains **OFF/OFF** for all overlays.

```text
TEMPLATE_CSS_VOCABULARY=0
TEMPLATE_PERSISTENCE=0
TEMPLATE_TEST_ISOLATION=0
HARNESS_VERIFY_REPAIR_V1=1          # new harness toggle at implementation
```

| Component | v2.2 OFF/OFF | Q2-B treatment |
|-----------|--------------|----------------|
| Base template / AGENTS.md | `app-template-base` | **unchanged** |
| All assembler overlays | off | **off** |
| Exp3 test policy (prompt) | in baseline | **unchanged** |
| Harness-owned VERIFY v1.1 | on | **unchanged base** |
| **`verify-repair-v1` extension** | absent | **on** (see below) |

### Harness extension: `verify-repair-v1`

Augment (not replace) [harness-owned-verify](./harness-owned-verify.md) when `HARNESS_VERIFY_REPAIR_V1=1`.

| Behavior | v2.2 VERIFY | Q2-B addition |
|----------|-------------|---------------|
| `verify` tool runs full `npm test` | yes | **unchanged** |
| Blocks piped `npm test` | yes | **unchanged** |
| Blocks direct `npm test` bash | yes | **unchanged** |
| Blocks partial / scoped vitest bash | partial | **tightened** — block any bash matching `vitest` (including `npx vitest run`, `-t`, single-file paths) |
| Failure output | raw reporter text | **structured summary** prepended (see taxonomy below) |
| Repair policy prompt | minimal | **added** — on VERIFY FAIL: assume **test/query bug first**; change selectors/structure before product code; one focused repair pass per FAIL; re-`verify` **full suite** only |

**Structured FAIL summary fields** (prepended to `verify` tool text):

```text
failure_class: <taxonomy value>
test_name: <Vitest test name if parseable>
file: <path:line if parseable>
hint: <one-line repair hint from class table>
---
<original reporter output>
```

**Failure class taxonomy** (frozen — implementation maps Vitest/RTL output):

| Class | Match condition (substring in reporter output) | Default hint |
|-------|-----------------------------------------------|--------------|
| `ambiguous_text` | `Found multiple elements with the text:` | Scope with `within(...)` or use `getByRole` / `getByLabelText` with accessible name |
| `ambiguous_role` | `Found multiple elements with the role` | Add accessible name or scope query to the target row/region |
| `missing_accessible_name` | `Unable to find an accessible element` or `Unable to find a label` | Add label/`aria-label` in product or query by role+name |
| `async_timing` | `waitFor` timeout or `not wrapped in act` | Fix async flow or `await` user events before assert |
| `suite_error` | `SyntaxError`, `Cannot find module`, `FAIL 0/0`, `Error: Collect` | Fix imports/syntax before re-running VERIFY |
| `other` | none of the above | Inspect failing test block; prefer narrowing query over rewriting product |

**Repair policy prompt** (frozen intent — wording may tighten at implementation, not weaken):

- After VERIFY reports FAIL, treat the failure as a **test or query problem** unless output clearly shows a product runtime exception unrelated to queries.
- Prefer editing `*.test.ts(x)` selectors/structure over product source on the first repair pass.
- Do **not** run file-scoped or filtered vitest via bash; use `verify` for the full suite.
- After edits, call `verify` once — avoid exploratory test sidecars.

**Explicitly NOT in this treatment:**

- AGENTS.md additions or `queryHelpers.ts` (future `test-authoring-v1` arm).
- `TEMPLATE_TEST_ISOLATION=1` / `memoryStorage`.
- Changes to canonical/pass parsing or trajectory metric definitions.

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

### Trajectory (primary comparison — from `trajectory.v2.json` + ledger)

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
| Median weighted VERIFY → first canonical PASS | **12,400** (report as **~12.4k**) |
| Median weighted before first VERIFY | **~36.2k** |

**Aspirational stretch (not a gate):** VERIFY → first canonical PASS median **≤ 8k** (~35% improvement).

**Q2 test-isolation reference** (not control — context only):

| Metric | Q2 test-isolation |
|--------|-------------------|
| VERIFY → first canonical PASS median | **~30.6k** |
| VERIFY fail distribution | **1, 1, 1, 2, 3** |
| Formal verdict | **REVERT** |

Metric definitions: [trajectory-metrics-v2.md](./trajectory-metrics-v2.md).  
Phase boundary **VERIFY → first canonical PASS**: weighted ledger spend from the call index of the **first canonical VERIFY fail** through the call index of the **first canonical VERIFY pass**, inclusive of the pass call (same method as [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md)).

---

## Primary outcomes

### A. VERIFY repair trajectory (co-primary)

Treatment **passes A** iff **all four**:

| Criterion | v2.2 control | Treatment threshold |
|-----------|--------------|---------------------|
| Median `verify_fail_before_first_canonical_green` | **1** | **≤ 1** |
| Reps with **0** verify fails before green | **1/5** | **≥ 2/5** |
| Reps with **≥2** verify fails before green | **2/5** | **≤ 1/5** |
| Median weighted **VERIFY → first canonical PASS** | **12,400** | **≤ 12,400** |

Distribution shape matters as much as median fail count — same bar family as [Q2 test-isolation prereg](./experiment-q2-test-isolation-v1-preregistration.md).

Also report (not gates):

- Aspirational: median VERIFY → PASS **≤ 8k**
- `canonical_unknown_before_first_canonical_green` per rep
- VERIFY tool count before first green
- Tail post-mortem for any rep >120k (classify bucket 1 vs bucket 2)

### B. Repair orchestration mechanism (co-primary)

> **Amendment 1:** Implementation inspection (pre-run) showed v2.2 harness-owned VERIFY **already blocks** piped, direct, and scoped test bash. Primary **B** is therefore retained as a **treatment-compliance / mechanism check**, not evidence of comparative improvement vs control. The causal treatment under test is **structured FAIL feedback + repair-first orchestration** (see [Amendment 1](#amendment-1-2026-09-01-pre-run)).

Treatment **passes B** iff **both**:

| Criterion | Measurement | Threshold |
|-----------|-------------|-----------|
| Non-canonical test bash before first canonical green | `trajectory.v2.json` events: any bash `isNpmTestCommand` or `vitest` match that is **not** canonical full-suite per [trajectory-metrics-v2.md](./trajectory-metrics-v2.md), occurring before `first_canonical_pass_call` | **0/5 runs** |
| Piped test bash before first canonical green | bash test command with `\|` redirect before `first_canonical_pass_call` | **0/5 runs** |

**Repair-phase edit ratio** (report only): share of write/edit calls in `(first_canonical_verify_fail, first_canonical_pass]` touching `*.test.*` vs product `src/**` (excluding tests). Hypothesis: test-targeted repairs dominate without increasing product churn.

**Forbidden RTL pattern scan** (report only in **this** arm — frozen definition in [Appendix A](#appendix-a--forbidden-rtl-patterns-frozen-scan-definition); co-primary gate reserved for future `test-authoring-v1` arm).

---

## Secondary outcomes (guardrails)

### Cost non-regression

| Metric | Threshold |
|--------|-----------|
| Median weighted | **≤ 70,000** |
| Runs >140k | **0/5** |

Failing → **REVERT** regardless of trajectory gains.

### Pre-VERIFY phase (report only)

| Metric | v2.2 median |
|--------|------------:|
| Weighted before first VERIFY | **~36.2k** |

Track confounding — treatment must not systematically increase pre-VERIFY work.

### Quality floors (regression guard)

Median `app_rating` ≥ 68, no UX < 27 — **regression → REVERT**. Human overlay **not required** to close formal verdict if primaries + cost already decide.

### Manual hard refresh (report only)

Not expected to improve. Motivates a future reload-orchestration arm.

---

## Verdict table

| Verdict | Conditions |
|---------|------------|
| **KEEP** | Primary **A** **and** **B** pass **and** cost non-regression **and** no quality regression |
| **RELOCATED** | Partial trajectory or orchestration improvement without full A+B — publish mechanism evidence; **do not promote** |
| **REVERT** | A or B fail, cost non-regression failed, or quality regression |

**Post-KEEP:** promote `HARNESS_VERIFY_REPAIR_V1` default-on in harness config — separate implementation PR.

**Post-KEEP next arm:** `test-authoring-v1` (template overlay) on the **new frozen floor** — separate prereg; uses [Appendix A](#appendix-a--forbidden-rtl-patterns-frozen-scan-definition) as co-primary mechanism gate.

---

## Explicitly out of scope

- Assembler overlays (`test_authoring`, `test_isolation`, persistence, CSS)
- AGENTS.md / `queryHelpers.ts` changes
- `memoryStorage` (closed)
- Runtime persistence (P1), CSS, hollow reload as co-primary
- Bucket 1 (pre-VERIFY product work) as primary claim
- Combined integration cohort
- New Run UI

---

## Protocol

1. **This prereg is frozen** — [Amendment 1](#amendment-1-2026-09-01-pre-run) applied pre-run; no further threshold changes without a dated amendment.
2. Implement harness extension + experiment script when authorized.
3. Run 5 reps: `npm run experiment:q2-verify-repair-v1 -- 5`.
4. Post-run: trajectory v2, orchestration scans, optional forbidden-RTL report (Appendix A), optional human quality overlay.
5. Verdict + analysis doc → **FINAL / FROZEN**.

---

## Future Q2 program

```text
q2-test-isolation-v1     ← CLOSED (mechanism PASS, REVERT)
q2-verify-repair-v1      ← this prereg (Q2-B harness-only)
        ↓ if KEEP
test-authoring-v1        ← Q2-A template overlay (separate prereg; Appendix A gates)
        ↓
q2-reload-verification   ← optional later (hollow refresh)
        ↓
integration prereg
```

---

## Appendix A — Forbidden RTL patterns (frozen scan definition)

Used as **report-only** in `q2-verify-repair-v1`. Becomes **co-primary mechanism gate** in the future `test-authoring-v1` prereg (**≤ 2/5 runs** with any hit).

**Scan scope:** final `src/**/*.test.ts` and `src/**/*.test.tsx` at run end.

**Test block:** the callback body of an `it(...)` or `test(...)` — from opening `{` of the callback through its matching `}` (brace-balanced parse; nested functions excluded).

**Hit:** a test block contains ≥1 forbidden match below.

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

**Non-hits (explicit exceptions):**

- `getByText` inside a `within(...)` block (block contains `within(`).
- `getByText` with first argument longer than 20 characters (domain-specific string — not in F1 list).
- `getByRole`, `getByLabelText`, `findByRole`, `findByLabelText` — never forbidden by this scan.

**Reporting:** per-run count of test blocks with ≥1 hit; list pattern IDs (F1–F4) and file:line of first match.

---

## Amendment 1 (2026-09-01, pre-run)

**Reason:** Pre-run implementation inspection of `verify-repair-v1` against v2.2 harness-owned VERIFY showed that the baseline **already blocks**:

- piped `npm test` (e.g. `| tail`)
- direct `npm test` / `npm run test`
- `npx vitest run …`, file-scoped vitest, and `-t` / filtered runs

Therefore the frozen Primary **B** gates — **0/5** non-canonical test bash and **0/5** piped test bash before first canonical green — are **likely non-discriminating** vs control (v2.2 OFF/OFF is already capable of scoring 0/5 on both).

**Interpretation (frozen):**

| Layer | Role in this experiment |
|-------|-------------------------|
| **Primary A** (VERIFY fail distribution + VERIFY→PASS ≤ 12.4k) | **Comparative evidence** — did repair spiral cost/shape improve? |
| **Primary B** (bash escape gates) | **Treatment-compliance / mechanism check** — confirms the cohort ran with repair orchestration active; **not** proof of improvement over control |
| **Causal treatment under test** | **Structured FAIL feedback** (`failure_class`, file, hint) + **repair-first-test orchestration prompt** — not test-command blocking itself |

**What does not change:** Primary A thresholds, VERIFY→PASS ≤ 12.4k hard gate, cost guardrails (≤70k, 0/5 >140k), verdict table logic, or implementation code.

**Analysis guidance:** Report Primary B compliance per rep. Do **not** cite 0/5 bash escapes as treatment success vs v2.2. The key result is whether **VERIFY→PASS repair cost and failure distribution** improve (Primary A).

---

## References

- Q2 Test Isolation verdict: [experiment-q2-test-isolation-v1-analysis.md](./experiment-q2-test-isolation-v1-analysis.md)
- Cost decomposition: [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md)
- Exp3 baseline policy: [exp3-test-policy.md](./exp3-test-policy.md)
- Harness-owned VERIFY: [harness-owned-verify.md](./harness-owned-verify.md)
- Trajectory metrics: [trajectory-metrics-v2.md](./trajectory-metrics-v2.md)
