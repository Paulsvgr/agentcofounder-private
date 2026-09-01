# Resource registry schema (v1)

**Schema ID:** `agentcofounder.resource.v1`

Each resource is one JSON file under `resources/registry/<type-plural>/<id>.json`.

## Resource types

| `type` | Directory | Examples |
|--------|-----------|----------|
| `component` | `components/` | `button`, `dialog`, `select` |
| `theme` | `themes/` | `theme-default` |
| `data-pattern` | `data-patterns/` | `local-storage-collection` |
| `integration` | `integrations/` | (future) Supabase, Stripe |
| `test-pattern` | `test-patterns/` | (future) stable query patterns |
| `repair-playbook` | `repair-playbooks/` | (future) verified fixes |

## Entry shape

```json
{
  "schema": "agentcofounder.resource.v1",
  "id": "dialog",
  "type": "component",
  "name": "Dialog",
  "version": "1.0.0",
  "content_hash": "<sha256 of canonical entry bytes, computed by tooling>",
  "files": [
    {
      "source": "resources/files/components/dialog/dialog.tsx",
      "target": "src/components/ui/dialog.tsx"
    }
  ],
  "npm_dependencies": [],
  "registry_dependencies": ["button"],
  "import": "import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from \"@/components/ui/dialog\"",
  "setup": null,
  "tiny_example": "<Dialog><DialogTrigger asChild><Button>Open</Button></DialogTrigger><DialogContent>...</DialogContent></Dialog>",
  "use_when": ["modal forms", "confirmations", "detail views"],
  "constraints": ["Prefer this component.", "Do not build a custom modal unless required."],
  "test_hint": "Use getByRole('dialog') or getByRole('button', { name: /open/i }). Wrap trigger with asChild.",
  "full_docs_reference": "resources/docs/components/dialog.md"
}
```

### Required fields

| Field | Type | Notes |
|-------|------|-------|
| `schema` | string | Always `agentcofounder.resource.v1` |
| `id` | string | Stable slug; matches filename |
| `type` | enum | See table above |
| `name` | string | Human label for generated doc |
| `version` | string | Semver for this entry |
| `content_hash` | string | Hash of entry JSON (excluding hash field) or of file bundle |
| `files` | array | Source → target paths assembler copies |
| `import` | string \| null | Exact import line(s) for Pi doc |
| `setup` | string \| null | Extra setup (theme tokens, env) if not covered by import |
| `tiny_example` | string | Minimal correct usage (one pattern) |
| `use_when` | string[] | When Planner should select this |
| `constraints` | string[] | “Do not reimplement…” rules |
| `test_hint` | string \| null | Known RTL/query pitfalls |
| `full_docs_reference` | string \| null | Path for docs retrieval when Pi is stuck |

### Optional fields

| Field | Type | Notes |
|-------|------|-------|
| `npm_dependencies` | string[] | Packages that must be in lockfile when selected |
| `registry_dependencies` | string[] | Other resource IDs assembler must include |

## Selection record (per run)

Written at assembly time (future: `resource-selection.json` beside manifest):

```json
{
  "schema": "agentcofounder.resource_selection.v1",
  "registry_schema_version": "agentcofounder.resource.v1",
  "selected_resource_ids": ["button", "input", "dialog", "theme-default"],
  "entries": [
    {
      "id": "button",
      "type": "component",
      "content_hash": "abc123..."
    }
  ],
  "resources_md_sha256": "def456...",
  "assembled_tree_sha256": "789abc..."
}
```

## Generating `RESOURCES.md`

Template per selected entry (Markdown only — not stored in registry):

```markdown
## {name}

Import:
`{import}`

Example:
`{tiny_example}`

Use for: {use_when joined}

{constraints as bullets}

{optional Test: test_hint}
```

Theme entries use `setup` + token list instead of JSX example.

## Validation (future tooling)

- JSON Schema validate each entry
- Resolve `registry_dependencies` transitively
- Verify `files[].source` exist
- Recompute `content_hash` on CI when entries change
- Refuse assembly if npm deps missing from template lockfile

## shadcn note

shadcn is a **source format** for populating `components/` entries, not the registry schema itself. Import paths and file layout may follow shadcn conventions (`@/components/ui/*`).
