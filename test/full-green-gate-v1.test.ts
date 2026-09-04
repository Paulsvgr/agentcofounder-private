import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyFullGreenGateAfterVerifyPass,
  buildHarnessFullGreenReport,
  formatBuildFailBlock,
  formatFullGreenBlock,
  fullGreenGateV1EnabledFromEnvironment,
  isFullGreenAchieved,
  resetFullGreenGateState,
} from "../solution/extensions/full-green-gate-core.ts";
import { processCanonicalVerifyForHardStopAfterGreen } from "../solution/extensions/hard-stop-after-green-core.ts";
import { resolveChallengeExtensions, resolveChallengeRuntimeEnv } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import { DEFAULT_TEMPLATE_OVERLAY_CONFIG } from "../src/v2/template-overlays.js";

const SAMPLE_PASS = `verify exit_code=0 (PASS)

✅ PASS 4/4 tests · 0 failed
`;

const repoRoot = process.cwd();
const temps: string[] = [];

afterEach(() => {
  resetFullGreenGateState();
  delete process.env.HARNESS_FULL_GREEN_GATE_V1;
  delete process.env.HARNESS_HARD_STOP_AFTER_GREEN_V1;
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("full-green-gate-v1", () => {
  it("env defaults OFF", () => {
    expect(fullGreenGateV1EnabledFromEnvironment({})).toBe(false);
    expect(
      fullGreenGateV1EnabledFromEnvironment({ HARNESS_FULL_GREEN_GATE_V1: "1" }),
    ).toBe(true);
  });

  it("formatters are factual only", () => {
    expect(formatFullGreenBlock()).toContain("FULL_GREEN");
    expect(formatFullGreenBlock().toLowerCase()).not.toContain("polish");
    expect(formatBuildFailBlock(1, "error TS")).toContain("BUILD FAIL");
    expect(formatBuildFailBlock(1, "error TS")).toContain("exit_code=1");
  });

  it("harness report shape is valid partial", () => {
    const report = buildHarnessFullGreenReport();
    expect(report.status).toBe("success");
    expect(report.tests_run.every((t) => t.result === "passed")).toBe(true);
    expect(report.tests_run.some((t) => t.command === "verify")).toBe(true);
    expect(report.tests_run.some((t) => t.command === "npm run build")).toBe(true);
  });

  it("skips hard-stop PASS decoration when full-green gate is on", () => {
    const out = processCanonicalVerifyForHardStopAfterGreen(SAMPLE_PASS, 0, {
      HARNESS_HARD_STOP_AFTER_GREEN_V1: "1",
      HARNESS_FULL_GREEN_GATE_V1: "1",
    });
    expect(out).toBe(SAMPLE_PASS);
    expect(out).not.toContain("HARD_STOP");
  });

  it("wires extension + runtime env when flag is on", () => {
    process.env.HARNESS_FULL_GREEN_GATE_V1 = "1";
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((p) => p.endsWith("full-green-gate-v1.ts"))).toBe(true);
    const env = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, DEFAULT_CONFIG);
    expect(env.HARNESS_FULL_GREEN_GATE_V1).toBe("1");
  });

  it("does not wire extension when flag is off", () => {
    process.env.HARNESS_FULL_GREEN_GATE_V1 = "0";
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((p) => p.endsWith("full-green-gate-v1.ts"))).toBe(false);
  });

  it("BUILD FAIL returns factual text and does not terminate", () => {
    const appRoot = mkdtempSync(path.join(tmpdir(), "full-green-build-fail-"));
    temps.push(appRoot);
    writeFileSync(
      path.join(appRoot, "package.json"),
      JSON.stringify({
        name: "full-green-build-fail",
        private: true,
        scripts: { build: "node -e \"process.exit(1)\"" },
      }),
      "utf8",
    );

    const gate = applyFullGreenGateAfterVerifyPass(appRoot, SAMPLE_PASS, 0, {
      HARNESS_FULL_GREEN_GATE_V1: "1",
    });
    expect(gate.terminate).toBe(false);
    expect(gate.fullGreen).toBe(false);
    expect(gate.buildExitCode).toBe(1);
    expect(gate.text).toContain("BUILD FAIL");
    expect(gate.text).toContain("exit_code=0 (PASS)");
    expect(isFullGreenAchieved()).toBe(false);
    expect(existsSync(path.join(appRoot, "report.partial.json"))).toBe(false);
  });

  it("BUILD PASS writes report, latches FULL_GREEN, and terminates", () => {
    const appRoot = mkdtempSync(path.join(tmpdir(), "full-green-build-pass-"));
    temps.push(appRoot);
    writeFileSync(
      path.join(appRoot, "package.json"),
      JSON.stringify({
        name: "full-green-build-pass",
        private: true,
        scripts: { build: "node -e \"process.exit(0)\"" },
      }),
      "utf8",
    );

    const gate = applyFullGreenGateAfterVerifyPass(appRoot, SAMPLE_PASS, 0, {
      HARNESS_FULL_GREEN_GATE_V1: "1",
    });
    expect(gate.terminate).toBe(true);
    expect(gate.fullGreen).toBe(true);
    expect(gate.buildExitCode).toBe(0);
    expect(gate.reportWritten).toBe(true);
    expect(gate.text).toContain("FULL_GREEN");
    expect(isFullGreenAchieved()).toBe(true);

    const report = JSON.parse(
      readFileSync(path.join(appRoot, "report.partial.json"), "utf8"),
    ) as { status: string };
    expect(report.status).toBe("success");
  });

  it("disabled flag leaves text unchanged", () => {
    const gate = applyFullGreenGateAfterVerifyPass("/tmp", SAMPLE_PASS, 0, {
      HARNESS_FULL_GREEN_GATE_V1: "0",
    });
    expect(gate.text).toBe(SAMPLE_PASS);
    expect(gate.terminate).toBe(false);
  });
});
