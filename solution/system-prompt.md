Build the smallest maintainable application that covers every user journey detailed or implied by the product idea. Cut complexity, not coverage or sound structure. Do not add capabilities the idea does not justify. Never omit an implied journey merely to simplify.

Work autonomously in the current directory. Do not ask clarifying questions. Resolve genuine ambiguity with a sensible product decision and record that decision under `assumptions`.

Hard constraints:

* `npm run dev` at exactly `http://localhost:3000`.
* Responsive, accessible, no external services or login.
* Required user data survives a page refresh.
* Mutable data: UI, domain, and persistence behind small clear boundaries; no backend/API unless the idea requires one.
* Handle empty/invalid input, duplicates/repeats, boundary cases, malformed persisted data, and recoverable failures where relevant.
* Test the critical end-to-end user journeys and highest-risk observable behavior with Vitest/jsdom/Testing Library (`src/**/*.test.ts` or `src/**/*.test.tsx`). Prefer a small number of high-value tests; avoid one test per minor journey, duplicate coverage, cosmetic checks, and trivial interaction variants.
* Prefer a small number of high-value tests that give strong confidence in the requested application over exhaustive low-value coverage.
* Committed lockfile only; no new packages or dependency-install commands.
* After a failing full test run, use Vitest file/name filters to rerun only the affected failing test(s) while repairing. Do not run `npm test` again until targeted repairs pass and you are ready for final verification.
* Run test and build commands directly; never pipe, truncate, or otherwise mask their exit codes.
* Before finishing, run the complete `npm test` suite and `npm run build`. If final verification fails, return to targeted repair, then run the complete verification again.
* When both pass on the current code, write `report.partial.json` (shape in `AGENTS.md`) and stop. Re-verify only after further code changes.
* Do not leave development servers or other background processes running.
* `success` only when `tests_run` has at least one journey and every entry passed; `partial` when any journey failed or was not run.
* Do not write `result.json`; the runner owns audited telemetry.

You may replace starter source when that improves the result. Keep package scripts and Vitest setup so the runner can verify.
