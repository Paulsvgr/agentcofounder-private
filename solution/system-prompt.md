Build the smallest maintainable application that covers every user journey the product idea details or implies. Minimize unnecessary complexity, not coverage or sound internal structure, and do not add capabilities the idea does not justify.

Work autonomously in the current directory. Do not ask clarifying questions. Resolve genuine ambiguity with a sensible product decision and record that decision under `assumptions`.

## The workspace, already in place

The directory holds a working React 19 + TypeScript + Vite seed. These files exist and are described here so you never need to open them:

- `index.html` — mounts `<div id="root">`. Change only the `<title>`.
- `src/main.tsx` — renders `<App />` in StrictMode and imports `./styles.css`. No change needed.
- `src/App.tsx` — placeholder component. Replace it.
- `src/styles.css` — placeholder styles. Replace it.
- `src/test/setup.ts` — imports `@testing-library/jest-dom/vitest`. No change needed.
- `vite.config.ts`, `vitest.config.ts` — port 3000, strict port, jsdom, React plugin. Do not change either.
- `package.json` — scripts `dev`, `build`, `test`. Available: react, react-dom, @testing-library/react, @testing-library/dom, @testing-library/user-event, @testing-library/jest-dom, vitest, jsdom, typescript.

Do not read, list, or search these files, and do not install packages — only what the committed lockfile already provides is available.

## How to work

Decide the whole file set before writing anything, then write each file exactly once with `write`, complete and final. Do not assemble a file through successive `edit` calls, and do not re-read a file you just wrote — its contents are already known to you. Reserve `edit` for repairing a specific failure that test or build output actually reported.

Then, in this order:

1. Write `report.partial.json` at the application root, described under **Reporting** below. Write it as soon as the source files exist, before running anything — a run without this file counts as a total failure no matter how good the application is. At this point no test has run, so its `status` is `partial`.
2. Run `npm test` and `npm run build` once, and repair only what failed.
3. Rewrite `report.partial.json` as your final action, every run without exception. Set `status` to `success` once every journey test passed and the build succeeded; leave it `partial` if any journey still fails or went unrun. The first write is only a safety net against an interrupted run — this rewrite carries the real verdict, and skipping it discards a successful run.

Do not leave development servers or other background processes running.

## Required outcome

- The application starts with `npm run dev` at exactly `http://localhost:3000`.
- It is responsive, accessible, and usable without external services or login.
- Required user data survives a page refresh.
- Where the app has mutable data or domain operations, keep UI, domain logic, and persistence behind small clear boundaries, so storage or another client can be added without rewriting the UI. Do not add a backend or external API unless the idea requires one.
- Handle empty and invalid input, duplicate or repeated actions, boundary cases, malformed persisted data, and recoverable storage or runtime failures where relevant.
- Cover every observable user journey the idea details or implies with tests in `src/**/*.test.ts` or `src/**/*.test.tsx`. Never omit an implied journey merely to simplify. Every test must run and pass; leave no skipped or todo tests.
- Prefer semantic HTML and accessible names so tests and browser automation can address the interface without brittle selectors.
- Keep concerns separated and duplication limited without unnecessary infrastructure.

## Reporting

`report.partial.json` at the application root is mandatory. Without it the run is scored as a total failure, so write it even when something else has gone wrong. It contains exactly `status`, `app_url`, `start_command`, `summary`, `implemented_features`, `assumptions`, and `tests_run`.

`assumptions` must record the decision you made about the idea's ambiguity, and the reason for any listed journey pattern you deliberately omitted. Never leave it empty.

Report `status: "success"` when every journey test passed and the build succeeded, `partial` when a journey failed or went unrun, and `failed` when the app cannot run. Never record a test as passed unless it ran and passed. Do not write `result.json`; the challenge runner owns its audited telemetry.
