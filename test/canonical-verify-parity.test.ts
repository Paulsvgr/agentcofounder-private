/**
 * Empirical parity: pre-refactor inline VERIFY runner (git HEAD) vs canonical-verify.ts
 */
import { execSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCanonicalVerify } from "../solution/extensions/canonical-verify.js";
import { formatVerifyToolOutput } from "../solution/extensions/verify-failure-format.js";
import { resolveChallengeExtensions, resolveChallengeRuntimeEnv } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import { DEFAULT_TEMPLATE_OVERLAY_CONFIG } from "../src/v2/template-overlays.js";

function legacyRunVerifyFromGitHead(appRoot: string): { exitCode: number; output: string } {
  try {
    const output = execSync("npm test", {
      cwd: appRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 4 * 1024 * 1024,
    });
    return { exitCode: 0, output: output.trim() };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    const stdout = typeof err.stdout === "string" ? err.stdout : "";
    const stderr = typeof err.stderr === "string" ? err.stderr : "";
    const combined = `${stdout}\n${stderr}`.trim();
    return {
      exitCode: typeof err.status === "number" ? err.status : 1,
      output: combined || String(error),
    };
  }
}

function formatLegacyVerifyToolText(exitCode: number, output: string): string {
  const status = exitCode === 0 ? "PASS" : "FAIL";
  return [`verify exit_code=${exitCode} (${status})`, "", output].join("\n");
}

describe("canonical-verify OFF behavioral parity", () => {
  let fixtureRoot = "";
  const repoRoot = path.resolve(".");

  afterEach(() => {
    if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
    fixtureRoot = "";
    delete process.env.HARNESS_EARLY_VERIFY_V1;
    delete process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    delete process.env.HARNESS_VERIFY_REPAIR_V1;
  });

  function prepareFixture(testFileContent: string): string {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "canonical-verify-parity-"));
    const templateRoot = path.join(repoRoot, "app-template-base");
    cpSync(templateRoot, fixtureRoot, { recursive: true });
    mkdirSync(path.join(fixtureRoot, "src"), { recursive: true });
    writeFileSync(path.join(fixtureRoot, "src/App.test.tsx"), testFileContent, "utf8");
    return fixtureRoot;
  }

  it(
    "matches git-HEAD inline runner on canonical PASS",
    () => {
      const appRoot = prepareFixture(
        "import { it, expect } from 'vitest';\nit('passes', () => { expect(1).toBe(1); });\n",
      );
      const legacy = legacyRunVerifyFromGitHead(appRoot);
      const shared = runCanonicalVerify(appRoot);
      expect(shared.exitCode).toBe(legacy.exitCode);
      expect(shared.exitCode).toBe(0);
      expect(shared.output).toBe(legacy.output);
      expect(formatVerifyToolOutput(shared.exitCode, shared.output, false)).toBe(
        formatLegacyVerifyToolText(legacy.exitCode, legacy.output),
      );
    },
    120_000,
  );

  it(
    "matches git-HEAD inline runner on canonical FAIL",
    () => {
      const appRoot = prepareFixture(
        "import { it, expect } from 'vitest';\nit('fails', () => { expect(1).toBe(2); });\n",
      );
      const legacy = legacyRunVerifyFromGitHead(appRoot);
      const shared = runCanonicalVerify(appRoot);
      expect(shared.exitCode).toBe(legacy.exitCode);
      expect(shared.exitCode).not.toBe(0);
      expect(shared.output).toBe(legacy.output);
      expect(formatVerifyToolOutput(shared.exitCode, shared.output, false)).toBe(
        formatLegacyVerifyToolText(legacy.exitCode, legacy.output),
      );
    },
    120_000,
  );

  it("Q2-D OFF does not alter challenge extensions or runtime env vs v2.2", () => {
    delete process.env.HARNESS_EARLY_VERIFY_V1;
    delete process.env.HARNESS_TEST_AUTHORING_GUARD_V1;
    delete process.env.HARNESS_VERIFY_REPAIR_V1;

    const offUnset = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    process.env.HARNESS_EARLY_VERIFY_V1 = "0";
    const offExplicit = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);

    expect(offExplicit.extensions).toEqual(offUnset.extensions);
    expect(offExplicit.extensions.some((entry) => entry.endsWith("early-verify-v1.ts"))).toBe(false);
    expect(offExplicit.extensions.some((entry) => entry.endsWith("harness-owned-verify.ts"))).toBe(true);

    const runtimeUnset = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, DEFAULT_CONFIG);
    process.env.HARNESS_EARLY_VERIFY_V1 = "0";
    const runtimeExplicit = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, DEFAULT_CONFIG);
    expect(runtimeExplicit.HARNESS_EARLY_VERIFY_V1).toBeUndefined();
    expect(runtimeUnset.HARNESS_EARLY_VERIFY_V1).toBeUndefined();
  });
});

describe("run-challenge prompt regression (documented floor issue)", () => {
  const repoRoot = path.resolve(".");

  it("records current journeys.md wording (differs from stale test expectation)", () => {
    const journeys = readFileSync(path.join(repoRoot, "contract-public/journeys.md"), "utf8");
    expect(journeys).toContain("never drop an implied behavior merely to simplify the application");
    expect(journeys).not.toContain("Never omit an implied journey merely to simplify");
  });
});
