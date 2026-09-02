# Generated application contract

- Keep the application self-contained and runnable with `npm run dev` at `http://localhost:3000`.
- Store durable single-user browser data locally when persistence is required.
- Prefer semantic HTML and accessible names so browser automation can use the interface without brittle selectors.
- Add tests for the product's critical user journeys and run them before claiming success.
- The seed intentionally contains no product tests. Add at least one completed, passing `src/**/*.test.ts` or `src/**/*.test.tsx` test; the runner rejects zero-test reports and any skipped or todo tests.
- Use only the dependencies already installed from the committed lockfile. Do not add packages or run dependency-install commands.
- `report.partial.json` contains only `status`, `app_url`, `start_command`, `summary`, `implemented_features`, `assumptions`, and `tests_run`.
- A `success` report must contain at least one `tests_run` entry and every entry must be `passed`. If a journey failed or was not run, record it as `failed`, explain why in `journey`, and use `partial` (or `failed` when the app cannot run).
- The runner owns the final `app_url`, location-aware `start_command`, independent `harness_checks`, and telemetry fields. Your product-journey test records remain in the specification-defined `tests_run` field.
- Do not create or edit `result.json`; the outer challenge runner derives its telemetry from Pi.

## Provided primitives

`src/lib/` implements persistence **for ideas that keep a collection of records**.
When the idea calls for that, import these rather than hand-rolling
`localStorage` access, JSON recovery, or id generation — the files are tested
and complete, and you never need to open them.

Many ideas are not shaped that way. A game, a calculator, a converter, a timer,
or a single-document editor should be built the way that idea actually needs,
and may use `useState` alone, persist one value, or persist nothing. Do not
force a record collection onto an idea that does not have one. **The idea
decides the shape, not this template.** Unused files may be deleted from
`src/lib/` only — `main.tsx`, `styles.css` and `test/setup.ts` are loaded by
path and removing them breaks the build and every test.

```ts
import { useCollection, type Identified } from "./lib/useCollection.js";
import { createId } from "./lib/id.js";
import type { StorageFailure } from "./lib/storage.js";

interface Thing extends Identified {   // Identified supplies `id: string`
  name: string;
}

// Inside a component. `revive` validates one stored entry and returns it,
// or returns undefined to drop it. Unreadable entries never discard the rest.
const { items, add, update, remove, replace } = useCollection<Thing>("things", {
  revive: (value) => {
    if (typeof value !== "object" || value === null) return undefined;
    const c = value as { id?: unknown; name?: unknown };
    if (typeof c.id !== "string" || typeof c.name !== "string") return undefined;
    return { id: c.id, name: c.name };
  },
  onFailure: (failure: StorageFailure, detail: string) => setNotice(detail),
});

add({ id: createId(), name: "example" });
update(id, (thing) => ({ ...thing, name: "renamed" }));
remove(id);
```

`items` is a readonly array that survives a refresh. Derive filters and counts
from it directly; do not mirror it into separate state. `onFailure` reports
unavailable storage, corrupt data, dropped entries, and rejected writes, so
render that message in an element with `role="alert"` when one arrives.

Records reach storage through a backend seam in `src/lib/backend.ts` — a
`read`/`write` pair. Browser storage is the default; passing a `backend` to
`useCollection` is all it takes to put a hosted database or API behind the same
components. Keep that seam intact: never call `localStorage` from a component,
and never add a network client, since the application must run with no external
service. Building on the seam is what makes the app integration-ready.

`src/styles.css` already styles semantic elements — headings, `section`, `form`,
`label`, `input`, `select`, `button`, `ul`/`li`, `table`, and `[role="alert"]` —
responsively, with focus rings and a dark scheme. Write accessible markup and it
is styled; you should not need to add CSS or class names.
