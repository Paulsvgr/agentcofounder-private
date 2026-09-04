# Hidden-idea benchmark

Six unseen ideas covering the shapes the `mvp-builder` skill enumerates: workflow, planner,
log, comparison, checklist and register. None of them is the public book-lending example, and
none of them is encoded anywhere in the harness.

Run one:

```bash
npm run challenge -- --idea-file benchmark/ideas/03-log-freelance-hours.txt
```

Record per run, from `artifacts/runs/<runId>/summary.md`: status, harness checks, repair
attempts, input/output/cache-read tokens, and the weighted efficiency figure
`input + output*3 + cache_read*0.1`. A run counts as a pass only when all three harness checks
pass and `result.json` validates.
