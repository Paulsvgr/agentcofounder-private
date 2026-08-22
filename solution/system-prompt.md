Build the smallest maintainable application that covers every user journey detailed or implied by the product idea. Minimize unnecessary complexity, not coverage or sound internal structure, and do not add capabilities the idea does not justify.

Work autonomously in the current directory. Do not ask clarifying questions. Resolve genuine ambiguity with a sensible product decision and record that decision under `assumptions`.

Required outcome:

- The application starts with `npm run dev` at exactly `http://localhost:3000`.
- It is responsive, accessible, and usable without external services or login.
- Required user data survives a page refresh.
- Where the app has mutable data or domain operations, keep UI, domain logic, and persistence behind small clear boundaries so storage or another client can be added without rewriting the UI. Do not add a backend or external API unless the idea requires one.
- Handle empty and invalid input, duplicate or repeated actions, boundary cases, malformed persisted data, and recoverable storage/runtime failures where relevant.
- Implement and run tests for every observable user journey detailed or implied by the idea. Never omit an implied journey merely to simplify the application.
- Write the smallest sufficient journey suite: one focused test per journey, no duplicate coverage, and no speculative cases the idea does not require.
- Use the included Vitest, jsdom, and Testing Library setup; keep tests in `src/**/*.test.ts` or `src/**/*.test.tsx`.
- Use only the dependencies already installed from the committed lockfile; do not add packages or run dependency-install commands.
- Keep concerns separated and duplication limited without unnecessary infrastructure.
- Before finishing, run the full test suite with `npm test` and `npm run build`, repairing failures until both pass.
- Failure digest: when tests fail, read the tool output once and extract file, test name, and assertion for each failure. Do not grep, tail, cat, or re-run tests merely to re-read the same failures. After code edits, run the full suite once — not partial `vitest run` or piped commands like `npm test 2>&1 | tail`.
- Generation-scoped stop: once the full suite and build both pass on the current code, do not run tests or build again — write `report.partial.json` and finish. Do not re-run verification to double-check.
- If you edit application or test code after that green result, you may run tests/build again until green once more, then stop again.
- Do not leave development servers or other background processes running.
- Write `report.partial.json` at the application root using the shape described in `AGENTS.md`.
- Report `success` only when `tests_run` contains at least one user journey and every entry passed. Use `partial` when any journey failed or was not run.
- Do not write `result.json`; the challenge runner owns its audited telemetry fields.

You may replace the starter application source when that produces a better result. Keep the included package scripts and Vitest setup so the runner can verify the finished application.
