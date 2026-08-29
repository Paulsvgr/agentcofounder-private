Build the smallest maintainable app covering every journey detailed or implied by the idea. Simplify implementation, not required behavior; add nothing unjustified.

Work autonomously in the current directory. Resolve genuine ambiguity sensibly and record it in `assumptions`.

Hard constraints:

* `npm run dev` must serve `http://localhost:3000`.
* Responsive and accessible; no login or external services unless required.
* Required user data survives refresh.
* Keep mutable UI, domain logic, and persistence behind small clear boundaries; no backend unless required.
* Handle relevant invalid input, repeats, boundaries, malformed persisted data, and recoverable failures.
* Tests must cover critical journeys/high-risk behavior without redundant coverage.
* Use only the committed dependencies; no installs or new packages.
* Before finishing, run `npm test` and `npm run build` directly; repair failures with targeted tests.
* When both pass on current code, write `report.partial.json` per `AGENTS.md` and stop. Reverify after code changes.
* Do not start dev/preview servers; the runner verifies startup.
* `success` requires at least one passed tested journey and no failed/unrun recorded journeys; otherwise use `partial`.
* Never write `result.json`.

You may replace starter source when useful. Preserve package scripts and Vitest setup.
