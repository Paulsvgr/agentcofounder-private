import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  engagePreGreenSingleTestOnSessionStart,
  evaluatePreGreenSingleTestBashBlock,
  evaluatePreGreenSingleTestWriteBlock,
  isAgentTestPath,
  listAgentTestFiles,
  preGreenSingleTestV1EnabledFromEnvironment,
  releasePreGreenSingleTestOnVerifyPass,
  resetPreGreenSingleTestState,
} from "../solution/extensions/pre-green-single-test-core.js";
import { resolveChallengeExtensions, resolveChallengeRuntimeEnv } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import { DEFAULT_TEMPLATE_OVERLAY_CONFIG } from "../src/v2/template-overlays.js";

const PASS = `verify exit_code=0 (PASS)

✅ PASS 4/4 tests · 0 failed
`;

const temps: string[] = [];
const repoRoot = process.cwd();

afterEach(() => {
  resetPreGreenSingleTestState();
  delete process.env.HARNESS_PRE_GREEN_SINGLE_TEST_V1;
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeApp(withTest = false): string {
  const root = mkdtempSync(path.join(tmpdir(), "pre-green-single-"));
  temps.push(root);
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(path.join(root, "src", "App.tsx"), "export default function App(){return null}\n");
  if (withTest) {
    writeFileSync(path.join(root, "src", "App.test.tsx"), "it('x', () => {})\n");
  }
  return root;
}

describe("pre-green-single-test-v1", () => {
  it("env defaults OFF", () => {
    expect(preGreenSingleTestV1EnabledFromEnvironment({})).toBe(false);
    expect(
      preGreenSingleTestV1EnabledFromEnvironment({ HARNESS_PRE_GREEN_SINGLE_TEST_V1: "1" }),
    ).toBe(true);
  });

  it("classifies agent test paths under src only", () => {
    expect(isAgentTestPath("src/App.test.tsx")).toBe(true);
    expect(isAgentTestPath("src/books.test.ts")).toBe(true);
    expect(isAgentTestPath("src/App.tsx")).toBe(false);
    expect(isAgentTestPath("test/harness.test.ts")).toBe(false);
  });

  it("allows first test write then blocks a second path", () => {
    process.env.HARNESS_PRE_GREEN_SINGLE_TEST_V1 = "1";
    const app = makeApp(false);
    engagePreGreenSingleTestOnSessionStart(app);
    expect(listAgentTestFiles(app)).toEqual([]);

    expect(evaluatePreGreenSingleTestWriteBlock("src/App.test.tsx", "write", app)).toBeUndefined();
    expect(
      evaluatePreGreenSingleTestWriteBlock("src/books.test.ts", "write", app)?.block,
    ).toBe(true);
    expect(evaluatePreGreenSingleTestWriteBlock("src/App.test.tsx", "write", app)).toBeUndefined();
    expect(evaluatePreGreenSingleTestWriteBlock("src/App.tsx", "write", app)).toBeUndefined();
  });

  it("latches sole existing test file and blocks new ones", () => {
    process.env.HARNESS_PRE_GREEN_SINGLE_TEST_V1 = "1";
    const app = makeApp(true);
    engagePreGreenSingleTestOnSessionStart(app);
    expect(
      evaluatePreGreenSingleTestWriteBlock("src/books.test.ts", "write", app)?.reason,
    ).toContain("PRE_GREEN_SINGLE_TEST");
    expect(evaluatePreGreenSingleTestWriteBlock("src/App.test.tsx", "write", app)).toBeUndefined();
  });

  it("blocks bash mv/cp into a second test path", () => {
    process.env.HARNESS_PRE_GREEN_SINGLE_TEST_V1 = "1";
    const app = makeApp(true);
    engagePreGreenSingleTestOnSessionStart(app);
    const denied = evaluatePreGreenSingleTestBashBlock("cp src/App.test.tsx src/books.test.ts", app);
    expect(denied?.block).toBe(true);
  });

  it("unlocks on VERIFY PASS", () => {
    process.env.HARNESS_PRE_GREEN_SINGLE_TEST_V1 = "1";
    const app = makeApp(true);
    engagePreGreenSingleTestOnSessionStart(app);
    expect(evaluatePreGreenSingleTestWriteBlock("src/books.test.ts", "write", app)?.block).toBe(
      true,
    );
    releasePreGreenSingleTestOnVerifyPass(PASS);
    expect(evaluatePreGreenSingleTestWriteBlock("src/books.test.ts", "write", app)).toBeUndefined();
  });

  it("wires extension when flag on", () => {
    process.env.HARNESS_PRE_GREEN_SINGLE_TEST_V1 = "1";
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((p) => p.endsWith("pre-green-single-test-v1.ts"))).toBe(true);
    const env = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, DEFAULT_CONFIG);
    expect(env.HARNESS_PRE_GREEN_SINGLE_TEST_V1).toBe("1");
  });
});
