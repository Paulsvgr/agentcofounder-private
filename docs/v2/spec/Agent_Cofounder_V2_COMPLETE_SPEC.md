# Agent Cofounder V2 — Complete Cursor Specification

This file concatenates the complete Cursor handoff pack. The individual files are easier to work with in a repository.



---

# Source document: `00_README.md`

# Agent Cofounder V2 — Cursor Handoff Pack

This folder is the working specification for a clean V2 of the private Agent Cofounder project.

The purpose is **not** to preserve the accumulated Phase F code as the architecture of the next version. The purpose is to preserve the evidence, lessons, and reproducibility of Phase F while building a cleaner research platform from the original `main` branch.

## What V2 is

V2 has two first-class systems:

1. **Build System** — a new app-building pipeline based on a Preparation/Planner agent, deterministic resource selection and assembly, a Pi build agent, deterministic guards, independent verification, and targeted repair/error memory.
2. **Analysis Station** — a measurement/research platform that captures every run, reconciles exact token usage, classifies work and phases, attributes failures and repair cost, compares runs/cohorts/branches, and lets the user drill from aggregate numbers back to the raw Pi evidence.

The research goal is not merely to make an agent that sometimes builds better apps. It is to build a system where we can answer:

> What changed? Did app quality improve? Where did the agent spend its tokens? Was the cost input, output, or cache? What failed? How expensive was that failure? Which intervention caused the difference? Can every conclusion be traced back to raw evidence?

## Recommended repository strategy

Cursor reported that the current experimental branch contains roughly **6,218 lines added, 20 deleted, across 48 files**, while the original harness behavior remains largely intact and `main` is still the clean starter. Cursor also reported **8 unpushed commits**, around **80 historical runs**, and **55 saved apps**.

Treat those repo-audit numbers as facts reported by the current local Cursor inspection and verify them before destructive actions.

Recommended action:

- Push the existing Phase F commits.
- Tag/freeze the final Phase F state.
- Preserve the 80 runs / 55 apps / session logs / result data.
- Branch V2 from clean `main`.
- Keep the old Phase F branch as read-only reference and provenance.
- Bring over concepts and evidence, not the old architecture wholesale.

## Documents

- `01_V2_MASTER_ARCHITECTURE.md` — complete product/research architecture.
- `02_ANALYSIS_STATION_SPEC.md` — exact analysis, token accounting, classification, comparison, and UI requirements.
- `03_BUILD_SYSTEM_PLANNER_ASSEMBLER.md` — Preparation Agent, profiles, plugins, components, style matching, Pi, guards, repair.
- `04_GROUND_TRUTH_TASK_SET_EXPERIMENTS.md` — harness-owned verification, held-out tasks, intervention toggles, experimental discipline.
- `05_PHASE_F_FINDINGS.md` — empirical findings we should design around, including token breakdown and Exp5b.
- `06_IMPLEMENTATION_SEQUENCE.md` — milestone order, acceptance criteria, and what not to build too early.
- `07_RESEARCH_PATTERNS_AND_DESIGN_RULES.md` — external patterns discussed: v0, shadcn registry, SWE-agent, Aider, Agentless, continual learning.

## Core constraints

1. Raw evidence is immutable.
2. Derived analysis is versioned and recomputable.
3. Token accounting must reconcile exactly before classification is trusted.
4. Evaluation truth must be harness-owned, not chosen or filtered by Pi.
5. A held-out multi-task benchmark exists before claiming an optimization works.
6. Every build intervention can be switched on/off independently.
7. Shared run data remains centrally accessible to all team members regardless of Git branch.
8. Git branches describe code variants; they are not a run database.
9. Quality and cost are both first-class outcomes.
10. Do not optimize based on a single app idea.



---

# Source document: `01_V2_MASTER_ARCHITECTURE.md`

# Agent Cofounder V2 — Master Architecture

## 1. Mission

Turn the project from an accumulation of experiment scripts into a **reproducible coding-agent research platform**.

V2 should make it possible to develop a new agent architecture, run controlled experiments on diverse app ideas, measure exact token economics, independently grade the produced application, diagnose why runs become expensive, and compare interventions without contaminating the evidence.

The platform has two coordinated halves:

- **Build System**: how a user idea becomes an application.
- **Analysis Station**: how the complete trajectory is captured, measured, classified, compared, and learned from.

Neither half should be designed as an afterthought to the other.

---

## 2. Clean-start strategy

Do **not** delete Phase F. Do **not** continue building V2 on top of the Phase F branch either.

Recommended repository shape:

```text
main
├── clean original Agent Cofounder starter
│
├── setup/measure or phase-f-final
│   └── frozen historical research implementation
│
└── v2
    ├── capture/
    ├── analysis/
    ├── evaluation/
    ├── experiments/
    ├── planner/
    ├── resources/
    ├── assembler/
    ├── guards/
    ├── repair/
    └── ui/
```

Before branching:

- Push the current 8 Phase F commits reported by Cursor.
- Create a stable tag such as `phase-f-final`.
- Ensure the historical run data is backed up.
- Record the exact commit that produced every historical run whenever that information exists.

The raw run data may live outside Git, but **its provenance must point back into Git**.

---

## 3. End-to-end V2 flow

```text
USER APP IDEA
      │
      ▼
PREPARATION / PLANNER AGENT                 [toggle]
      │
      │ structured BuildSpec
      ▼
RESOURCE RESOLUTION
      ├── profile matcher                    [toggle]
      ├── component/block resolver           [toggle]
      ├── integration/plugin resolver        [toggle]
      ├── style/theme matcher                [toggle]
      ├── docs/example retrieval             [toggle]
      └── test-contract retrieval            [toggle]
      │
      ▼
DETERMINISTIC ASSEMBLER
      │ prepares a known-valid starting app
      ▼
PI BUILD AGENT
      │ writes only the app-specific remainder
      ▼
DETERMINISTIC GUARDS                         [toggle]
      ├── imports/dependencies
      ├── syntax/types
      ├── component/plugin contracts
      ├── known deterministic corrections
      └── forbidden/noncompliant behavior
      │
      ▼
PI'S DEVELOPMENT TESTS
      │ recorded as agent behavior, not truth
      ▼
HARNESS-OWNED ACCEPTANCE / GROUND TRUTH
      │ independent commands and evidence
      ├──────── PASS ───────► VERIFIED CHECKPOINT / FINAL APP
      │
      └──────── FAIL
                │
                ▼
          ERROR CLASSIFIER
                │
      ┌─────────┼───────────┐
      ▼         ▼           ▼
 deterministic known       specialist / targeted
 fix          memory       repair pattern
      └─────────┼───────────┘
                ▼
           PI REPAIR only if needed
                │
           bounded attempts
```

The Analysis Station observes the **entire trajectory**, including Planner cost and all later calls.

---

## 4. Preparation / Planner Agent

The Planner is a separate intelligent stage. It should understand the user's intention but **must not build the application itself**.

Its output is a structured `BuildSpec`, not source code.

A conceptual schema:

```json
{
  "appType": "booking",
  "goals": ["create bookings", "view bookings", "cancel bookings"],
  "entities": ["booking", "customer"],
  "state": {
    "persistence": "local_or_remote",
    "requirements": ["survives refresh"]
  },
  "capabilities": ["calendar", "forms", "filters"],
  "integrations": ["supabase", "stripe"],
  "uiNeeds": ["calendar", "dialog", "select", "table"],
  "testNeeds": ["persistence", "validation", "booking lifecycle"],
  "designIntent": {
    "keywords": ["elegant", "minimal", "black and white"]
  },
  "constraints": [],
  "unknowns": []
}
```

The exact schema can evolve; the architectural boundary should not.

### Planner design rule

Do **not** dump the entire component/plugin/theme library into the Planner prompt.

Correct flow:

```text
user prompt
→ Planner extracts needs
→ search/matching operates on those needs
→ deterministic system fetches actual resources
```

This keeps Planner context smaller and separates reasoning from retrieval.

---

## 5. Resource resolution and dynamic app template

Avoid hundreds of monolithic templates. Use a composable starting environment:

```text
Base App
+ optional Build Profile
+ reusable Components / Blocks
+ Integration Plugins
+ short Docs / Skills
+ Test Contracts
+ Style / Theme
```

### Profiles

A profile should encode a useful architectural starting pattern, not hard-code one benchmark prompt.

Examples later might include:

- flat local CRUD
- dashboard
- booking/scheduling
- authenticated SaaS
- API-backed data app

Exp5b may inform a future simple CRUD/local-storage profile, but it should **not** automatically be treated as the universal or first profile. It is evidence from one app family.

### Resource manifest

Every reusable resource should expose enough metadata for deterministic resolution and validation:

```text
name
version
kind
capabilities
files
dependencies
peer dependencies
environment variables
registry dependencies
integration points
conflicts
compatible profiles
usage contract
accessibility contract
test contract
known failure patterns
```

Pin versions where behavior matters so documentation, generated imports, tests, and repair memory refer to the same world.

---

## 6. UI components and blocks

Prefer verified reusable UI primitives/blocks instead of asking Pi to recreate common controls.

Potentially leverage the shadcn registry model rather than inventing every registry primitive from zero.

For a selected resource, Pi should receive a **small semantic contract**, for example:

```text
Calendar
Import: @/components/ui/calendar
Purpose: date selection
Important props: mode, selected, onSelect
Accessibility: labelled date control
Testing: role/label/scoped-query guidance
Known gotchas: selected can be undefined
```

Do not inject the full implementation or thousands of documentation tokens unless Pi requests them.

Goal:

- lower output generation
- fewer wrong imports
- fewer inconsistent custom controls
- fewer accessibility/query problems
- fewer downstream repair loops

---

## 7. Styling architecture

Styling is separate from build reasoning.

The Planner extracts design intention:

```text
"elegant, minimalist, black and white"
```

A separate matcher chooses the closest theme/style template from a library.

All themes expose the same semantic token API, preferably shadcn-like semantics:

```text
background
foreground
primary
primary-foreground
secondary
muted
accent
destructive
card
border
input
ring
radius
```

Pi should use semantic classes/tokens rather than hard-coding colors across the application.

Use a hybrid model: common semantic styles are reusable, while Pi remains free to create app-specific layout classes such as `.booking-grid` or `.book-item` when useful.

The purpose is not to eliminate every line of CSS. It is to reduce expensive repeated output and make visual behavior more predictable.

---

## 8. Deterministic assembler

Assembly should use **no LLM**.

Given the resolved resource set, it should:

- start from a clean base app
- install/copy selected resources
- merge dependencies safely
- add required configuration
- add environment-variable declarations
- wire known integration points
- attach concise contracts/docs
- attach test patterns
- validate conflicts and versions
- stop before Pi if the combination is invalid

The assembler should produce an explicit assembly manifest so the analysis system knows exactly what Pi received before its first call.

---

## 9. Pi build agent

Pi remains the main coding agent under the hackathon harness.

The new architecture should make Pi spend its intelligence on the **novel app-specific remainder**, not on rediscovering known boilerplate.

Pi should know:

- the user's original intent
- the structured build plan it needs
- what resources already exist
- exact import/API contracts
- relevant short docs and warnings
- what acceptance requirements must be satisfied

Pi should not need to decide whether common infrastructure exists when the deterministic preparation layer can tell it exactly what exists.

---

## 10. Prevention before repair

A central V2 principle:

> If a failure can be made impossible or fixed deterministically before Pi sees it, do that instead of spending another large-model turn on repair.

Potential guards:

- invalid imports / unavailable exports
- missing dependency declarations
- syntax failures
- TypeScript failures that are mechanically resolvable
- known plugin wiring requirements
- semantic component contracts
- disallowed dev-server/process behavior
- known test anti-patterns

This layer must be separately toggleable in experiments.

---

## 11. Repair and Error Memory

Error Memory is a side subsystem, not a permanently active third heavyweight agent.

Capture raw failures automatically.

For a failure:

1. classify error type/signature
2. attach relevant stack context: profile, plugins, versions, dependencies, files
3. try deterministic correction if one exists
4. search verified historical fixes
5. provide Pi a short targeted hint/fix only when relevant
6. verify the result
7. store a new memory only after verification, ideally FAIL → PASS

Never promote an unverified attempt into reusable memory.

Start with structured signatures before assuming a large embedding database is necessary:

```text
error_type
framework
plugin
package
version
message_signature
source_location_pattern
```

Embeddings can be added for fuzzy similarity after deterministic retrieval is measured.

Repair should have a budget. Endless `test → repair → test → repair` loops are exactly the cost pattern we want to eliminate.

---

## 12. Harness-owned ground truth

Pi's chosen tests are part of **behavior telemetry**, not the authoritative evaluation.

The harness needs an independent verification path that Pi cannot truncate or redefine:

- canonical test/acceptance commands
- raw unfiltered outputs
- reliable exit codes
- independent build result
- browser/port validation where required
- persistence verification where required
- quality rubric results

If Pi runs `vitest -t`, pipes through `tail`, or chooses a different reporter, record that behavior — but do not let it redefine whether the application is actually correct.

---

## 13. Analysis Station

Every stage writes immutable/raw evidence. Derived analysis sits above it.

The core data path:

```text
raw Pi / harness evidence
→ normalized calls
→ exact usage reconciliation
→ phase classification
→ work classification
→ error / repair attribution
→ aggregation
→ comparisons
→ dashboard
```

See `02_ANALYSIS_STATION_SPEC.md` for the full specification.

---

## 14. Shared team model

Continue using the existing shared server-backed run storage if it already provides cross-team access.

Example:

```text
Developer A on branch A ─┐
Developer B on branch B ─┼→ shared run storage → Analysis Station
Developer C on branch C ─┘
```

Every run must include the Git commit/branch/config that produced it.

Git branches are for implementation variants. The shared server is for experiment evidence.

---

## 15. Quality model

Cost cannot be optimized without app quality.

Retain/implement the 100-point application-quality framework discussed:

- Usability & UX — 30
- Data & State Persistence — 20
- Robustness — 20
- API & Internal Integration Readiness — 15
- Maintainability & Extensibility — 15

The station should make comparisons such as:

```text
Run A: 54k weighted, quality 71
Run B: 61k weighted, quality 91
```

rather than treating the lowest-token run as automatically best.

---

## 16. Scientific requirement: independent toggles

Every intervention must be independently configurable from day one.

At minimum:

```text
planner: on/off
profiles: on/off
component_assembly: on/off
plugin_assembly: on/off
theme_matching: on/off
test_contracts: on/off
deterministic_guards: on/off
error_memory: on/off
```

Do not build a single bundled "V2 mode" and attempt to infer causality afterwards.

Every run stores the exact intervention configuration.

---

## 17. Scientific requirement: diverse + held-out tasks

Do not evaluate the new system on only the book-lending idea.

Create:

- a development task set used for iteration
- a held-out task set not used to tune profiles/resources/rules

The set should vary along meaningful axes:

- simple CRUD vs multi-step workflows
- local vs remote persistence
- forms/validation
- filtering/search
- dialogs/selects/calendars
- auth/integrations
- dashboards/data display
- error states
- responsive/accessibility requirements

The exact set should be frozen/versioned before comparative claims are made.

---

## 18. Definition of success

V2 succeeds when it can produce statements like:

> Enabling Planner + component assembly added 4,200 weighted preparation tokens but reduced Pi UI output by 18,000 weighted, eliminated two Testing Library repair loops, reduced cache-read cost by 31,000 weighted, and improved held-out quality from 82 to 89. The result reproduces across N tasks and every number can be traced to raw evidence.

That is the level of explanation the platform is intended to provide.



---

# Source document: `02_ANALYSIS_STATION_SPEC.md`

# Agent Cofounder V2 — Analysis Station Specification

## 1. Purpose

The Analysis Station is not just a dashboard. It is the **measurement backbone and research notebook** for every agent run.

It must answer four levels of question:

1. **Run level** — How expensive/good was this run?
2. **Segment level** — What work consumed the tokens?
3. **Trajectory level** — When and why did cost snowball?
4. **Evidence level** — Which exact Pi calls/events support the number?

---

## 2. Non-negotiable milestone: exact reconciliation

Before activity classification is considered valid, prove:

```text
SUM(normalized assistant-call input tokens)      = official run input
SUM(normalized assistant-call output tokens)     = official run output
SUM(normalized assistant-call cache-read tokens) = official run cache-read
```

Then:

```text
weighted = input * W_input
         + output * W_output
         + cache_read * W_cache
```

Current research weights:

```text
W_input = 1.0
W_output = 3.0
W_cache = 0.1
```

Weights must be configurable and versioned; raw token values never change.

### Reconciliation behavior

Every analyzed run receives a status:

```text
EXACT
MISMATCH
INCOMPLETE_RAW_DATA
UNSUPPORTED_FORMAT
```

Never silently "fix" or approximate a mismatch.

Store the discrepancy fields so failures in the parser become visible.

---

## 3. Immutable raw evidence

Keep raw artifacts unchanged:

- Pi session JSONL
- raw event stream
- tool events/results
- original user idea
- system prompt / skill if available
- result metadata
- harness test/build evidence
- saved final app
- exact Git commit/config/model metadata

The normalized schema is a derived projection. The classifier is another derived projection. Both can be rebuilt later.

---

## 4. Normalized call model

Each assistant/model turn should become one normalized record.

Conceptual schema:

```json
{
  "runId": "...",
  "callIndex": 17,
  "timestampStart": "...",
  "timestampEnd": "...",
  "provider": "zai",
  "model": "glm-5.2",
  "usage": {
    "input": 913,
    "output": 405,
    "cacheRead": 18048,
    "cacheWrite": 0
  },
  "tools": [
    {
      "name": "bash",
      "command": "npx vitest run ...",
      "exitCode": 1
    }
  ],
  "filesRead": [],
  "filesWritten": [],
  "filesEdited": [],
  "phase": null,
  "workType": null,
  "classifierVersion": null,
  "sourceRefs": []
}
```

The normalized record should preserve enough source pointers to reconstruct the exact raw evidence used.

---

## 5. Two independent classification axes

Do not force phase and work type into one label.

### Phase axis

Initial recommended phases:

- `recon_plan` — before first project-code write
- `initial_build` — first project-code write through first canonical full-suite test
- `repair_debug` — after a canonical full-suite failure until first verified full-suite pass
- `verify_finalize` — first verified pass onward

This definition must be tied to **harness-owned/canonical full-suite semantics**, not any filtered command Pi happens to run.

Later phases can be refined, but version them.

### Work-type axis

Recommended initial work labels:

- `read_inspect`
- `plan_reason`
- `logic_data`
- `ui_jsx`
- `styling_css`
- `test_code`
- `test_build_run`
- `build_verify`
- `config_other`
- `report_finalize`
- `unclassified`

The initial labels come directly from the Phase F analysis we already performed. Preserve continuity so historical and future runs can be compared.

---

## 6. Automatic classification strategy

Use layered classification, cheapest and most explainable first.

### Layer A — deterministic rules

Examples:

- command contains canonical `vitest run` / `npm test` → test execution
- dominant write path ends in `.css` → styling
- dominant write path is `*.test.ts(x)` → test code
- write/edit under React component path → UI/JSX candidate
- package/config file → config
- read-only shell/cat/find activity → read/inspect candidate

### Layer B — sequence/state rules

A single call may only make sense in context.

Example:

```text
full-suite FAIL
→ read failing test
→ inspect component
→ edit test/component
→ rerun
```

This sequence is repair/debug even if one individual call is a simple file read.

### Layer C — lightweight AI classifier

Only use an LLM/small classifier for ambiguous calls that deterministic rules cannot classify confidently.

Requirements:

- record classifier model/version
- record confidence
- keep raw evidence
- allow reclassification later
- measure classification cost separately from app-building cost

Analysis AI must never contaminate the official build token metric.

---

## 7. Token reporting per segment

Every work type and phase must expose both **raw** and **weighted** components.

Example table shape:

| Work type | Input raw | Output raw | Cache raw | Input weighted | Output weighted | Cache weighted | Total weighted | Share |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| UI/JSX | ... | ... | ... | ... | ... | ... | ... | ... |

Also show the internal cost composition:

```text
UI/JSX total = 65% output-weighted + 21% cache-weighted + 14% input-weighted
```

This is essential because two categories with the same total require completely different optimizations.

Example interpretation:

- output-heavy category → templates/components/patterns may help
- cache-heavy category → reduce number of turns, repairs, and reinspection
- input-heavy category → reduce context/document loading

---

## 8. Repair trajectory analysis

The station must make repair a first-class object.

Capture:

- first canonical failure
- failure signature(s)
- first observed failing generation
- calls since failure
- inspection calls
- edits
- partial test probes
- canonical reruns
- first verified pass
- post-green verification
- repair token cost
- repair input/output/cache breakdown
- number of strategy changes

Recommended derived metrics:

```text
repair_calls
repair_weighted
repair_output_weighted
repair_cache_weighted
time_to_first_failure
time_failure_to_green
same_generation_test_reruns
test_reinspection_calls
partial_suite_probes
post_verified_verification_calls
```

Do not use a Pi-selected `tail/grep` output as the ground truth of the failure.

---

## 9. Error taxonomy and cost attribution

Initial error classes based on Phase F:

- `testing_library_query_assertion`
- `persistence_storage`
- `import_module_path`
- `test_infrastructure`
- `build_config`
- `runtime_syntax`
- `typescript`
- `dependency`
- `accessibility_ui`
- `behavior_assertion`
- `unknown`

Measure **both frequency and economic impact**.

A useful view:

| Error class | Occurrences | Runs affected | Repair weighted | Mean repair | Median repair | Cache share |
|---|---:|---:|---:|---:|---:|---:|

An error that happens once but causes a 50k repair tail can deserve higher priority than a frequent 1k warning.

---

## 10. Harness-owned evaluation evidence

Keep two distinct streams:

### Agent behavior stream

What Pi chose to do:

- commands it ran
- reporters it chose
- output it piped/truncated
- targeted tests
- debug files
- reads/edits

### Evaluation truth stream

What the harness independently observed:

- canonical acceptance tests
- full test results
- full build result
- real exit codes
- browser-level behavior
- persistence behavior
- quality rubric

The UI should let us compare them. A key research question is sometimes precisely that Pi thought something was green while the independent evaluator disagreed.

---

## 11. Provenance schema

Each run should store at least:

```text
run_id
created_at
team_member / runner identity if desired
branch
commit_sha
experiment_id
cohort/treatment
rep_number
intervention_config
idea_text
idea_hash
task_id
task_set_version
held_out flag
system_prompt_hash
skill_hash
template/base_app_hash
lockfile_hash
model
provider
reasoning setting
max tokens
context-window settings
resource manifest hash
planner version
assembler version
guard version
error-memory version
classifier version
analysis version
```

Do not rely on filenames or human memory for provenance.

---

## 12. Comparison engine

First-class comparisons:

- run vs run
- run vs cohort median
- treatment vs control
- experiment vs experiment
- branch vs branch
- commit vs commit
- profile vs profile
- model/provider vs model/provider
- task family vs task family
- dev vs held-out

Comparison output should explain the delta, not only display it.

Example:

```text
Run A is +54,700 weighted vs Run B.
Main contributors:
+31,200 cache-weighted from 4 extra test/repair calls
+12,400 output-weighted from rewritten test code
+7,800 input-weighted from repeated file inspection
+3,300 other
```

Allow drill-down from each delta to the actual calls.

---

## 13. Analysis Station UI

Recommended top-level screens:

### Runs

Table with:

- task/idea
- experiment/treatment
- branch/commit
- status
- quality score
- weighted total
- raw input/output/cache
- calls
- repair cost
- time-to-green

### Run detail

- timeline of calls
- phase bands
- work-type classification
- token stack per call
- test/failure events
- file activity
- exact raw-event links
- app preview/artifact links where available

### Compare

Select 2+ runs/cohorts and show:

- cost delta
- quality delta
- work-type delta
- phase delta
- input/output/cache delta
- error/repair delta
- trajectory/timeline comparison

### Experiments

- configuration
- treatment/control definition
- repetitions
- task coverage
- medians/distributions
- quality gate
- token economics
- outcome status

### Errors

- error families
- frequency
- weighted repair cost
- affected resources/plugins
- verified fixes/memory status

### Tasks

- task set version
- development vs held-out
- app family
- requirements
- coverage

---

## 14. Re-analysis/versioning

Never persist only the final label.

Store something like:

```text
analysis_run_id
source_run_id
parser_version
classifier_version
weights_version
error_taxonomy_version
created_at
```

This allows:

```text
80 old runs
→ classifier v1
→ later classifier v2
→ recompute all derived tables
```

No expensive Pi rerun required.

---

## 15. Data-quality dashboard

Before showing research conclusions, expose measurement health:

- reconciliation pass rate
- raw-data completeness
- unknown/unclassified share
- classifier confidence distribution
- missing provenance fields
- acceptance-capture failures

Research charts should be visually marked when their source set includes incomplete/unreconciled runs.

---

## 16. Definition of done for the first Analysis Station release

V2 Analysis v0 is complete when:

1. Historical raw runs can be ingested.
2. Exact token totals reconcile for supported runs.
3. Every call can be opened from the UI.
4. Work type and phase are automatically classified.
5. Every category shows input/output/cache raw + weighted.
6. Repair sequences and error classes are visible.
7. Two runs can be compared and their cost delta explained.
8. Derived analysis can be deleted and recomputed without touching raw evidence.
9. Classifier/weights/parser versions are stored.
10. The system can ingest a new run automatically when the existing shared server receives it.



---

# Source document: `03_BUILD_SYSTEM_PLANNER_ASSEMBLER.md`

# Agent Cofounder V2 — Build System: Preparation Agent, Resources, Assembly, Pi, Guards

## 1. Goal

The build-system hypothesis is:

> Pi becomes cheaper and more reliable when the environment is prepared so it assembles known-valid resources and spends generation only on the genuinely app-specific work.

This hypothesis must be tested rather than assumed.

---

## 2. Preparation Agent / Planner

One LLM call receives the original app idea and returns structured intent.

It identifies:

- app type / likely profile
- user goals and workflows
- entities/data model needs
- state/persistence requirements
- UI capabilities
- integrations
- validation/error behavior
- testing requirements
- accessibility concerns
- design intention
- constraints/unknowns

It should **not** choose concrete library item IDs from a 50-template list by reading the whole library.

It should say:

```text
Design intent: elegant, monochrome, minimal, restrained
Needs: calendar, dialog, select, booking list
Integration: Supabase
Persistence: remote database
```

Then a separate matching system chooses concrete resources.

### Measure Planner economics separately

Store:

```text
planner_input
planner_output
planner_cache
planner_weighted
planner_latency
planner_spec_size
```

The central experiment is whether preparation cost is repaid later by lower Pi cost and/or higher quality.

---

## 3. Resource resolution

After Planner output, use deterministic and retrieval logic.

Possible order:

1. exact capability filters
2. dependency/version compatibility filters
3. profile compatibility
4. keyword matching
5. embeddings for fuzzy intent where useful
6. deterministic ranking/tie-breaking

Do not make an LLM call just to copy files or choose between exact compatible resources when rules can do it.

---

## 4. Build profiles

Profiles should encode architectural starting points, not finished apps.

A profile can supply:

- directory structure
- state/persistence boundary
- known hooks/services
- base tests
- conventions
- recommended resources
- concise Pi guidance

Potential examples:

```text
basic-local-crud
booking
api-dashboard
authenticated-saas
```

Do not overfit a profile to one benchmark prompt.

Evaluate profiles on held-out tasks of the same broad family and on adjacent families.

---

## 5. Integration plugins

Examples:

- Supabase
- Stripe
- Firebase
- Google Maps
- Google Auth

Each plugin should be a controlled resource with a manifest.

Minimum plugin content:

```text
implementation/starter code
pinned dependencies
configuration
env vars
short docs
skills/instructions
integration contract
tests/test contract
known failure patterns
version compatibility
conflicts
```

The assembler validates combinations before Pi starts.

Do not promise that arbitrary plugins can never conflict. Detect and reject known-incompatible combinations deterministically.

---

## 6. Reusable UI components and blocks

Use reusable components for common controls and composed blocks where this reduces improvisation.

Examples:

```text
Button
Input
Select
Dialog
Calendar
Table
Form field
Empty state
Search/filter toolbar
```

The resource presented to Pi should have a concise API contract rather than forcing Pi to rediscover it.

A resource can include:

```text
import path
props / usage
accessibility expectations
test pattern
known errors
style-token dependencies
```

A shadcn-compatible registry is a strong candidate because it already has concepts for files, dependencies, registry dependencies, components, blocks, templates, and semantic design conventions.

Whether V2 directly uses shadcn registry format or adopts a compatible internal manifest should be an explicit architectural decision.

---

## 7. Test contracts are part of resources

The Phase F data makes this important.

Do not treat tests as something Pi must invent independently after the component is selected.

For a reusable resource, include guidance such as:

```text
Preferred queries:
- getByRole
- getByLabelText
- within(scope)

Avoid:
- broad getByText when repeated text is expected
```

A component's test contract should describe its stable semantic surface, not prescribe fragile implementation details.

This can reduce both:

- test-code output
- Testing Library repair loops

---

## 8. Style/theme system

### Planner responsibility

Extract design intent.

### Style matcher responsibility

Choose the nearest compatible theme from the library.

### Theme responsibility

Expose a stable semantic API.

Example:

```text
background
foreground
primary
primary-foreground
secondary
muted
accent
card
border
input
ring
destructive
radius
```

A black/red theme and a cream/green theme can expose the same semantic contract.

Pi writes semantic usage, not scattered hex colors.

### Important limitation

Do not try to eliminate all app-specific CSS/layout. The better model from the real runs is hybrid:

- reusable semantic design system for common primitives
- app-specific layout CSS allowed when genuinely specific

---

## 9. Deterministic assembler

The assembler owns mechanical work.

Inputs:

```text
BuildSpec
selected profile
selected plugins
selected UI resources
selected theme
retrieved docs/contracts
```

Outputs:

```text
prepared app workspace
assembly-manifest.json
Pi context/manifest
validation report
```

Responsibilities:

- copy/install files
- merge package dependencies
- maintain pinned versions
- resolve registry dependencies
- create configuration
- inject theme tokens
- attach tests/contracts where appropriate
- validate imports/resources
- detect conflicts
- produce deterministic result from same inputs

The assembler should not invoke AI.

---

## 10. Pi input contract

Pi should be told exactly what has already been prepared.

Example concise manifest:

```text
Profile: booking-v1
Persistence: Supabase client configured at src/lib/supabase.ts
Components:
- Calendar: @/components/ui/calendar
- Dialog: @/components/ui/dialog
- Select: @/components/ui/select
Theme: elegant-monochrome-v3
Tests: booking lifecycle acceptance contract available
Known warnings:
- do not use broad getByText for repeated booking labels
- Calendar selected value can be undefined
```

Do not inject full source implementations unless required.

---

## 11. Deterministic guards

Run cheap/preventive checks before expensive agent repair where possible.

Candidate checks:

- generated imports resolve
- package dependencies exist
- no unavailable icon/component export
- TypeScript parse/basic type gate
- JSX parse
- known provider/wrapper required
- plugin environment schema
- resource manifest consistency
- forbidden process commands/harness violations

A deterministic guard can either:

- auto-correct a mechanically safe issue
- reject the edit/resource
- produce a concise diagnostic for Pi

Track every guard action in telemetry and make the guard layer independently toggleable.

---

## 12. Verification

Two distinct notions:

### Development verification

Commands Pi chooses while building.

Useful to understand agent behavior.

### Acceptance verification

Harness-owned, canonical and independent.

Used to judge the final app and define real green.

The Analysis Station should preserve both.

---

## 13. Error Memory

The first V2 Error Memory should be deliberately small and measurable.

Store only verified episodes:

```text
normalized error signature
context fingerprint
relevant plugin/profile/version
verified fix
verification evidence
frequency
last seen
```

On future errors:

```text
exact signature lookup
→ structured similarity
→ optional embedding similarity
→ return short verified hint
```

Do not inject a giant list of historical warnings into every Pi prompt.

Retrieve only relevant high-confidence guidance.

Potential future extension: proactive warnings for the most common stack-specific mistakes, but only if experiments show they save more than they cost.

---

## 14. Bounded repair

Avoid unlimited retries.

Conceptual policy:

```text
failure
→ deterministic fix if possible
→ targeted repair 1
→ verify
→ targeted repair 2
→ verify
→ targeted repair 3 / strategy change
→ verify
→ stop/escalate if still broken
```

The exact count should be tested, not hard-coded forever.

When a verified green checkpoint exists, protect it from later unverified changes.

---

## 15. Everything is an experiment toggle

The architecture must make it easy to create configurations such as:

```text
baseline
planner_only
planner_plus_profile
planner_plus_components
planner_plus_components_plus_test_contracts
planner_plus_components_plus_theme
planner_plus_guards
full_stack_without_memory
full_stack_with_memory
```

Do not let modules depend on hidden global state that makes ablation impossible.

---

## 16. What we expect to learn

The system is intended to test hypotheses such as:

- Does Planner cost less than it saves in downstream Pi calls?
- Do reusable components reduce UI output?
- Do test contracts reduce Testing Library failures?
- Do themes reduce CSS output without reducing quality?
- Do deterministic guards reduce repair/cache snowball?
- Do profiles generalize beyond the task they were designed from?
- Does Error Memory help only repeated stacks/errors or also held-out tasks?
- Which combination maximizes quality per weighted token?



---

# Source document: `04_GROUND_TRUTH_TASK_SET_EXPERIMENTS.md`

# Agent Cofounder V2 — Ground Truth, Task Set, and Experimental Protocol

## 1. Why this document exists

Phase F produced useful discoveries, but it also exposed three methodological risks that V2 must remove architecturally:

1. the agent could influence what test evidence was visible
2. many experiments reused the same application idea
3. multiple interventions could become chained together and make attribution difficult

V2 should make those failure modes difficult by construction.

---

## 2. Harness-owned ground truth

### Principle

Pi cannot own the definition of success.

Pi may run whatever development commands the harness permits. Those commands are recorded as behavior. Separately, the harness runs its own canonical acceptance checks.

### Ground-truth capture requirements

- canonical command(s) defined outside Pi's control
- no `tail`, `head`, `grep`, or shell pipeline capable of hiding the real failure
- real process exit code captured directly
- complete machine-readable result where possible
- bounded/sanitized human-readable diagnostic generated by the harness, not by truncation
- build check
- runtime/startup/port check when required
- browser-level acceptance checks where the challenge grades through a real browser
- persistence/refresh behavior checked independently
- raw artifacts retained

### Pi reporter vs harness reporter

Pi's chosen reporter is not authoritative.

The harness should be able to impose the reporter or invoke the acceptance suite with its own explicit reporter/output channel.

---

## 3. Full-suite semantics

Define a single canonical meaning of "full suite".

Examples of commands that may count:

```text
npm test
npm run test
unfiltered vitest run
```

Examples that must **not** automatically count:

```text
vitest run -t "adds a book"
vitest run src/debug.test.tsx
grep/tail-filtered probes if they alter evidence semantics
```

Store whether a Pi test call was:

```text
canonical_full
partial_targeted
ad_hoc_debug
unknown
```

Ground-truth green comes only from the independent acceptance path.

---

## 4. Quality evaluation

Use both automated acceptance and a stable quality rubric.

Current 100-point rubric:

- Usability & UX: 30
- Data & State Persistence: 20
- Robustness: 20
- API & Internal Integration Readiness: 15
- Maintainability & Extensibility: 15

If any rubric component is automatically scored, version the evaluator and retain its raw evidence.

Never turn a harness status proxy into a claim about true app quality without labeling it clearly.

---

## 5. Task set before optimization claims

The first benchmark should be created before tuning the new Planner/profile/resource system against it.

Use two partitions:

### Development set

Visible to the team and used to design/fix the system.

### Held-out set

Frozen tasks not used to author profile-specific rules or resource choices.

The held-out set is the main defense against "we built the world's best book-lending harness."

---

## 6. Suggested task dimensions

The task set does not need hundreds of ideas initially. It needs **coverage diversity**.

Cover dimensions such as:

### Data/state

- no persistence
- localStorage persistence
- structured local persistence
- remote database

### UI

- simple CRUD list
- filters/search
- dialog/modal
- select/dropdown
- calendar/date selection
- table/dashboard
- multi-step form

### Behavior

- validation
- edit/delete
- status transition
- derived counters
- sorting/filtering
- optimistic/error state

### Integrations

- none
- auth
- database
- external API
- payments where appropriate

### Quality pressure

- accessibility names
- responsive layout
- malformed stored data
- refresh persistence
- empty/error/loading states

Task IDs and task-set version must be stored with every run.

---

## 7. Experimental unit

A run should be defined by an immutable configuration:

```text
task_id
code commit
provider/model settings
planner on/off + version
profile on/off + selected version
components on/off + registry/resource versions
theme on/off + selected version
test contracts on/off
guards on/off + version
error memory on/off + snapshot/version
random/seed controls where available
```

If any of these differs, the run belongs to a different configuration.

---

## 8. Independent intervention switches

Required from the architecture itself:

```text
planner
profile_matcher
plugin_resolver
component_resolver
theme_matcher
test_contracts
deterministic_guards
error_memory
```

Each can be disabled without rewriting source code.

Why this matters:

```text
Full V2 beats baseline
```

is much less scientifically useful than:

```text
Planner alone: +quality, +small cost
Components: -UI output, -repair
Test contracts: -test output, -query failures
Theme: -CSS output, neutral quality
Guards: -repair/cache
Memory: helps repeated stack errors only
```

---

## 9. Recommended experiment progression

Do not begin with a giant factorial test of every switch.

### Stage A — measurement validation

No new agent intervention.

- ingest historical runs
- reconcile tokens
- validate acceptance capture
- validate classifier

### Stage B — fresh baseline

Run clean baseline across the task set to establish current variance.

### Stage C — single-variable interventions

Examples:

```text
baseline vs planner
baseline vs components
baseline vs test contracts
baseline vs theme
baseline vs guards
```

### Stage D — combinations supported by evidence

Combine interventions that independently helped.

### Stage E — held-out evaluation

Freeze the chosen configuration and test on held-out tasks.

### Stage F — robustness/repetition

Repeat enough runs to distinguish real effects from stochastic model variance.

---

## 10. Primary outcomes

Prioritize outcomes in this order:

1. **Quality/reliability gate**
2. **Mechanism metric** tied to the intervention
3. **Behavioral trajectory**
4. **Economics**
5. **Final aggregate outcome**

Example for test contracts:

```text
1. quality remains acceptable
2. ambiguous query/test-code errors fall
3. repair/test reruns fall
4. output/cache savings exceed added contract input
5. weighted total improves
```

This prevents declaring an intervention bad because it adds 1k input while removing a 20k repair tail.

---

## 11. Compare distributions, not anecdotes

The station should show:

- individual runs
- median
- mean
- spread/IQR
- min/max
- CLEAN/green rate
- quality distribution
- repair-tail distribution

Use statistical tests only when sample size and question justify them. Do not hide raw run points behind a single mean.

---

## 12. Historical data as regression suite

The reported 80 historical runs are a major V2 asset.

Use them immediately to test:

- parser compatibility
- token reconciliation
- classifier stability
- failure taxonomy
- UI scalability
- provenance gaps

Historical runs cannot retroactively provide evidence that was never captured, so mark missing ground-truth fields explicitly.

Do not fabricate new evaluation evidence for old runs.

---

## 13. Data and code provenance

Raw run data can live on the existing shared server/disk store. Every run should point to:

```text
commit SHA
branch
task version
experiment config
model config
resource versions
analysis source version
```

If a run's code provenance is unknown, mark it as such rather than inferring it.

---

## 14. No experiment-specific hacks in core analysis

Core parser/classifier/evaluator code should not contain logic like:

```text
if experiment == "Exp5b": ...
```

Experiment definitions belong in configuration/metadata.

The analysis engine should operate on normalized behavior and evidence independent of experiment name.

---

## 15. Experiment report template

Every experiment should automatically generate a report containing:

```text
Hypothesis
Treatment/control definitions
Task set/version
Run count
Quality gate
Primary mechanism metric
Token totals
Input/output/cache decomposition
Phase decomposition
Work-type decomposition
Repair/error decomposition
Per-run distribution
Unexpected behavior
Conclusion: keep / reject / inconclusive
Next experiment
```

This report is derived from the same raw run data and versioned analysis used by the dashboard.



---

# Source document: `05_PHASE_F_FINDINGS.md`

# Agent Cofounder V2 — Phase F Findings to Preserve

## 1. Purpose

These findings are the empirical reason for several V2 design choices. They should be preserved as historical evidence, not copied blindly as architectural assumptions.

There are two different counts in our current context:

- Cursor reports around **80 historical runs / 55 saved apps** in the private project data.
- Our recent detailed token/work-type analysis used **33 unique raw Pi sessions that were directly available and verifiable in the supplied/exported material**.

Do not conflate those populations. V2 should ingest the full historical corpus and produce its own authoritative counts.

---

## 2. Token weighting used in current analysis

```text
weighted = input * 1
         + output * 3
         + cache_read * 0.1
```

Raw values remain more important than the formula because weights may change later.

---

## 3. Aggregate findings across 33 verified sessions

Current analyzed totals:

```text
Input raw:      790,100
Output raw:     446,970
Cache read:  17,642,688

Input weighted:   790,100     20.3%
Output weighted: 1,340,910    34.4%
Cache weighted:  1,764,269    45.3%

Total weighted:  3,895,279
```

### Key lesson

Although cache is weighted at only 0.1, long trajectories make it the largest total weighted component.

This means optimization cannot focus only on reducing generated text. Reducing repeated model calls and repair trajectories can dominate.

---

## 4. Aggregate work-type breakdown

| Work type | Input raw | Output raw | Cache raw | Weighted total | Share |
|---|---:|---:|---:|---:|---:|
| Test execution | 168,518 | 37,352 | 6,160,000 | 896,574 | 23.0% |
| Test writing/editing | 119,575 | 109,277 | 2,944,960 | 741,902 | 19.0% |
| UI / React / JSX | 116,474 | 111,047 | 1,830,336 | 632,649 | 16.2% |
| Read / inspect | 170,800 | 20,702 | 2,620,800 | 494,986 | 12.7% |
| App logic / data / state | 88,221 | 53,270 | 948,608 | 342,892 | 8.8% |
| Styling / CSS | 51,736 | 68,710 | 302,016 | 288,068 | 7.4% |
| Final report | 9,554 | 27,743 | 728,064 | 165,589 | 4.3% |
| Other | 29,126 | 12,105 | 774,784 | 142,919 | 3.7% |
| Build / verification | 14,299 | 1,845 | 974,336 | 117,268 | 3.0% |
| Config | 17,509 | 2,198 | 164,736 | 40,577 | 1.0% |
| Uncertain classification residual | 4,288 | 2,721 | 194,048 | 31,856 | 0.8% |

### Internal cost composition

Important patterns:

- Test execution was ~69% cache-weighted.
- Test writing was ~44% output-weighted and ~40% cache-weighted.
- UI/JSX was ~53% output-weighted.
- Read/inspect was ~53% cache-weighted.
- App logic was ~47% output-weighted.
- CSS was ~72% output-weighted.
- Build/verification was ~83% cache-weighted.

Interpretation:

```text
Generation-heavy problems:
- UI/JSX
- CSS
- test code
- app logic

Likely levers:
- reusable components
- profiles/patterns
- style tokens/themes
- test contracts

Loop/cache-heavy problems:
- test execution
- build/verification
- repeated inspection

Likely levers:
- fewer failed generations
- deterministic guards
- clearer diagnostics
- targeted repair
- bounded loops
```

---

## 5. Phase breakdown

Across the analyzed sessions:

```text
repair_debug      ~42.0% weighted
initial_build     ~35.8%
verify_finalize   ~12.7%
recon_plan         ~9.5%
```

### Central lesson

Approximately **42% of weighted cost occurred in repair/debug** in this analysis.

The repair phase was especially cache-heavy because every additional call carried a growing context.

This is the strongest reason V2 prioritizes prevention and trajectory control rather than only reducing initial code size.

---

## 6. Error-cost finding

In our heuristic attribution of repair cost, approximately **77.3% of repair weighted cost that could be attached to a known error class** was associated with Testing Library/query/assertion-style failures.

Important caveat:

> 77.3% is **not** the percentage of all individual errors that were Testing Library errors. It is the share of attributed repair cost in the analyzed sample.

Other attributed classes included persistence/storage, imports/module paths, test infrastructure, build/config, and runtime/syntax.

### Design implication

A small test-pattern/accessibility contract attached to reusable resources may have larger leverage than its token size suggests if it prevents expensive ambiguous-query repair loops.

---

## 7. Test-command blindness observed in Phase F

Earlier Phase F investigation found:

- many test commands were piped through tools such as `tail`, `head`, `grep`, or `sed`
- agents sometimes ran filtered/targeted Vitest commands instead of a canonical full suite
- compact/error reporters could accidentally remove evidence needed for repair
- Pi behavior could therefore obscure the actual test state

This is why V2 separates:

```text
Pi development tests
from
Harness-owned ground-truth acceptance tests
```

---

## 8. CSS finding

Representative runs primarily generated ordinary `src/styles.css` rather than Tailwind-heavy styling.

Common repeated CSS included:

```text
button
button:hover
button.primary
button.danger
book-list
book-item
book-actions
empty-state
inputs/selects
borders/radius/colors
responsive media queries
```

Representative CSS files were roughly 3–4.6 KB.

Across the larger 33-session analysis, styling represented **7.4% of weighted total**, but it was extremely output-heavy.

Conclusion:

- style templates/tokens are useful
- they are not the largest optimization alone
- their larger value may come when combined with reusable components that also reduce JSX and later repair

---

## 9. Exp5b / storage-treatment — 5 runs

Exp5b was a separate storage-hardening arm. It should be treated as evidence for a possible simple CRUD/local-persistence pattern, not as proof of a universal profile.

Aggregate across 5 Exp5b runs:

```text
Input raw:      91,504
Output raw:     52,108
Cache raw:   1,450,240

Input weighted:   91,504
Output weighted: 156,324
Cache weighted:  145,024
Total weighted:  392,852
```

### Exp5b work breakdown

| Work type | Input raw | Output raw | Cache raw | Weighted | Share |
|---|---:|---:|---:|---:|---:|
| Test writing/editing | 18,186 | 15,617 | 364,672 | 101,504 | 25.8% |
| Test execution | 14,500 | 2,438 | 467,584 | 68,572 | 17.5% |
| UI / JSX | 9,305 | 14,771 | 140,288 | 67,647 | 17.2% |
| Read / inspect | 26,245 | 2,535 | 126,336 | 46,484 | 11.8% |
| Final report | 5,923 | 5,931 | 182,144 | 41,930 | 10.7% |
| Styling / CSS | 9,372 | 7,789 | 46,976 | 37,437 | 9.5% |
| App logic/data/state | 5,744 | 2,681 | 25,344 | 16,321 | 4.2% |
| Build/verification | 1,398 | 229 | 89,472 | 11,032 | 2.8% |
| Uncertain | 831 | 117 | 7,424 | 1,924 | 0.5% |

### Exp5b internal composition

- Test writing: ~46% output-weighted, ~36% cache-weighted.
- Test execution: ~68% cache-weighted.
- UI/JSX: ~66% output-weighted.
- Read/inspect: ~57% input-weighted.
- CSS: ~62% output-weighted.
- Build/verification: ~81% cache-weighted.

### Exp5b per-run weighted totals from our analysis

```text
Rep 1: ~115,137 weighted, 34 calls
Rep 2: ~89,822 weighted, 26 calls
Rep 3: ~60,754 weighted, 15 calls
Rep 4: ~66,787 weighted, 20 calls
Rep 5: ~60,351 weighted, 17 calls
```

The same experimental arm had roughly a 2x spread between the most and least expensive run.

That variance strongly motivates trajectory comparison: **why did Rep 1 need the extra calls that Rep 5 avoided?**

---

## 10. Prior Phase F experimental lessons

Other findings discussed during Phase F:

- weighted total correlated strongly with number of model calls
- cache-read grows superlinearly as trajectories lengthen
- reporter changes alone did not produce a statistically decisive improvement in small samples
- first-failure information quality can change repair behavior
- missed/filtered errors can create long repair tails
- provenance needs hashes/versions for idea, prompts, template, lockfile, model settings
- A/A or fresh-control repetitions are important because stochastic variation is large

V2 should preserve the raw historical data and recompute these metrics under the new analysis pipeline rather than copying old derived values as unquestioned truth.

---

## 11. What these findings actually tell V2

Do not interpret the data as "CSS is unimportant" or "tests are bad."

The better interpretation is:

> The largest opportunity is to reduce improvisation that causes repeated verification and repair, while separately reducing expensive generated output in reusable areas.

Priority hypotheses:

1. prevent repair/test snowballs
2. reusable UI/components/blocks
3. reusable test contracts/patterns
4. deterministic guards
5. profiles/persistence patterns where they generalize
6. semantic style/theme templates
7. verified error memory

Every hypothesis must still pass multi-task/held-out experiments.



---

# Source document: `06_IMPLEMENTATION_SEQUENCE.md`

# Agent Cofounder V2 — Implementation Sequence and Acceptance Criteria

## Guiding rule

Do not build the impressive parts first.

The platform must earn the right to make optimization claims by establishing trustworthy evidence first.

---

## Milestone 0 — Preserve Phase F

### Actions

- Push the reported 8 current commits.
- Tag/freeze Phase F.
- Back up run/session/app data.
- Record available provenance.
- Do not delete old branch/files.

### Acceptance

- Another team member can check out the frozen Phase F state.
- Historical data can be located independently of the active V2 branch.

---

## Milestone 1 — Clean V2 branch from main

### Actions

- Branch from original clean `main`.
- Add only the minimum V2 skeleton.
- Keep experiment-specific code out of core modules.

### Acceptance

- Diff from main is intentional and understandable.
- No Phase F file is copied without an explicit reason.

---

## Milestone 2 — Raw ingestion + normalized call schema

### Actions

- Parse historical Pi session/event formats.
- Build normalized run/call records.
- Preserve source pointers.
- Ingest metadata/provenance.

### Acceptance

- A historical run can be opened as ordered normalized calls.
- Raw source is still accessible.

---

## Milestone 3 — Exact token reconciliation

### Actions

- Sum input/output/cache per normalized call.
- Compare against authoritative run totals.
- Add mismatch diagnostics.
- Run against as many historical runs as possible.

### Acceptance

- Supported complete runs reconcile exactly.
- Non-reconciling runs are visibly marked and explain the discrepancy.
- No classification-dependent logic is needed to reconcile usage.

**Nothing downstream is considered trustworthy before this milestone is green.**

---

## Milestone 4 — Harness-owned ground-truth capture

### Actions

- Implement independent canonical test/build/acceptance execution.
- Capture real exit code and unfiltered/machine-readable evidence.
- Separate Pi's development test stream from evaluation truth.
- Add browser/persistence checks required by the challenge.

### Acceptance

- Pi cannot obtain a false green by choosing a filtered command or truncating output.
- Ground-truth results can be reproduced from the saved evidence.

---

## Milestone 5 — Task benchmark

### Actions

- Define task schema.
- Create diverse development tasks.
- Create and freeze held-out tasks.
- Version task set.

### Acceptance

- Every run has a task ID/version.
- Held-out tasks are clearly separated from tuning tasks.

---

## Milestone 6 — Analysis Station v0

### Actions

- deterministic work classification
- phase classification
- input/output/cache decomposition
- repair detection
- error taxonomy
- comparison engine
- basic UI

### Acceptance

For any reconciled run the user can see:

```text
raw tokens
weighted tokens
per-phase breakdown
per-work-type breakdown
input/output/cache split inside each category
repair cost
error classes
exact source calls
```

Two runs can be compared and the weighted delta is accounted for.

---

## Milestone 7 — Fresh baseline across task set

### Actions

- Run clean baseline V2 measurement with no new build intervention.
- Establish variance across tasks and repetitions.

### Acceptance

- Fresh data uses the same ground-truth/analysis pipeline as future treatments.
- Baseline quality and economics are stable enough to compare.

---

## Milestone 8 — Preparation Agent

### Actions

- Define BuildSpec.
- Add one Planner call.
- Record Planner economics.
- Planner output is inspectable and versioned.

### First experiment

```text
baseline
vs
planner-only
```

Do not add components/themes/guards into the same treatment.

---

## Milestone 9 — Resource resolver + deterministic assembler

Build resource selection/assembly as a separate module.

Start small with a limited verified resource set.

Potential progression:

```text
profile
→ components
→ test contracts
→ theme
→ plugins
```

Each is independently toggleable.

---

## Milestone 10 — Deterministic guards

Add cheap prevention for observed high-cost failure classes.

Do not build a giant generic fixer first.

Use analysis data to choose the first guard.

---

## Milestone 11 — Error Memory

Only after new-architecture runs produce enough real failure data.

Start with verified structured error/fix records.

Measure memory/retrieval cost separately.

---

## Milestone 12 — Combined architecture + held-out evaluation

Combine only interventions that independently showed value.

Then test the frozen combined configuration on held-out tasks.

---

# What NOT to do early

Do not:

- build a giant vector database before proving structured matching is insufficient
- introduce multiple always-on intelligent agents
- rewrite the historical data
- optimize only CSS because it is easy to see
- bundle Planner + components + theme + guards + memory in the first experiment
- use one book-lending prompt as evidence of generality
- treat Pi's chosen test output as ground truth
- store only derived classification labels
- use Git branches as the run database
- let an analysis LLM's tokens contaminate app-build metrics
- call an experiment successful solely because weighted tokens fall while quality drops

---

# Recommended first V2 folder boundaries

Conceptual only; adapt to the actual public starter after auditing it.

```text
src/
  capture/
    raw-events
    harness-evidence
  normalized/
    schemas
    parsers
    reconciliation
  analysis/
    phases
    work-types
    errors
    repair
    aggregation
    compare
  evaluation/
    acceptance
    quality
    task-set
  experiments/
    config
    registry
    reports
  build/
    planner
    resource-resolver
    assembler
    guards
    repair-memory
  server/
    run-ingest
    queries
  ui/
    runs
    compare
    experiments
    errors
    tasks
```

The actual existing repo may use different conventions. Preserve clean boundaries more than these exact folder names.

---

# First Cursor task after reading this pack

Before coding, produce an audit showing:

```text
1. current public/main architecture
2. current Phase F additions
3. where raw run data is written/read
4. existing server upload/store path
5. exact Pi session/event/token fields
6. existing analyzer/classification code worth referencing
7. existing acceptance/test capture and its weaknesses
8. migration-free path to branch V2 from main
```

Then propose the **smallest Milestone 2 + 3 implementation** that can ingest one historical run and reconcile its token totals exactly.

Do not implement Planner/resources yet.



---

# Source document: `07_RESEARCH_PATTERNS_AND_DESIGN_RULES.md`

# Agent Cofounder V2 — Research Patterns and Design Rules

This document captures external architecture patterns we discussed as inspiration. These are not requirements merely because another project uses them; each should be translated into a measurable V2 hypothesis.

## 1. v0 / Vercel pattern

Public descriptions of v0's coding-agent architecture emphasize a layered approach:

- dynamic/relevant knowledge rather than one enormous static prompt
- retrieval using intent/keyword/embedding matching
- curated examples/resources
- deterministic transformations for mechanically detectable mistakes
- specialized autofix for harder but common failures
- main model only when necessary

### V2 takeaway

Prefer:

```text
retrieve known resource
→ deterministic correction
→ targeted fixer
→ Pi repair last
```

instead of using the expensive build model as the universal error handler.

Reference discussed: `https://vercel.com/blog/how-we-made-v0-an-effective-coding-agent`

---

## 2. shadcn registry / skills pattern

The shadcn ecosystem exposes reusable components/blocks through structured registry metadata, dependencies, registry dependencies, templates, and agent-oriented guidance.

### V2 takeaway

Investigate using or aligning with an existing registry format instead of inventing a completely custom component distribution protocol.

Treat components as more than source code. Attach:

```text
API contract
accessibility contract
test contract
design-token requirements
known failure patterns
```

References discussed:

- `https://ui.shadcn.com/docs/registry`
- `https://ui.shadcn.com/docs/registry/getting-started`
- `https://ui.shadcn.com/docs/registry/mcp`
- `https://ui.shadcn.com/docs/skills`

---

## 3. SWE-agent / Agent-Computer Interface pattern

SWE-agent work has emphasized that the interface/tools exposed to the agent strongly affect performance. Useful patterns include constrained editing, immediate validation, and intentionally bounded file/search output rather than maximal context dumps.

### V2 takeaway

- reject/prevent obviously invalid edits early
- give Pi small, precise resource contracts
- do not assume more context is always better
- design tools/guards as part of the agent architecture, not as neutral plumbing

Reference discussed: `https://swe-agent.com/0.7/background/aci/`

---

## 4. Aider pattern

Aider represents the classic iterative repair flow:

```text
edit
→ lint/test
→ feed error back
→ repair
```

### V2 takeaway

Keep this as a fallback, but do not make it the only reliability strategy. Our Phase F data shows that repeated repair can become cache-expensive.

Reference discussed: `https://github.com/Aider-AI/aider`

---

## 5. Agentless pattern

Agentless research separates repository localization, patch generation, and validation rather than relying on one unrestricted agent loop.

### V2 takeaway

Where orchestration is predictable, encode the pipeline in deterministic software and reserve model reasoning for the uncertain step.

Reference discussed: `https://github.com/OpenAutoCoder/Agentless`

---

## 6. AutoCodeRover-style decomposition

Research systems have experimented with explicit stages such as reproducing, localizing, patching, reviewing, and correcting.

### V2 takeaway

Error repair should know **which stage failed**. Do not always send a vague "fix the app" instruction back to Pi.

A failure can be routed as:

```text
assembly failure
plugin configuration failure
test-pattern failure
app logic failure
build/type failure
```

---

## 7. Continual learning / cl-agent pattern

The cl-agent project discussed in our research focuses on capturing agent trajectories, replaying them, distilling reusable experience, and evaluating the learned artifacts. It can work with coding-agent session data, including Pi-like session logs.

### V2 takeaway

Keep raw episodes so future learning layers can be built without changing capture.

Begin with explainable structured signatures and verified fixes. Add embedding similarity after measuring the need.

Reference discussed: `https://github.com/dattgoswami/cl-agent`

---

## 8. General design rules synthesized from research + Phase F

### Rule 1 — Preparation can be worth paying for

A Planner that costs a few thousand weighted tokens can still be a win if it prevents tens of thousands of downstream repair/cache cost.

Measure total trajectory, not stage cost in isolation.

### Rule 2 — Determinism beats repeated inference for known mechanics

If the correct import/dependency/theme/resource can be resolved exactly, do not spend an LLM turn rediscovering it.

### Rule 3 — Small relevant context beats library dumps

Give exact imports, props, constraints, test behavior and known gotchas. Load full docs only on demand.

### Rule 4 — Verify independently

The agent's own debugging tools are not the grading system.

### Rule 5 — Preserve a verified green checkpoint

Once the independent evaluator has verified a good state, later repair should not silently destroy it without new verification.

### Rule 6 — Learn only from verified fixes

Never teach Error Memory from an attempted fix that was not demonstrated to work.

### Rule 7 — Measure mechanism, not only total score

If a test-contract experiment works, we should observe the specific mechanism: fewer ambiguous-query failures, less test rewriting, fewer reruns.

### Rule 8 — Generality requires held-out tasks

A reusable profile that only wins on the prompt that inspired it is overfitting, not architecture improvement.

### Rule 9 — Analysis itself must be reproducible

Parser, classifier, error taxonomy, quality evaluator and weight formula all need versions.

### Rule 10 — Human-readable research conclusions must be traceable

Every chart/table/claim should support drill-down to runs and calls. No unexplained magic score.

