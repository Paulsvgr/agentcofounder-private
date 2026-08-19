import { describe, expect, it } from "vitest";
import {
  blockedDevServerReason,
  buildFinalizeSteerMessage,
  detectBuildPassed,
  detectTestTimedOut,
  detectTestsPassed,
  extractToolText,
  isTestExecutionCommand,
  remainingMinutes,
  shouldInvalidateVerificationOnPath,
  shouldWarnTimeBudget,
  stripTestCommandPipes,
  wrapTestCommand,
} from "../solution/extensions/challenge-guards.js";

describe("blockedDevServerReason", () => {
  it("blocks npm run dev and background servers", () => {
    expect(blockedDevServerReason("npm run dev")).toBeDefined();
    expect(blockedDevServerReason("cd app && npm run dev &")).toBeDefined();
    expect(blockedDevServerReason("nohup npm run dev > /tmp/dev.log 2>&1 &")).toBeDefined();
    expect(blockedDevServerReason("vite --host 0.0.0.0 --port 3000")).toBeDefined();
    expect(blockedDevServerReason("npm run preview")).toBeDefined();
  });

  it("blocks vite-related process inspection only", () => {
    expect(blockedDevServerReason("pgrep -f vite")).toBeDefined();
    expect(blockedDevServerReason("pkill -f vite")).toBeDefined();
    expect(blockedDevServerReason("lsof -i :3000")).toBeDefined();
  });

  it("allows tests, build, general ps, and grep", () => {
    expect(blockedDevServerReason("npm test")).toBeUndefined();
    expect(blockedDevServerReason("npm run build")).toBeUndefined();
    expect(blockedDevServerReason("grep vite vite.config.ts")).toBeUndefined();
    expect(blockedDevServerReason("cat vite.config.ts")).toBeUndefined();
    expect(blockedDevServerReason("ps aux | grep node")).toBeUndefined();
    expect(blockedDevServerReason("pgrep node")).toBeUndefined();
  });
});

describe("test command wrapping", () => {
  const wrapper = "/repo/solution/scripts/run-test-with-timeout.sh";

  it("detects test execution commands", () => {
    expect(isTestExecutionCommand("npm test")).toBe(true);
    expect(isTestExecutionCommand("cd output/app && npm test 2>&1")).toBe(true);
    expect(isTestExecutionCommand("npx vitest run src/App.test.tsx")).toBe(true);
    expect(isTestExecutionCommand("npm run build")).toBe(false);
  });

  it("strips external pipes before wrapping", () => {
    expect(stripTestCommandPipes("cd app && npm test 2>&1 | tail -100")).toBe("cd app && npm test");
    expect(stripTestCommandPipes("npm test")).toBe("npm test");
  });

  it("wraps without external tail pipes", () => {
    const wrapped = wrapTestCommand("cd app && npm test 2>&1 | tail -100", wrapper);
    expect(wrapped).toContain(wrapper);
    expect(wrapped).not.toContain("tail -100");
    expect(wrapped).toContain("cd app && npm test");
  });
});

describe("verification detection", () => {
  const passingTests = `
 RUN  v4.1.5 /app
 Test Files  1 passed (1)
      Tests  9 passed (9)
`;

  it("detects a passing full test suite run", () => {
    expect(detectTestsPassed("npm test", passingTests)).toBe(true);
    expect(detectTestsPassed("cd app && npm test 2>&1 | tail -50", passingTests)).toBe(true);
  });

  it("rejects timed-out test output even if vitest summary lines appear in the tail", () => {
    const timedOut = `TEST RUN TIMED OUT. The test process did not settle within 60 seconds.
 Test Files  1 passed (1)
      Tests  9 passed (9)`;
    expect(detectTestsPassed("npm test", timedOut)).toBe(false);
    expect(detectTestTimedOut(timedOut)).toBe(true);
  });

  it("rejects targeted or partial test commands", () => {
    expect(
      detectTestsPassed("npx vitest run src/App.test.tsx", passingTests),
    ).toBe(false);
    expect(
      detectTestsPassed('npm test -- -t "adds a book"', passingTests),
    ).toBe(false);
    expect(
      detectTestsPassed(
        './node_modules/.bin/vitest run src/App.test.tsx -t "blocks adding"',
        passingTests,
      ),
    ).toBe(false);
  });

  it("rejects failed or partial vitest output", () => {
    expect(
      detectTestsPassed(
        "npm test",
        "Test Files  1 failed (1)\nTests  2 failed | 7 passed (9)",
      ),
    ).toBe(false);
  });

  it("detects a passing production build", () => {
    const output = "> npm run build\n> tsc --noEmit && vite build\n✓ built in 1.2s";
    expect(detectBuildPassed("npm run build", output)).toBe(true);
  });

  it("rejects build output with TypeScript errors", () => {
    const output = "src/App.tsx(1,1): error TS2345: Argument of type";
    expect(detectBuildPassed("npm run build", output)).toBe(false);
  });
});

describe("stale green invalidation", () => {
  it("invalidates on app edits but not report.partial.json", () => {
    expect(shouldInvalidateVerificationOnPath("src/App.tsx")).toBe(true);
    expect(shouldInvalidateVerificationOnPath("report.partial.json")).toBe(false);
  });
});

describe("extractToolText", () => {
  it("reads bash tool content arrays", () => {
    expect(
      extractToolText({
        content: [{ type: "text", text: "hello\nworld" }],
      }),
    ).toBe("hello\nworld");
  });
});

describe("time budget helpers", () => {
  it("warns after 75% of the configured timeout", () => {
    expect(shouldWarnTimeBudget(675_000, 900_000)).toBe(true);
    expect(shouldWarnTimeBudget(600_000, 900_000)).toBe(false);
    expect(remainingMinutes(810_000, 900_000)).toBe(2);
  });

  it("includes finalize instructions", () => {
    expect(buildFinalizeSteerMessage()).toContain("report.partial.json");
    expect(buildFinalizeSteerMessage()).toContain("Do not run npm run dev");
  });
});
