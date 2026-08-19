Build the smallest maintainable application that covers every user journey detailed or implied by the product idea. Minimize unnecessary complexity, not coverage or sound internal structure, and do not add capabilities the idea does not justify.

Work autonomously in the current directory. Do not ask clarifying questions. Resolve genuine ambiguity with a sensible product decision and record that decision under `assumptions`.

## Budget

You have a hard {{TIMEOUT_MINUTES}}-minute wall-clock limit and are terminated at the limit without warning. Work that was never written to disk scores nothing.

- Do not plan the whole application before writing files. Decide one file, write it, move on.
- Never draft code, tests, or file contents in prose or reasoning before writing them. Emit them directly into the write tool. Restating a file before writing it doubles its cost.
- Write each file completely on the first attempt. Re-reading or rewriting a file you just wrote is pure waste.
- Batch shell work: one `bash` call joined with `&&` beats four separate calls. Prefer `./node_modules/.bin/vitest run <file> -t "<name>"` for targeted repair instead of rerunning the full suite repeatedly.
- Read the seed once. Do not re-read it.
- Never run `npm run dev`, `npm run preview`, `vite`, `vite preview`, `nohup`, or any persistent background server. The challenge runner verifies startup on port 3000 after Pi exits.
- When `npm test` and `npm run build` both pass, update `report.partial.json` and stop immediately. Do not start servers, inspect processes, or add features.

## Order Of Work

Follow this order, and keep the application working at every step.

1. Identify the entity, its fields, and the list of journeys. A few lines, not a document.
2. Write the domain module (pure logic, no UI, no storage), then the persistence module.
3. Write the UI for the primary journey (create and list) plus one test that proves it.
4. Run `npm test`. Fix failures before adding anything else.
5. Write `report.partial.json` describing what exists so far, then keep it current as you go.
6. Add the remaining journeys with their tests, running `npm test` after each journey rather than once at the end.
7. Run `npm test` and `npm run build`, repairing failures.
8. Rewrite `report.partial.json` with the final state.

If time runs short, stop adding features, get the tests green, and update `report.partial.json`. A smaller app with passing tests and an honest report beats a larger one that never ran.

Required outcome:

- The application starts with `npm run dev` at exactly `http://localhost:3000`.
- It is responsive, accessible, and usable without external services or login.
- Required user data survives a page refresh.
- Where the app has mutable data or domain operations, keep UI, domain logic, and persistence behind small clear boundaries so storage or another client can be added without rewriting the UI. Do not add a backend or external API unless the idea requires one.
- Handle empty and invalid input, duplicate or repeated actions, boundary cases, malformed persisted data, and recoverable storage/runtime failures where relevant.
- Implement and run tests for every observable user journey detailed or implied by the idea. Never omit an implied journey merely to simplify the application.
- Use the included Vitest, jsdom, and Testing Library setup; keep tests in `src/**/*.test.ts` or `src/**/*.test.tsx`.
- `npm run build` runs `tsc --noEmit` across tests as well as source, so type test fixtures explicitly. A loosely typed array literal in a test can fail the build even when the test passes.
- Use only the dependencies already installed from the committed lockfile; do not add packages or run dependency-install commands.
- Keep concerns separated and duplication limited without unnecessary infrastructure.
- Before finishing, run `npm test` and `npm run build`, repairing failures.
- Do not start development servers or other background processes. The runner owns startup verification.
- Write `report.partial.json` at the application root using the shape described in `AGENTS.md`.
- Report `success` only when `tests_run` contains at least one user journey and every entry passed. Use `partial` when any journey failed or was not run.
- Do not write `result.json`; the challenge runner owns its audited telemetry fields.

You may replace the starter application source when that produces a better result. Keep the included package scripts and Vitest setup so the runner can verify the finished application.
