# V2 resource registry

First genuine V2 prototype: **select resources → assemble into app-template → generate tiny `RESOURCES.md` → Pi builds**.

Phase F optimised trajectories (control floor). This layer optimises **what Pi receives** before generation starts.

## Design rules (frozen)

1. **Registry = source of truth (JSON).** Full knowledge, validation, diffs, deterministic assembly.
2. **`RESOURCES.md` = generated view.** Pi reads only the selected slice — import, tiny example, when to use, constraints, optional test hint.
3. **Experiment manually simulates Planner + assembler.** Final V2 automates selection per user idea.
4. **Adoption ≠ benefit.** Import/use proves adoption; cost/repairs/quality prove benefit.
5. **High-leverage patterns only.** Small UI primitives rejected in Experiment A v2 — see [experiment-a-v2-verdict.md](./experiment-a-v2-verdict.md).
6. **Exp5/5b is not discarded.** Hardened localStorage lives in `data-patterns/local-storage-collection`, not in baseline.

> **Full knowledge stays outside Pi's context. Pi receives the smallest selected slice required to build correctly.**

## Layout

```text
resources/
  registry/              ← JSON entries (this repo)
    components/
    themes/
    data-patterns/
    integrations/        (future)
    test-patterns/       (future)
    repair-playbooks/    (future)
  files/                 ← canonical file payloads assembler copies
  docs/                  ← full_docs_reference targets (lazy retrieval)

docs/v2/resources/       ← human docs (you are here)
```

## Flow (target V2)

```text
User idea
  ↓
Planner → selected resource IDs + theme
  ↓
Registry lookup (JSON)
  ↓
Assembler → copy files into app-template, wire deps
  ↓
Generate RESOURCES.md (compact contract only)
  ↓
Pi
```

## Experiment sequence

See [experiments.md](./experiments.md).

| Stage | Experiment ID | Adds |
|-------|---------------|------|
| Control | `phase-f-control-floor` | Exp1+2+3+6 only (**locked**, 5 runs) |
| A | `resource-slice-ui-v1` | Selected UI components + theme |
| B | `resource-slice-data-v1` | `local-storage-collection` data-pattern only |
| C | `resource-slice-full-v1` | UI + theme + data (vs control **and** best of A/B) |

## Provenance per run (record on every treatment)

| Field | Purpose |
|-------|---------|
| `selected_resource_ids` | Exact IDs Pi was offered |
| Per-entry `content_hash` | Registry entry at assembly time |
| `resources_md_sha256` | Generated guide Pi read |
| `registry_schema_version` | e.g. `agentcofounder.resource.v1` |
| `assembled_tree_sha256` | Copied files in app-template snapshot |

Future: `run-manifest.json` → `versions.resource_manifest` (hash of selection record).

## Docs in this folder

| File | Contents |
|------|----------|
| [registry-schema.md](./registry-schema.md) | JSON entry fields, types, validation |
| [experiments.md](./experiments.md) | A/B/C protocol, metrics, labels |
| [experiment-b-v1-analysis.md](./experiment-b-v1-analysis.md) | Experiment B deep session analysis |
| [experiment-b-v1-verdict.md](./experiment-b-v1-verdict.md) | Experiment B frozen verdict |
| [experiment-c-v1-analysis.md](./experiment-c-v1-analysis.md) | Experiment C deep session analysis |
| [experiment-c-v1-verdict.md](./experiment-c-v1-verdict.md) | Experiment C frozen verdict |
| [examples/](./examples/) | Sample registry entries + generated `RESOURCES.md` |

## Related

- Control floor (baseline): [../control-floor/README.md](../control-floor/README.md)
- Exp5 deferred to data-patterns: [../control-floor/not-included-exp5-primitives.md](../control-floor/not-included-exp5-primitives.md)
- V2 spec: [../spec/Agent_Cofounder_V2_COMPLETE_SPEC.md](../spec/Agent_Cofounder_V2_COMPLETE_SPEC.md)
