# Not included — Exp5 template primitives & Exp5b storage

These Phase F interventions were **KEEP** or **WEAK KEEP** in `ac-control`, but they are **not** part of the V2 control floor in `agentcofounder`.

## Why excluded

They are **implementation opinions**, not neutral harness infrastructure:

| Item | Files in ac-control | Why deferred |
|------|---------------------|--------------|
| **Exp5** seed primitives | `app-template/src/lib/collectionStore.ts`, `useCollection.ts`, `text.ts`, `src/test/memoryStorage.ts`, primitive block in `AGENTS.md` | Prescribes storage/hook/text patterns; model should choose or get them from future **component assembly** |
| **Exp5b** lazy storage | Hardening inside `collectionStore.ts` + AGENTS anti-wrapper guidance | Only meaningful when Exp5 is shipped |
| **Exp4** NL failure digest | Prompt-only “read failures once” | **REVERT** in Phase F — replaced by Exp6 reporter |

## When to add them

Run as **separate experiments** after locking `phase-f-control-floor`. Registry entry and files:

- `resources/registry/data-patterns/local-storage-collection.json`
- `resources/files/data-patterns/local-storage-collection/`
- Full doc: `resources/docs/data-patterns/local-storage-collection.md`

See [resources/experiments.md](../resources/experiments.md) — Experiment **B** (`resource-slice-data-v1`).

```bash
export RUN_EXPERIMENT="resource-slice-data-v1"
export RUN_ARM="treatment"
```

Compare 5 treatment vs 5 `phase-f-control-floor` control runs.

## Reference

Full Phase F sequence and verdicts: `ac-control/docs/phase-f-strategy.md`
