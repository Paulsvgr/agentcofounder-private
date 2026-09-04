import { describe, expect, it } from "vitest";
import {
  formatHardStopBlock,
  hardStopAfterGreenV1EnabledFromEnvironment,
  isReportPartialPath,
  isVerifyPassText,
  processCanonicalVerifyForHardStopAfterGreen,
} from "../solution/extensions/hard-stop-after-green-core.ts";

const SAMPLE_PASS = `verify exit_code=0 (PASS)

✅ PASS 4/4 tests · 0 failed
`;

const SAMPLE_FAIL = `verify exit_code=1 (FAIL)

❌ FAIL 3/4 tests · 1 failed
`;

describe("hard-stop-after-green-v1", () => {
  it("env defaults OFF", () => {
    expect(hardStopAfterGreenV1EnabledFromEnvironment({})).toBe(false);
    expect(
      hardStopAfterGreenV1EnabledFromEnvironment({ HARNESS_HARD_STOP_AFTER_GREEN_V1: "1" }),
    ).toBe(true);
  });

  it("formatHardStopBlock is facts only", () => {
    const block = formatHardStopBlock();
    expect(block).toContain("HARD_STOP");
    expect(block).toContain("Verification is green");
    expect(block.toLowerCase()).not.toContain("should improve");
    expect(block.toLowerCase()).not.toContain("polish");
  });

  it("appends HARD_STOP on PASS when enabled", () => {
    const out = processCanonicalVerifyForHardStopAfterGreen(SAMPLE_PASS, 0, {
      HARNESS_HARD_STOP_AFTER_GREEN_V1: "1",
    });
    expect(out.startsWith("verify exit_code=0 (PASS)")).toBe(true);
    expect(out).toContain("HARD_STOP");
    expect(out.indexOf("HARD_STOP")).toBeLessThan(out.indexOf("PASS 4/4"));
  });

  it("FAIL unchanged even when enabled", () => {
    const out = processCanonicalVerifyForHardStopAfterGreen(SAMPLE_FAIL, 1, {
      HARNESS_HARD_STOP_AFTER_GREEN_V1: "1",
    });
    expect(out).toBe(SAMPLE_FAIL);
  });

  it("PASS unchanged when disabled", () => {
    const out = processCanonicalVerifyForHardStopAfterGreen(SAMPLE_PASS, 0, {
      HARNESS_HARD_STOP_AFTER_GREEN_V1: "0",
    });
    expect(out).toBe(SAMPLE_PASS);
  });

  it("isVerifyPassText / isReportPartialPath helpers", () => {
    expect(isVerifyPassText(SAMPLE_PASS)).toBe(true);
    expect(isVerifyPassText(SAMPLE_FAIL)).toBe(false);
    expect(isReportPartialPath("report.partial.json")).toBe(true);
    expect(isReportPartialPath("src/App.tsx")).toBe(false);
  });
});
