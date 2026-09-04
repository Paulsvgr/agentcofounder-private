Build the smallest maintainable application that covers every user journey detailed or implied by the product idea. Minimize unnecessary complexity, not coverage or sound internal structure, and do not add capabilities the idea does not justify.

Work autonomously in the current directory. Do not ask clarifying questions. Resolve genuine ambiguity with a sensible product decision and record that decision under `assumptions`.

Required outcome:

- The application starts with `npm run dev` at exactly `http://localhost:3000`.
- It is responsive, accessible, and usable without external services or login.
- Required user data survives a page refresh.
- For mutable data, split the app into small modules so a future database or service can replace storage without rewriting the UI:
  - `src/domain/` — types and pure domain operations (add/edit/delete/filter/derive)
  - `src/storage/` — persistence only (e.g. `*Repository.ts` with load/save); never call `localStorage` from React components
  - `src/components/` — focused UI pieces
  - `src/App.tsx` — composition/wiring only (keep it thin)
- Usability: labeled controls, empty states, clear primary actions, and **visible** validation / error text (not only disabled buttons). Mark invalid fields with `aria-invalid="true"` and announce errors with `role="alert"` or `aria-live="polite"`. Use vocabulary classes from `AGENTS.md` (field help may use `ui-empty` under `ui-field`). Keep list order stable while the user edits a row; call out derived states (e.g. low stock) with badges/highlights rather than jumping rows on every +/-.
- Robustness when the idea has forms or durable data: reject empty/invalid required fields with on-screen messages; confirm destructive deletes; recover from malformed stored JSON **or** surface persistence failures (one path is enough to demonstrate); do not silent-`catch` saves.
- Persistence: use a versioned storage key; parse defensively; never swallow save failures without UI feedback.
- **Test budget: ≤10 high-information UI journeys.** Combine multiple rubric points per test when possible. Prefer Testing Library UI tests over domain/repository unit suites. Include validation and one persistence-robustness case when forms/storage apply.
- **Output governance:** no long explanations; do not dump files/logs; prefer write/edit; run `npm test` and `npm run build` once; final message ≤80 tokens; stop immediately after green.
- Use the included Vitest, jsdom, and Testing Library setup; keep tests in `src/**/*.test.ts` or `src/**/*.test.tsx`.
- Use only the dependencies already installed from the committed lockfile; do not add packages or run dependency-install commands.
- Keep concerns separated and duplication limited without unnecessary infrastructure.
- Before finishing, write a **complete** `report.partial.json` with every required field (`status`, `app_url`, `start_command`, `summary`, `implemented_features`, `assumptions`, `tests_run`) per `AGENTS.md` — never `tests_run` alone. Use `status: "success"` when journeys pass. Then finish. Do not re-run on unchanged code.
- Do not leave development servers or other background processes running.
- Report `success` or `partial` per the rules in `AGENTS.md`.
- Do not write `result.json`; the challenge runner owns its audited telemetry fields.

You may replace the starter application source when that produces a better result. Keep the included package scripts and Vitest setup so the runner can verify the finished application.
