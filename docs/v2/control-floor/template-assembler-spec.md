# Template Assembler Spec

**Status:** FROZEN (2026-09-01)  
**Purpose:** Deterministically compose the application template from an immutable v2.2 base plus optional treatment overlays.  
**Replaces:** manual git reverts of `app-template/` and `protected-paths.ts` between experiments.

---

## 1. Goals

| Goal | Requirement |
|------|-------------|
| Reproducibility | Same toggle set + same overlay sources → identical assembled template |
| No contamination | Toggle **OFF** → zero files, AGENTS text, or guards from that treatment |
| Composability | Overlays are independent; combined configs are explicit |
| Audit trail | Run manifest records active toggles + layered hashes (§8) |
| Experiment discipline | Assembler is infrastructure; prereg still runs **one new overlay per experiment** |

---

## 2. Architecture

```text
app-template-base/     ← committed canonical v2.2 skeleton (never mutated per experiment)
overlays/                ← frozen treatment packages
        ↓
assembleTemplate(config) → temp/run directory ONLY
        ↓
run-challenge copies assembled tree → output/ + artifacts/
```

**`app-template-base/` is the committed canonical v2.2 source.** Do not keep mutating a working-tree `app-template/` as the experiment switch. Each run assembles into a **temporary or run-scoped directory**. That removes another contamination vector.

Working-tree `app-template/` may be deprecated, gitignored, or retained only as a dev convenience assembled from OFF/OFF — not as a hand-edited source of truth.

---

## 3. Toggle model

### 3.1 Template overlay toggles

```typescript
interface TemplateOverlayConfig {
  css_vocabulary: boolean;           // default: false
  persistence_primitive: boolean;    // default: false
  // q2_*: added when Q2 overlay exists
}
```

**Default = v2.2:** all `false`.

### 3.2 Coupled pieces per overlay

| Overlay | Template files | AGENTS section | Harness behavior |
|---------|----------------|----------------|------------------|
| `css_vocabulary` | theme `styles.css`, seed `App.tsx` (ui-* classes) | `## CSS vocabulary (preinstalled)` | `protected-paths`: CSS read/write/bash block **enabled** |
| `persistence_primitive` | `src/lib/{collectionStore,useCollection,text}.ts` | `## Collection persistence (preinstalled)` | none |
| `q2_*` (future) | TBD | TBD | TBD |

Enabling an overlay enables **all** of its coupled pieces. Partial enable is forbidden.

### 3.3 Guard implementation — one stable module

**Do not** code-generate or merge `protected-paths.ts`.

Keep **one stable** `protected-paths.ts` implementation. At runtime (or extension load), it reads the **resolved overlay config** and enables CSS theme protection only when `css_vocabulary` is active. Same source file every run; behavior varies only by config. Cleaner and easier to reproduce than fragment merge/codegen.

---

## 4. Overlay package contract

```text
overlays/<overlay-id>/
  manifest.json
  files/                 # paths relative to template root
  agents.section.md
```

### 4.1 Overlay `manifest.json`

```json
{
  "overlay_id": "css-vocabulary-v1.1",
  "version": "1.0.0",
  "content_hash": "<computed; see §7>",
  "files": [
    { "source": "files/src/styles.css", "target": "src/styles.css" }
  ],
  "replaces": ["src/styles.css", "src/App.tsx"],
  "agents_section_marker": "## CSS vocabulary (preinstalled)",
  "guard_profile": "css_vocabulary"
}
```

### 4.2 File collision policy — fail by default

**No implicit "later overlay wins."**

During assembly, if overlay B targets a path already written by base or a prior overlay:

- **Error** unless overlay B's manifest explicitly lists that path in `replaces: [...]`.
- `replaces` documents intentional overwrite (e.g. CSS replacing `src/styles.css` and `src/App.tsx`).

Assembly order is fixed (§5); collisions without `replaces` are hard failures.

### 4.3 AGENTS.md composition

1. Start with base `AGENTS.md` (core contract only).
2. For each **enabled** overlay, append `agents.section.md` (or splice at `agents_section_marker`).
3. Disabled overlays: their marker strings must be **absent** from final `AGENTS.md`.

---

## 5. Assembly algorithm

```text
assembleTemplate(overlayConfig, baseDir, overlayRoot, outDir):

  1. Empty outDir; copy app-template-base/ → outDir
  2. occupied = set of all base file paths
  3. For each overlay in FIXED_ORDER [css, persistence, q2…]:
       if not enabled: continue
       for each file in overlay.manifest.files:
         if target in occupied AND target NOT IN overlay.manifest.replaces:
           ERROR collision
         copy file → outDir
         occupied.add(target)
       merge agents.section.md into outDir/AGENTS.md
       record overlay content_hash in assembly record
  4. Compute assembled tree hash (§7)
  5. Return AssemblyRecord + resolved overlay config (for guards)
```

Fixed overlay order prevents nondeterministic merge; **collisions are errors unless declared**.

---

## 6. Integration points

| Step | After assembler |
|------|-----------------|
| `npm run challenge` | assemble → temp dir; Pi works in assembled `output/` |
| Run snapshot | copies **assembled** tree to `artifacts/runs/<id>/app-template/` |
| `protected-paths` | reads resolved `TemplateOverlayConfig`; CSS blocks on iff `css_vocabulary` |
| Experiment scripts | set env toggles only — no repo template edits |

`HarnessConfig` / `config_hash` remains for harness toggles (`harness_owned_verify`, etc.). Template overlays use a **separate hash ladder** (§7–§8).

---

## 7. Hashing (precise)

### 7.1 Overlay content hash

For each overlay package, compute `content_hash` as SHA-256 of a **canonical bundle**:

1. **Manifest JSON** with the `content_hash` field **excluded** (or set to empty string).
2. Every file listed in `manifest.files`, in **sorted `target` path order**, each preceded by its target path and NUL separator (or equivalent canonical framing).
3. Raw bytes of `agents.section.md`.
4. Guard profile identifier string (`guard_profile` value, or empty string if null).

Same inputs → same hash across machines.

### 7.2 Assembly hash ladder

Record **four distinct hashes**:

| Hash | Definition |
|------|------------|
| `base_hash` | SHA-256 of canonical bundle of `app-template-base/` tree (same file-sorting rules as today's `tree_sha256`) |
| `overlay_hashes.<id>` | Per-overlay `content_hash` (§7.1) for each **active** overlay |
| `active_set_hash` | SHA-256 of canonical JSON: `{ active toggles sorted, overlay_ids sorted, overlay_hashes sorted by id }` |
| `assembled_tree_hash` | SHA-256 of fully assembled template tree written to `outDir` |

Do not conflate `config_hash` (harness) with `active_set_hash` (template overlays).

---

## 8. Run manifest extensions

```json
{
  "template_overlays": {
    "schema": "agentcofounder.template_overlays.v1",
    "active": {
      "css_vocabulary": false,
      "persistence_primitive": true
    },
    "base_hash": "<sha256>",
    "overlay_hashes": {
      "persistence-v1": "<sha256>"
    },
    "active_set_hash": "<sha256>",
    "assembled_tree_hash": "<sha256>",
    "assembler_version": "1.0.0"
  }
}
```

Populate existing `versions.assembler` with assembler version string.

---

## 9. Frozen overlay sources (initial)

| Overlay ID | Source | Validated by |
|------------|--------|--------------|
| `css-vocabulary-v1.1` | git `b3a2771` (CSS files, AGENTS section, guard profile) | CSS v1.1 analysis |
| `persistence-v1` | registry 3 runtime files + P1 AGENTS section | P1 analysis (0/5 refresh, 5/5 adoption) |

**Base:** extracted from frozen v2.2 run snapshot  
`artifacts/runs/2026-08-31T21-16-45-263Z/app-template/`  
Byte anchors: `styles.css` = **966 B**, core `AGENTS.md` = **1,581 B**.

---

## 10. Acceptance tests (pre-Q2 gate)

| Test | Config | Expected |
|------|--------|----------|
| **T1: v2.2 exact** | CSS off, persistence off | **Entire assembled tree byte-matches `app-template-base/`** (full tree equality, not spot checks only) |
| **T2: P1 exact** | CSS off, persistence on | Base tree + 3 lib files + persistence AGENTS section; no CSS markers; CSS guards off |
| **T3: CSS exact** | CSS on, persistence off | v1.1 theme + CSS AGENTS + guards enabled; no persistence files |
| **T4: Combined** | both on | Both overlays; declared `replaces` honored; no undeclared collisions |
| **T5: Idempotent** | any config | assemble twice → identical `assembled_tree_hash` |
| **T6: Contamination** | each toggle off alone | Final tree contains **none** of that overlay's files, AGENTS markers, or guard behavior |
| **T7: Collision fail** | two overlays target same path without `replaces` | assembly **errors** |

---

## 11. Experiment protocol (unchanged)

- Q2 prereg runs against **assembled OFF/OFF** (v2.2 base).
- One new overlay per prereg experiment.
- Combined floor cohort is a **separate integration prereg** after Q2.

---

## 12. Out of scope (v1)

- `memoryStorage.ts` (future Q2 overlay)
- RESOURCES.md injection (Experiment B path) — separate unless unified later
- Auto-promoting overlays without prereg

---

## 13. Implementation sequence

```text
1. Freeze this spec
2. Implement assembler + manifest fields + guard config wiring
3. Verify T1 (OFF/OFF full tree match)
4. Q2 prereg
5. Q2 experiment
```

---

## 14. Directory layout (at implement time)

```text
app-template-base/              # committed v2.2 skeleton
overlays/
  css-vocabulary-v1.1/
  persistence-v1/
scripts/assemble-template.ts
src/v2/template-overlays.ts
```

---

**STOP** — spec only, no implementation beyond this document.
