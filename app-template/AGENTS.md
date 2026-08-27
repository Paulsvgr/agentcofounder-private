# Generated application contract

- Runnable with `npm run dev` at `http://localhost:3000`, self-contained, no login or external services.
- Semantic HTML and accessible names, so tests and browser automation avoid brittle selectors.
- The seed ships no product tests. Add at least one completed, passing `src/**/*.test.tsx`; the runner rejects zero-test reports and any skipped or todo test.
- Use only the dependencies in the committed lockfile. Do not install packages.
- `report.partial.json` holds exactly `status`, `app_url`, `start_command`, `summary`, `implemented_features`, `assumptions`, `tests_run`.
- Do not create or edit `result.json`; the runner owns telemetry, `app_url`, `start_command` and `harness_checks`.
- `main.tsx`, `styles.css`, `test/setup.ts` and `<div id="root">` are loaded by path. Deleting or moving any of them breaks the build and every test. Only `src/lib/` files may be deleted when unused.

## Provided primitives

`src/lib/` handles persistence **for ideas that keep a collection of records**.
Import it rather than hand-rolling `localStorage`, JSON recovery or ids. These
files are tested and complete — never open them.

```ts
import { useCollection, type Identified } from "./lib/useCollection.js";
import { createId } from "./lib/id.js";

interface Thing extends Identified { name: string }   // Identified gives `id: string`

const { items, add, update, remove, replace } = useCollection<Thing>("things", {
  // Validate one stored entry; return undefined to drop it. Bad entries never
  // discard the rest. onFailure reports corrupt data, full disk, no storage.
  revive: (v) => (typeof v === "object" && v !== null
    && typeof (v as Thing).id === "string" && typeof (v as Thing).name === "string")
    ? v as Thing : undefined,
  onFailure: (_kind, detail) => setNotice(detail),
});

add({ id: createId(), name: "example" });
update(id, (t) => ({ ...t, name: "renamed" }));
remove(id);
```

`items` is a readonly array that survives a refresh — derive filters and counts
from it directly rather than mirroring it into state. Show `onFailure` messages
in an element with `role="alert"`.

Ideas that are not record collections — a game, a calculator, a timer, a single
document — should be built the way that idea needs, with `useState` alone or one
persisted value. **The idea decides the shape, not this template.**

`src/styles.css` already styles headings, `section`, `form`, `label`, `input`,
`select`, `button`, `ul`/`li`, `table` and `[role="alert"]` responsively, with
focus rings and a dark scheme. Write accessible markup and it is styled; you
should not need to add CSS or class names.
