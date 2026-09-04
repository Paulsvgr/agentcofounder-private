import { describe, expect, it } from "vitest";
import { buildChallengeShellCommand, jobStatusLabel } from "../server/jobs.js";
import type { JobStatus } from "../server/types.js";

describe("buildChallengeShellCommand", () => {
  it("exports env_overrides after profile source", () => {
    const { command, args } = buildChallengeShellCommand(
      "/repo",
      "/home/user/.pi/agent/challenge-env-zai.sh",
      {
        env_profile: "challenge-env-zai.sh",
        provider: "zai",
        model: "glm-5.2",
        experiment_id: "verify-rtl-text-v1",
        arm: "treatment",
        env_overrides: {
          HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1: "1",
          HARNESS_HARD_STOP_AFTER_GREEN_V1: "0",
          TEMPLATE_TAILWIND: "1",
          EVIL_INJECT: "nope",
        },
      },
    );

    expect(command).toBe("bash");
    const script = args[1] ?? "";
    expect(script).toContain("source '/home/user/.pi/agent/challenge-env-zai.sh'");
    expect(script).toContain("export HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1='1'");
    expect(script).toContain("export HARNESS_HARD_STOP_AFTER_GREEN_V1='0'");
    expect(script).toContain("export TEMPLATE_TAILWIND='1'");
    expect(script).not.toContain("EVIL_INJECT");
    expect(script).toContain("export RUN_EXPERIMENT='verify-rtl-text-v1'");
    expect(script).toContain("export RUN_ARM='treatment'");
    expect(script).toContain("npm run challenge");
  });
});

describe("jobStatusLabel", () => {
  it("covers all statuses exhaustively", () => {
    const statuses: JobStatus[] = ["running", "succeeded", "failed", "timed_out", "stopped"];
    for (const status of statuses) {
      expect(jobStatusLabel(status)).toBe(status);
    }
  });
});
