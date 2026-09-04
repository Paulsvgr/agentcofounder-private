# Experiment: hard-stop-after-green v1

**ID:** `hard-stop-after-green-v1`  
**Status:** **PARKED** — mechanism validated, no KEEP evidence yet — see [results](./experiment-hard-stop-after-green-v1-results.md)  
**Flag:** `HARNESS_HARD_STOP_AFTER_GREEN_V1` — default **OFF**  
**Depends on:** default KEEP stack (VERIFY + root-error-first + persistence + Tailwind + RTL evidence + TYPECHECK)  
**Orthogonal to:** TYPECHECK (time-to-green) · MULTIPLE (reporter) · tail-sweep (post-**report** harness checks)

## Locked claim

> Once independent verification is green, additional agent work is mostly waste.

```text
TYPECHECK:     shortens path TO green
hard-stop:     eliminates work AFTER green
```

## Arms (only difference = flag)

```text
Control (flag=0):
VERIFY PASS
↓
Pi continues normally

Treatment (flag=1):
VERIFY PASS
↓
deterministic STOP immediately
  (allow report.partial.json write only; block edit/bash/verify/etc.)
```

No advice beyond a factual `HARD_STOP` line on PASS. No Error Memory. No TYPECHECK changes. Tail-sweep stays **OFF** for this seed (different mechanism).

## Historical waste (257k)

Run `2026-09-04T09-25-09-799Z`: first green @46 (~225k), then **7 calls / ~32k** post-green (build “to be sure”, title/import polish, re-verify, report, summary).

## Hard 257k post-green seed (current)

Seal first-green state from `2026-09-04T09-25-09-799Z` (@46): product green, but unused `fireEvent` import + default `index.html` title still present (the polish Pi historically did after green).

```text
fixtures/hard-stop-257k-postgreen/
```

Neutral idea (does **not** say finish immediately when green).

```bash
npm run experiment:hard-stop-257k-postgreen-repair -- both 1
```

---

## Soft seed (superseded — NOT KEEP evidence)

## Primary measures

| Measure | Definition |
|---------|------------|
| Weighted after first green | Sum weighted from first VERIFY PASS call through end |
| Calls after first green | Call count after first PASS |
| Wall time after first green | Session time after first PASS (if available) |
| Final correctness | Journeys / VERIFY still green; product quality unchanged |

## KEEP rule

KEEP only if treatment **materially cuts post-green weighted + calls** while final correctness / quality is unchanged vs control.

Do **not** claim a universal “X% cheaper harness” from one pair.

## Explicit non-goals

- Mixing with tail-sweep in the same seed  
- Prompt-only stop (Exp2 already tried; this is **mechanical**)  
- More TYPECHECK reps  
- Natural cohort before seeded proof
