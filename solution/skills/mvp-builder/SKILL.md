---
name: mvp-builder
description: Build and verify a complete application from the product idea.
---

# MVP Builder

Workflow:

`UNDERSTAND → PLAN → BUILD → TEST → REPAIR → BUILD → RUN → VERIFY → AUDIT → REPORT`

## 1. Understand

Inspect the existing project before modifying it.

Identify:

- framework and entry point
- relevant source structure
- existing tests
- available npm scripts
- existing dependencies/configuration

Read the complete product idea.

Extract:

- `REQ` = requirement
- `J` = user journey
- `MUST` = explicit requirement
- `SHOULD` = strongly implied requirement

For each important `J`:

`START → ACTIONS → STATE CHANGE → EXPECTED RESULT`

Use the public journey guidance injected with the prompt as a coverage check. Implement every applicable pattern, but omit patterns the idea does not imply instead of inventing substitute features; record the rationale in `assumptions`.

Prioritize MUST requirements and critical journeys.

## 2. Plan

Choose the simplest architecture that satisfies the requirements.

Reuse the existing stack.

Prefer browser-local persistence unless the idea genuinely requires a backend. For mutable data, isolate persistence and domain operations from UI components with a small repository or service boundary; do not invent an external API.

Avoid unnecessary dependencies, abstractions and unrelated features.

## 3. Build

Implement critical journeys as vertical slices:

`UI → STATE → PERSISTENCE → VALIDATION → TEST`

Implement core behavior before cosmetic polish.

Implement accessible controls, validation, empty states, errors, and responsive layout. Handle duplicate or repeated actions, boundary values, malformed stored data, and recoverable storage or runtime failures where relevant.

Keep components focused, separate concerns, and avoid duplication so another developer or agent can extend the app without a rewrite.

Use only the dependencies already installed from the committed lockfile. Do not add packages or run dependency-install commands.

## 4. Test

Inspect `package.json` and use the project's configured test command.

Normally:

`npm test`

Use the included Vitest, jsdom, and Testing Library setup. Keep tests in `src/**/*.test.ts` or `src/**/*.test.tsx`.

Test every applicable observable user behavior, especially MUST journeys and every implied journey the idea requires. Startup and assumptions reporting are runner obligations, not UI test journeys.

Run the tests after implementation.

Every committed test must run and pass; do not leave skipped or todo tests.

If tests fail:

`FAIL → DIAGNOSE → FIX → RERUN`

Do not skip, weaken or hide failures.

## 5. Build

After tests pass, use the project's configured production build command.

Normally:

`npm run build`

If it fails:

`FAIL → DIAGNOSE → FIX → REBUILD`

Do not finish with a known build failure.

## 6. Run

Start the application using the project's configured development/start command.

Normally:

`npm run dev`

The application must be reachable at:

`http://localhost:3000`

Verify that it actually starts and responds.

If startup fails:

`FAIL → DIAGNOSE → FIX → RESTART`

Stop the development server when verification is complete. Do not leave development servers or other background processes running.

## 7. Verify

Return to the original product idea.

For every MUST:

`DONE / MISSING / BROKEN`

For every critical J:

`WORKS / BROKEN`

If something important is broken:

`FIX → TEST → BUILD → RUN → VERIFY`

Completion requires:

- `REQUIREMENTS_COVERED`
- `CRITICAL_JOURNEYS_VERIFIED`
- `TESTS_PASS`
- `BUILD_PASS`
- `STARTUP_PASS`

## 8. Audit

Reconcile the verification checklist with the report you are about to write.

Confirm:

- every implemented feature appears in `implemented_features`
- every verified product journey appears in `tests_run`
- every ambiguity decision appears in `assumptions`
- `status` matches what was actually verified

Downgrade to `partial` or `failed` rather than claiming `success` for unverified behavior.

Do not write `harness_checks`; the runner records independent Vitest, build, and startup evidence there.

## 9. Report

Write `report.partial.json` at the application root with this exact shape:

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

Include only these fields: `status`, `app_url`, `start_command`, `summary`, `implemented_features`, `assumptions`, and `tests_run`.

Use `success` only when `tests_run` contains at least one user journey and every entry passed. Use `partial` when useful functionality remains incomplete or any journey failed or was not run. Use `failed` when the app cannot run.

Use only `passed` or `failed` for each test result. Record an unrun check as `failed` and explain why in its journey. Never invent a passing test.

Only report behavior that was actually implemented and verified.

Do not modify runner-owned `result.json`.

# Efficiency

Prioritize:

`REQUIREMENTS > JOURNEYS > CORE FUNCTIONALITY > DEBUGGING > VERIFICATION`

Avoid speculative features, unnecessary abstractions and cosmetic refactoring.
