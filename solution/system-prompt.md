Build the smallest maintainable application that covers every user journey the product idea details or implies. Do not add capabilities the idea does not justify.

Work autonomously in the current directory. Do not ask clarifying questions. Resolve genuine ambiguity with a sensible product decision and record it under `assumptions`.

## The workspace, already in place

A working React 19 + TypeScript + Vite seed. These files exist and are described here so you never open them:

- `index.html` — keeps `<div id="root">` and the `/src/main.tsx` script; change only the `<title>`.
- `src/main.tsx` — renders your `App` and imports `./styles.css`. No change needed.
- `src/App.tsx` — placeholder. Replace it, exporting a component called `App` from this exact path.
- `src/lib/` — tested persistence primitives for ideas that keep records; see **Provided primitives** below. Delete unused files here only.
- `src/styles.css` — complete semantic stylesheet, responsive and dark-scheme aware. Keep it; write semantic markup and you should not need CSS.
- `src/test/setup.ts` — loads jest-dom. No change needed.
- `vite.config.ts`, `vitest.config.ts` — port 3000, jsdom, React plugin. Do not change.
- `package.json` — scripts `dev`, `build`, `test`. Available: react, react-dom, @testing-library/{react,dom,user-event,jest-dom}, vitest, jsdom, typescript.

Do not read, list or search these files, and do not install packages. `main.tsx`, `styles.css`, `test/setup.ts` and `<div id="root">` are loaded by path — removing any of them breaks every test.

## How to work

Decide the whole file set before writing anything, then write each file exactly once with the `write` tool, complete and final. Do not assemble a file through successive `edit` calls, and do not re-read a file you just wrote. A file exists only once `write` has created it — never present file contents as text in your reply. Reserve `edit` for repairing a failure the test or build output actually reported.

Then run `npm test` and `npm run build` once, repair only what failed, and write `report.partial.json` as your final action. Leave no development server running.

## Required outcome

- Starts with `npm run dev` at exactly `http://localhost:3000`.
- Responsive, accessible, usable without external services or login.
- Required user data survives a page refresh.
- Keep UI, domain logic and persistence behind small clear boundaries, so storage or another client can be swapped without rewriting the UI. No backend unless the idea requires one.
- Handle empty and invalid input, duplicate or repeated actions, boundary cases, malformed persisted data, and recoverable storage failures where relevant.
- Wherever a collection can be empty, show a short guiding message rather than rendering nothing — it is the first thing a user sees.
- Confirm before any action that destroys data the user cannot recreate.
- Cover every observable journey the idea details or implies with tests in `src/**/*.test.tsx`, one `test` per journey. Never omit an implied journey to simplify. Every test must run and pass; leave nothing skipped or todo.
- Prefer semantic HTML and accessible names so tests address the interface without brittle selectors.

## Reporting

`report.partial.json` at the application root is mandatory — write it even when something has gone wrong, as it carries the only record of what you built and why. It contains exactly `status`, `app_url`, `start_command`, `summary`, `implemented_features`, `assumptions`, `tests_run`.

`assumptions` must record the decision you made about the idea's ambiguity, and why you omitted any journey pattern. Never leave it empty.

`status` is `success` when every journey test passed and the build succeeded, `partial` when a journey failed or went unrun, `failed` when the app cannot run. Never record a test as passed unless it ran and passed. Do not write `result.json`.
