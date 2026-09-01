# Exp2 — Generation-scoped stop rule

**Phase F verdict:** KEEP  
**Type:** prompt / agent behavior (domain-neutral)

## Problem

After tests and build pass, the model often re-runs `npm test` or `npm run build` “to be sure.” Each extra verification call adds tokens and can re-open repair paths.

## Change

Tell the agent: run `npm test` and `npm run build` until both pass, write `report.partial.json`, and finish. Do not re-run to double-check on unchanged code; after a code edit, verify once and stop again.

**Files:**

| File | What was added |
|------|----------------|
| `solution/system-prompt.md` | One bullet: verify → report → stop (no duplicate lines) |
| `solution/skills/mvp-builder/SKILL.md` | Step 8: verify → report → stop (merged); step 9: JSON shape only |
| `app-template/AGENTS.md` | One line mirroring stop-after-green for the generated app |

## What this does **not** do

- Does not change when the harness considers a run successful (still uses real test results).
- Does not skip required journeys or build checks on first pass.

## How to revert

Remove the generation-scoped stop bullets from the three files above.
