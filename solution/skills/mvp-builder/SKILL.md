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
- Give every control an accessible name, label every input, and provide validation messages and a responsive layout.
- Every collection that can be empty needs its own message saying so and what to do next; rendering an empty container is not an empty state.
- Anything that destroys unrecoverable data asks first.
- Keep components focused so another developer can extend the app without a rewrite.

## Test rules

Cover each observable journey with Testing Library, driving the UI the way a user would. Reach for `getByRole` and `getByLabelText` first, and scope a query to a region when a page has several similar controls. Broad `getByText` and loose regex match more than you intend and fail with "found multiple elements", which costs a repair round. Do not assert on exact text-node structure when a role or label identifies the element. Startup and assumption reporting are runner obligations, not UI journeys. Every committed test must run and pass; leave nothing skipped or todo, and never record a test as passed unless it ran and passed.

One `test` per journey, named for the behaviour a user would recognise, in the idea's own vocabulary rather than generic CRUD wording ("clears the flag on a record", "keeps records after a reload").

This is Vitest, not Jest, and globals are off: import every helper you use — `describe`, `test`, `expect`, `beforeEach`, `afterEach`, `vi` — from `"vitest"` in each test file, and use `vi` rather than `jest` for mocks and timers. A missing import fails the build, not just the test.

When behaviour depends on the passage of time — a countdown, an interval, anything that changes on its own — control the clock with `vi.useFakeTimers()` and advance it inside `act()`, and restore real timers afterwards. Waiting on the real clock makes a test slow and flaky, and a test that never resolves fails the run. A single test that walks through every feature reports as one journey and hides the others as soon as an early step breaks. Where data must survive a reload, unmount and re-render the component and assert the data returns — that is a journey in its own right.

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
