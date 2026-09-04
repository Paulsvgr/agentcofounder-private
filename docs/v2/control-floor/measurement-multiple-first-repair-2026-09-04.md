# Measurement: MULTIPLE first-repair despite KEEP reporter (2026-09-04)

**Status:** MEASUREMENT ONLY — no new rule / experiment  
**Prior:** [measurement-first-fail-copy-miss-gate-2026-09-04.md](./measurement-first-fail-copy-miss-gate-2026-09-04.md) — PRE_TEST **DROP**

---

## Hygiene: `NO_MATCHES_BLOCK` is not a ship reporter gap

Among 16 MULTIPLE first fails on persist+tw, **9** lacked a `MATCHES PRESENT` block. All 9 are **correctly excluded** from this bucket:

| Experiment | n | Why no MATCHES |
|------------|--:|----------------|
| `tailwind-ab-persist-v1-c` | 4 | Before MULTIPLE evidence existed |
| `verify-rtl-evidence-v1-control` | 3 | RTL text/role evidence only; not multiple arm |
| `verify-rtl-multiple-evidence-v1-control` | 2 | Explicit `HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1=0` |

`NONE_PARSED` (2) = pre-fix parser defect (already KEEP-fixed).  

**Ship-keep with MULTIPLE=1:** first MULTIPLE fails show **COMPLETE** inventory (4/4 evening+morning cases that were MULTIPLE). Bucket definition stays: COMPLETE only.

---

## Per-hit extraction (frozen)

For each bucket hit, record **only**:

| Field | Definition |
|-------|------------|
| `label` | `FIXED_MULTIPLE_NEXT_OTHER` (A) \| `BOTCHED` (B) \| `WIDEN_ESCAPE` (C) |
| `cost_fail_to_green` | Weighted cost from first MULTIPLE FAIL call through first canonical green (or run end if never green) |
| `extra_verify_cycles` | VERIFY calls after that first MULTIPLE FAIL until green (or run end) |

**Counting rule:** if MULTIPLE is fixed and the next VERIFY is red for a **different** class → label **A** only. That is **not** a MULTIPLE repair failure. Do not fold A into B/C pass-rate denominators.

When choosing a later mechanism, prefer **sum of `cost_fail_to_green` by label**, not headcount alone (B may be frequent but cheap).

---

## Collection protocol (in progress)

1. Run ship stack as-is (`npm run experiment:ship-keep-full-green -- N`) — **no new flags**.
2. For each new run: if first FAIL is MULTIPLE **and** MATCHES COMPLETE **and** next VERIFY red → add to bucket and label A/B/C.
3. Also record **post-fail weighted cost** (cost after first FAIL) so target is chosen by **attributable $**, not headcount alone.
4. Revisit when bucket **n ≥ 10**, or one label ≥7.

**Cohort:** 5-rep batch **aborted** mid-flight (2026-09-04 ~19:11Z). Do **not** run multi-rep collection for this slice — single-run probes only when testing a mechanism. Bucket still grows opportunistically from any ship run that lands in COMPLETE∩next-red.

---

## Locked question

> When MULTIPLE evidence is **complete** and the next VERIFY is still red, **why** — not “what is the raw first-repair pass rate?”

**Do not** treat overall “MULTIPLE first-repair pass ≈ 62%” as the decision metric. That mixes three different stories.

---

## Bucket (grow this only)

```text
COMPLETE MATCHES inventory on first FAIL
∩ primary fail is MULTIPLE (“Found multiple elements…”)
∩ next VERIFY still red
```

Corpus so far (persist+Tailwind / ship-keep): **n = 5**.

---

## Closed labels (exactly three)

| Label | Meaning | Counts as “MULTIPLE repair failed”? |
|-------|---------|-------------------------------------|
| `FIXED_MULTIPLE_NEXT_OTHER` | Local MULTIPLE query fixed; next red is a **different** failure class | **No** |
| `BOTCHED` | Right repair idea (scope / `within` / `getAllBy`); **implementation broken** | **Yes** — execution |
| `WIDEN_ESCAPE` | Abandoned local test disambiguation; unrelated product/test rewrite | **Yes** — decision/locus |

---

## Current classifications (n=5)

| Run | MATCHES | Repair | Next red | Label | fail→green $ | extra VERIFY |
|-----|---------|--------|----------|-------|-------------:|-------------:|
| `14-42-27` | `Cookbook` option vs span | `within(row)…` | duplicate `row` transform | **B BOTCHED** | *(cheap cycle)* | 1+ |
| `16-52-11` | `Title` two inputs | `within(card).getByLabelText` | invented empty copy | **A FIXED→OTHER** | high | 1+ |
| `16-47-42` | `Reference` option vs span | product+test rewrite | new bad matcher | **C WIDEN** | high | many |
| `19-04-38`† | function `getByText` vs page nodes | `getByText(title)` exact — **on-target** | `1 lent out` COPY miss | **A FIXED→OTHER** | **~69k** | **2** |
| `19-08-49`‡ | text `"1"` on two `<p>` counts | tried `getAllByRole("heading")` still kept `getByText("1")` | no `heading` role | **B BOTCHED** | ~69k to abort (never green) | 2+ (aborted) |

† First VERIFY fail of run was `vi is not defined` (OTHER); first **COMPLETE MULTIPLE** at call 14 — included as MULTIPLE-repair slice.  
‡ Aborted cohort mid-run; no green / no app snapshot.

```text
A FIXED_MULTIPLE_NEXT_OTHER  2
B BOTCHED                    2
C WIDEN_ESCAPE               1
```

**MULTIPLE-repair failure denominator (B+C only):** 3/5 of next-red bucket; **A is excluded** from “failed MULTIPLE repair.”

Still **no dominant label**. Attributable $ so far: A and B both can be expensive (~69k post-fail on tonight’s hits); C remains the known expensive widen pattern. **No mechanism yet.**

---

## Aborted 5-rep batch — extract (2026-09-04 ~19:04Z)

| Run | Outcome | Bucket? |
|-----|---------|---------|
| `2026-09-04T19-04-38-165Z` | success, **140k**, green@21, vf=3 | **Yes — A** (~69k fail→green, 2 extra VERIFY) |
| `2026-09-04T19-08-49-761Z` | **aborted** mid-run (~89k usage, never green) | **Yes — B** (incomplete) |

No further reps. Measurement only.

---

## Interpretation rules (frozen)

1. Facts-missing is **out of scope** for this bucket (COMPLETE by construction).
2. `FIXED_MULTIPLE_NEXT_OTHER` ⇒ MULTIPLE path basically worked; chase the **other** fail class separately (do not “improve MULTIPLE repair”).
3. Only `BOTCHED` + `WIDEN_ESCAPE` justify MULTIPLE-adjacent repair interventions later.
4. **No new rule** until this bucket is large enough to show a clear majority (guideline: revisit at **n ≥ 10** COMPLETE∩next-red, or sooner if one label hits ≥7).

---

## Context (not the metric)

All MULTIPLE first fails on persist+tw (including incomplete evidence): 10/16 next PASS. Useful background only — **not** the slice we grow.

---

## One-line

> **Bucket n=5 (A:2 B:2 C:1) PARKED — same ceiling as COPY: evidence-use, not missing MATCHES. See [measurement-copy-first-repair-2026-09-04.md](./measurement-copy-first-repair-2026-09-04.md).**
