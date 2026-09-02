Build the smallest maintainable application that covers every user journey the product idea details or implies. Minimize unnecessary complexity, not coverage or sound internal structure, and do not add capabilities the idea does not justify.

Work autonomously in the current directory. Do not ask clarifying questions. Resolve genuine ambiguity with a sensible product decision and record that decision under `assumptions`.

## The workspace, already in place

The directory holds a working React 19 + TypeScript + Vite seed. These files exist and are described here so you never need to open them:

- `index.html` — mounts `<div id="root">` and loads `/src/main.tsx`. Change only the `<title>`; keep both of those.
- `src/main.tsx` — renders your `App` in StrictMode and imports `./styles.css`. No change needed.
- `src/App.tsx` — placeholder component. Replace it, exporting a component called `App` from this exact path.
- `src/lib/` — tested persistence primitives for ideas that keep a collection of records: `useCollection` (persisted list with add/update/remove), `createId`, and the storage layer beneath them. Their API is given under **Provided primitives** below. Use them when the idea keeps records; build whatever the idea actually needs when it does not, and delete unused files from `src/lib/` only.
- `src/styles.css` — complete semantic stylesheet: responsive, accessible, dark-scheme aware. Keep it and write semantic markup; you should not need to add CSS or class names.
- `src/test/setup.ts` — imports `@testing-library/jest-dom/vitest`. No change needed.
- `vite.config.ts`, `vitest.config.ts` — port 3000, strict port, jsdom, React plugin. Do not change either.
- `package.json` — scripts `dev`, `build`, `test`. Available: react, react-dom, @testing-library/react, @testing-library/dom, @testing-library/user-event, @testing-library/jest-dom, vitest, jsdom, typescript.

Do not read, list, or search these files, and do not install packages — only what the committed lockfile already provides is available.

Four things must keep existing exactly as they are, because the build and the
test runner load them by path: `src/main.tsx`, `src/styles.css`,
`src/test/setup.ts`, and `<div id="root">` inside `index.html`. Deleting or
moving any of them breaks every test. `src/lib/` is the only directory whose
unused files you may remove.

## How to work

Decide the whole file set before writing anything, then write each file exactly once with the `write` tool, complete and final. A file only exists once `write` has created it — never present file contents as text in your reply, as nothing is saved that way. Do not assemble a file through successive `edit` calls, and do not re-read a file you just wrote — its contents are already known to you. Reserve `edit` for repairing a specific failure that test or build output actually reported.

Then, in this order:

1. Run `npm test` and `npm run build` once, and repair only what failed.
   Once both pass on the current code, stop verifying. Do not re-run them to
   double-check a result you already have — that costs a full step and tells you
   nothing new. If you change code afterwards, verify once more, then stop again.
2. Write `report.partial.json` at the application root as your final action, described under **Reporting** below. Write it exactly once, after the tests and build have settled, so it describes the finished application rather than an intermediate state.

Do not leave development servers or other background processes running.

## Required outcome

- The application starts with `npm run dev` at exactly `http://localhost:3000`.
- It is responsive, accessible, and usable without external services or login.
- Required user data survives a page refresh.
- Where the app has mutable data or domain operations, keep UI, domain logic, and persistence behind small clear boundaries, so storage or another client can be added without rewriting the UI. Do not add a backend or external API unless the idea requires one.
- Handle empty and invalid input, duplicate or repeated actions, boundary cases, malformed persisted data, and recoverable runtime failures where relevant.
- Confirm any action that destroys data the user cannot recreate before carrying it out.
- Cover every observable user journey the idea details or implies with tests in `src/**/*.test.ts` or `src/**/*.test.tsx`. Never omit an implied journey merely to simplify. Every test must run and pass; leave no skipped or todo tests.
- Give each journey its own `test`, named for the behaviour a user would recognise. Do not combine several journeys into one long test: each is reported separately, and a single combined test hides the rest the moment one step breaks. Persisting data across a reload is its own journey whenever the idea needs data to survive — remount the component and assert the data returns.
- Prefer semantic HTML and accessible names so tests and browser automation can address the interface without brittle selectors.
- Keep concerns separated and duplication limited without unnecessary infrastructure.

## Reporting

`report.partial.json` at the application root is mandatory — write it even when something else has gone wrong, because it carries the only record of what you built and why. It contains exactly `status`, `app_url`, `start_command`, `summary`, `implemented_features`, `assumptions`, and `tests_run`.

`assumptions` must record the decision you made about the idea's ambiguity, and the reason for any listed journey pattern you deliberately omitted. Never leave it empty.

Report `status: "success"` when every journey test passed and the build succeeded, `partial` when a journey failed or went unrun, and `failed` when the app cannot run. Never record a test as passed unless it ran and passed. Do not write `result.json`; the challenge runner owns its audited telemetry.
