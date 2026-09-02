# Experiment S1 — Convergence Intervention v1 — preregistration

**Status:** PREREGISTERED — frozen (2026-09-02)  
**Experiment ID:** `s1-convergence-intervention-v1`  
**Short label:** S1 (smallest post-forensic snowball-prevention arm)  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) via assembler **OFF/OFF**  
**Canonical base hash:** `1f897f6388754c98f311031dd79600bd65d1ec476e57a43b67ca70f67dad82f6` ([provenance](./template-base-provenance.json))

> **Forensic phase:** CLOSED. Evidence base: [failure-implementation-study-v1.json](../../artifacts/forensic/failure-implementation-study-v1.json), [error-mutation-tracking-v1.json](../../artifacts/forensic/error-mutation-tracking-v1.json), [matched-repair-strategy-v1.json](../../artifacts/forensic/matched-repair-strategy-v1.json), [first-verify-corpus-v1.json](../../artifacts/forensic/first-verify-corpus-v1.json).

> **Scope boundary.** This experiment tests **one harness-only hypothesis**:
>
> **When Pi stops converging after a canonical VERIFY failure, can the harness redirect Pi early enough — with the smallest possible message — to prevent repair snowballs without harming normal cheap repairs?**
>
> **It does NOT include:** Error Memory, verified fix lookup, external/StackOverflow-style research, test-count caps, test-structure seeding (Q2-E), pre-VERIFY blocking, template overlay changes, or **hard-blocking** `debug.test.tsx` / debug sidecars.
>
> **It does NOT claim:** all expensive runs are preventable; prevention-candidate patterns (unit tests before green, modals, split modules) are **observational only** — not tested here.
>
> **Causal isolation (frozen):** S1 may add deterministic harness bookkeeping and feedback text only; it **must not** add any standalone LLM invocation, VERIFY invocation, or tool call.

> **Program sequence (frozen intent — not this experiment):**
>
> | Step | Arm | Question |
> |------|-----|----------|
> | **S1 (this prereg)** | Convergence intervention | Does early redirect on loss-of-convergence help? |
> | S2 | + Error Memory | Do verified per-signature fixes improve further? |
> | S3 | + external helper | Do unresolved errors benefit from research fallback? |

---

## Problem statement

### What forensic analysis established

| Finding | Source | Implication |
|---------|--------|-------------|
| First VERIFY **PASS** median ~**47–57k**; normal FAIL→recover ~**70k** | First-VERIFY corpus | Failure alone is not catastrophic (~+20k) |
| Snowball median ~**155–223k** | Cohort + ladder | Tail is a distinct pathology |
| Snowballs correlate with **loss of convergence** + **debug surface expansion**, not merely “many tests” | Timeline + matched repair | Target convergence, not test count |
| **debug_sidecar** post-fail → **97%** snowball in corpus | First-VERIFY + repair study | Strong **escalation signal** — not yet a proven intervention |
| **303k inflection:** 11→1 (converging) → 1→4 (**regressing**, mutation) → 4→4 (**stalled** + debug) | Error mutation tracking | Same-signature-only detectors miss regressing mutations |
| Recover cohort: **0%** debug_sidecar after first fail; snowball: **37%** | Repair-strategy study | Wrong post-fail strategy separates outcomes |
| Prevention share **not quantified** | Synthesis correction | Do not bundle prevention levers into S1 |

### Causal chain S1 targets

```text
Canonical VERIFY FAIL
        ↓
Pi attempts repair
        ↓
Next canonical VERIFY
        ↓
┌───────────────────────────────────────┐
│ CONVERGING (fail count ↓)                 │ → no message              (~70k path)
│ STALLED (fail count flat, counts known)   │ → Tier 1 append           (~risk)
│ REGRESSING (fail count ↑, counts known)   │ → Tier 1 append           (~risk)
│ UNKNOWN (counts unavailable)              │ → silent unless exact sig repeat
│ + debug sidecar + non-convergence       │ → Tier 2 append           (escalation signal)
└───────────────────────────────────────┘
        ↓ (untreated snowball path)
more VERIFY / debug tests / context bloat → 150–300k
```

**Out of scope for S1:** bucket before first VERIFY (product/test interleaving), journey quality, first-VERIFY timing.

---

## Hypothesis (narrow, falsifiable)

On exact v2.2 (OFF/OFF), harness extension **`convergence-intervention-v1`** will:

1. **Reduce snowball incidence** without increasing median cost on runs that would have been cheap on control.
2. **Change post-fail repair behavior** toward in-place repair and away from debug-surface expansion (mechanism check).

**Primary success statement:**

> Median weighted cost **≤ v2.2 (60,852)** AND **≤ 1/5** runs exceed **120k** (snowball guardrail), with **≥ 2/5** improvement on at least one snowball proxy vs control cohort baseline.

**Not claimed in S1:** median must beat 50k; journey scores must improve; first-VERIFY PASS rate must rise.

---

## Treatment (harness-only — frozen at prereg; implement after freeze)

**v2.2 + one new harness extension.** Assembler **OFF/OFF** for all overlays.

```text
TEMPLATE_CSS_VOCABULARY=0
TEMPLATE_PERSISTENCE=0
TEMPLATE_TEST_ISOLATION=0
HARNESS_CONVERGENCE_INTERVENTION_V1=1    # new toggle at implementation
```

| Component | v2.2 OFF/OFF | S1 treatment |
|-----------|--------------|--------------|
| Base template / AGENTS.md | `app-template-base` | **unchanged** |
| All assembler overlays | off | **off** |
| Harness-owned VERIFY v1.1 | on | **unchanged** |
| `HARNESS_VERIFY_REPAIR_V1` | off | **off** |
| Q2-E test-structure guard | off | **off** |
| Early auto-VERIFY | off | **off** |
| **`convergence-intervention-v1`** | absent | **on** |

### Harness extension: `convergence-intervention-v1`

**Principle:** Observe convergence state after each **canonical** VERIFY; when intervention is warranted, append **one minimal redirect** to the **existing VERIFY tool result** (or equivalent piggyback on the immediate next Pi turn — **no extra model call**). **Do not block tools.** **Do not inject Error Memory fixes.**

**Delivery (frozen):** Tier 1/2 text is appended to the canonical VERIFY result body that Pi already receives, or merged into the same turn boundary — **not** a separate harness-initiated LLM turn, VERIFY run, or tool invocation.

#### Step 1 — State classification (after each canonical VERIFY)

Harness parses the latest canonical VERIFY output (same pass/fail parsing as [trajectory-metrics-v2](./trajectory-metrics-v2.md)) and compares to the **previous canonical VERIFY** in the run.

| State | Operational rule (frozen) |
|-------|---------------------------|
| **`converging`** | `failed_after < failed_before` when **both** counts known; OR `failed_after == 0` / canonical pass; OR first canonical VERIFY in run |
| **`stalled`** | `failed_after == failed_before` when **both** counts known |
| **`regressing`** | `failed_after > failed_before` when **both** counts known — **includes mutation regression** (303k 1→4). **Never inferred when counts are unknown.** |
| **`unknown`** | Fail counts unavailable (e.g. legacy piped bash). **Do not infer stalled or regressing.** Classify as `unknown` and **stay silent** unless the fallback trigger below applies. |

**Fallback trigger (conservative — protects cheap path):** When state is `unknown`, intervene **only** if the **exact same normalized signature** appears on **consecutive** canonical VERIFY transitions (see [Appendix A](#appendix-a--normalized-signature-frozen-subset)). Do not infer regression from signature churn alone.

**Normalized signature** uses the forensic subset (import path, RTL role/name snippet, file+message) — **not** broad classes like `rtl_other` alone.

#### Step 2 — Intervention trigger

| Condition | Action |
|-----------|--------|
| **`converging`** | **No harness message** |
| **`stalled` or `regressing`** (counts known) | Append **Tier 1** to VERIFY result (once per transition) |
| **Fallback:** consecutive canonical VERIFY with **exact same normalized signature** (includes `unknown` count cases) | Append **Tier 1** |
| **`stalled` or `regressing` AND debug sidecar detected since last VERIFY** | Append **Tier 2** instead of Tier 1 |
| **`unknown`** without exact signature repeat | **Silent** |

**Debug sidecar detection (observational — not a block):**

- New write/edit to path matching `debug.test.*` or `/tmp/` test heredoc in ledger since last VERIFY
- Trajectory `debug_test_files_created` non-empty and timestamp after last VERIFY

#### Step 3 — Redirect messages (frozen)

Appended to the VERIFY result — **no extra call**.

**Tier 1 — loss of convergence (minimal intervention):**

```text
[harness] Repair the current failure directly. Keep test scope unchanged; do not add diagnostic test files. Make the smallest fix, then run canonical VERIFY.
```

**Tier 2 — escalation (debug surface detected + non-convergence):**

```text
[harness] Repair is not converging and debugging surface has expanded. Remove temporary debug tests, return to the existing test suite, make the smallest direct fix, then run canonical VERIFY.
```

Wording is frozen for S1; implementation may not weaken the in-place / no-expansion intent.

#### Explicitly NOT in S1 treatment

- Error Memory lookup or verified fix injection
- External research / StackOverflow helper
- Blocking `verify`, bash, write, or edit tools
- Hard-blocking `debug.test.tsx` creation
- Test file count caps or harness-owned test skeleton (Q2-E)
- Pre-VERIFY readiness gates (“don’t verify if imports broken”)
- Changes to canonical/pass parsing definitions
- **Standalone LLM invocation, VERIFY invocation, or tool call** for intervention delivery (feedback text only)

---

## Control reference (v2.2 lock)

Historical cohort — **5 reps**, book-lending idea, success.

### Cost (guardrail)

| Metric | v2.2 (5 reps) |
|--------|---------------|
| Median weighted | **60,852** |
| Range | 49,449 – 108,708 |
| Runs ≥ **120k** (snowball proxy) | **0/5** |
| Runs ≥ **140k** | **0/5** |
| Median calls | **16** |

### Forensic snowball baseline (context — not control cohort)

| Cohort | n | Median weighted | Snowball rate |
|--------|--:|----------------:|--------------:|
| First VERIFY PASS | 12–13 | ~54k | ~23% |
| FAIL → recover | 20 | ~70k | 0% (by selection) |
| Snowball (corpus) | 81 | ~155k+ | — |

Full corpus: 140 success book-lending runs. S1 uses **5-rep cohort** consistent with Q2 arms.

---

## Primary outcomes

### A. Snowball guardrail (co-primary)

Treatment **passes A** iff **both**:

| Criterion | v2.2 control | S1 threshold |
|-----------|--------------|--------------|
| Runs with weighted **≥ 120k** | **0/5** | **≤ 1/5** |
| Median weighted total | **60,852** | **≤ 60,852** |

**Rationale:** S1 fails if we trade one snowball for systematically higher median cost, or if ≥2/5 runs hit expensive tail.

### B. Cheap-path non-regression (co-primary)

Treatment **passes B** iff **both**:

| Criterion | v2.2 control | S1 threshold |
|-----------|--------------|--------------|
| Reps with weighted **≤ 70k** | **3/5** | **≥ 2/5** |
| Best rep weighted | **49,449** | **≤ 55k** (allow small slack) |

**Rationale:** Intervention must not destroy the ~50–70k one-shot path.

### C. Mechanism — intervention fires correctly (co-primary)

Treatment **passes C** iff **all**:

| Criterion | Measurement | Threshold |
|-----------|-------------|-----------|
| Triggers on known **converging** transitions | Export `convergence-intervention.v1.json` per run | **0** Tier 1/2 on strictly converging steps (e.g. 11→1) |
| Triggers on **observable stalled/regressing** transitions | Same export; only when classifier state is `stalled` or `regressing` with **known** fail counts | **≥ 1** Tier 1/2 on every such transition in runs that have them |
| **`unknown`** transitions | Same export | **Silent** unless exact normalized-signature repetition triggers fallback Tier 1 |
| Debug escalation tier | Tier 2 appended only when debug sidecar + observable non-convergence | **100%** compliance |

Also report: Tier 1 vs Tier 2 counts; `unknown`-silent vs signature-fallback counts; piggyback delivery confirmed (no extra VERIFY/LLM calls attributable to S1).

---

## Secondary outcomes (report only — not gates)

| Metric | Why report |
|--------|------------|
| `verify_fail_before_first_canonical_green` | Repair depth |
| `canonical_verification_count` | VERIFY loop length |
| `debug_test_files_created` | Snowball proxy |
| `verify_fail_before_first_canonical_green` distribution | Shape vs v2.2 **0,1,1,2,2** |
| Post-intervention repair strategy (direct vs debug) | Behavioral shift |
| Journey pass rate / human app_rating | Quality guardrail |
| Per-rep convergence state timeline | Forensic validation of classifier |

---

## Formal verdict rules

| Layer | PASS | REVERT |
|-------|------|--------|
| **Mechanism (C)** | Classifier + trigger compliance | Any false positive on converging 11→1-style step |
| **Experiment** | **A AND B AND C** | Any co-primary fails |

**Partial signal (not KEEP):** A passes, B fails → intervention may reduce tails but taxes cheap runs — redesign trigger or message, do not proceed to S2.

**Partial signal:** B passes, A fails → cheap runs preserved but snowballs unchanged — S1 intervention too weak; revise before S2.

---

## Run protocol

| Field | Value |
|-------|-------|
| Idea | Book lending (same as v2.2 / Q2 cohorts) |
| Replicates | **5** |
| Model | Same as v2.2 cohort default |
| Success criterion | Harness `result.json` success + journeys |
| Analysis | `npm run analyze:run` + S1 export |

**Per-run export (required):** `convergence-intervention.v1.json`

```json
{
  "schema": "agentcofounder.convergence_intervention.v1",
  "run_id": "...",
  "transitions": [
    {
      "ordinal": 2,
      "state": "regressing",
      "counts_known": true,
      "failed_before": 1,
      "failed_after": 4,
      "signatures_before": ["import_resolve|./useCollection"],
      "signatures_after": ["rtl_duplicate|..."],
      "intervention_tier": 1,
      "delivery": "appended_to_verify_result",
      "debug_sidecar_detected": false
    }
  ],
  "false_positive_converging_interventions": 0,
  "tier1_count": 0,
  "tier2_count": 0
}
```

---

## Epistemic prior

| Reason to expect PASS | Reason for skepticism |
|-----------------------|----------------------|
| Forensic: recover path uses direct repair, 0% debug sidecar | Prompt-only nudges often failed in Q2-B |
| 303k shows escalation after unstopped non-convergence | Message may be ignored under pressure |
| Smallest intervention isolates causal lever | Fail counts unknown on piped bash — mitigated by conservative `unknown` + signature fallback only |
| Cheap runs are converging — no message | Signature-fallback must not fire on healthy one-shot paths |

**Prior:** ~40% formal PASS on A+B+C. Either outcome is informative for S2 design.

---

## Future arms (explicitly not S1)

### S2 — Error Memory v1

Add verified fix lookup for high-ROI signatures after Tier 1/2 trigger:

- `import_resolve|"./X"`
- `missing_global_setup|*.test.ts|expect is not defined`
- Selected RTL duplicate selectors

Requires S1 PASS on mechanism + partial experiment signal.

### S3 — External helper

Research fallback only when Error Memory misses **and** convergence remains stalled after S2-eligible redirect.

---

## Appendix A — Normalized signature (frozen subset)

For signature-repeat fallback when fail counts are `unknown`:

| Family | Signature shape | Example |
|--------|-----------------|---------|
| `import_resolve` | `import_resolve\|<path>` | `import_resolve\|./books` |
| `missing_global_setup` | `missing_global_setup\|<file>\|expect is not defined` | |
| `rtl_selector` | `rtl_selector\|<role/name/text snippet>` | `rtl_selector\|button\|/Lend out/i` |
| `rtl_duplicate` | `rtl_duplicate\|<text or role snippet>` | |
| `assertion` | `assertion\|<file>\|<message prefix>` | |

**Exact match required** for fallback trigger — same normalized string on consecutive canonical VERIFY.

Implementation may reuse [forensic-matched-repair-strategy.py](../../scripts/forensic-matched-repair-strategy.py) normalizer.

---

## Appendix B — What S1 must not bundle

Checklist for implementation review:

- [ ] No Error Memory database
- [ ] No external API / web research
- [ ] No test file caps
- [ ] No Q2-E skeleton / increment guard
- [ ] No pre-VERIFY blocking
- [ ] No tool blocks (including debug sidecar)
- [ ] No AGENTS.md / template overlay changes
- [ ] No standalone LLM / VERIFY / tool call for intervention delivery
- [ ] No changes to trajectory metric definitions

---

## References

- [Harness-owned VERIFY v1.1](./harness-owned-verify.md)
- [Trajectory metrics v2](./trajectory-metrics-v2.md)
- [Q2 verify-repair v1 analysis](./experiment-q2-verify-repair-v1-analysis.md) — post-fail coaching alone insufficient
- [Q2-E analysis](./experiment-q2-harness-owned-test-structure-v1-analysis.md) — forcing test structure worsened cost
- Forensic: `artifacts/forensic/error-mutation-tracking-v1.json` — converging / stalled / regressing definitions

---

**Next step:** implement `convergence-intervention-v1` extension + export schema per this frozen prereg; **do not** start S2/S3.
