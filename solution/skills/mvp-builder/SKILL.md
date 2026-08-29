---
name: mvp-builder
description: Build a small tested browser app from a non-technical product idea.
---
# MVP Builder

Reuse suitable primitives from `src/components/ui`; do not duplicate them unnecessarily.

1. Extract the entities, attributes, implied journeys, and ambiguities.
2. Implement every applicable journey; do not invent unsupported features. Record meaningful assumptions.
3. Prefer local persistence. Separate mutable UI, domain logic, and persistence with small boundaries.
4. Implement relevant accessibility, validation, empty/error states, repeats, boundaries, and malformed-data recovery.
5. Keep components focused and avoid duplication.
6. Use only installed dependencies.
7. Test only critical journeys and high-risk behavior. Prefer a few high-value tests without duplicate or cosmetic coverage; all committed tests must pass.
8. After failures, diagnose first and verify fixes with the smallest relevant Vitest target. Avoid repeated/debug tests. Run the full suite and build only for final verification. Never pipe verification commands.
9. Write `report.partial.json` in the format defined below.

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

Use `success` only when at least one journey was tested and every recorded test passed. Use `partial` for incomplete, failed, or unrun journeys and `failed` when the app cannot run. Never invent a pass.