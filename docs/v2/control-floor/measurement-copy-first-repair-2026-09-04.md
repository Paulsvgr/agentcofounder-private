# Measurement: COPY_NAME_MISS first-repair on ship-keep (2026-09-04)

**Status:** MEASUREMENT ONLY — no new rule  
**Prior:** [next-slice-copy-after-multiple-2026-09-04.md](./next-slice-copy-after-multiple-2026-09-04.md) · MULTIPLE A/B/C [parked](./measurement-multiple-first-repair-2026-09-04.md)

---

## Question

> When first (or first post-handoff) fail is `COPY_NAME_MISS` with **COMPLETE** RTL inventory, and the next VERIFY is still red — why?

Same discipline as MULTIPLE:

| Label | Counts as failed COPY repair? |
|-------|-------------------------------|
| `FIXED_COPY_NEXT_OTHER` (A) | **No** |
| `BOTCHED` (B) | Yes — execution |
| `WIDEN_ESCAPE` (C) | Yes — locus |
| `IGNORED_FACTS` (D) | Yes — inventory present, repair does not use it |

Choose later work by **∑ cost fail→green**, not headcount.

---

## Corpus

`ship-keep-full-green-v1` natural runs **n = 12**.

| First COPY fail evidence | n |
|--------------------------|--:|
| COMPLETE (BUTTONS / VISIBLE TEXT / QUERIED present) | **7** |
| NA (not an Unable-to-find primary / assertion-shaped) | 1 |
| No COPY fail in run | 4 |

Next after first COPY:

| Next | n |
|------|--:|
| COPY again | 5 |
| PASS (fixed in one repair) | 2 |
| MULTIPLE | 1 |

**One-repair COPY success (not in next-red bucket):** `16-40-36`, `19-04-38` (expected `1 lent out`, facts showed `2 lent out` → localStorage isolation fix → PASS).

---

## Bucket: COMPLETE ∩ COPY ∩ next VERIFY red

**n = 5** complete ship hits (+1 aborted soft).

| Run | Queried vs facts | Repair | Next | Label | fail→green $ |
|-----|------------------|--------|------|-------|-------------:|
| `14-37-34` | `2 books total` vs VISIBLE `"books total"` (split) | **Product** rewrite to force contiguous count string | still COPY | **D IGNORED_FACTS** | ~42k |
| `14-40-05` | `role=list` name `Book list`; LISTS `""` | Changed section aria **away** to `"Books"`; test still wants `Book list` | same COPY | **B BOTCHED** (+ ignored empty list name) | ~39k |
| `14-48-25` | `Lend out` vs BUTTONS `Mark returned` / Edit / Remove | Import `.js` + filter regex — **not** the button inventory | same `Lend out` | **D IGNORED_FACTS** | **~99k** |
| `16-43-18` | `/0 of 0 books/` vs `"…currently lent out"` | Test → testid + real copy phrasing | different COPY (`Home`) | **A FIXED→OTHER** | ~75k |
| `16-52-11` | invented empty sentence; VISIBLE has no empty copy | **Full rewrite** `App.test.tsx`, still asserts `/Your library is empty/` | same empty COPY | **C WIDEN_ESCAPE** | **~99k** |
| `19-08-49`‡ | no `heading`; soft | product store churn | MULTIPLE | *(aborted)* | — |

```text
D IGNORED_FACTS           2   (∑ ≈ 141k)
A FIXED_COPY_NEXT_OTHER   1   (∑ ≈ 75k)  ← not a COPY-repair fail
C WIDEN_ESCAPE            1   (∑ ≈ 99k)
B BOTCHED                 1   (∑ ≈ 39k)
```

**COPY-repair failure denominator = B+C+D only** (exclude A).

---

## Headline

1. **Evidence is usually enough** (7/8 first COPY fails COMPLETE) — same story as MULTIPLE. Do **not** expand VERIFY text dumps.
2. **Dominant wasted $ is `IGNORED_FACTS`** — especially `14-48-25` (~99k) where BUTTONS already listed `Mark returned` and Pi never aligned the lend step.
3. **A still happens** (`16-43-18`): good COPY fix, then another COPY — queue depth, not “COPY repair broken.”
4. **PRE_TEST / source facts stay DROP** — these fails already have rendered inventory at FAIL time; the miss is **repair use of facts**, not missing pre-test strings.

---

## What this authorizes (later — not now)

If building anything after more hits, attack **D** (and maybe C), e.g. mechanisms that keep the failing query + PRESENT inventory in the repair turn — **not** more coaching essays, not PRE_TEST.

**No rule tonight.** Optional: grow D-heavy hits with single-run ship probes only.

---

## Freeze (2026-09-04 evening)

```text
COPY_NAME_MISS
Evidence complete:     7/8
Largest waste:         IGNORED_FACTS (~141k ∑)
Reporter gap:          basically none
Decision:              stop adding facts; PARK this slice
```

**Killed by this result:** more VERIFY text, more inventory, PRE_TEST, copy AST/source dumps.

**Not authorized:** a broad “use the evidence” coaching rule (steering history is bad).  
**Only reopen** for a *very small* one-run probe aimed specifically at `IGNORED_FACTS` — not a cohort, not a new reporter.

---

## Unified ceiling (MULTIPLE + COPY)

Both slices say the same thing:

> Remaining cost is less “bad reporter” and more **Pi sometimes ignores or misuses correct evidence**.

That is likely the **current ceiling** of this harness + model combo for VERIFY-repair loops.

**Ship stance:** keep KEEP stack; observe; no new evidence/repair experiment without a falsifiable one-run IGNORED_FACTS idea.

---

## One-line

> **PARK COPY: facts are complete, waste is IGNORED_FACTS — stop adding facts; same ceiling as MULTIPLE (evidence-use, not inventory).**
