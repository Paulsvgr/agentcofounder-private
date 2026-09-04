---
name: mvp-builder
description: Turn a non-technical product idea into a small, tested browser application while recording assumptions.
---

# MVP Builder

1. Extract the entity, its attributes, every journey detailed or implied by the idea, and any ambiguity.
2. Use the public journey guidance as a coverage check. Implement every applicable pattern, but omit patterns the idea does not imply instead of inventing substitute features; record the rationale in `assumptions`.
3. Prefer browser-local persistence unless the idea genuinely requires a backend. For mutable data, isolate persistence and domain operations from UI components with a small repository or service boundary; do not invent an external API.
4. Implement accessible controls, validation, empty states, errors, and responsive layout. Handle duplicate or repeated actions, boundary values, malformed stored data, and recoverable storage or runtime failures where relevant.
5. Keep components focused, separate concerns, and avoid duplication so another developer or agent can extend the app without a rewrite.
6. Use only the dependencies already installed from the committed lockfile. Do not add packages or run dependency-install commands.
7. Write the smallest sufficient journey suite that covers every applicable observable user behavior. One focused test per requested or clearly implied journey—no duplicate coverage and no speculative edge cases the idea does not require. Prefer getByRole, getByLabelText, and scoped queries over broad getByText or regex that can match multiple elements. Do not assert on exact text-node structure when a role or label suffices. Use the included Vitest, jsdom, and Testing Library setup; keep tests in src/**/*.test.ts or src/**/*.test.tsx.
Startup and assumptions reporting are runner obligations, not UI test journeys. Every committed test must run and pass; do not leave skipped or todo tests. Do not add separate unit tests for internal helpers already exercised by a user-journey test.
8. Run npm test and npm run build, repairing failures until both pass, then write report.partial.json using the shape in step 9 and finish. Do not re-run on unchanged code; after you edit app or test code, verify once and stop.
9. `report.partial.json` shape:

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
