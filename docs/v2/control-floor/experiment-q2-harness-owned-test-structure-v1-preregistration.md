# Experiment Q2-E — Harness-owned test structure v1 — preregistration

**Status:** **PREREGISTERED — frozen (2026-09-02)**  
**Experiment ID:** `q2-harness-owned-test-structure-v1`  
**Short label:** Q2-E (harness **owned test shell** + **+1-per-action** filesystem guard — **structure**, not timing)  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) via assembler **OFF/OFF**  
**Canonical base hash:** `1f897f6388754c98f311031dd79600bd65d1ec476e57a43b67ca70f67dad82f6` ([provenance](./template-base-provenance.json))  
**Prior confidence:** **Moderate mechanism / exploratory experiment** — deterministic guard should block monolithic first writes (Q2-D root cause); whether Pi adapts to incremental authoring without cost blowups is the open question.

> **Scope boundary.** This experiment tests **one harness-only hypothesis**: whether **owning the test file shell** and enforcing **at most +1 source-derived authored test per completed Pi tool action** — detected **filesystem-first after every tool**, not by `write`/`edit` tool names — prevents the monolithic first `App.test.tsx` write and compresses suite size at the **first canonical VERIFY after tests begin**.
>
> **It does NOT include** automatic VERIFY between test additions (Q2-D closed), F1–F6 pre-VERIFY guard (Q2-C closed), VERIFY repair coaching (Q2-B closed), test-count caps, AGENTS.md / `queryHelpers.ts`, `memoryStorage`, CSS/persistence overlays, harness report finalization, or pre-seeded journey `it()` stubs (E3).
>
> **It does NOT claim** that the harness inserts VERIFY checkpoints between additions. Pi may add several tests through separate +1 mutations before choosing VERIFY. Early feedback timing is **out of scope**.

---

## Epistemic prior

Q2-E asks:

```text
If Pi cannot monolith the first test write,
does suite size at first real VERIFY compress
without blowing total cost or repair loops?
```

| Reason to run | Reason for skepticism |
|---------------|----------------------|
| Q2-D mechanism PASS / experiment REVERT: Pi wrote **7–13** tests in first mutation | Pi may fight guard with many +1 edits → call tax |
| Root cause identified: **structure**, not feedback timing | Incremental tests may still be brittle selectors |
| Q2-C blocking pre-VERIFY **increased** cost (+118% median pre-allowed) | Post-tool restore ≠ pre-VERIFY block — different architecture |
| Deterministic guard → mechanism PASS plausible | Product-only long runway unchanged (bucket 1) |

**Expected outcome:** mechanism **PASS** likely (~70%); formal **KEEP** moderate prior (~40–50%) if Pi adapts. Either outcome closes the “monolithic first write” question.

---

## Relationship to prior work

| Prior arm | Verdict | What it proved | Why this arm is next |
|-----------|---------|----------------|----------------------|
| [Q2 test-isolation v1](./experiment-q2-test-isolation-v1-analysis.md) | REVERT | Storage mechanism PASS; not the bottleneck | Test process, not storage |
| [Q2 verify-repair v1](./experiment-q2-verify-repair-v1-analysis.md) | REVERT | Post-failure coaching **worsens** VERIFY→PASS (~2.2×) | More feedback **after** a large suite does not help |
| [Q2 test-authoring-guard v1](./experiment-test-authoring-guard-v1-analysis.md) | REVERT | Pre-VERIFY **blocking** fires; +118% median cost; same 1/5 first-VERIFY pass | Static pre-VERIFY blocking is the wrong architecture |
| [Q2 early-verify v1](./experiment-q2-early-verify-v1-analysis.md) | **Mechanism PASS / Experiment REVERT** | Auto VERIFY fires 5/5; **monolithic first write defeats timing** | Stop testing feedback timing; constrain **creation** |
| [Exp3](./exp3-test-policy.md) (prompt RTL guidance) | in v2.2 baseline | Prompt-only insufficient | No new prompt text |

**Q2-D locked diagnosis (motivating E2):**

```text
Pi writes whole test suite in FIRST write (7–13 authored tests at anchor)
    ↓
Auto VERIFY fires immediately (timing works)
    ↓
Large suite already exists → A/D/E fail
```

**Explicitly closed — not retried here:**

- Q2-D early auto VERIFY (`HARNESS_EARLY_VERIFY_V1`)
- Q2-C F1–F6 pre-VERIFY guard (`HARNESS_TEST_AUTHORING_GUARD_V1`)
- Q2-B VERIFY repair (`HARNESS_VERIFY_REPAIR_V1`)
- E3 variant (pre-seeded journey `it()` stubs — separate future prereg if E2 partial-signals)
- E1 variant (edit-only enforcement without +1 delta cap)
- Test-count caps, max LOC caps, max-calls caps
- Harness report finalization / lifecycle pipeline

---

## Problem statement

### Causal chain (v2.2 control — today)

```text
Pi builds product (may be large — out of scope)
    ↓
Pi creates src/App.test.tsx (often entire suite in one tool action)
    ↓
First canonical VERIFY at/after tests exist → large suite already on disk
    ↓
VERIFY fails → expensive repair loop
```

On control, Pi may call VERIFY before any test file exists. Metrics anchor to **first canonical VERIFY at or after the first successful authored-test addition**, not first VERIFY overall.

### Causal chain (Q2-E treatment — E2)

```text
Harness seeds src/App.test.tsx shell (0 authored tests)
    ↓
Pi builds product (unchanged)
    ↓
After EVERY completed Pi tool action:
  filesystem rescan → source-derived authored count
  allow delta 0 or +1 only; reject extra test files
  on violation → restore qualifying test-file state only + compact feedback
    ↓
Pi adds tests incrementally (+1 per accepted action max)
    ↓
Pi chooses when to call VERIFY (unchanged manual verify)
    ↓
First canonical VERIFY at/after first successful +1 addition
```

**Out of scope:** automatic VERIFY between additions; product build before any test mutation; selector quality rules; post-VERIFY repair orchestration; caps beyond the +1-per-action rule.

---

## Hypothesis (narrow, falsifiable)

On exact v2.2 (OFF/OFF, **no assembler overlays**), harness extension **`harness-owned-test-structure-v1`** will:

1. **Prevent monolithic first test writes** — no accepted tool action increases source-derived authored-test count by ≥ 2; at the primary anchor, suite size is materially smaller than v2.2 control.
2. **Preserve single-file discipline** — Pi never successfully creates a second qualifying test file under `src/**/*.test.ts(x)`.
3. **Non-regress total cost** — median weighted and tail bounds vs v2.2 guardrails.
4. **Hold VERIFY repair cost** — weighted span primary anchor → first canonical PASS does not blow up like Q2-B/Q2-D.
5. **Preserve journey coverage and app quality** — smaller anchor suites must not come from dropping required journeys or regressing quality vs v2.2 control floors.

**Not claimed:** VERIFY fires between each +1 addition; Pi must VERIFY after every test; first anchor VERIFY pass rate alone wins.

---

## Treatment (harness-only — frozen at implementation)

**v2.2 + harness-owned test structure extension only.** Assembler remains **OFF/OFF**.

```text
TEMPLATE_CSS_VOCABULARY=0
TEMPLATE_PERSISTENCE=0
TEMPLATE_TEST_ISOLATION=0
HARNESS_VERIFY_REPAIR_V1=0              # explicit off — Q2-B closed
HARNESS_TEST_AUTHORING_GUARD_V1=0       # explicit off — Q2-C closed
HARNESS_EARLY_VERIFY_V1=0               # explicit off — Q2-D closed
HARNESS_OWNED_TEST_STRUCTURE_V1=1       # new harness toggle at implementation
HARNESS_OWNED_VERIFY=1                  # unchanged v2.2 baseline
```

| Component | v2.2 OFF/OFF | Q2-E treatment |
|-----------|--------------|----------------|
| Base template / AGENTS.md | `app-template-base` | **unchanged** |
| All assembler overlays | off | **off** |
| Exp3 test policy (prompt) | in baseline | **unchanged** |
| Harness-owned VERIFY v1.1 | on | **unchanged** |
| `verify-repair-v1` | off | **off** |
| `test-authoring-guard-v1` | off | **off** |
| `early-verify-v1` | off | **off** |
| **`harness-owned-test-structure-v1` extension** | absent | **on** |

### Frozen seed — exactly one shell, zero authored tests

At workspace materialization (before first Pi tool call), when `HARNESS_OWNED_TEST_STRUCTURE_V1=1`:

| Property | Rule |
|----------|------|
| **Path** | Exactly **`src/App.test.tsx`** — no other qualifying test files |
| **Authored tests** | **0** — `describe` wrapper only; zero top-level `it(` / `test(` blocks per source-derived parser |
| **Ownership** | Harness-authored seed content; Pi may **edit** this file incrementally |
| **Additional test files** | **Forbidden** — any `src/**/*.test.ts` or `src/**/*.test.tsx` other than `src/App.test.tsx` is a violation |

**Frozen skeleton content (illustrative — exact whitespace hased at implementation):**

```tsx
import { describe } from "vitest";

describe("App", () => {
  // Harness-owned shell — add journey tests incrementally (+1 it/test per tool action).
});
```

The base `app-template/` ships **no** test file today; the shell is injected by the extension at session prepare time only when the toggle is on.

### Frozen enforcement — filesystem after every completed Pi tool action

Enforcement is **not** keyed on `write` / `edit` / `apply_patch` tool names. It runs **after every Pi tool execution completes** (including `bash`, `run_terminal_cmd`, or any other tool that mutates the workspace).

#### Definitions (frozen)

| Term | Definition |
|------|------------|
| **Qualifying test file** | Workspace-relative path matching `src/**/*.test.ts` or `src/**/*.test.tsx`. |
| **Allowed test file set** | Exactly `{ "src/App.test.tsx" }` after seed. |
| **Run-start accepted snapshot** | Map `{ relativePath → fullFileContent }` for all qualifying files after seed (expected: one entry, `authored_test_count = 0`). |
| **Last accepted snapshot** | Updated only when a post-tool scan **passes** the increment rule; initialized to run-start accepted snapshot. |
| **Source-derived authored-test count** | At a snapshot, sum over qualifying files of top-level `it(` and `test(` invocations via **brace-balanced parse** (same rules as [Q2-C Appendix A](./experiment-test-authoring-guard-v1-preregistration.md#appendix-a--forbidden-rtl-patterns-frozen-scan-definition)). **Do not** use vitest-reported totals. |
| **Post-tool filesystem scan** | After tool **T** completes: read all qualifying files from disk; compute `current_authored_count`, `current_paths[]`. |
| **Authored delta** | `current_authored_count − last_accepted_authored_count`. |
| **First successful authored-test addition** | Earliest tool-result index where post-tool scan **passes** and `authored_delta = +1`. Record `first_successful_authored_test_addition_call`. If Pi never achieves `+1` (only `0` deltas), anchor metrics are **unevaluable** → protocol failure (**F10**). |
| **Primary anchor VERIFY** | **First canonical VERIFY** whose call index **≥** `first_successful_authored_test_addition_call`. |
| **Canonical VERIFY** | Full-suite run per [harness-owned-verify.md](./harness-owned-verify.md) — `npm test`, real exit code, compact reporter. |

#### Increment rule (frozen — every completed tool action)

```text
AFTER each Pi tool execution completes:
  currentSnapshot ← read all qualifying test files from disk
  currentCount ← source-derived authored_test_count(currentSnapshot)
  acceptedCount ← source-derived authored_test_count(lastAcceptedSnapshot)

  violation ← null

  IF current_paths ≠ subset of { "src/App.test.tsx" }:
    violation ← "extra_test_file"
  ELIF any path in current_paths is not "src/App.test.tsx":
    violation ← "extra_test_file"
  ELIF currentCount < acceptedCount:
    violation ← "authored_count_decreased"
  ELIF currentCount > acceptedCount + 1:
    violation ← "authored_increment_exceeded"

  IF violation:
    RESTORE qualifying test-file state from lastAcceptedSnapshot (see below)
    INJECT compact rejection feedback to Pi (see below)
    DO NOT update lastAcceptedSnapshot
    DO NOT record first_successful_authored_test_addition_call
  ELSE:
    lastAcceptedSnapshot ← currentSnapshot
    IF currentCount == acceptedCount + 1 AND first_successful_addition not yet recorded:
      RECORD first_successful_authored_test_addition_call at this tool-result index
```

| Property | Rule |
|----------|------|
| **Detection** | **Filesystem only** after tool completes — covers `write`, `edit`, `apply_patch`, bash heredocs, `tee`, `cp`, etc. |
| **Allowed delta** | **0** (edits without new `it`/`test`) or **+1** (exactly one new authored test) |
| **Forbidden delta** | **≥ +2**, **< 0**, extra qualifying files, deletion of `src/App.test.tsx` |
| **VERIFY between additions** | **Not inserted** — Pi may accumulate several +1 steps before calling `verify` |
| **Manual Pi `verify`** | **Unchanged** — harness-owned VERIFY v1.1 only |
| **Pre-tool blocking on `write`/`edit`** | **Not used** — post-tool restore only |

#### Violation — filesystem restore (frozen)

On any violation at tool-result index **K**, rollback applies **only to qualifying test-file state**. Unrelated filesystem changes from the same tool action — product code, config, `src/test/setup.ts`, non-qualifying paths — **remain intact**.

1. **Write back** every qualifying test file in `lastAcceptedSnapshot` to its recorded content (overwrite on disk).
2. **Delete** any qualifying test file on disk whose path is **not** a key in `lastAcceptedSnapshot` (removes e.g. `src/Foo.test.tsx` created via bash).
3. **Do not** revert, delete, or overwrite any **non-qualifying** path touched by the same tool action.
4. **Emit sidecar event** `test_structure_v1_rejected` with `{ call_index, violation, accepted_count, observed_count, restored_paths[] }`.
5. **Do not** advance `lastAcceptedSnapshot`.

Restore must be **synchronous** before the agent receives its next turn context.

#### Violation — compact feedback to Pi (frozen)

Append to the completed tool result (or equivalent injection channel) as a **single compact block** — max ~6 lines:

```text
test_structure_v1: rejected
reason: <extra_test_file | authored_count_decreased | authored_increment_exceeded>
accepted_authored_count: <N>
observed_authored_count: <M>
rule: only src/App.test.tsx; authored tests may increase by +0 or +1 per tool action
action: qualifying test files restored to last accepted snapshot; other changes kept
```

Pi's tool action **stands as executed** from Pi's perspective; only qualifying test-file state is rolled back. No full file diff in feedback.

#### Explicitly NOT in this treatment

- Automatic canonical VERIFY after mutations (Q2-D).
- VERIFY after each +1 addition.
- Pre-VERIFY F1–F6 scanner / blocking `verify`.
- `HARNESS_VERIFY_REPAIR_V1` structured repair prompts.
- Max test count, max LOC, max calls before VERIFY (beyond +1-per-action).
- Pre-seeded journey `it()` stubs (E3).
- Blocking Pi from calling `verify`.
- AGENTS.md, `queryHelpers.ts`, `memoryStorage`, assembler overlays.
- Harness-owned `report.partial.json` / report finalization.

---

## Control reference (v2.2 lock — retro baselines for gates)

Historical cohort — **no re-run required** unless base hash drift detected.

Control metrics use the **same primary anchor** as treatment:

> **First canonical VERIFY at or after first successful authored-test addition.**

On v2.2 (no guard, no seed), the first filesystem appearance of tests is a monolithic write, so **first successful addition = first test mutation** and **primary anchor VERIFY = first post-mutation canonical VERIFY**. Metrics are **equivalent** to [Q2-D retro](./experiment-q2-early-verify-v1-analysis.md) — reuse locked numbers; no new control cohort.

### Locked v2.2 retro baselines (source-derived @ primary anchor)

Reconstructed from v2.2 control events replay ([Q2-D retro script](../../scripts/retro-analyze-q2-early-verify-control.ts); parser: `countAuthoredTestsInApp` / `extractTestBlocks`).

| Metric | v2.2 control (5 reps) |
|--------|----------------------:|
| Median `authored_test_count_at_anchor` | **8** |
| Median `test_loc_at_anchor` | **171** |
| Median `weighted_first_test_mutation_to_first_post_mutation_canonical_verify` | **~8,929** |
| Median call span (`first_post_mutation_canonical_verify_call − first_test_mutation_call`) | **1** *(report-only for E2)* |
| Median `run_end_journey_test_count` | **8** (range **6–10**) |
| Median weighted total | **60,852** |
| Range weighted | 49,449 – 108,708 |
| Runs **> 140k** | **0/5** |
| Median `weighted_anchor_verify_to_first_canonical_pass` | **12,400** |
| Median calls | **16** |

**Pre-implementation step:** run retro script with anchor field aliases; confirm numbers match table above (Amendment 1 if drift). **Do not run a treatment cohort until prereg is frozen and implementation passes acceptance tests.**

### Cost (guardrail reference)

| Metric | v2.2 (5 reps) |
|--------|---------------|
| Median weighted | **60,852** |
| Runs **> 140k** | **0/5** |

---

## Metrics (frozen)

### Anchor events

| Field | Definition |
|-------|------------|
| `first_successful_authored_test_addition_call` | First tool-result index where post-tool scan passes and `authored_delta = +1` |
| `primary_anchor_canonical_verify_call` | First canonical VERIFY with index ≥ `first_successful_authored_test_addition_call` |
| `primary_anchor_verify_source` | `pi_verify` \| `bash` (no `auto_early_v1` in this experiment) |
| `primary_anchor_verify_outcome` | `pass` \| `fail` \| `unknown` per [trajectory-metrics-v2.md](./trajectory-metrics-v2.md) |

### Source-derived counts @ primary anchor

| Metric | Definition |
|--------|------------|
| `authored_test_count_at_anchor` | Source-derived count at `primary_anchor_canonical_verify_call` |
| `test_loc_at_anchor` | Sum of qualifying test file line counts at same call |

### Increment guard telemetry

| Metric | Definition |
|--------|------------|
| `increment_guard_rejections` | Count of post-tool violations restored |
| `increment_guard_rejection_reasons` | Histogram of `extra_test_file` / `authored_count_decreased` / `authored_increment_exceeded` |
| `max_accepted_single_step_delta` | Max `authored_delta` among **accepted** post-tool scans (expect **≤ 1** always) |
| `authored_tests_added_before_anchor` | Count of accepted post-tool scans with `authored_delta = +1` before `primary_anchor_canonical_verify_call` |
| `call_span_first_addition_to_anchor` | `primary_anchor_canonical_verify_call − first_successful_authored_test_addition_call` |

### Cost spans

| Metric | Definition |
|--------|------------|
| `weighted_first_addition_to_anchor_verify` | Ledger cumulative at anchor **minus** ledger at `first_successful_authored_test_addition_call` |
| `weighted_to_anchor_verify` | Ledger cumulative through anchor (includes pre-test product work) |
| `weighted_anchor_verify_to_first_canonical_pass` | Ledger span anchor → first canonical **pass** |
| `verify_fail_before_first_canonical_green` | Standard trajectory v2 |

**Control comparison (report-only):** on v2.2, `first_successful_authored_test_addition_call` equals `first_test_mutation_call`, so treatment `weighted_first_addition_to_anchor_verify` is compared against control **`weighted_first_test_mutation_to_first_post_mutation_canonical_verify`** (~**8,929**). E2 does **not** gate on this span or cost — Pi chooses VERIFY timing.

### Secondary / report-only (required in analysis)

| Metric | Definition |
|--------|------------|
| `run_end_authored_test_count` | Source-derived at run end |
| `run_end_journey_test_count` | Final `result.json` `tests_run` length |
| `call_span_first_addition_to_anchor` | VERIFY timing — **not** enforced by E2 |
| `authored_tests_added_before_anchor` | Accepted +1 steps before first anchor VERIFY |
| `weighted_first_addition_to_anchor_verify` | vs control **`weighted_first_test_mutation_to_first_post_mutation_canonical_verify`** (~8,929) |
| `total_canonical_verify_count` | All canonical VERIFY events |
| `canonical_verify_count_after_first_addition` | VERIFY events with index ≥ `first_successful_authored_test_addition_call` |
| `product_weighted_before_first_addition` | Ledger at first successful +1 |
| `skeleton_authored_count_at_start` | Expect **0** on 5/5 |
| `increment_guard_rejections` | Pi fighting guard vs adapting |

Export in `trajectory.v2.json` extensions and/or companion `test-structure.v1.json`.

---

## Primary outcomes

### A. Suite size at primary anchor (co-primary)

Treatment **passes A** iff **both**:

| Criterion | v2.2 control (retro) | Treatment threshold |
|-----------|---------------------:|---------------------|
| Median `authored_test_count_at_anchor` | **8** | **≤ 6** **and** ≤ control median |
| Median `test_loc_at_anchor` | **171** | **≤ 120** **and** ≤ control median |

**Rationale:** Absolute caps encode “early feedback surface”; relative gate ensures improvement vs monolithic control at the **correct anchor**.

### B. Monolithic write prevention (co-primary)

Treatment **passes B** iff:

| Criterion | Measurement | Threshold |
|-----------|-------------|-----------|
| No accepted monolith | `max_accepted_single_step_delta` across all runs | **≤ 1** on **5/5** runs (equivalently: **0/5** runs accept Δ ≥ 2) |

**Rationale:** Gate B proves the **mechanism changed authoring shape** — E2 enforces test **growth**, not VERIFY timing. Call span and count of accepted +1 additions before first VERIFY are **secondary** (see below); they must not be primary gates because E2 does not control when Pi calls VERIFY.

### C. Test-structure mechanism (co-primary — separate verdict layer)

Treatment **passes C** iff **all**:

| Criterion | Measurement | Threshold |
|-----------|-------------|-----------|
| Skeleton seeded | `skeleton_authored_count_at_start` | **0** on **5/5** |
| Single test file discipline | No qualifying path other than `src/App.test.tsx` at run end | **5/5** runs |
| Post-tool guard active | `test_structure_v1` sidecar present | **5/5** runs |
| Restore on violation | Acceptance tests + any cohort rejection restores snapshot hash | **pass** (0 restore failures) |
| Harness errors | `test_structure_error` | **0/5** |

**Not gates:** rejection count (high rejections with eventual incremental success is valid); anchor VERIFY outcome.

### D. Total cost non-regression (co-primary guardrail)

| Metric | Threshold |
|--------|-----------|
| Median weighted | **≤ 70,000** |
| Runs **> 140k** | **0/5** |

Failing → experiment **REVERT** regardless of A–C.

### E. Anchor VERIFY repair ceiling (co-primary guardrail)

| Metric | v2.2 median | Treatment threshold |
|--------|------------:|---------------------|
| Median `weighted_anchor_verify_to_first_canonical_pass` | **12,400** | **≤ 18,600** (~1.5× headroom) |

Uses primary anchor (first VERIFY at/after first +1), not first VERIFY in run.

### F. Quality & journey coverage (co-primary guardrail)

E2 rewards smaller suites at anchor; treatment must not “win” by writing fewer journeys or shipping worse apps. Gate **F** has two parts with **different evaluability timing**.

#### F-journey (evaluable immediately post-cohort)

| Criterion | v2.2 control (frozen) | Treatment threshold |
|-----------|----------------------:|---------------------|
| Median `run_end_journey_test_count` | **8** | **≥ 8** (no regression vs control median) |
| Minimum `run_end_journey_test_count` per rep | **6** | **≥ 6** on **5/5** runs (no rep below v2.2 control minimum) |

Journey thresholds use `result.json` `tests_run` length and apply **immediately** after the cohort run. A journey failure is recorded as **F-journey FAIL** regardless of quality scoring status.

#### F-quality (mandatory before formal experiment verdict)

Before assigning Layer 2 **KEEP** or **REVERT**, all **5** treatment apps must receive the **same human quality scoring method** used for the control floor (`app_rating`, `usability_ux` per rep).

| Criterion | v2.2 control (frozen) | Treatment threshold |
|-----------|----------------------:|---------------------|
| Median `app_rating` | floor **≥ 68** | **≥ 68** |
| Per-rep `usability_ux` | floor **27** | **≥ 27** on **5/5** runs |

**Gate F passes** iff **both** F-journey **and** F-quality pass.

**Formal experiment verdict rule:** If quality scores are **not yet available** for all 5 reps, Layer 2 experiment verdict remains **`PENDING`** — not **KEEP** and not **REVERT** — even if A–E and F-journey are already evaluable. Report provisional A–E and F-journey results; close to **KEEP** or **REVERT** only after F-quality is scored.

Once quality is scored: failing **F** (journey or quality) → experiment **REVERT** regardless of other passing gates (unless already failed on A–E/C).

**Rationale:** Primary **A** compresses suite size at first VERIFY; Primary **F** ensures that compression is not achieved by dropping required journey coverage or regressing app quality vs the frozen v2.2 control band. Human quality is **mandatory** for the final experiment verdict — not optional (cf. Q2-D analysis note where quality was absent).

---

## Secondary outcomes (report only — not KEEP gates)

| Metric | Role |
|--------|------|
| `call_span_first_addition_to_anchor` | VERIFY timing after first +1 — E2 does **not** enforce |
| `authored_tests_added_before_anchor` | Incremental steps before Pi chooses VERIFY |
| `weighted_first_addition_to_anchor_verify` | vs control **`weighted_first_test_mutation_to_first_post_mutation_canonical_verify`** (~8,929) |
| `run_end_authored_test_count` | Terminal suite size |
| `canonical_verify_count_after_first_addition` | VERIFY frequency after tests begin |
| `primary_anchor_verify_outcome` pass rate | Report — not sufficient alone |
| `verify_fail_before_first_canonical_green` | Compare to v2.2 `{0,1,1,2,2}` |
| Median calls | Increment tax proxy |
| `increment_guard_rejections` | Pi fighting guard vs adapting |

---

## Verdict table — two layers (frozen)

Analysis must report **mechanism** and **experiment** separately (same pattern as Q2 test-isolation, Q2-C, Q2-D).

### Layer 1 — Mechanism (Primary C)

| Verdict | Conditions |
|---------|------------|
| **PASS** | All Primary **C** criteria met |
| **FAIL** | Any Primary **C** criterion failed |

Mechanism PASS with experiment REVERT → extension validated but **not promoted** (cf. Q2-D `early-verify-v1`).

### Layer 2 — Formal experiment (Primary A, B, D, E, F)

| Verdict | Conditions |
|---------|------------|
| **KEEP** | Primary **A**, **B**, **C**, **D**, **E**, **F** pass — **including F-quality scored on 5/5 reps** |
| **REVERT** | Any Primary **A**, **B**, **D**, **E**, or **F** fail; Primary **C** fail — **requires F-quality scored on 5/5 reps** |
| **PENDING** | Human quality scoring (`app_rating`, `usability_ux`) **not yet complete** on all 5 treatment reps — formal **KEEP** / **REVERT** **withheld** |

Provisional gate results (A–E, F-journey) are reported immediately post-cohort. **F-journey FAIL** is recorded immediately but final Layer 2 verdict stays **PENDING** until F-quality is scored, then resolves to **REVERT** (if F-journey or F-quality failed) or **KEEP**/**REVERT** per remaining gates.

There is **no fourth experiment verdict** beyond KEEP / REVERT / PENDING.

**Post-KEEP:** promote `HARNESS_OWNED_TEST_STRUCTURE_V1` default-on — separate PR.

**Post-REVERT interpretation guide:**

| Pattern | Implication |
|---------|-------------|
| C PASS, A/B/D/E fail | Structure guard works; incremental authoring insufficient for cost/size — consider E3 stubs or caps |
| C PASS, F fail (journey or quality) | Smaller anchor suite via dropped journeys or quality regression — not a valid KEEP |
| Layer 2 **PENDING** | Quality not yet scored on 5/5 — withhold KEEP/REVERT; report provisional A–E + F-journey |
| High `increment_guard_rejections`, C PASS | Pi fights guard — report; may inflate calls |
| High rejections + D fail | Guard tax dominates — post-tool restore too expensive in wall-clock/calls |
| C PASS, E fail | Incremental tests still brittle — selector problem persists |
| B fail (accepted Δ ≥ 2) | Mechanism leak — implementation bug, not experiment interpretable |
| A pass, F pass, high `call_span_first_addition_to_anchor` | Valid — E2 does not gate VERIFY timing |

---

## Failure modes (pre-specified)

| Mode | Observable | Classification |
|------|------------|----------------|
| **F1 — Skeleton missing or pre-populated** | `skeleton_authored_count_at_start ≠ 0` or file absent | Primary **C** fail |
| **F2 — Extra test file accepted** | Second qualifying path persists after tool | Primary **C** fail |
| **F3 — Monolith accepted** | `max_accepted_single_step_delta ≥ 2` | Primary **B** fail + **C** fail |
| **F4 — Restore failure** | Post-rejection disk hash ≠ last accepted | Primary **C** fail |
| **F5 — Pi never adds a test** | `first_successful_authored_test_addition_call` null | Protocol failure (**F10**) |
| **F6 — Pi VERIFY before any +1** | Anchor VERIFY exists but no successful +1 | Unevaluable anchor — **F10** |
| **F7 — Product-only long runway** | High `product_weighted_before_first_addition` | Out of scope |
| **F8 — VERIFY repair blowup** | `weighted_anchor_verify_to_first_canonical_pass` > gate | Primary **E** fail |
| **F9 — Guard bypass via non-qualifying path** | Tests outside `src/**/*.test.ts(x)` | Report only — out of guard scope v1 |
| **F10 — Null experiment** | No successful +1 in **0/5** runs | Protocol failure |
| **F11 — Coverage regression** | `run_end_journey_test_count` below F-journey gate | **F-journey FAIL** (immediate); Layer 2 **PENDING** until F-quality scored, then **REVERT** |
| **F12 — Quality regression** | `app_rating` or `usability_ux` below floor | **F-quality FAIL** → Layer 2 **REVERT** (once scored) |
| **F13 — Quality scoring incomplete** | Any rep missing `app_rating` or `usability_ux` | Layer 2 **PENDING** — not KEEP or REVERT |

---

## E2 vs deferred variants (design record)

| Variant | Seed | Enforcement | In this prereg? |
|---------|------|-------------|-----------------|
| **E1** | None | Edit-tool blocking only, no Δ cap | **No** — misses bash heredocs |
| **E2** | Empty shell, 0 tests | Post-tool filesystem, Δ ∈ {0,+1}, single file | **Yes — this experiment** |
| **E3** | Journey `it()` stubs | Pi fills bodies only | **Deferred** — separate prereg if E2 partial-signals |

---

## Explicitly out of scope

- `HARNESS_EARLY_VERIFY_V1` / auto VERIFY on mutation (Q2-D)
- `HARNESS_TEST_AUTHORING_GUARD_V1` / F1–F6 pre-VERIFY blocking (Q2-C)
- `HARNESS_VERIFY_REPAIR_V1` (Q2-B)
- `TEMPLATE_TEST_ISOLATION` / `memoryStorage`
- CSS / persistence overlays
- Test-count cap, max LOC cap (beyond +1-per-action)
- Pre-seeded journey stubs (E3)
- Harness report finalization / lifecycle pipeline
- VERIFY checkpoints between +1 additions
- Combined integration cohort

---

## Protocol

1. **This prereg is frozen** (2026-09-02) — no threshold or mechanism changes without a dated amendment.
2. Confirm v2.2 retro anchor numbers match [Q2-D analysis](./experiment-q2-early-verify-v1-analysis.md) (Amendment 3 or appendix if drift).
3. Implement `harness-owned-test-structure-v1` extension + experiment script when authorized.
4. Acceptance tests: seed parity, Δ+2 rejection + restore, extra-file rejection, bash heredoc path, Δ0 edit pass, Δ+1 pass.
5. Run **5 reps:** `npm run experiment:q2-harness-owned-test-structure-v1 -- 5` (script name TBD at implementation).
6. Post-run: trajectory v2, `test-structure.v1.json`, retro comparison, secondary metrics table.
7. Analysis doc → **FINAL / FROZEN** with **dual verdict** (mechanism + experiment). Experiment verdict **PENDING** until F-quality scored on 5/5 reps.

---

## Amendment 1 (2026-09-02 — pre-freeze)

1. **Gate B:** removed call-span ≤ 8 as a primary gate; span and accepted +1 count before anchor VERIFY are **secondary/report-only** (E2 does not control VERIFY timing).
2. **Primary F:** explicit quality & journey coverage guard — median journeys ≥ 8, min per rep ≥ 6, `app_rating` ≥ 68, `usability_ux` ≥ 27.
3. **Control metric naming:** `~8,929` is **`weighted_first_test_mutation_to_first_post_mutation_canonical_verify`** (Q2-D retro label), not generic “weighted to anchor.”
4. **Rollback scope:** restore **only qualifying test-file state**; unrelated changes from the same tool action remain intact.

## Amendment 2 (2026-09-02 — pre-freeze)

**Gate F quality scoring:** human quality (`app_rating`, `usability_ux` on all 5 reps, same method as control floor) is **mandatory** before Layer 2 **KEEP** or **REVERT**. F-journey thresholds apply immediately. If quality is not yet scored, experiment verdict is **`PENDING`**.

---

## Q2 program position

```text
q2-test-isolation-v1              ← CLOSED (REVERT)
q2-verify-repair-v1               ← CLOSED (REVERT)
test-authoring-guard-v1           ← CLOSED (REVERT)
q2-early-verify-v1 (Q2-D)        ← CLOSED (Mechanism PASS / Experiment REVERT)
q2-harness-owned-test-structure-v1 ← this prereg (Q2-E structure — E2) — **FROZEN**
        ↓ if REVERT with mechanism PASS
E3 journey-stub variant           ← optional separate prereg
test-count-cap-v1                 ← optional if bucket-1 residual
harness-owned-lifecycle-v1        ← deferred
        ↓
integration prereg
```

---

## References

- Q2-D verdict: [experiment-q2-early-verify-v1-analysis.md](./experiment-q2-early-verify-v1-analysis.md)
- Q2-D prereg (anchor / parser parity): [experiment-q2-early-verify-v1-preregistration.md](./experiment-q2-early-verify-v1-preregistration.md)
- Q2-C prereg (source parse): [experiment-test-authoring-guard-v1-preregistration.md](./experiment-test-authoring-guard-v1-preregistration.md)
- Cost decomposition: [control-floor-v2.2-cost-decomposition.md](./control-floor-v2.2-cost-decomposition.md)
- Harness-owned VERIFY: [harness-owned-verify.md](./harness-owned-verify.md)
- Trajectory metrics: [trajectory-metrics-v2.md](./trajectory-metrics-v2.md)
- v2.2 baseline: [control-floor-v2.2-baseline.md](./control-floor-v2.2-baseline.md)
- Filesystem mutation reference: `solution/extensions/early-verify-core.ts` (qualifying paths, hash snapshots — reuse, do not fork parser)

---

**STOP** — prereg frozen (2026-09-02). Implementation is the next separate step when authorized.
