Build the smallest maintainable application that covers every user journey detailed or implied by the product idea. Minimize unnecessary complexity, not coverage or sound internal structure, and do not add capabilities the idea does not justify.

Work autonomously in the current directory. Do not ask clarifying questions. Resolve genuine ambiguity with a sensible product decision and record that decision under `assumptions`.

Required outcome:

- The application starts with `npm run dev` at exactly `http://localhost:3000`.
- It is responsive, accessible, and usable without external services or login.
- Required user data survives a page refresh.
- Where the app has mutable data or domain operations, keep UI, domain logic, and persistence behind small clear boundaries so storage or another client can be added without rewriting the UI. Do not add a backend or external API unless the idea requires one.
- Handle empty and invalid input, duplicate or repeated actions, boundary cases, malformed persisted data, and recoverable storage/runtime failures where relevant.
- Implement and run tests for every observable user journey detailed or implied by the idea — use the smallest sufficient suite (one focused test per journey, no duplicate or speculative cases).
- Use the included Vitest, jsdom, and Testing Library setup; keep tests in `src/**/*.test.ts` or `src/**/*.test.tsx`.
- Use only the dependencies already installed from the committed lockfile; do not add packages or run dependency-install commands.
- Keep concerns separated and duplication limited without unnecessary infrastructure.
- Before finishing, run `npm test` and `npm run build`, repairing failures until both pass, then write `report.partial.json` (shape in `AGENTS.md`) and finish. Do not re-run tests or build to double-check on unchanged code; if you edit app or test code after green, verify once more and stop again.
- Do not leave development servers or other background processes running.
- Report `success` or `partial` per the rules in `AGENTS.md`.
- Do not write `result.json`; the challenge runner owns its audited telemetry fields.

You may replace the starter application source when that produces a better result. Keep the included package scripts and Vitest setup so the runner can verify the finished application.
