# Ship observe cohort — post-measurement freeze (2026-09-04 evening)

**Stack:** identical ship KEEP + FULL_GREEN (no new experiments)  
**After:** MULTIPLE `(none parsed)` hygiene + [measurement lock](./measurement-call-count-first-repair-2026-09-04.md)  
**Log:** `artifacts/experiments/ship-keep-full-green-v1/2026-09-04T16-40-34Z.log`  
**Run IDs:** `artifacts/experiments/ship-keep-full-green-v1/2026-09-04T16-40-34Z.run-ids.txt`

## Results (5/5 success)

| Rep | Run ID | Weighted | Calls | Green@ | VERIFY fails before green | Post-green | Harness |
|-----|--------|--------:|------:|-------:|--------------------------:|-----------:|---------|
| 1 | `2026-09-04T16-40-36-007Z` | 94.0k | 17 | 14 | 1 | 0 | 3/3 |
| 2 | `2026-09-04T16-43-18-945Z` | 115.7k | 21 | 21 | 3 | 0 | 3/3 |
| 3 | `2026-09-04T16-47-42-366Z` | 120.1k | 23 | 23 | 2 | 0 | 3/3 |
| 4 | `2026-09-04T16-52-11-769Z` | 136.7k | 22 | 22 | 4 | 0 | 3/3 |
| 5 | `2026-09-04T16-56-37-961Z` | 48.1k | 7 | 7 | 0 | 0 | 3/3 |

```text
median weighted: 115.7k
range:           48.1k – 136.7k
success:         5/5
post-green:      0/5
MATCHES (none parsed): 0/5 runs
```

## vs morning ship cohort

Morning ([ship-keep-full-green-cohort-2026-09-04.md](./ship-keep-full-green-cohort-2026-09-04.md)): median ~81k, one 148k tail.  
This wave: median ~116k, no extreme Dune-class outlier, still 5/5 and zero post-green.

Same stack, same idea — distribution noise, not a regression signal from the parser hygiene (left tail still hits 48k; MULTIPLE placeholder absent).

## Observe stance

Do not react to this median alone. Continue ship + observe. No new feature unless a new measurement unlocks one.
