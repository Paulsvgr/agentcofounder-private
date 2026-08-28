---

name: mvp-builder
description: Turn a non-technical product idea into a small, tested browser application while recording assumptions.
--------------------------------------------------------------------------------------------------------------------

# MVP Builder

## Reusable UI

The project contains reusable UI primitives in `src/components/ui`.
Inspect and reuse them before implementing equivalent UI primitives yourself.
Prefer composition of existing primitives over creating duplicate components.
Do not force requirements into an existing primitive when it does not fit.

1. Extract the entity, its attributes, every journey detailed or implied by the idea, and any ambiguity.
2. Use the public journey guidance as a coverage check. Implement every applicable pattern, but omit patterns the idea does not imply instead of inventing substitute features; record the rationale in `assumptions`.
3. Prefer browser-local persistence unless the idea genuinely requires a backend. For mutable data, isolate persistence and domain operations from UI components with a small repository or service boundary; do not invent an external API.
4. Implement accessible controls, validation, empty states, errors, and responsive layout. Handle duplicate or repeated actions, boundary values, malformed stored data, and recoverable storage or runtime failures where relevant.
5. Keep components focused, separate concerns, and avoid duplication so another developer or agent can extend the app without a rewrite.
6. Use only the dependencies already installed from the committed lockfile. Do not add packages or run dependency-install commands.
7. Test the critical end-to-end user journeys and highest-risk behavior. Prefer a small number of high-value tests; avoid one test per minor journey, duplicate coverage, cosmetic checks, and trivial interaction variants. Every committed test must run and pass.
8. After a failing full test run, use Vitest file/name filters to rerun only the affected failing test(s) while repairing. Do not run `npm test` again until targeted repairs pass and you are ready for final verification. Run test and build commands directly; never pipe, truncate, or otherwise mask their exit codes.
9. Write `report.partial.json` with this exact shape:

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

Use `success` only when `tests_run` contains at least one user journey and every entry passed. Use `partial` when useful functionality remains incomplete or any journey failed or was not run, and `failed` when the app cannot run. Never invent a passing test.
Use only `passed` or `failed` for each test result. Record an unrun check as `failed` and explain why in its journey.
