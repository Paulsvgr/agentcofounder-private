# Experiment SS2b — Scope & Sequence v2b — preregistration

**Status:** PREREGISTERED — frozen (2026-09-02) — anchor + message **LOCKED** — **IMPLEMENTED** (awaiting cohort authorization)  
**Experiment ID:** `scope-sequence-v2b`  
**Short label:** SS2b (same scope/sequence message, **broader pre-code anchor**)  
**Baseline:** [Control floor v2.2](./control-floor-v2.2-baseline.md) via assembler **OFF/OFF**  
**Comparator arms (frozen — no re-run):**

- [SS1 scope-sequence v1 cohort](./experiment-scope-sequence-v1-preregistration.md) — `artifacts/exports/cohort-ss1-scope-sequence-v1-2026-09-02.zip` — median total **60,051**, invented scope **4/5**
- [SS2 scope-sequence v2 cohort](./experiment-scope-sequence-v2-preregistration.md) — `artifacts/exports/cohort-ss2-scope-sequence-v2-2026-09-02.zip` — median total **125,684**, invented scope **0/5** (formal App/test detector)

> **Scope boundary.** SS2b changes **one thing** vs SS2: the steer anchor widens from **`src/App.tsx` only** to the **first qualifying product-code write/edit anywhere under `src/**/*.ts` or `src/**/*.tsx`**, excluding frozen scaffold/config/test paths below.
>
> **Question under test:** Does **true earlier delivery** (before Pi writes hooks/components/other product code) preserve SS2’s scope improvement **without** SS2’s cost explosion?
>
> **It does NOT include:** message rewording (SS3), Error Memory (S2), S1, Q2-D/E/C, test caps, AGENTS/system-prompt edits, or delivery-channel changes beyond SS2’s steer-on-`tool_call` pattern.

---

## Problem statement (from SS1 + SS2 cohorts)

### What SS2 established (forensic revision)

| Finding | SS2 cohort |
|---------|------------|
| Invented scope @ 1st VERIFY (formal App/test) | **0/5** — scope improved vs SS1 **4/5** |
| Total cost | **FAIL** — median **125,684**; **3/5** ≥ 120k |
| Mechanism | Steer on first **`src/App.tsx`** tool_call — **5/5** |

**Critical forensic finding:** SS2 did **not** test message-before-decision. Pi **generates the full tool call first**; steer arrives on the next turn. Rep 3 encoded sort in **`useLibrary.ts` before** the App.tsx anchor fired — SS2’s narrow anchor missed it.

### Causal chain SS2b targets

```text
SS2 (narrow anchor):
  Pi may write useLibrary.ts / components with invented scope
        → first App.tsx tool_call → steer (too late for earlier files)

SS2b (broad anchor):
  Pi approaches first product .ts/.tsx write (hook, component, or App)
        → steer on that tool_call → hopefully minimal scope everywhere
```

---

## Hypothesis (narrow, falsifiable)

On exact v2.2 (OFF/OFF), harness extension **`scope-sequence-v2b`** will, vs **frozen SS1 + SS2 comparators**:

1. **Preserve scope improvement:** invented-scope incidence at first canonical VERIFY **≤ 1/5** (SS2-like, not SS1-like **4/5**).
2. **Restore economics:** median weighted total **≤ 60,852** (SS1 band); **0/5** ≥ 120k; **≥ 4/5** ≤ 70k.
3. **Non-regress** pre-VERIFY total (≤ 40,000) and mechanism gate **PASS**.

**Primary success statement:**

> Invented scope **≤ 1/5** AND total median **≤ 60,852** AND **0/5** ≥ 120k AND **≥ 4/5** ≤ 70k AND pre-VERIFY median **≤ 40,000** AND mechanism gate **PASS**.

**Not claimed:** SS2b is proven before the cohort runs.

---

## Experimental nuance (frozen epistemic caveat)

SS2b retains SS2’s delivery channel: **`sendMessage` with `deliverAs: "steer"`** on **`tool_call`**. The steer still fires **after Pi has generated that tool call** — but on the **earliest qualifying product-code path**, not only App.tsx.

| Dimension | SS2 | SS2b |
|-----------|-----|------|
| **Primary variable** | Anchor path **`src/App.tsx` only** | Anchor **first qualifying `src/**/*.ts(x)` product code** |
| **Delivery channel** | steer on tool_call | **unchanged** |
| **Message** | 354-byte frozen SS1 text | **unchanged** |

**Interpretation rule (frozen):**

| SS2b outcome | Inference |
|--------------|-----------|
| Scope **≤ 1/5**, cost ~60k | Strong evidence **earlier anchor** fixes SS2’s miss (e.g. hooks) without steer cost side-effects dominating |
| Scope **≤ 1/5**, cost bad | Investigate **steer/delivery side-effects** — not wording |
| Scope still **≥ 2/5** | True pre-decision delivery may require a different mechanism; then SS3 wording |

**Flag safety (frozen):** At most **one** of `HARNESS_SCOPE_SEQUENCE_V1`, `HARNESS_SCOPE_SEQUENCE_V2`, `HARNESS_SCOPE_SEQUENCE_V2B` → **hard error at run start**.

---

## Treatment (harness-only — frozen at prereg)

**v2.2 + one new harness extension.** Assembler **OFF/OFF**. **No AGENTS.md / system-prompt.md edits.**

```text
TEMPLATE_CSS_VOCABULARY=0
TEMPLATE_PERSISTENCE=0
TEMPLATE_TEST_ISOLATION=0
HARNESS_SCOPE_SEQUENCE_V2B=1    # new toggle at implementation
HARNESS_SCOPE_SEQUENCE_V2=0     # explicit off — do not combine
HARNESS_SCOPE_SEQUENCE_V1=0     # explicit off — do not combine
```

| Component | v2.2 OFF/OFF | SS2b treatment |
|-----------|--------------|----------------|
| Base template / AGENTS.md | `app-template-base` | **unchanged** |
| All assembler overlays | off | **off** |
| Harness-owned VERIFY v1.1 | on | **unchanged** |
| S1 / Q2-B/C/D/E / SS1 / SS2 toggles | off | **off** |
| **`scope-sequence-v2b`** | absent | **on** |

### Harness extension: `scope-sequence-v2b`

**Principle:** Deliver **one** minimal, frozen scope/sequence nudge via **steer on the first qualifying product-code `write`/`edit` tool_call** under `src/` — **before that tool executes**.

#### Delivery anchor — **Anchor C (frozen)**

**Trigger (frozen):**

> Trigger **exactly once** on the **first** `write` or `edit` **tool_call** whose resolved path is a **qualifying product-code file** under `src/**/*.ts` or `src/**/*.tsx`. Deliver the frozen 354-byte message via **`sendMessage` with `deliverAs: "steer"`** before the tool executes.

**Qualifying product-code path (frozen):**

| Rule | Definition |
|------|------------|
| **Include** | Any path under `src/` ending in `.ts` or `.tsx` |
| **Exclude — exact paths** | `src/main.tsx` (Vite bootstrap scaffold) |
| **Exclude — prefixes** | `src/test/` (test harness setup, e.g. `src/test/setup.ts`) |
| **Exclude — patterns** | `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`, `**/*.spec.tsx`, `**/*.d.ts` |
| **Examples — qualify** | `src/App.tsx`, `src/useLibrary.ts`, `src/components/BookList.tsx`, `src/hooks/useBooks.ts` |
| **Examples — do not qualify** | `src/main.tsx`, `src/test/setup.ts`, `src/App.test.tsx`, `src/vite-env.d.ts`, `styles.css`, paths outside `src/` |

**Operational rules (frozen):**

| Rule | Definition |
|------|------------|
| **Qualifying tools** | `write` or `edit` tool_call only |
| **Delivery moment** | **Before** tool execution (tool_call hook), not on tool_result |
| **Failed later mutation** | If first tool_call fires steer but tool fails, latch **remains consumed** |
| **No qualifying touch** | If run completes without any qualifying tool_call, SS2b **never delivers** — mechanism failure (Gate D) |
| **Delivery count** | **Exactly one** steer per run |

**Explicit contrast with SS2:**

| | SS2 | SS2b |
|---|-----|------|
| Path filter | **`src/App.tsx` only** | **First qualifying `src/**/*.ts(x)` product code** |
| Anchor id | `before_first_app_tsx_mutation` | `before_first_src_product_code_mutation` |
| Misses hooks before App | **Yes** (Rep 3) | **No** (by design) |

#### Frozen message text (exact — unchanged from SS1/SS2)

```text
Implement only capabilities required or clearly implied by the idea; do not add unsupported extras such as search, sort, or undo/redo. Keep tests compact: one focused test per required/implied journey, with no duplicate or speculative cases. After the first complete App.test.tsx write, call verify next—before tsc, build checks, or further CSS/polish.
```

**Explicit prohibitions:** Same as SS2 — no blocking, auto-VERIFY, caps, SS1/SS2 combined, or message rewording.

#### Frozen treatment flow (SS2b v1)

```text
First write/edit tool_call to qualifying src/**/*.ts(x) product code
                  ↓
steer one small message (exact SS1 text)
                  ↓
tool executes normally
                  ↓
Pi builds product code (hopefully minimal scope)
                  ↓
compact tests → verify next (Pi choice)
```

**Export (required per run):** `scope-sequence.v2b.json`

```json
{
  "schema": "agentcofounder.scope_sequence.v2b",
  "run_id": "...",
  "delivery": "steer_before_tool_call",
  "anchor": "before_first_src_product_code_mutation",
  "anchor_path": "src/useLibrary.ts",
  "anchor_tool_call_index": 4,
  "anchor_kind": "write",
  "message_text_frozen": "Implement only capabilities required or clearly implied by the idea; ...",
  "message_bytes": 354,
  "delivered": true,
  "trigger_consumed": true
}
```

---

## Required / optional behavior taxonomy (frozen — same as SS1/SS2)

**Invented scope (flag if present in App or tests at first VERIFY):**

- `search_ui`, `sort_alpha`, `undo_redo`

Detection: same rules as SS1/SS2 — replay at first canonical VERIFY.

**Supplementary (analysis only, not a gate):** whole-source scan including hooks/components at first VERIFY for sort/search patterns missed by App/test-only formal detector.

---

## Primary gates

**Comparators:** frozen SS1 + SS2 official cohorts (2026-09-02).

### A. Pre-VERIFY cost (co-primary)

| Metric | SS1 | SS2 | SS2b threshold |
|--------|-----|-----|----------------|
| Median pre-VERIFY | **37,607** | **50,958** | **≤ 40,000** |
| Median mutation→VERIFY | **8,385** | **2,815** | **≤ 8,000** (informational vs SS2 improvement) |

### B. Total cost (co-primary)

| Metric | SS1 | SS2 | SS2b threshold |
|--------|-----|-----|----------------|
| Median weighted total | **60,051** | **125,684** | **≤ 60,852** |
| Runs **≥ 120k** | **0/5** | **3/5** | **0/5** |

### C. Cheap-path preservation (co-primary)

| Metric | SS1 | SS2 | SS2b threshold |
|--------|-----|-----|----------------|
| Reps **≤ 70k** | **4/5** | **1/5** | **≥ 4/5** |
| Best rep weighted | **54,466** | **55,465** | **≤ 55,000** |

### D. Mechanism (co-primary)

SS2b **passes D** iff **all**:

| Criterion | Threshold |
|-----------|-----------|
| Qualifying **src product-code** write/edit tool_call occurred | **5/5** |
| Scope/sequence message **delivered exactly once** via steer on first qualifying tool_call | **5/5** |
| Delivery confirmed in session log (`customType: harness_scope_sequence_v2b`, verbatim text) | **5/5** |
| **Zero** tool blocks, auto-VERIFY, or extra LLM/VERIFY calls attributable to SS2b | **0** |
| Export `scope-sequence.v2b.json` with `anchor: "before_first_src_product_code_mutation"` | **5/5** |

### E. Strategy proxy (co-primary)

| Metric | SS1 | SS2 | SS2b threshold |
|--------|-----|-----|----------------|
| Runs with **any** invented-scope flag at first VERIFY | **4/5** | **0/5** | **≤ 1/5** |
| `authored_tests_at_first_verify` | **6** | — | median **≤ 10** (informational) |

---

## Formal verdict rules

| Layer | PASS | REVERT |
|-------|------|--------|
| **Mechanism (D)** | All D criteria | Any failure |
| **Experiment** | **A AND B AND C AND D AND E** | Any co-primary fails |

**Decision tree after SS2b (frozen):**

| Outcome | Next step |
|---------|-----------|
| Scope **≤1/5**, cost ~60k | Upstream nudge **solved for now** — stop exploring |
| Scope good, cost bad | Investigate steer/delivery side-effects |
| Scope still bad | SS3 stronger wording |

---

## Relationship to prior arms

| Arm | Verdict | SS2b distinction |
|-----|---------|------------------|
| SS1 | REVERT | Same message; post-mutation append; App-only |
| SS2 | REVERT | Same message + steer; App-only anchor missed hooks |
| S1 | REVERT | SS2b is pre-VERIFY; S1 **off** |

**Do not combine SS2b + SS1/SS2/S1 in v1 cohort.**

---

## Run protocol

| Field | Value |
|-------|-------|
| Idea | Book lending (same as v2.2 / SS1 / SS2) |
| Replicates | **5** |
| Model | Same as v2.2 cohort default (`glm-5.2`, thinking off) |
| Success criterion | Harness `result.json` success + journeys |
| Analysis | `npm run analyze:run` + SS2b export + forensic replay at first VERIFY |

**Cohort authorization:** Run **one 5-run cohort** after implementation parity; **no other changes** in the same commit window.

---

## Epistemic prior

| Reason to expect PASS | Reason for skepticism |
|-----------------------|----------------------|
| SS2 scope win likely real; SS2 cost may be steer churn + late reactive cleanup | Steer channel may still cause cost explosion regardless of anchor |
| Hook miss (Rep 3) is exactly what SS2b fixes | Pi may still ignore early steer |
| SS1 economics safe when not steered heavily | tool_call timing still post-generation |

**Prior:** ~**40%** formal PASS on all co-primary gates. Mechanism PASS (~90%) more likely than experiment PASS.

---

## Implementation checklist (post-authorization only)

1. Implement `scope-sequence-v2b` extension + export schema (frozen anchor + verbatim message).
2. Unit tests: trigger on first qualifying src product-code tool_call; exclusions; latch; export; mutual exclusion with SS1/SS2.
3. Parity script `run-experiment-ss2b-scope-sequence-v2b.sh` (5 reps, V2B on, SS1/SS2 off).
4. Pin SHA after parity; fresh 5/5 cohort.
5. Analysis doc → **FINAL / FROZEN** vs frozen SS1 + SS2 comparators.

---

## Document history

| Date | Event |
|------|-------|
| 2026-09-02 | SS2 cohort REVERT (scope win, cost fail); SS2b prereg frozen — broad pre-code anchor |
