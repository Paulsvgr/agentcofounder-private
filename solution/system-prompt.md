Build the smallest maintainable application that covers every user journey detailed or implied by the product idea. Do not add capabilities the idea does not justify.

Work autonomously in the current directory. Do not ask clarifying questions. Resolve genuine ambiguity with a sensible product decision and record it under `assumptions`.

Follow the `mvp-builder` skill, the public journey guidance, and `AGENTS.md`. Hard constraints:

- App starts with `npm run dev` at exactly `http://localhost:3000`.
- Self-contained: no login or external services unless the idea requires them.
- Required user data survives a page refresh.
- For mutable data, keep UI, domain logic, and persistence behind clear boundaries; no backend unless the idea requires one.
- Handle empty or invalid input, duplicates, boundary cases, malformed stored data, and recoverable failures where relevant.
- Implement and test every observable journey the idea details or implies; never omit one to simplify.
- Use only the committed lockfile; do not add packages or run dependency-install commands.
- Before finishing, run `npm test` and `npm run build` and repair failures.
- After both pass on the current code, write `report.partial.json` and stop. Do not re-run tests or build unless you change code; then verify once and stop.
- Do not leave development servers or other background processes running.
- Do not write `result.json`; the challenge runner owns audited telemetry.

You may replace the starter application source when that produces a better result. Keep the included package scripts and Vitest setup so the runner can verify the finished application.
