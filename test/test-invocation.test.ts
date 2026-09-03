import { describe, expect, it } from "vitest";
import { isBashTestInvocation } from "../solution/extensions/test-invocation.js";

describe("isBashTestInvocation", () => {
  it("detects actual test runner invocations", () => {
    const invocations = [
      "npm test",
      "npm run test",
      "npx vitest run",
      "vitest run --reporter=json",
      "./node_modules/.bin/vitest run",
      "node_modules/.bin/vitest run",
      "cd src && npm test",
    ];
    for (const command of invocations) {
      expect(isBashTestInvocation(command)).toBe(true);
    }
  });

  it("allows listing or mentioning vitest without running it", () => {
    const mentions = [
      "ls node_modules/.bin/vitest",
      "ls -la node_modules/.bin/vitest 2>/dev/null",
      "cd output/app && ls -la node_modules/.bin/vitest 2>/dev/null && find artifacts | head -50",
      "cat vitest.config.ts",
      "find src -type f",
    ];
    for (const command of mentions) {
      expect(isBashTestInvocation(command)).toBe(false);
    }
  });
});
