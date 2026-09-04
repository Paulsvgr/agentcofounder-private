# Generated application contract

- Keep the application self-contained and runnable with `npm run dev` at `http://localhost:3000`.
- Store durable single-user browser data locally when persistence is required.
- For mutable data, split `src/domain/` (pure logic), `src/storage/` (repository load/save only), `src/components/` (UI), and keep `src/App.tsx` thin. Do not call `localStorage` from components.
- Prefer semantic HTML and accessible names so browser automation can use the interface without brittle selectors.
- Show visible validation/error text with `aria-invalid` and `role="alert"` or `aria-live="polite"`. Confirm destructive deletes. Surface persistence failures to the user.
- Keep list order stable while editing a row; use `ui-badge` (or similar vocabulary) for low-stock / derived callouts instead of reshuffling on every +/-.
- Field-level help or errors may use `ui-empty` inside a `ui-field` (stylesheet already styles that).
- Keep the product suite to **8–10** focused UI journeys (do not exceed 10). Combine assertions; do not add separate domain/repository unit suites. Run tests before claiming success. After the suite and build both pass on the current code, do not re-run unless you changed code — then verify once and stop.
- The seed intentionally contains no product tests. Add at least one completed, passing `src/**/*.test.ts` or `src/**/*.test.tsx` test; the runner rejects zero-test reports and any skipped or todo tests.
- Use only the dependencies already installed from the committed lockfile. Do not add packages or run dependency-install commands.
- `report.partial.json` contains only `status`, `app_url`, `start_command`, `summary`, `implemented_features`, `assumptions`, and `tests_run`.
- A `success` report must contain at least one `tests_run` entry and every entry must be `passed`. If a journey failed or was not run, record it as `failed`, explain why in `journey`, and use `partial` (or `failed` when the app cannot run).
- The runner owns the final `app_url`, location-aware `start_command`, independent `harness_checks`, and telemetry fields. Your product-journey test records remain in the specification-defined `tests_run` field.
- Do not create or edit `result.json`; the outer challenge runner derives its telemetry from Pi.

## CSS vocabulary (preinstalled)

A complete design-system stylesheet is already installed. **Do not read or edit the theme stylesheet.** The vocabulary below is sufficient.

Use only these class names for layout, typography, forms, buttons, lists, and cards:

| Class | Use for |
|-------|---------|
| `ui-page` | Full-page shell (min-height viewport, page padding) |
| `ui-container` | Centered max-width content wrapper |
| `ui-section` | Vertical content section with spacing |
| `ui-card` | Bordered card panel with padding and shadow |
| `ui-header` | Header block inside a card or section |
| `ui-title` | Primary page or section heading |
| `ui-subtitle` | Secondary or muted descriptive text |
| `ui-form` | Form layout grid (responsive columns) |
| `ui-field` | Single form field wrapper (label + control) |
| `ui-label` | Field label text |
| `ui-input` | Text input or select styling (apply to `<input>` and `<select>`) |
| `ui-btn` | Base button (neutral outline) |
| `ui-btn-primary` | Primary action button (add with `ui-btn`) |
| `ui-btn-secondary` | Secondary/neutral button (add with `ui-btn`) |
| `ui-btn-danger` | Destructive action button (add with `ui-btn`) |
| `ui-list` | Vertical list container (use on `<ul>`) |
| `ui-list-item` | List row (use on `<li>`) |
| `ui-empty` | Empty-state message |
| `ui-badge` | Small status or count badge |
| `ui-row` | Horizontal flex row with gap |
| `ui-stack` | Vertical stack with gap |

**Rules:**

- Compose UI from these classes only. Combine modifiers as shown (`className="ui-btn ui-btn-primary"`).
- **Accept the default appearance. Do not customise merely to make it prettier.**
- Do not substitute inline `style={{...}}` for the vocabulary.
- Do not add class names outside this list.
