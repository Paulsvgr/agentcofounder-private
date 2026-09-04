---
name: mvp-builder
description: Turn a non-technical product idea into a small, tested browser application while recording assumptions.
---

# MVP Builder

1. Extract the entity, its attributes, every journey detailed or implied by the idea, and any ambiguity.
2. Use the public journey guidance as a coverage check. Implement every applicable pattern, but omit patterns the idea does not imply instead of inventing substitute features; record the rationale in `assumptions`.
3. Prefer browser-local persistence unless the idea genuinely requires a backend. For mutable data, **do not put domain logic or `localStorage` inside React components**. Use this layout (names may vary; folders matter):
   - `src/domain/` — types + pure operations
   - `src/storage/` — repository `load` / `save` (and only there talk to `localStorage`)
   - `src/components/` — presentational / interaction UI
   - `src/App.tsx` — thin composition only
4. Usability & accessibility:
   - Labels via `htmlFor` / accessible names; empty states; responsive vocabulary layout from `AGENTS.md`.
   - Show **visible** validation and error messages (e.g. “Title is required”). Do not rely only on disabled submit.
   - Set `aria-invalid="true"` on invalid inputs and announce messages with `role="alert"` or `aria-live="polite"`.
   - Confirm before destructive remove/delete.
   - Stable interaction UX: do not re-sort the list on +/- / inline edit; highlight “running low” with `ui-badge`.
5. Robustness when forms or persistence apply (keep lean):
   - Empty/invalid required fields → on-screen error.
   - Malformed stored JSON recovery **or** surfaced save/quota failure (one robustness demo is enough).
6. Keep modules focused so another developer or agent can extend the app without a rewrite.
7. Use only the dependencies already installed from the committed lockfile. Do not add packages or run dependency-install commands.
8. **Test budget: 8–10 UI journeys (do not exceed 10).** Combine assertions; prefer `getByRole` / `getByLabelText` and queries scoped to the list item. When +/- exists, one multi-item test must cover value change + stable order. Do **not** add separate domain/repository unit-test files or speculative edges (qty floor, cancel-delete, filter counts) unless the idea explicitly requires them. Every committed test must run and pass; no skipped or todo tests. Keep tests in `src/**/*.test.ts` or `src/**/*.test.tsx`.
9. Run `npm test` and `npm run build` once green, write a **complete** `report.partial.json` (all fields below — never `tests_run` alone), and stop. Do not polish further or expand the suite after success.
10. `report.partial.json` shape (required keys — omit none):

```json
{
  "status": "success",
  "app_url": "http://localhost:3000",
  "start_command": "npm run dev",
  "summary": "Short description of the application",
  "implemented_features": ["Feature"],
  "assumptions": ["Ambiguity and the decision made"],
  "tests_run": [
    {
      "command": "npm test",
      "journey": "User-visible behaviour that was verified",
      "result": "passed"
    }
  ]
}
```

Use `success`, `partial`, or `failed` per `AGENTS.md`. Never invent a passing test.
Use only `passed` or `failed` for each test result. Record an unrun check as `failed` and explain why in its journey.
