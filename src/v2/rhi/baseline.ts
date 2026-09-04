import type { HarnessDocument } from "./schema.js";
import { RHI_HARNESS_SCHEMA } from "./schema.js";

const IMPLEMENTER_INSTRUCTIONS = [
  "This is one slice. Do not plan a waterfall.",
  "Do not write a textual plan or description before you start editing files.",
  "Ship a modular app: src/domain/, src/storage/, src/components/, thin App.tsx.",
  "First file-changing actions must create those modules and replace the seed App.",
  "Usability+robustness in the same journeys where possible: validation+aria-invalid, confirm delete, stable +/- with badge, refresh persist, one recovery path.",
  "Add ≤10 high-information UI journeys (soft max 10). Combine rubric points per test. No domain/repo unit suites.",
  "OUTPUT GOVERNANCE: no long explanations; do not repeat the task; do not dump files/logs; prefer write/edit; final message ≤80 tokens; stop immediately after one green npm test + npm run build.",
  "Use CSS vocabulary in AGENTS.md. Do not edit src/styles.css. Harness runs L0 after exit.",
].join("\n");

const CONTINUER_INSTRUCTIONS = [
  "Only close the single highest-value gap named in the slice contract.",
  "If L0 is green and no critical sensor gap remains, write a complete report.partial.json (all required fields, status success) and stop — do not polish.",
  "Do not rewrite sealed behavior. Stay ≤10 tests. No prose plans.",
  "OUTPUT GOVERNANCE: ≤80 token final message; stop after one verify.",
].join("\n");

const REPAIRER_INSTRUCTIONS = [
  "Files are on disk. Do not restore the seed.",
  "Fix only what L0 names. Prefer domain/storage/components.",
  "OUTPUT GOVERNANCE: no long explanations; stop after failing tests pass.",
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
        slice_timeout_ms: 900_000,
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
