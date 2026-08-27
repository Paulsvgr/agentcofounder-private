---
name: mvp-builder
description: Turn a non-technical product idea into a small, tested browser application while recording assumptions.
---

# MVP Builder

Read the idea once and settle four things before writing any file:

1. **The entity or state** the idea is really about, and its attributes.
2. **The journeys** — every observable behaviour it details or implies.
3. **The ambiguity** — most ideas leave one detail underspecified. Decide it, and record the decision in `assumptions`.
4. **The file set** — usually a domain module, one or more components, and a test file.

Then write those files, each in a single complete `write`.

## Design

- Keep persistence and domain rules out of components, behind a small boundary. Prefer browser-local storage; never invent an external API.
- Reading persisted data must survive absent, malformed or partial values; a failed write must not lose the in-memory session.
- Label every input, give every control an accessible name, and provide validation messages, empty states and a responsive layout.
- Anything that destroys unrecoverable data asks first.

## Tests

One `test` per journey, named for the behaviour a user would recognise, in the idea's own vocabulary. A single test walking through every feature reports as one journey and hides the rest as soon as an early step breaks.

Drive the UI as a user would — by role, label and visible text, not test IDs. Where data must survive a reload, unmount and re-render and assert it returns; that is a journey in its own right. When behaviour depends on time, control the clock with `vi.useFakeTimers()`, advance it inside `act()`, and restore real timers afterwards — waiting on the real clock is slow and flaky, and a test that never resolves fails the run.

Startup and assumption reporting are runner obligations, not UI journeys. Never record a test as passed unless it ran and passed.

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
    { "command": "npm test", "journey": "User-visible behaviour verified", "result": "passed" }
  ]
}
```

`passed` or `failed` only. `success` requires at least one journey with every entry passed; `partial` when one failed or went unrun; `failed` when the app cannot run.
