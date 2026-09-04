import { describe, expect, it } from "vitest";
import {
  formatTypecheckBlock,
  processCanonicalVerifyForTypecheckOnFail,
  verifyTypecheckOnFailV1EnabledFromEnvironment,
  type TypecheckResult,
} from "../solution/extensions/verify-typecheck-on-fail-core.ts";

const SAMPLE_FAIL = `verify exit_code=1 (FAIL)

❌ FAIL 0/1 tests · 1 failed

TYPE  TestingLibraryElementError
MESSAGE
Unable to find an element with the display value: Dune.
`;

describe("verify-typecheck-on-fail-v1", () => {
  it("env defaults ON when unset (KEEP); explicit 0 disables", () => {
    expect(verifyTypecheckOnFailV1EnabledFromEnvironment({})).toBe(true);
    expect(
      verifyTypecheckOnFailV1EnabledFromEnvironment({
        HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1: "0",
      }),
    ).toBe(false);
    expect(
      verifyTypecheckOnFailV1EnabledFromEnvironment({
        HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1: "1",
      }),
    ).toBe(true);
  });

  it("formatTypecheckBlock is facts only", () => {
    const block = formatTypecheckBlock([
      "src/App.tsx(24,62): error TS2345: Argument of type 'string' is not assignable to parameter of type 'Book'.",
    ]);
    expect(block).toContain("TYPECHECK");
    expect(block).toContain("TS2345");
    expect(block?.toLowerCase()).not.toContain("fix");
    expect(block?.toLowerCase()).not.toContain("should");
  });

  it("on FAIL + diagnostics, prepends TYPECHECK after status line", () => {
    const fakeRun = (): TypecheckResult => ({
      exitCode: 1,
      diagnostics: [
        "src/App.tsx(24,62): error TS2345: Argument of type 'string' is not assignable to parameter of type 'Book'.",
      ],
      raw: "error",
    });
    const out = processCanonicalVerifyForTypecheckOnFail(
      SAMPLE_FAIL,
      1,
      "/tmp/app",
      { HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1: "1" },
      fakeRun,
    );
    expect(out.startsWith("verify exit_code=1 (FAIL)")).toBe(true);
    expect(out).toContain("TYPECHECK");
    expect(out).toContain("TS2345");
    expect(out.indexOf("TYPECHECK")).toBeLessThan(out.indexOf("display value: Dune"));
  });

  it("PASS leaves text unchanged", () => {
    const pass = "verify exit_code=0 (PASS)\n\n✅ PASS 1/1";
    const out = processCanonicalVerifyForTypecheckOnFail(
      pass,
      0,
      "/tmp/app",
      { HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1: "1" },
      () => ({
        exitCode: 1,
        diagnostics: ["should not appear"],
        raw: "",
      }),
    );
    expect(out).toBe(pass);
  });

  it("disabled env leaves FAIL unchanged even if tsc would fail", () => {
    const out = processCanonicalVerifyForTypecheckOnFail(
      SAMPLE_FAIL,
      1,
      "/tmp/app",
      { HARNESS_VERIFY_TYPECHECK_ON_FAIL_V1: "0" },
      () => ({
        exitCode: 1,
        diagnostics: ["src/App.tsx(1,1): error TS2345: nope"],
        raw: "",
      }),
    );
    expect(out).toBe(SAMPLE_FAIL);
  });
});
