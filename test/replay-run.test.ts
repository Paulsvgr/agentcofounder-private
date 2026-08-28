import { describe, expect, it } from "vitest";
import { applyEditsToContent } from "../scripts/replay-run.js";

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
