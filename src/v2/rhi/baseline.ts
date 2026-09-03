import type { HarnessDocument } from "./schema.js";
import { RHI_HARNESS_SCHEMA } from "./schema.js";

const IMPLEMENTER_INSTRUCTIONS = [
  "This is one slice. Do not plan a waterfall.",
  "Implement the core product in src/App.tsx and add focused src/**/*.test.ts(x) journeys in this same slice.",
  "Do not write a textual plan or description before you start editing files.",
  "The first file-changing action must be using the `write` tool to create/replace `src/App.tsx` (the seed must be replaced, not kept).",
  "After `src/App.tsx` is written, immediately use `write`/`edit` to create/overwrite `src/**/*.test.ts(x)` (at least one completed passing product test).",
  "If you need to inspect the repo, use `read` (not bash for editing). Keep inspection minimal.",
  "Exiting without passing product tests fails L0. No skipped or todo tests.",
  "Use the CSS vocabulary in AGENTS.md. Do not inspect or edit src/styles.css.",
  "The harness runs L0 after you exit. Do not start a lingering dev server.",
].join("\n");

const CONTINUER_INSTRUCTIONS = [
  "Observe the current code, tests, and last L0 report. Do not restart from a blank plan.",
  "Implement only the next missing implied journeys, then add or update the smallest tests that cover them.",
  "Do not rewrite working sealed behavior. Do not emit a multi-phase roadmap.",
  "Do not write a textual plan; use `write`/`edit` to implement the missing behavior and its tests.",
  "The harness will verify after this slice. Write report.partial.json if the app is now complete.",
].join("\n");

const REPAIRER_INSTRUCTIONS = [
  "The previous slice's files are still on disk. Do not restore the seed and do not start over.",
  "Product tests already exist. Fix only what the L0 report names — usually failing src/**/*.test.ts(x) or the UI they exercise.",
  "Do not write a textual plan; use `write`/`edit` to fix the specific failing tests and their UI.",
  "L0 report:",
].join("\n");

const WORKER_INPUT = ["idea", "slice_title", "slice_action", "sealed_milestones", "last_l0"];
const WORKER_OUTPUT = ["source_changes", "product_tests", "report.partial.json_if_complete"];

export function baselineHarness(id = "v0"): HarnessDocument {
  return {
    schema: RHI_HARNESS_SCHEMA,
    id,
    task_kind: "coding",
    harness: {
      agents: [
        {
          id: "orchestrator",
          role: "deterministic slice selector",
          instructions:
            "Choose exactly one next hop from observed workspace state and last L0. Do not emit a waterfall plan.",
          input_contract: ["workspace_observation", "milestone_state", "max_slices"],
          output_contract: ["next_agent_id", "next_action", "slice_title"],
        },
        {
          id: "implementer",
          role: "worker",
          action: "implement_core",
          instructions: IMPLEMENTER_INSTRUCTIONS,
          input_contract: WORKER_INPUT,
          output_contract: WORKER_OUTPUT,
        },
        {
          id: "continuer",
          role: "worker",
          action: "continue_journeys",
          instructions: CONTINUER_INSTRUCTIONS,
          input_contract: [...WORKER_INPUT, "implemented_features"],
          output_contract: WORKER_OUTPUT,
        },
        {
          id: "repairer",
          role: "worker",
          action: "repair",
          instructions: REPAIRER_INSTRUCTIONS,
          input_contract: [...WORKER_INPUT, "last_l0.summary"],
          output_contract: ["targeted_fixes", "product_tests"],
        },
        {
          id: "l0_verifier",
          role: "deterministic verifier",
          instructions:
            "After each worker slice, run Vitest. If tests fail, skip production build and HTTP. If tests pass, run the production build and defer HTTP to the official final verify.",
          input_contract: ["app_tree"],
          output_contract: ["tests_passed", "build_passed", "http_passed", "l0_summary"],
        },
        {
          id: "done",
          role: "terminal",
          action: "done",
          instructions: "No further worker slices.",
          input_contract: ["milestone_state"],
          output_contract: ["termination_reason"],
        },
      ],
      workflow: {
        hops: [
          {
            from: "*",
            to: "done",
            condition: "done || slice >= max_slices",
            purpose: "Stop when the run is marked done or the slice budget is exhausted",
          },
          {
            from: "*",
            to: "implementer",
            condition: "product_test_count == 0",
            purpose: "Keep implementing the product until journey tests exist; do not repair a seed tree",
          },
          {
            from: "*",
            to: "repairer",
            condition: "last_l0_exists && last_l0_passed == false && product_test_count > 0",
            purpose: "Repair only after a failed L0 gate when product tests already exist",
          },
          {
            from: "*",
            to: "done",
            condition: 'last_l0_passed == true && report_status == "success"',
            purpose: "Stop when L0 passed and the agent reported a finished app",
          },
          {
            from: "*",
            to: "done",
            condition: 'last_action == "continue_journeys" && last_l0_passed == true',
            purpose: "Allow one continue slice, then stop after it goes green",
          },
          {
            from: "*",
            to: "continuer",
            condition: "last_l0_passed == true || product_test_count > 0",
            purpose: "Cover remaining implied journeys without restarting",
          },
          {
            from: "*",
            to: "implementer",
            condition: "true",
            purpose: "Fallback to a core implementation slice",
          },
        ],
      },
      control: {
        termination_rules: [
          "Stop when L0 passed and report.partial.json status is success",
          "Stop after max_slices worker slices",
          "Stop after one green continue_journeys slice",
        ],
        retry_rules: [
          "On L0 failure after a sealed green checkpoint, restore that green tree and repair",
          "On L0 failure with no product tests, run implementer again instead of repair",
          "On L0 failure with product tests and no green checkpoint, keep the current workspace and repair in place",
        ],
        fallback_rules: ["Never restore the seed over in-progress work"],
        recall_rules: [
          "Each worker session is fresh; do not pass prior chat",
          "Pass only input_contract fields: idea, current slice, sealed milestones, last L0",
        ],
        restore_on_repair: true,
        max_slices: 3,
        slice_timeout_ms: 180_000,
      },
      global_rules: {
        constraints: [
          "owner=solution/system-prompt.md: smallest maintainable app covering implied journeys",
          "owner=contract-public/journeys.md: implement implied journey patterns only",
          "owner=app-template/AGENTS.md: CSS vocabulary; do not edit src/styles.css",
        ],
        tool_rules: [
          "Use only lockfile-installed dependencies",
          "Do not start a lingering dev server",
          "The runner owns result.json and official verify",
        ],
        context_rules: [
          "Workspace on disk is the source of truth between slices",
          "Do not inspect or edit src/styles.css",
          "Do not copy full researcher/chat history into the next worker",
        ],
        runtime_additions: [],
      },
    },
  };
}
