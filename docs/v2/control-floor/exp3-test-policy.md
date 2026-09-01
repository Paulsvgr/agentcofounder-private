# Exp3 — Compact test policy

**Phase F verdict:** KEEP  
**Type:** prompt / test authoring guidance (domain-neutral)

## Problem

Large or redundant test suites and brittle selectors (`getByText` matching multiple nodes) cause false failures and long repair trajectories.

## Change

Instruct the agent to:

1. Write the **smallest sufficient journey suite** — one focused test per required journey, no duplicate or speculative cases.
2. Prefer **`getByRole`**, **`getByLabelText`**, and scoped queries over broad text/regex matchers.

**Files:**

| File | What was added |
|------|----------------|
| `solution/system-prompt.md` | One bullet: journey coverage + smallest suite (merged) |
| `solution/skills/mvp-builder/SKILL.md` | Step 7: journey suite size + query guidance |

## What this does **not** do

- Does not ship pre-written tests in the template (seed still has zero product tests).
- Does not mandate a specific app architecture or storage pattern.

## How to revert

Restore the older test bullets in `solution/system-prompt.md` and step 7 in `solution/skills/mvp-builder/SKILL.md`.
