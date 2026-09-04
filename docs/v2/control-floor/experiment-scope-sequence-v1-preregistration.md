# Experiment SS1 — Scope & Sequence v1 — preregistration

**Status:** PREREGISTERED — frozen (2026-09-02) — anchor + message **LOCKED** — **NOT IMPLEMENTED**  
**Experiment ID:** `scope-sequence-v1`  
**Short label:** SS1 (minimal **scope + sequence** nudge at pre-VERIFY strategy fork)  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) via assembler **OFF/OFF**  
**Canonical base hash:** `1f897f6388754c98f311031dd79600bd65d1ec476e57a43b67ca70f67dad82f6` ([provenance](./template-base-provenance.json))  
**Forensic basis:** [Forensic Phase 2 — CLOSED](./forensic-phase-2-trajectory-fork.md)

> **Scope boundary.** This experiment tests **one harness-only hypothesis**:
>
> **Can a single minimal scope/sequence message — delivered before the expensive build-complete trajectory forms (calls 4–6) — shift Pi toward required-journey implementation, a compact test suite, and early VERIFY without hard blocking, auto-VERIFY, or structural test guards?**
>
> **It does NOT include:** Error Memory (S2), S1 convergence intervention, Q2-D auto early-VERIFY, Q2-E +1 test guard / harness test shell, Q2-C pre-VERIFY blocking, Q2-B VERIFY repair coaching, test-count caps, max-LOC caps, CSS overlays, persistence overlays, template overlay changes, or **changes to the frozen product idea**.
>
> **It does NOT claim:** to fix post-VERIFY repair tails (S1 domain), eliminate all model variance, or guarantee first-VERIFY PASS. Success is measured on **pre-first-VERIFY cost**, **strategy proxies**, and **total cost vs v2.2**.

---

## Problem statement (from Forensic Phase 2)

### What we now know

| Finding | Source |
|---------|--------|
| S1 expensive median **93,354** vs v2.2 **60,852**; S1 mechanism PASS but **0/5** intervention opportunity on converging 8→3→0 paths | S1 analysis |
| ~**+18k** pre-first-VERIFY gap: **+14k** pre-mutation + **+11k** mutation→VERIFY (medians) | First-VERIFY authoring forensic |
| Median tests at first VERIFY **8 vs 9** — not the primary fork | Same |
| Fork at **calls 4–6**: test-soon vs build-complete vs invented scope (search, sort, undo) | Trajectory fork forensic |
| v2.2 Rep4 (**109k**) reproduces expensive shape **without S1** | Bridge comparator |
| Q2-D / Q2-E increased median cost despite mechanism PASS | Q2 analyses |

### Causal chain SS1 targets (upstream of S1)

```text
Calls 1–3: recon (cheap ≈ expensive)
        ↓
Call 4–6: STRATEGY FORK  ← SS1 targets HERE
        ↓
┌─────────────────────────────────────────────────────────────┐
│ CHEAP: App + CSS → compact tests → VERIFY soon (span 1–2)      │
│ EXPENSIVE: extra scope + polish → verbose/granular tests     │
│            → tsc/refinement → VERIFY late → large repair       │
└─────────────────────────────────────────────────────────────┘
        ↓
First VERIFY (S1 only helps after this if non-converging)
```

**Out of scope for SS1:** post-first-VERIFY repair, convergence classification, debug sidecars, journey quality scoring (report only).

---

## Hypothesis (narrow, falsifiable)

On exact v2.2 (OFF/OFF), harness extension **`scope-sequence-v1`** will:

1. **Reduce median weighted cost before first canonical VERIFY** toward v2.2 cheap cohort levels (~**30.7k**), without increasing post-VERIFY repair beyond v2.2.
2. **Increase the fraction of runs that follow the cheap strategy proxy** (mutation→VERIFY span ≤ **2**, no invented scope features, authored tests at first VERIFY ≤ **10**).
3. **Non-regress v2.2 median total cost** and cheap-rep count.

**Primary success statement:**

> Median weighted total **≤ 60,852** AND **≥ 2/5** reps **≤ 70k**, with median **weighted_before_first_canonical_verification ≤ 40,000** and mechanism gate **PASS**.

**Not claimed:** median must hit 49k; first-VERIFY PASS rate must rise; all optional UI disappears (prompt-supported validation/empty states may remain).

---

## Treatment (harness-only — frozen at prereg; implement after explicit authorization)

**v2.2 + one new harness extension.** Assembler **OFF/OFF**. **No AGENTS.md / system-prompt.md edits** in v1 (harness-delivered message only — isolates delivery mechanism).

```text
TEMPLATE_CSS_VOCABULARY=0
TEMPLATE_PERSISTENCE=0
TEMPLATE_TEST_ISOLATION=0
HARNESS_SCOPE_SEQUENCE_V1=1    # new toggle at implementation
```

| Component | v2.2 OFF/OFF | SS1 treatment |
|-----------|--------------|---------------|
| Base template / AGENTS.md | `app-template-base` | **unchanged** |
| All assembler overlays | off | **off** |
| Harness-owned VERIFY v1.1 | on | **unchanged** |
| S1 / Q2-B/C/D/E toggles | off | **off** |
| **`scope-sequence-v1`** | absent | **on** |

### Harness extension: `scope-sequence-v1`

**Principle:** Deliver **one** minimal, frozen scope/sequence nudge **before Pi commits to the expensive build-complete path** — piggybacked on an existing turn boundary with **no extra LLM call, VERIFY call, or tool block**.

#### Delivery anchor — **Anchor A only (frozen)**

**There is no Anchor B and no path fallback in SS1 v1.** Call-index timing and generic “first product `.tsx`” triggers are **explicitly excluded** — they would fire at a less causally clean moment than the forensic fork (calls 4–6).

**Trigger (frozen):**

> Trigger **exactly once** on the **first successful, content-changing** `write` or `edit` to **`src/App.tsx`**. Append the SS1 message to **that tool result**. **Failed / no-op mutations do not consume the trigger.**

**Operational rules (frozen):**

| Rule | Definition |
|------|------------|
| **Path** | **`src/App.tsx` only** — not `main.tsx`, not `src/components/*.tsx`, not any other product file |
| **Qualifying tools** | `write` or `edit` whose resolved path is `src/App.tsx` |
| **Content-changing** | Write replaces/creates file content, or edit applies at least one successful text change (same tolerance as replay-run edit application) |
| **Failed / no-op** | Tool error, empty edit, or edit whose `oldText` is not found — **does not** fire SS1; a later successful mutation may still trigger |
| **Seeded template** | An **edit** of the preinstalled seed `App.tsx` **counts**, if it succeeds and changes content |
| **No `App.tsx` touch** | If the run completes without any qualifying mutation to `src/App.tsx`, SS1 **never delivers** — record as **mechanism failure** (Gate D), not silent fallback to another anchor |
| **Delivery count** | **Exactly one** append per run (when trigger fires) |

**Rationale:** Intervenes at the moment Pi commits to app implementation — aligned with Forensic Phase 2 fork at calls 4–6. Waiting until call 3 or a non-`App.tsx` file risks the expensive build-complete strategy already forming.

#### Frozen message text (exact — do not paraphrase at implementation)

Append verbatim (leading/trailing whitespace normalized; internal wording unchanged):

```text
Implement only capabilities required or clearly implied by the idea; do not add unsupported extras such as search, sort, or undo/redo. Keep tests compact: one focused test per required/implied journey, with no duplicate or speculative cases. After the first complete App.test.tsx write, call verify next—before tsc, build checks, or further CSS/polish.
```

**Message covers three forensic forks (frozen intent):**

| Fork | How the message addresses it |
|------|------------------------------|
| Scope invention (search, sort, undo) | Names unsupported extras explicitly |
| Granular / verbose tests | One focused test per journey; no duplicate or speculative cases |
| Deferred VERIFY (tsc, refinement, polish) | **`call verify next`** after first complete `App.test.tsx` write — not “verify soon” |

**Explicitly out of message scope:** confirmation flows / delete dialogs — not listed as unsupported extras in v1 (may be idea-justified in some apps).

**Delivery format:** Plain text appended to the anchored tool result body (same piggyback pattern as S1 Tier 1/2 on VERIFY results). No markdown requirement.

**Explicit prohibitions for the extension:**

- **No tool blocking** or filesystem restore (Q2-C / Q2-E architecture)
- **No automatic VERIFY** (Q2-D architecture)
- **No test-count or LOC caps**
- **No repeated/nagging messages** — exactly **one** delivery per run when trigger fires; silent only if trigger never qualifies
- **No alternate anchor** (no call-index trigger, no non-`App.tsx` fallback)
- **No change** to VERIFY output, S1 hooks, Error Memory, AGENTS.md, or `system-prompt.md`

#### Frozen treatment flow (SS1 v1)

```text
First successful mutation of src/App.tsx
                  ↓
append one small SS1 message (exact text above)
                  ↓
Pi continues normally (no block, no auto-VERIFY)
                  ↓
required/implied scope only
                  ↓
one compact App.test.tsx
                  ↓
call verify next (Pi choice — not harness-forced)
```

**Unchanged vs v2.2:** S1 off, no test caps, no guards, no auto-VERIFY, no AGENTS/system-prompt edits.

**Export (required per run):** `scope-sequence.v1.json`

```json
{
  "schema": "agentcofounder.scope_sequence.v1",
  "run_id": "...",
  "delivery": "appended_to_tool_result",
  "anchor": "first_app_tsx_mutation",
  "anchor_path": "src/App.tsx",
  "anchor_call_index": 5,
  "anchor_tool_index": 1,
  "anchor_kind": "write",
  "message_text_frozen": "Implement only capabilities required or clearly implied by the idea; do not add unsupported extras such as search, sort, or undo/redo. Keep tests compact: one focused test per required/implied journey, with no duplicate or speculative cases. After the first complete App.test.tsx write, call verify next—before tsc, build checks, or further CSS/polish.",
  "message_bytes": 354,
  "delivered": true,
  "trigger_consumed": true,
  "invented_scope_detected_at_first_verify": ["search_ui"],
  "strategy_proxy": {
    "first_test_mutation_call": 7,
    "first_canonical_verify_call": 8,
    "mutation_to_verify_span": 1,
    "authored_tests_at_first_verify": 7,
    "weighted_before_first_verify": 31204
  }
}
```

---

## Required / optional behavior taxonomy (frozen — for scoring)

**Required or clearly implied** (from `contract-public/development-idea.txt` + journeys.md patterns 1–5):

- Add book (title, author, category/kind)
- Lend with borrower name; clear on return
- Filter/narrow to lent-out only
- Show lent-out count (derived value)
- Edit and delete records
- Persistence across refresh

**Invented scope (flag if present in App or tests at first VERIFY):**

- `search_ui`, `sort_alpha`, `undo_redo`
- Separate cancel-edit / cancel-lend **UI flows** not required by idea
- Tests for capabilities not in required set (e.g. alphabetical sort test when no sort UI)

**Not flagged as invented scope in SS1 v1 scoring:** confirmation/delete dialogs (message does not ban them; idea may justify in some runs).

Detection: same rules as [trajectory-fork-forensic.md](./trajectory-fork-forensic.md) source replay at first canonical VERIFY.

---

## Primary gates

### A. Pre-VERIFY cost (co-primary)

| Metric | v2.2 control | v2.2 cheap (Rep2/3/5) | SS1 threshold |
|--------|-------------:|----------------------:|---------------|
| Median `weighted_before_first_canonical_verification` | **36,202** | **30,744** | **≤ 40,000** |
| Median `weighted_mutation_to_first_post_mutation_verify` | **~8,929** (retro) | **~3,481** | **≤ 8,000** |

### B. Total cost (co-primary)

| Metric | v2.2 control | SS1 threshold |
|--------|-------------:|---------------|
| Median weighted total | **60,852** | **≤ 60,852** |
| Runs **≥ 120k** | **0/5** | **≤ 1/5** |

### C. Cheap-path preservation (co-primary)

| Metric | v2.2 control | SS1 threshold |
|--------|-------------:|---------------|
| Reps **≤ 70k** | **3/5** | **≥ 2/5** |
| Best rep weighted | **49,449** | **≤ 55,000** |

### D. Mechanism (co-primary)

SS1 **passes D** iff **all**:

| Criterion | Threshold |
|-----------|-----------|
| Qualifying **`src/App.tsx`** mutation occurred in run | **5/5** (book-lending task always expects App work) |
| Scope/sequence message **delivered exactly once** on first successful content-changing `write`/`edit` to `src/App.tsx` | **5/5** |
| Delivery confirmed in `events.jsonl` (append visible on anchored tool result; verbatim frozen text) | **5/5** |
| **Zero** tool blocks, auto-VERIFY, or extra LLM/VERIFY calls attributable to SS1 | **0** |
| Export `scope-sequence.v1.json` present with `anchor: "first_app_tsx_mutation"` | **5/5** |

**Mechanism failure examples:** run never mutates `src/App.tsx`; message fires twice; message on wrong path; paraphrased message text.

### E. Strategy proxy (co-primary — forensic-derived)

| Metric | v2.2 cheap median | SS1 threshold |
|--------|------------------:|---------------|
| `mutation_to_verify_span` | **1** | median **≤ 2** |
| `authored_tests_at_first_verify` | **8** | median **≤ 10** |
| Runs with **any** invented-scope flag (`search_ui`, `sort_alpha`, `undo_redo`) at first VERIFY | cheap: **1/3** (Rep2 undo) | **≤ 1/5** |

---

## Secondary outcomes (report only)

| Metric | Why report |
|--------|------------|
| `test_loc_at_first_verify` | Verbosity proxy (Rep2: 258 LOC / 7 tests) |
| `first_verify_fail_count` | Repair surface |
| `verify_fail_before_first_canonical_green` | Repair depth vs v2.2 **0,1,1,2,2** |
| Invented-scope flags per run | Scope compliance |
| Pi assistant text at calls 4–6 | Qualitative strategy trace |
| Journey pass rate / harness success | Quality guardrail |
| Human `app_rating` if available | UX non-regression |

---

## Formal verdict rules

| Layer | PASS | REVERT |
|-------|------|--------|
| **Mechanism (D)** | All D criteria | Any failure |
| **Experiment** | **A AND B AND C AND D AND E** | Any co-primary fails |

**Partial signals (not KEEP):**

- **A/B pass, E fail:** cheaper pre-VERIFY but strategy unchanged (message ignored) → revise message or anchor; do not promote.
- **E pass, B fail:** strategy shifts but total cost rises (e.g. more VERIFY loops) → sequence OK, cost not; redesign.
- **D pass, A fail:** delivered but no pre-VERIFY savings → wrong anchor or message strength.

---

## Relationship to prior arms (explicitly closed)

| Arm | Verdict | SS1 distinction |
|-----|---------|-----------------|
| Q2-D early VERIFY | REVERT | SS1 does **not** auto-run VERIFY; Pi chooses verify after compact tests |
| Q2-E test structure | REVERT | SS1 does **not** cap +1 or seed shell; no filesystem guard |
| Q2-C test guard | REVERT | SS1 does **not** block pre-VERIFY |
| Q2-B verify repair | REVERT | SS1 is pre-first-VERIFY only |
| S1 convergence | REVERT | SS1 is **upstream** of S1; S1 toggle **off** |

**Do not combine SS1 + S1 in v1 cohort** — confounds upstream/downstream levers.

---

## Run protocol

| Field | Value |
|-------|-------|
| Idea | Book lending (same as v2.2 / S1 cohorts) |
| Replicates | **5** |
| Model | Same as v2.2 cohort default (`glm-5.2`, thinking off) |
| Success criterion | Harness `result.json` success + journeys |
| Analysis | `npm run analyze:run` + SS1 export + forensic replay metrics at first VERIFY |

**Comparator runs (no re-run — frozen forensics):**

- v2.2 cheap Rep2/3/5, v2.2 Rep4 bridge, S1 Rep1/Rep2–5

---

## Epistemic prior

| Reason to expect PASS | Reason for skepticism |
|-----------------------|----------------------|
| Fork is identifiable and precedes errors | Q2-B showed post-failure nudges ignored |
| Message aligns with existing system-prompt L12 (“smallest sufficient suite”) — reduces tension rather than new rules | Single append may be drowned by Pi builtin + long context |
| Avoids Q2-D/E call-tax architectures | Prompt-supported “boundary cases” may still expand scope |
| Cheap path exists on same env (S1 Rep1, v2.2 Rep3) | Model may still choose build-complete despite nudge |

**Prior:** ~**35%** formal PASS on all co-primary gates. Mechanism PASS (~80%) more likely than experiment PASS.

---

## Implementation checklist (post-authorization only)

1. ~~Freeze exact message text + delivery anchor (A or B).~~ **Done — Anchor A + hybrid message locked in this prereg.**
2. Implement `scope-sequence-v1` extension + export schema (frozen anchor + verbatim message).
3. Unit tests: trigger on first successful `src/App.tsx` write/edit only; failed/no-op does not consume; no second delivery; export fields; piggyback only.
4. Parity script `run-experiment-ss1-scope-sequence-v1.sh` (5 reps, toggle on).
5. Pin SHA after parity; fresh 5/5 cohort.
6. Analysis doc → **FINAL / FROZEN** with dual verdict (mechanism + experiment).

**Not authorized until implementation is explicitly requested after this prereg review.**

---

## Future arms (not SS1)

| Arm | Question | Prerequisite |
|-----|----------|--------------|
| SS1 + prompt edit | Does embedding same text in system prompt beat piggyback? | SS1 mechanism PASS |
| S1 + SS1 | Upstream scope + downstream convergence | Separate factorial prereg |
| S2 Error Memory | Per-signature verified fixes | SS1 or successor addresses pre-VERIFY cost |
| Test-count cap | Hard limit on authored tests | Only if SS1 partial-signals on granularity |

---

## Document history

| Date | Event |
|------|-------|
| 2026-09-02 | Forensic Phase 2 closed; SS1 prereg frozen — design only |
| 2026-09-02 | **Anchor A only** + **exact hybrid message** locked (review approved; implementation not authorized) |
