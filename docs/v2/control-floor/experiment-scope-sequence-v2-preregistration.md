# Experiment SS2 — Scope & Sequence v2 — preregistration

**Status:** PREREGISTERED — frozen (2026-09-02) — anchor + message **LOCKED** — **IMPLEMENTED** (awaiting cohort authorization)  
**Experiment ID:** `scope-sequence-v2`  
**Short label:** SS2 (same scope/sequence message, **earlier delivery anchor**)  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) via assembler **OFF/OFF**  
**Comparator arm (frozen — no re-run):** [SS1 scope-sequence v1 cohort](./experiment-scope-sequence-v1-preregistration.md) — `artifacts/exports/cohort-ss1-scope-sequence-v1-2026-09-02.zip`  
**Canonical base hash:** `1f897f6388754c98f311031dd79600bd65d1ec476e57a43b67ca70f67dad82f6` ([provenance](./template-base-provenance.json))

> **Scope boundary.** This experiment tests a **narrow A/B contrast** against frozen SS1 — **timing is the main intended variable**, but delivery channel necessarily co-varies (see [Experimental nuance](#experimental-nuance-frozen-epistemic-caveat) below):
>
> **SS1 told Pi the right thing, but probably told it too late.** SS2 delivers the **exact same frozen 354-byte message** on the **first `write`/`edit` tool_call** to `src/App.tsx` — **before** the mutation executes — instead of SS1’s anchor on the **first successful tool result** after the mutation.
>
> **It does NOT include:** message rewording, Error Memory (S2), S1 convergence intervention, Q2-D auto early-VERIFY, Q2-E test guard, Q2-C blocking, test-count caps, AGENTS/system-prompt edits, or **changes to the frozen product idea**.
>
> **It does NOT claim:** SS2 works — this is the **next experiment designed from SS1’s REVERT verdict**. Success is measured against **frozen SS1 cohort numbers**, not a re-run of SS1.

---

## Problem statement (from SS1 cohort)

### What SS1 established

| Finding | SS1 cohort |
|---------|------------|
| Mechanism (Gate D) | **PASS** — 5/5 delivery on first App.tsx mutation; verbatim message; latch; no auto-VERIFY |
| Pre-VERIFY total (Gate A primary) | **PASS** — median **37,607** (≤ 40,000) |
| Total cost (Gate B) | **PASS** — median **60,051**; **0/5** ≥ 120k |
| Cheap-path (Gate C) | **PASS** |
| Mutation→VERIFY (Gate A secondary) | **FAIL** — median **8,385** (> 8,000) |
| Invented scope (Gate E) | **FAIL** — **4/5** runs with `search_ui` / `sort_alpha` at first VERIFY |

**Locked SS1 interpretation:** Mechanically successful, economically safe (~v2.2 band), behaviorally partial. The message can change behavior **after** a bad App write (Rep 3 removed search) but **4/5** still carried invented scope at first VERIFY because the anchor fired **after** Pi committed to implementation.

### Causal chain SS2 targets

```text
SS1 (control timing):
  Pi decides implementation → writes App.tsx (may add search/sort)
        → message arrives on tool result → must undo decision

SS2 (treatment timing):
  Pi approaches implementation → message arrives on tool_call
        → Pi decides implementation → App.tsx hopefully minimal scope
```

**Forensic reference reps (interpret only — not re-run):**

| Rep | Role |
|-----|------|
| **Rep 3** | Positive control for **message comprehension** — search removed after SS1 delivery; still expensive (83k) |
| **Rep 5** | Negative control for **sequencing** — message delivered; Pi still followed long test/build path before VERIFY |

---

## Hypothesis (narrow, falsifiable)

On exact v2.2 (OFF/OFF), harness extension **`scope-sequence-v2`** will, vs **frozen SS1 cohort**:

1. **Reduce invented-scope incidence** at first canonical VERIFY from **4/5** to **≤ 1/5**.
2. **Reduce median mutation→VERIFY weighted cost** from **8,385** to **≤ 8,000**.
3. **Non-regress** pre-VERIFY total (≤ 40,000), total cost (~60k band), and **0/5** ≥ 120k.

**Primary success statement:**

> Invented scope **≤ 1/5** AND mutation→VERIFY median **≤ 8,000** AND pre-VERIFY median **≤ 40,000** AND total median **≤ 60,852** AND mechanism gate **PASS**.

**Not claimed:** SS2 is proven before the cohort runs. If scope remains **3–4/5**, the next lever is **message strength/wording** (SS3), not further anchor moves without new prereg.

---

## Experimental nuance (frozen epistemic caveat)

SS2 does **not** change timing alone. The operational A/B contrast is technically:

```text
SS1: post-mutation tool-result append
SS2: pre-mutation sendMessage steer
```

| Dimension | SS1 | SS2 |
|-----------|-----|-----|
| **Primary intended variable** | Message **after** first App implementation commit | Message **before** first App implementation attempt |
| **Co-varying channel** | Piggyback on `tool_result` body | `sendMessage` with `deliverAs: "steer"` on `tool_call` |

**Timing** is the main hypothesized cause of SS1’s 4/5 invented-scope failure. **Delivery channel** necessarily co-varies — pre-mutation delivery cannot use SS1’s tool-result piggyback without blocking the tool or adding an extra LLM turn.

**Interpretation rule (frozen):**

| SS2 outcome | Inference |
|-------------|-----------|
| Invented scope **≤ 1/5** | Strong evidence that **earlier delivery helps**; **cannot prove with absolute certainty** that timing alone caused it (steer vs append may contribute). |
| Invented scope still **3–4/5** | Evidence shifts toward **message strength/wording**; channel difference is unlikely to be the primary explanation for continued scope failure. |

**Future arm (not SS2 v1):** same early anchor with tool-result-equivalent delivery if the harness supports it without blocking — requires separate prereg.

**Flag safety (frozen):** `HARNESS_SCOPE_SEQUENCE_V1=1` and `HARNESS_SCOPE_SEQUENCE_V2=1` together → **hard error at run start** (no silent fallback).

---

## Treatment (harness-only — frozen at prereg)

**v2.2 + one new harness extension.** Assembler **OFF/OFF**. **No AGENTS.md / system-prompt.md edits.**

```text
TEMPLATE_CSS_VOCABULARY=0
TEMPLATE_PERSISTENCE=0
TEMPLATE_TEST_ISOLATION=0
HARNESS_SCOPE_SEQUENCE_V2=1    # new toggle at implementation
HARNESS_SCOPE_SEQUENCE_V1=0    # explicit off — do not combine
```

| Component | v2.2 OFF/OFF | SS2 treatment |
|-----------|--------------|---------------|
| Base template / AGENTS.md | `app-template-base` | **unchanged** |
| All assembler overlays | off | **off** |
| Harness-owned VERIFY v1.1 | on | **unchanged** |
| S1 / Q2-B/C/D/E / SS1 toggles | off | **off** |
| **`scope-sequence-v2`** | absent | **on** |

### Harness extension: `scope-sequence-v2`

**Principle:** Deliver **one** minimal, frozen scope/sequence nudge **before Pi’s first `src/App.tsx` implementation mutation executes** — via **steer on tool_call** with **no extra LLM call, VERIFY call, or tool block**.

#### Delivery anchor — **Anchor B only (frozen)**

**Trigger (frozen):**

> Trigger **exactly once** on the **first** `write` or `edit` **tool_call** whose resolved path is **`src/App.tsx`**. Deliver the SS1/SS2 frozen message via **`sendMessage` with `deliverAs: "steer"`** before the tool executes. **Does not wait for tool success** — the decision to mutate App is the causal moment.

**Operational rules (frozen):**

| Rule | Definition |
|------|------------|
| **Path** | **`src/App.tsx` only** |
| **Qualifying tools** | `write` or `edit` tool_call targeting `src/App.tsx` |
| **Delivery moment** | **Before** tool execution (tool_call hook), not on tool_result |
| **Failed later mutation** | If first tool_call fires steer but tool fails, latch **remains consumed** — message was delivered before the attempt |
| **No App.tsx touch** | If the run completes without any qualifying tool_call to `src/App.tsx`, SS2 **never delivers** — mechanism failure (Gate D) |
| **Delivery count** | **Exactly one** steer per run (when trigger fires) |

**Explicit contrast with SS1:**

| | SS1 | SS2 |
|---|-----|-----|
| Hook | `tool_result` | `tool_call` |
| Moment | After first **successful content-changing** mutation | Before first **attempted** write/edit |
| Delivery | Append to tool result body | Steer message |
| Anchor id | `first_app_tsx_mutation` | `before_first_app_tsx_mutation` |

#### Frozen message text (exact — unchanged from SS1)

Same verbatim 354-byte text as SS1 — **do not paraphrase**:

```text
Implement only capabilities required or clearly implied by the idea; do not add unsupported extras such as search, sort, or undo/redo. Keep tests compact: one focused test per required/implied journey, with no duplicate or speculative cases. After the first complete App.test.tsx write, call verify next—before tsc, build checks, or further CSS/polish.
```

**Explicit prohibitions:**

- **No tool blocking** or filesystem restore
- **No automatic VERIFY**
- **No test-count or LOC caps**
- **No repeated/nagging messages**
- **No SS1 + SS2 combined** in one run — harness **throws** if both toggles are set
- **No message rewording** in SS2 v1

#### Frozen treatment flow (SS2 v1)

```text
First write/edit tool_call to src/App.tsx
                  ↓
steer one small message (exact SS1 text)
                  ↓
tool executes normally (no block, no auto-VERIFY)
                  ↓
Pi builds App.tsx (hopefully minimal scope)
                  ↓
compact tests → verify next (Pi choice)
```

**Export (required per run):** `scope-sequence.v2.json`

```json
{
  "schema": "agentcofounder.scope_sequence.v2",
  "run_id": "...",
  "delivery": "steer_before_tool_call",
  "anchor": "before_first_app_tsx_mutation",
  "anchor_path": "src/App.tsx",
  "anchor_tool_call_index": 4,
  "anchor_kind": "write",
  "message_text_frozen": "Implement only capabilities required or clearly implied by the idea; ...",
  "message_bytes": 354,
  "delivered": true,
  "trigger_consumed": true
}
```

---

## Required / optional behavior taxonomy (frozen — same as SS1)

**Invented scope (flag if present in App or tests at first VERIFY):**

- `search_ui`, `sort_alpha`, `undo_redo`

Detection: same rules as SS1 — replay at first canonical VERIFY.

---

## Primary gates

**Comparator:** frozen SS1 official cohort (2026-09-02, commit `1622482`, 5/5 OK).

### A. Pre-VERIFY cost (co-primary)

| Metric | SS1 cohort | SS2 threshold |
|--------|------------|---------------|
| Median `weighted_before_first_canonical_verification` | **37,607** | **≤ 40,000** |
| Median `weighted_mutation_to_first_post_mutation_verify` | **8,385** | **≤ 8,000** |

### B. Total cost (co-primary)

| Metric | SS1 cohort | SS2 threshold |
|--------|------------|---------------|
| Median weighted total | **60,051** | **≤ 60,852** |
| Runs **≥ 120k** | **0/5** | **≤ 1/5** |

### C. Cheap-path preservation (co-primary)

| Metric | SS1 cohort | SS2 threshold |
|--------|------------|---------------|
| Reps **≤ 70k** | **4/5** | **≥ 2/5** |
| Best rep weighted | **54,466** | **≤ 55,000** |

### D. Mechanism (co-primary)

SS2 **passes D** iff **all**:

| Criterion | Threshold |
|-----------|-----------|
| Qualifying **`src/App.tsx`** write/edit tool_call occurred | **5/5** |
| Scope/sequence message **delivered exactly once** via steer on first qualifying tool_call | **5/5** |
| Delivery confirmed in `events.jsonl` (steer with verbatim frozen text) | **5/5** |
| **Zero** tool blocks, auto-VERIFY, or extra LLM/VERIFY calls attributable to SS2 | **0** |
| Export `scope-sequence.v2.json` present with `anchor: "before_first_app_tsx_mutation"` | **5/5** |

### E. Strategy proxy (co-primary)

| Metric | SS1 cohort | SS2 threshold |
|--------|------------|---------------|
| `mutation_to_verify_span` | **1** | median **≤ 2** |
| `authored_tests_at_first_verify` | **6** | median **≤ 10** |
| Runs with **any** invented-scope flag at first VERIFY | **4/5** | **≤ 1/5** |

---

## Formal verdict rules

| Layer | PASS | REVERT |
|-------|------|--------|
| **Mechanism (D)** | All D criteria | Any failure |
| **Experiment** | **A AND B AND C AND D AND E** | Any co-primary fails |

**Decision tree after SS2:**

| Outcome | Next step |
|---------|-----------|
| Scope **≤1/5**, cost ~60k | Strong evidence **earlier delivery** helps (timing likely; channel may co-contribute) |
| Scope still **3–4/5**, cost ~60k | Test message strength/wording (SS3), same early anchor |
| Scope better, cost **>70k** median | Redesign delivery without auto-VERIFY |
| Mechanism fail | Fix implementation before inference |

---

## Relationship to prior arms

| Arm | Verdict | SS2 distinction |
|-----|---------|-----------------|
| SS1 | REVERT (mechanism PASS) | Same message; **earlier anchor**; steer vs append channel co-varies |
| S1 | REVERT | SS2 is pre-VERIFY; S1 **off** |
| Q2-D/E/C | REVERT | SS2 does not auto-VERIFY, block, or cap |

**Do not combine SS2 + SS1 or SS2 + S1 in v1 cohort.**

---

## Run protocol

| Field | Value |
|-------|-------|
| Idea | Book lending (same as v2.2 / SS1) |
| Replicates | **5** |
| Model | Same as v2.2 cohort default (`glm-5.2`, thinking off) |
| Success criterion | Harness `result.json` success + journeys |
| Analysis | `npm run analyze:run` + SS2 export + forensic replay at first VERIFY |

---

## Epistemic prior

| Reason to expect PASS | Reason for skepticism |
|-----------------------|----------------------|
| SS1 failed scope primarily **after** bad App writes | Steer before tool may be ignored like other nudges |
| Rep 3 proves message can change scope when read | Pi may still choose build-complete path |
| Timing is the one variable SS1 left untested | Steer ≠ tool_result piggyback — delivery channel changes |

**Prior:** ~**45%** formal PASS on all co-primary gates (slightly higher than SS1’s ~35% given clearer causal anchor). Mechanism PASS (~85%) more likely than experiment PASS.

---

## Implementation checklist (post-authorization only)

1. Implement `scope-sequence-v2` extension + export schema (frozen early anchor + verbatim SS1 message).
2. Unit tests: trigger on first `src/App.tsx` write/edit tool_call only; latch; export fields; steer only; **hard error** if SS1 + SS2 both enabled.
3. Parity script `run-experiment-ss2-scope-sequence-v2.sh` (5 reps, toggle on, SS1 off).
4. Pin SHA after parity; fresh 5/5 cohort.
5. Analysis doc → **FINAL / FROZEN** with dual verdict (mechanism + experiment) vs frozen SS1 comparator.

---

## Document history

| Date | Event |
|------|-------|
| 2026-09-02 | SS1 cohort REVERT; SS2 prereg frozen — A/B timing experiment vs SS1 |
