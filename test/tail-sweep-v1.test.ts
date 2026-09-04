import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createEmptyTailSweepExport,
  formatCompactTailSweepResult,
  harnessOwnedVerifyEnabledFromEnvironment,
  isBuildCommand,
  isDevServerCommand,
  isReportPartialPath,
  normalizeRelativePath,
  tailSweepV1EnabledFromEnvironment,
  writeTailSweepExport,
} from "../solution/extensions/tail-sweep-core.js";
import { resolveChallengeExtensions, resolveChallengeRuntimeEnv } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import { DEFAULT_TEMPLATE_OVERLAY_CONFIG } from "../src/v2/template-overlays.js";

describe("tail-sweep-core", () => {
  afterEach(() => {
    delete process.env.HARNESS_TAIL_SWEEP_V1;
    delete process.env.HARNESS_OWNED_VERIFY;
  });

  it("detects report.partial.json paths", () => {
    expect(isReportPartialPath("report.partial.json")).toBe(true);
    expect(isReportPartialPath("./report.partial.json")).toBe(true);
    expect(isReportPartialPath("src/report.partial.json")).toBe(false);
    expect(normalizeRelativePath(".\\report.partial.json")).toBe("report.partial.json");
  });

  it("detects post-report build and dev commands", () => {
    expect(isBuildCommand("npm run build 2>&1")).toBe(true);
    expect(isBuildCommand("cd app && npm run build")).toBe(true);
    expect(isDevServerCommand("npm run dev")).toBe(true);
    expect(isBuildCommand("npm test")).toBe(false);
  });

  it("formats compact tail sweep output with stop instruction", () => {
    const text = formatCompactTailSweepResult({
      passed: true,
      checks: [
        {
          command: "npm test",
          journey: "tests passed",
          result: "passed",
        },
      ],
    });
    expect(text).toContain("Harness tail sweep (complete)");
    expect(text).toContain("Stop immediately");
    expect(text).toContain("write a closing summary");
  });

  it("reads env flags", () => {
    process.env.HARNESS_TAIL_SWEEP_V1 = "1";
    process.env.HARNESS_OWNED_VERIFY = "true";
    expect(tailSweepV1EnabledFromEnvironment()).toBe(true);
    expect(harnessOwnedVerifyEnabledFromEnvironment()).toBe(true);
  });

  it("writes export records", () => {
    const exportRecord = createEmptyTailSweepExport("run-123");
    exportRecord.fired = true;
    exportRecord.passed = true;
    const dir = mkdtempSync(path.join(tmpdir(), "tail-sweep-test-"));
    const exportPath = path.join(dir, "tail-sweep.v1.json");
    writeTailSweepExport(exportPath, exportRecord);
    const written = JSON.parse(readFileSync(exportPath, "utf8")) as { run_id: string; fired: boolean };
    expect(written.run_id).toBe("run-123");
    expect(written.fired).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("tail-sweep extension wiring", () => {
  afterEach(() => {
    delete process.env.HARNESS_TAIL_SWEEP_V1;
    delete process.env.HARNESS_EARLY_VERIFY_V1;
    delete process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    delete process.env.HARNESS_VERIFY_REPAIR_V1;
  });

  it("loads tail-sweep extension when flag is set on v2.2 config", () => {
    process.env.HARNESS_TAIL_SWEEP_V1 = "1";
    const repoRoot = process.cwd();
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((entry) => entry.endsWith("tail-sweep-v1.ts"))).toBe(true);
    expect(extensions.some((entry) => entry.endsWith("harness-owned-verify.ts"))).toBe(true);
  });

  it("does not load tail-sweep extension by default", () => {
    const repoRoot = process.cwd();
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((entry) => entry.endsWith("tail-sweep-v1.ts"))).toBe(false);
  });

  it("exports runtime env when flag is set", () => {
    process.env.HARNESS_TAIL_SWEEP_V1 = "1";
    const runtimeEnv = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, DEFAULT_CONFIG);
    expect(runtimeEnv.HARNESS_TAIL_SWEEP_V1).toBe("1");
    expect(runtimeEnv.HARNESS_OWNED_VERIFY).toBe("1");
  });
});
