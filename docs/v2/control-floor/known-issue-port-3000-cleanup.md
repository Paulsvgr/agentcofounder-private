# Known issue: challenge cleanup kills `:3000`

**Status:** Open (harness / local-dev environment)  
**Date noted:** 2026-09-04  
**Not related to:** TYPECHECK, MULTIPLE, RTL text-miss, hard-stop, or Control App KEEP / health decisions

## Issue

Challenge / seeded-experiment cleanup currently terminates the existing process on **port 3000** (via `fuser` / `lsof` kill in experiment scripts and run teardown that starts Vite on `:3000` for the generated app).

Typical symptom: an already-running `output/app` Vite exits with **137** (SIGKILL) after a challenge — runner cleanup, not an app crash.

So after a challenge run, any local V2 UI / `output/app` Vite already bound to `:3000` dies and must be restarted.

## Interpretation

This is a **repeatable cleanup side effect of the run harness**, not evidence about any intervention (hard-stop, TYPECHECK, `rtl_text`, Control App, etc.).

It should **not** affect KEEP / NOT KEEP decisions and should **not** be logged as a Control App or treatment failure.

## Workaround

```bash
cd output/app && npm run dev
# → http://localhost:3000/
```

Control UI on `:5174` / API on `:4319` are usually unaffected.

## Possible later fix (out of scope for current levers)

- Prefer reclaiming only ports owned by the current challenge process tree, or
- Use an ephemeral port for post-run app probes when a listener already exists on 3000.
