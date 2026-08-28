import { describe, expect, it } from "vitest";
import { applyEditsToContent, remapPath } from "../scripts/replay-run.js";

const REPLAY_DIR = "/replay/app";

describe("remapPath", () => {
  it("maps a path relative to the session cwd", () => {
    expect(remapPath("/repo/output/app/src/App.tsx", "/repo/output/app", REPLAY_DIR)).toBe(
      "/replay/app/src/App.tsx",
    );
  });

  it("resolves relative paths against the session cwd", () => {
    expect(remapPath("src/App.tsx", "/repo/output/app", REPLAY_DIR)).toBe(
      "/replay/app/src/App.tsx",
    );
  });

  // Regression: with cwd checked first, a repository-root cwd nested the whole
  // output path inside the replay directory and rebuilt the wrong tree.
  it("strips the app prefix even when cwd is the repository root", () => {
    expect(remapPath("/repo/output/app/src/App.tsx", "/repo", REPLAY_DIR)).toBe(
      "/replay/app/src/App.tsx",
    );
  });

  it("maps a run from a different repository checkout", () => {
    expect(remapPath("/elsewhere/output/app/src/main.tsx", "/elsewhere/output/app", REPLAY_DIR)).toBe(
      "/replay/app/src/main.tsx",
    );
  });

  it("still maps a custom output directory through the cwd branch", () => {
    expect(remapPath("/repo/output/custom/src/App.tsx", "/repo/output/custom", REPLAY_DIR)).toBe(
      "/replay/app/src/App.tsx",
    );
  });

  it("rejects paths outside the app workspace", () => {
    expect(remapPath("/etc/passwd", "/repo/output/app", REPLAY_DIR)).toBeNull();
    expect(remapPath("   ", "/repo/output/app", REPLAY_DIR)).toBeNull();
  });
});

describe("applyEditsToContent", () => {
  it("inserts replacement text verbatim", () => {
    expect(applyEditsToContent("const a = 1;\n", [{ oldText: "1", newText: "2" }])).toBe(
      "const a = 2;\n",
    );
  });

  it("throws when oldText is absent so the caller can record a failure", () => {
    expect(() => applyEditsToContent("abc", [{ oldText: "xyz", newText: "1" }])).toThrow(
      "oldText not found",
    );
  });

  it("applies edits in order", () => {
    const result = applyEditsToContent("a b", [
      { oldText: "a", newText: "x" },
      { oldText: "b", newText: "y" },
    ]);
    expect(result).toBe("x y");
  });

  // Regression: agents emit regex-escaping helpers whose replacement string is
  // "\\$&". A string-valued replace() expands those patterns and corrupts the
  // file without raising, which made a replayed app silently differ.
  it("does not expand $& in replacement text", () => {
    const newText = 'title.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")';
    const result = applyEditsToContent("const escaped = PLACEHOLDER;", [
      { oldText: "PLACEHOLDER", newText },
    ]);
    expect(result).toBe(`const escaped = ${newText};`);
  });

  it("does not expand $` or $' in replacement text", () => {
    const result = applyEditsToContent("before MARK after", [
      { oldText: "MARK", newText: "$` and $' and $$" },
    ]);
    expect(result).toBe("before $` and $' and $$ after");
  });
});
