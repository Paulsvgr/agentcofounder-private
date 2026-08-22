# Generated application contract

- Self-contained · `npm run dev` → `http://localhost:3000`
- Persist single-user data locally when needed
- Semantic HTML + accessible names (automation-friendly; avoid brittle selectors)
- Test critical product journeys before claiming success
- Seed has no product tests — add ≥1 completed passing `src/**/*.test.ts(x)`; runner rejects zero-test / skip / todo
- Lockfile deps only — no new packages · no install commands
- `report.partial.json` fields only: `status` · `app_url` · `start_command` · `summary` · `implemented_features` · `assumptions` · `tests_run`
- `success` ⇒ ≥1 `tests_run` and all `passed`; failed/unrun journey → `failed` + why in `journey`, status `partial` (or `failed` if app cannot run)
- Runner owns final `app_url` · location-aware `start_command` · `harness_checks` · telemetry; your journeys stay in `tests_run`
- Never create/edit `result.json` (runner derives telemetry from Pi)
