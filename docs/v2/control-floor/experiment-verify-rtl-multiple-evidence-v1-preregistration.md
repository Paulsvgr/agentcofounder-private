# Experiment: VERIFY multiple-elements candidate evidence

**ID:** `verify-rtl-multiple-evidence-v1`  
**Status:** **KEEP** (2026-09-04) — factual reporter correction; **do not** cite seeded ~83k→12k as causal ([keep doc](./experiment-verify-rtl-multiple-evidence-v1-keep.md))  
**Depends on:** default stack (VERIFY + root-error-first + persistence + Tailwind + role+name evidence KEEP)  
**Audit:** [audit-repair-tail-rtl-text-multiple.md](./audit-repair-tail-rtl-text-multiple.md)  
**Export:** `artifacts/exports/cohort-verify-rtl-multiple-evidence-v1-2026-09-04.zip`  
**Default:** ON when unset. **No more random MULTIPLE cohorts.**

## Causal story

`rtl_multiple` is expensive because VERIFY strips match identity. Testing Library already prints:

```text
Found multiple elements with the text: Science

Here are the matching elements:
<option value="Science">Science</option>
<span class="badge">Science</span>
```

Legacy `extractMatches` collapses that to `</option>` / `</span>`. Pi then guesses scope, burns repair calls, and can rename valid product controls (WRONG_PRODUCT).

## Treatment (mechanism only)

When `HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1=1` (default ON when unset), compact MESSAGE for `Found multiple elements…` becomes:

```text
Found multiple elements with the text: Science

QUERY
text="Science"

MATCHES PRESENT
1. <option> text="Science" value="Science"
2. <span> text="Science" class="badge"
```

or:

```text
Found multiple elements with the role "button" and name "Lend out"

QUERY
role="button"
name="Lend out"

MATCHES PRESENT
1. <button> name="Lend out" type="button"
2. <button> name="Lend out" type="button"
```

Facts only: tag, text/name, attributes present in the dump. **No** `within()` / `*AllBy*` advice. **No** test-vs-product claim.

Control arm sets `HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1=0` (legacy line-count + tag-token MATCHES). **All other flags identical**, including `HARNESS_VERIFY_RTL_EVIDENCE_V1` KEEP default.

**Code:** `app-template-base/compactFailureMessage.ts` + `compactFailureReporter.ts` (synced to `app-template/`)  
**Forwarded:** `src/v2/challenge-prompt.ts` → VERIFY child env

**Not included:** `rtl_text` miss evidence, Error Memory, repair prompts, `rg` enrichment, product renames.

## Offline proof

```bash
npx vitest run test/compact-failure-message.test.ts
```

Gates for mechanism:

| Gate | Check |
|------|--------|
| Science replay (hand fixture) | MESSAGE has `QUERY` + `MATCHES PRESENT` with `<option>` and `<span class="badge">` |
| Live RTL Science / Lend out | `app-template-base/test/compact-failure-multiple-live.test.ts` — real exceptions |
| Live-shaped Ignored nodes | root compact-failure-message test |
| No advice | compacted text must not contain `within` / `*AllBy*` / “intentional” |
| No false success | unparsable dump → null (no `MATCHES PRESENT (none parsed)`) |
| Control =0 | no `MATCHES PRESENT`; legacy path |

```bash
npx vitest run test/compact-failure-message.test.ts
npm --prefix app-template-base exec -- vitest run test/compact-failure-multiple-live.test.ts --reporter=default
```

## Seeded deterministic proof (next / in progress)

**No more random 5+5.** Prove on a sealed failing fixture:

```text
fixtures/verify-rtl-multiple-seeded/
  src/App.tsx          # Science option+badge, two Lend out buttons
  src/App.test.tsx     # unscoped getByText/getByRole → Found multiple…
  repair-idea.txt      # repair-from-seed instructions for Pi
```

### Layer A — what Pi sees (no Pi cost)

```bash
npm run prove:verify-rtl-multiple-seeded-messages
```

Same fixture, `MULTIPLE_EVIDENCE=0` vs `=1`. Expect:

| Arm | Science | Lend out |
|-----|---------|----------|
| Legacy | `MATCHES` `</option>` / `</button>` | tag tokens |
| Treatment | `MATCHES PRESENT` `<option>` + `<span class="badge">` | two `<button> name="Lend out"` |

Artifact: `artifacts/experiments/verify-rtl-multiple-seeded/message-proof.json`  
**Status:** VERIFIED (2026-09-04) after parser fix.

### Layer B — Pi repair behavior (1+1 seeded)

```bash
npm run experiment:verify-rtl-multiple-seeded-repair -- both 1
# or: control 1 | treatment 1
```

Uses `HARNESS_SEEDED_FIXTURE_DIR` overlay + repair idea. Measure on each arm:

- first VERIFY evidence (candidates vs tag tokens)
- first diagnosis / first edit (test vs product)
- repeated same FAIL streak
- calls + weighted to green

Log: `artifacts/experiments/verify-rtl-multiple-seeded/seeded-repair-pair.log`

**Post-hoc correction:** the published 1+1 cost delta (~83k→12k repair) is **confounded** — control still had `test/compact-failure-multiple-live.test.ts` on first VERIFY; treatment did not. Do not cite that delta as causal. KEEP rationale = factual reporter correction + message proof; see [keep doc](./experiment-verify-rtl-multiple-evidence-v1-keep.md).

---

## Cohort result (2026-09-04) — mechanism path (KEEP via seeded proof + parser fix)

| Gate | Result |
|------|--------|
| Natural activation | **GOOD** — control 4/5, treatment 3/5 |
| Candidate extraction in vivo | **FAIL** — 0 successful parses; every treatment FAIL showed `MATCHES PRESENT (none parsed)` |
| Token / repair effect | **NOT TESTED** (intended evidence never arrived) |
| Idea (historical forensic) | Still supported |
| Implementation | **NOT KEEP YET** |

Root cause: offline fixtures omitted live RTL’s `Ignored nodes: …` prefix (and ANSI). `extractMatchingElementBlocks` required blocks to start with `<`, so all candidates were dropped. Summarizer wrongly counted `MATCHES PRESENT` as mechanism success even with `(none parsed)`.

### Fix landed (post-cohort)

- Parser strips `Ignored nodes` / finds first tag; no false `(none parsed)` MESSAGE (returns null → legacy if unparsable).
- Live integration: `app-template-base/test/compact-failure-multiple-live.test.ts` (real `getByText` / `getByRole` exceptions).
- Summarizer / export: mechanism = `MATCHES PRESENT` **and** `\d+. <` candidate **and not** `(none parsed)`.

### Next (do not start another random 5+5)

1. Confirm live tests green (done after fix).
2. Deterministic seeded / replay of Science + Lend-out failures with old vs new formatter, then optional Pi repair comparison on a fixed fail state.

---

## Cohort commands

Causal question (narrow):

> When `rtl_multiple` fires, does structured candidate evidence reduce wrong diagnosis, repeated same FAILs, wrong product edits, calls after first FAIL, and weighted repair tail?

Evaluate **activated** runs separately from the overall cohort (same rule as role+name).

```bash
npm run experiment:verify-rtl-multiple-evidence-v1-cohort-pair -- 5
# or separately:
npm run experiment:verify-rtl-multiple-evidence-v1-control -- 5
npm run experiment:verify-rtl-multiple-evidence-v1-treatment -- 5

# after complete:
npm run summarize:verify-rtl-multiple-evidence-v1
```

Default stack (both arms):

```text
HARNESS_OWNED_VERIFY=1
HARNESS_ROOT_ERROR_FIRST_V1=1
TEMPLATE_PERSISTENCE=1
TEMPLATE_TAILWIND=1
TEMPLATE_CSS_VOCABULARY=0
HARNESS_VERIFY_RTL_EVIDENCE_V1=1          # KEEP both arms
HARNESS_ERROR_MEMORY_V1=0
```

| Arm | Flag | Experiment id |
|-----|------|---------------|
| Control | `HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1=0` | `verify-rtl-multiple-evidence-v1-control` |
| Treatment | `HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1=1` | `verify-rtl-multiple-evidence-v1-treatment` |

Pair log: `artifacts/experiments/verify-rtl-multiple-evidence-v1-cohort-pair.log`

### Activation split (required)

```text
activated = ≥1 VERIFY FAIL with Found multiple elements… (text or role)
treatment mechanism success = MATCHES PRESENT with ≥1 "N. <tag>" candidate
                           AND not "(none parsed)"
```

Judge causality primarily on the **activated** subset.

### Stop rule (locked)

Finish this **one** 5+5 natural cohort. Do not start another random cohort for this treatment.

| Treatment activations (`Found multiple elements…`) | Next step |
|----------------------------------------------------|-----------|
| **≥ 2–3** | Forensic activated chains; decide KEEP/REVERT from activated subset (+ report all-run economics) |
| **0–1** | **Stop** random reps. Switch to deterministic seeded/replay of historical multiples (e.g. Science option+badge, Lend out buttons): same failure dump → old vs new formatter; optionally seed identical fail state to compare Pi repair |

**Post-cohort amendment:** activations were ≥3 but mechanism extractions 0 candidates → treat as **parser failure**, not KEEP. Fix + live RTL proof + seeded replay; **no second random 5+5**.

Natural cohort = real-world frequency/economics when activated.  
Deterministic replay = causal proof of mechanism / repair behavior without paying for hope-based reps.

### Primary outcomes (behavioral)

| Metric | Notes |
|--------|-------|
| First diagnosis after first multiple FAIL | option/badge vs N-buttons vs form+row (manual) |
| Same multiple signature streak before green | |
| `WRONG_PRODUCT` uniquify renames | e.g. Lend out → Confirm loan |
| Calls / weighted after first multiple FAIL → green | |

### Verdict rule

- **KEEP** if mechanism holds on activated runs and repair behavior improves without quality loss  
- **REVERT** if activated tails worsen or product quality drops  

## Explicit non-goals

- Bundling `rtl_text` miss evidence (separate treatment later)  
- Deciding test vs product for Pi  
- Inventing row context not present in the dump  
- Error Memory / verify-repair prompts  
