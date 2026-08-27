import { describe, expect, it } from "vitest";
import { decideRead } from "../solution/extensions/lean-context.js";

describe("read decisions", () => {
  it("blocks a seed file whose contents the prompt already describes", () => {
    const decision = decideRead("src/lib/storage.ts", new Set(), false);
    expect(decision.block).toBe(true);
    expect(decision.reason).toContain("already");
  });

  it("blocks re-reading a file already returned this session", () => {
    expect(decideRead("src/App.tsx", new Set(["src/App.tsx"]), false).block).toBe(true);
  });

  it("allows the first read of a file the model has not seen", () => {
    expect(decideRead("src/App.tsx", new Set(), false).block).toBe(false);
  });

  it("allows a ranged read, which may return unseen content", () => {
    expect(decideRead("src/lib/storage.ts", new Set(["src/lib/storage.ts"]), true).block).toBe(false);
  });

  it("allows re-reading a file that was written since it was last seen", () => {
    // The extension drops the path on write; this is the state that leaves.
    const seen = new Set(["src/App.tsx"]);
    seen.delete("src/App.tsx");
    expect(decideRead("src/App.tsx", seen, false).block).toBe(false);
  });

  it("allows files the model created itself", () => {
    expect(decideRead("src/books.tsx", new Set(), false).block).toBe(false);
    expect(decideRead("report.partial.json", new Set(), false).block).toBe(false);
  });
});
