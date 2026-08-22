---
name: mvp-builder
description: Non-technical idea → small tested browser app; record assumptions.
---

# MVP Builder

1. **Extract:** entity · attributes · every journey detailed/implied · ambiguities.
2. **Coverage:** use public journey guidance as a checklist. Implement if implied; if not, omit (no substitute features) and note why in `assumptions`.
3. **Data:** browser-local persistence by default; backend only if the idea requires it. Mutable data → thin repo/service boundary (UI ≠ domain ≠ persistence). No invented external API.
4. **UI/edge cases (where relevant):** accessible controls · validation · empty states · errors · responsive layout · duplicate/repeated actions · boundaries · malformed persistence · recoverable storage/runtime failures.
5. **Structure:** focused components · separated concerns · low duplication · easy to extend.
6. **Deps:** lockfile only — no new packages, no install commands.
7. **Tests:** every applicable observable user behavior via included Vitest/jsdom/Testing Library. Not UI journeys: startup, assumptions reporting (runner-owned). All committed tests must run and pass — no skip/todo.
8. **Gate:** `npm test` + `npm run build` green before reporting success.
9. **Report:** write `report.partial.json` exactly:

```json
{
  "status": "success",
  "app_url": "http://localhost:3000",
  "start_command": "npm run dev",
  "summary": "…",
  "implemented_features": ["…"],
  "assumptions": ["ambiguity → decision"],
  "tests_run": [{ "command": "npm test", "journey": "user-visible behaviour verified", "result": "passed" }]
}
```

**Status:** `success` = ≥1 `tests_run` and all `passed` · `partial` = incomplete / any journey failed or unrun · `failed` = app cannot run.  
**Results:** only `passed`|`failed` · unrun → `failed` + why in `journey` · never invent `passed`.
