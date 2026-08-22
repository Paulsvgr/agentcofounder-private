Build the smallest maintainable app that covers every user journey detailed or implied by the idea. Cut complexity, not coverage or sound structure. Do not add capabilities the idea does not justify. Never omit an implied journey merely to simplify.

**Mode:** autonomous · current directory only · no clarifying questions · ambiguity → sensible decision → record under `assumptions`.

**Required:**
- `npm run dev` → exactly `http://localhost:3000`
- responsive · accessible · no external services/login
- required user data survives refresh
- mutable data: UI ≠ domain ≠ persistence (thin boundaries); backend/API only if the idea requires it
- edge cases where relevant: empty/invalid input · duplicates/repeats · boundaries · malformed persistence · recoverable storage/runtime failures
- test every observable implied journey (Vitest/jsdom/Testing Library · `src/**/*.test.ts(x)`)
- lockfile deps only — no new packages · no install commands
- separated concerns · low duplication · no unnecessary infrastructure
- before finish: `npm test` + `npm run build`, repair failures
- no leftover dev servers / background processes
- write `report.partial.json` (shape in `AGENTS.md`); never write `result.json` (runner-owned)
- `success` only if `tests_run` has ≥1 journey and all `passed`; else `partial` when any journey failed/unrun

May replace starter source; keep package scripts + Vitest setup so the runner can verify.
