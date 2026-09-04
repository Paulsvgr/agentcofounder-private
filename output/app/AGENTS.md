# Generated application contract

## Runtime rules

- The app runs with `npm run dev` at exactly `http://localhost:3000`; keep the existing scripts, Vite, TypeScript and Vitest setup.
- Use only the dependencies already installed from the committed lockfile. Never add packages or run install commands.
- Persist durable single-user data in the browser through `src/lib/repository.ts`; never call `localStorage` from components.
- Prefer semantic HTML and accessible names: a real browser drives this app during judging.
- Keep files small and single-purpose: `src/domain/*` (types, rules, derivations), `src/lib/*` (reusable infrastructure), `src/components/*` (UI), `src/App.tsx` (composition).
- Add `src/**/*.test.ts(x)` covering the product's user journeys and run them before claiming success. The runner rejects zero-test reports and any skipped or todo test.
- `report.partial.json` contains only `status`, `app_url`, `start_command`, `summary`, `implemented_features`, `assumptions`, `tests_run`.
- A `success` report needs at least one `tests_run` entry with every entry `passed`; otherwise use `partial`, or `failed` when the app cannot run.
- Never create or edit `result.json`; the runner owns telemetry, `harness_checks` and the audited `app_url`/`start_command`.

## Pre-built toolkit — use it, do not re-implement it

This starter already ships tested, domain-neutral infrastructure. Import it instead of
writing your own; every line you do not generate is saved output cost.

`src/lib/id.ts`
- `createId(prefix?)`, `normalizeKey(text)` (trim + collapse + lowercase, for duplicate checks).

`src/lib/validation.ts`
- Rules: `required(msg?)`, `minLength(n)`, `maxLength(n)`, `pattern(re,msg)`, `isNumber()`, `numberRange(min,max)`, `oneOf(values)`, `unique(existingValues)`.
- `validateFields(values, { field: [rules] }) -> FieldErrors`, `hasErrors(errors)`, `firstError(value, rules)`.

`src/lib/dates.ts`
- `nowIso()`, `toIsoDate(value?)`, `isValidDate(v)`, `formatDate(v)`, `daysUntil(v, from?)`, `isOverdue(v, from?)`.

`src/lib/storage.ts`
- `createStorage<T>(key, { version?, parseRecord, migrate? })` → `{ load, save, clear }`.
- `load()` returns `{ records, status: "ok"|"empty"|"recovered"|"unavailable", message? }` and never throws on unreadable JSON, wrong shapes, damaged entries, or blocked storage.

`src/lib/repository.ts`
- `interface Entity { id, created_at, updated_at }`, `isEntityShape(value)`.
- `createRepository<T extends Entity>(key, { parseRecord, version?, migrate?, compare? })` → `{ load, list, create, update, remove, replaceAll, save, clear }`. It owns ids and timestamps.

`src/lib/collection.ts`
- `searchRecords`, `filterRecords`, `sortRecords`, `groupRecords`, `countBy`, `sumBy`, `uniqueValues`.

`src/lib/state-machine.ts`
- `createStateMachine({ initial, transitions })` → `{ states, can, next, apply, isFinal }` for lifecycles (e.g. requested → active → closed).

`src/hooks/useCollection.ts`
- `useCollection(repository)` → `{ records, loading, status, notice, create, update, remove, replaceAll, dismissNotice }`. Loads once, saves on every change, surfaces storage problems as a notice.

`src/ui/index.tsx` (accessible, responsive, styled by `src/styles.css`)
- `AppShell`, `Section`, `StatCard`, `Button`, `Form`, `TextField`, `TextAreaField`, `SelectField`, `Notice`, `EmptyState`, `DataList`, `DataTable`, `Dialog`.
- Fields render a real `<label>`, wire `aria-invalid` and `aria-describedby`, and expose errors with `role="alert"`.

`src/test/setup.ts` clears `localStorage` and unmounts between tests. `src/test/helpers.ts` provides `seedStorage(key, records, version?)`, `corruptStorage(key, raw?)`, `readStorage(key)`.

Useful CSS classes: `grid`, `form__actions`, `muted`, plus the classes the primitives already apply.

`src/lib/**` and `src/ui/**` ship with passing tests; keep them working. Extend them only when the idea genuinely needs something they do not cover.
