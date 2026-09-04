import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendLockBlockToVerifyText,
  engageRepairSurfaceLockOnVerifyFail,
  evaluateRepairSurfaceBashBlock,
  evaluateRepairSurfaceWriteBlock,
  extractBashNewSurfaceDestinations,
  formatRepairSurfaceLockBlock,
  isSurfacePath,
  isVerifyFailText,
  isVerifyPassText,
  listSurfaceFiles,
  releaseRepairSurfaceLockOnVerifyPass,
  repairSurfaceLockV1EnabledFromEnvironment,
  resetRepairSurfaceLockState,
} from "../solution/extensions/repair-surface-lock-core.js";
import { resolveChallengeExtensions, resolveChallengeRuntimeEnv } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import { DEFAULT_TEMPLATE_OVERLAY_CONFIG } from "../src/v2/template-overlays.js";

const FAIL = `verify exit_code=1 (FAIL)

❌ FAIL 3/4 tests · 1 failed
`;
const PASS = `verify exit_code=0 (PASS)

✅ PASS 4/4 tests · 0 failed
`;

const temps: string[] = [];
const repoRoot = process.cwd();

afterEach(() => {
  resetRepairSurfaceLockState();
  delete process.env.HARNESS_REPAIR_SURFACE_LOCK_V1;
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeApp(): string {
  const root = mkdtempSync(path.join(tmpdir(), "repair-surface-"));
  temps.push(root);
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(path.join(root, "src", "App.tsx"), "export default function App(){return null}\n");
  writeFileSync(path.join(root, "src", "App.test.tsx"), "it('x', () => {})\n");
  return root;
}

describe("repair-surface-lock-v1", () => {
  it("env defaults OFF", () => {
    expect(repairSurfaceLockV1EnabledFromEnvironment({})).toBe(false);
    expect(
      repairSurfaceLockV1EnabledFromEnvironment({ HARNESS_REPAIR_SURFACE_LOCK_V1: "1" }),
    ).toBe(true);
  });

  it("detects surface paths and verify outcomes", () => {
    expect(isSurfacePath("src/App.tsx")).toBe(true);
    expect(isSurfacePath("src/lib/books.test.ts")).toBe(true);
    expect(isSurfacePath("report.partial.json")).toBe(false);
    expect(isVerifyFailText(FAIL)).toBe(true);
    expect(isVerifyPassText(PASS)).toBe(true);
  });

  it("lists surface files under src/", () => {
    const app = makeApp();
    expect(listSurfaceFiles(app)).toEqual(["src/App.test.tsx", "src/App.tsx"]);
  });

  it("engages lock on FAIL and blocks new files; allows frozen paths", () => {
    process.env.HARNESS_REPAIR_SURFACE_LOCK_V1 = "1";
    const app = makeApp();
    const block = engageRepairSurfaceLockOnVerifyFail(app, FAIL);
    expect(block).toContain("REPAIR_SURFACE_LOCK");
    expect(formatRepairSurfaceLockBlock(2)).toContain("frozen 2");

    expect(evaluateRepairSurfaceWriteBlock("src/App.tsx", "write")).toBeUndefined();
    expect(evaluateRepairSurfaceWriteBlock("report.partial.json", "write")).toBeUndefined();

    const denied = evaluateRepairSurfaceWriteBlock("src/lib/useBooks.ts", "write");
    expect(denied?.block).toBe(true);
    expect(denied?.reason).toContain("REPAIR_SURFACE_LOCK");
    expect(denied?.reason).toContain("useBooks.ts");
  });

  it("does not engage when flag off", () => {
    process.env.HARNESS_REPAIR_SURFACE_LOCK_V1 = "0";
    const app = makeApp();
    expect(engageRepairSurfaceLockOnVerifyFail(app, FAIL)).toBeNull();
    expect(evaluateRepairSurfaceWriteBlock("src/new.ts", "write")).toBeUndefined();
  });

  it("unlocks on PASS so new files are allowed again", () => {
    process.env.HARNESS_REPAIR_SURFACE_LOCK_V1 = "1";
    const app = makeApp();
    engageRepairSurfaceLockOnVerifyFail(app, FAIL);
    expect(evaluateRepairSurfaceWriteBlock("src/extra.ts", "write")?.block).toBe(true);
    releaseRepairSurfaceLockOnVerifyPass(PASS);
    expect(evaluateRepairSurfaceWriteBlock("src/extra.ts", "write")).toBeUndefined();
  });

  it("appends lock block after status line", () => {
    const out = appendLockBlockToVerifyText(FAIL, formatRepairSurfaceLockBlock(3));
    expect(out.startsWith("verify exit_code=1 (FAIL)")).toBe(true);
    expect(out).toContain("REPAIR_SURFACE_LOCK");
  });

  it("blocks bash mv into a new surface destination", () => {
    process.env.HARNESS_REPAIR_SURFACE_LOCK_V1 = "1";
    const app = makeApp();
    engageRepairSurfaceLockOnVerifyFail(app, FAIL);
    expect(extractBashNewSurfaceDestinations("mv src/lib/books.ts src/books.ts")).toEqual([
      "src/books.ts",
    ]);
    const denied = evaluateRepairSurfaceBashBlock("mv src/App.tsx src/App2.tsx");
    expect(denied?.block).toBe(true);
    expect(denied?.reason).toContain("App2.tsx");
  });

  it("wires extension when flag on", () => {
    process.env.HARNESS_REPAIR_SURFACE_LOCK_V1 = "1";
    const { extensions } = resolveChallengeExtensions(repoRoot, DEFAULT_CONFIG);
    expect(extensions.some((p) => p.endsWith("repair-surface-lock-v1.ts"))).toBe(true);
    const env = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, DEFAULT_CONFIG);
    expect(env.HARNESS_REPAIR_SURFACE_LOCK_V1).toBe("1");
  });
});
