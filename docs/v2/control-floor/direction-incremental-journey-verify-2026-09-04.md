# Direction: one journey at a time (incremental VERIFY) — 2026-09-04

**Status:** PROBE CLOSED — **KILL prompt-only** (see [probe-incremental-journey-v1-results.md](./probe-incremental-journey-v1-results.md))

**Procedure tried:**

> Write one journey `it`, run VERIFY, fix until green, then write the next journey.

**Result:** `2026-09-04T19-23-16-058Z` — 6 `it`s in one write before first VERIFY; PASS @8; ~31.5k. Mechanism **did not engage**; cheap cost is luck.

---

## Proposal (user)

> Author **one small journey/test at a time**, VERIFY, then add the next — instead of writing the whole suite before first VERIFY.

---

## What this is *not* (already REVERT)

| Prior | Mechanism | Outcome |
|-------|-----------|---------|
| `pre-green-single-test-v1` | Latch **one test file**; block second path until PASS | **REVERT** — wrong first file (`books.test`) → thrash, 106k→227k |
| Q2-E owned test structure | Skeleton + Δ≤1 `it` per step | Call-tax explosion |
| Q2-C authoring guard | Pre-VERIFY pattern blocks | Inflated cost |
| Q2-D early VERIFY | Timing nudge alone | REVERT |

So: **do not** revive “only one `*.test.*` file.”  
This direction must be about **one `it` / one journey → VERIFY → next `it`**, or it collides with a known fail.

---

## Ship baseline (why the claim is open)

On `ship-keep-full-green-v1` (n=11 with replay):

| | median `it()` count @ first VERIFY |
|--|----------------------------------:|
| all | **11** |
| ≤60k | **14** |
| >100k | **14** |

Almost always **one** test file. Cheap runs are **not** “tiny suite before first VERIFY.”  
So the bet is **not** “fewer tests ⇒ cheaper.” The bet is:

> **Earlier feedback on a small oracle** reduces multi-fail / IGNORED_FACTS / widen tails even if total tests end similar.

Falsifiable. If treatment still writes 10 `it`s before first VERIFY, mechanism failed. If it VERIFYs after 1–2 `it`s but cost rises, economics failed.

---

## Sharpened treatment (candidate)

```text
CONTROL: ship KEEP stack (current)

TREATMENT: same stack + incremental journey gate
  After first product test file exists:
    each successful addition of a new top-level it()/test()
    must be followed by VERIFY before adding another it()
  OR softer: harness rejects a write/edit that increases it-count by >1
             since last VERIFY
```

**Prefer soft Δ≤1-since-last-VERIFY** over “must call VERIFY” coaching — still a gate (risky), but closer to Q2-E’s mechanism which burned us.  

**Safer one-run probe first (no gate):**

```text
Seeded or natural single run with AGENTS one-liner ONLY:
  “Add one journey it(), call verify, only then add another.”
Measure: it-count @ first VERIFY, vf, weighted.
```

If soft prompt does nothing → don’t build a hard gate.  
If it lowers `it@first VERIFY` and cost → then consider gate.

Steering risk is real (COPY/MULTIPLE freeze said avoid coaching). This is **procedural authoring**, not “use the BUTTONS list” — still steering-adjacent; keep **one-run** until economics clear.

---

## Primary metrics (if probed)

1. `it_count_at_first_verify` (must drop vs ship median ~11)  
2. `verify_fail_before_green`  
3. weighted cost / calls  
4. Failure-class mix (did IGNORED_FACTS Dune-style tails shrink?)  
5. Thrash: repeated blocked edits / rewrite loops (auto-REVERT if present)

**A does not apply here** — this is authoring, not post-FAIL repair labels.

---

## GO / NO-GO

| | |
|--|--|
| **GO small** | One natural or seeded run with **prompt-only** incremental instruction; compare to ship median |
| **NO-GO** | File-latch revival; multi-rep cohort before one-run signal; combining with new VERIFY evidence |
| **REVERT echoes** | Cost up + thrash, or `it@first VERIFY` unchanged |

---

## One-line

> **Different line: incremental journey→VERIFY — not file latch (REVERT’d); ship data says suite size@first VERIFY ≠ cost, so probe feedback timing in one run before any gate.**
