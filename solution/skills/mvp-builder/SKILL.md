---
name: mvp-builder
description: Turn a non-technical product idea into a small, tested browser application while recording assumptions.
---

# MVP Builder

Read the idea once and settle these before writing any file:

1. **The entity** — its name and every attribute the idea mentions.
2. **The journeys** — every observable behaviour the idea details or implies. Check coverage against the public journey guidance, but omit patterns the idea does not imply rather than inventing substitutes, and say why in `assumptions`.
3. **The ambiguity** — most ideas contain one underspecified detail. Decide it, and record the decision in `assumptions`.
4. **The file set** — usually a domain/storage module, one or more components, a stylesheet, and a test file per journey group.

Then write those files, each in a single complete `write`.

## Design rules

- Isolate persistence and domain operations from components behind a small repository or service boundary. Prefer browser-local persistence; do not invent an external API.
- Reading persisted data must survive absent, malformed, or partial values, and writes must survive a storage failure without losing the in-memory session.
- Give every control an accessible name, label every input, and provide empty states, validation messages, and a responsive layout.
- Keep components focused so another developer can extend the app without a rewrite.

## Test rules

Cover each observable journey with Testing Library, driving the UI the way a user would — by role, label, and visible text rather than test IDs or implementation details. Startup and assumption reporting are runner obligations, not UI journeys. Every committed test must run and pass; leave nothing skipped or todo, and never record a test as passed unless it ran and passed.

One `test` per journey, named for the behaviour a user would recognise ("returns a borrowed item", "keeps records after a reload"). A single test that walks through every feature reports as one journey and hides the others as soon as an early step breaks. Where data must survive a reload, unmount and re-render the component and assert the data returns — that is a journey in its own right.

## Report shape

```json
{
  "status": "success",
  "app_url": "http://localhost:3000",
  "start_command": "npm run dev",
  "summary": "Short description of the application",
  "implemented_features": ["Feature"],
  "assumptions": ["The ambiguity and the decision made"],
  "tests_run": [
    { "command": "npm test", "journey": "User-visible behaviour that was verified", "result": "passed" }
  ]
}
```

Use `passed` or `failed` for each entry, nothing else. `success` requires at least one journey with every entry passed; use `partial` when a journey failed or went unrun, and `failed` when the app cannot run.
