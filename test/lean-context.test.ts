import { describe, expect, it } from "vitest";
import { decideRead, recordRead, type SeenRange } from "../solution/extensions/lean-context.js";

/** Pi sends a whole-file read as {offset: 1, limit: 400}. */
const WHOLE_FILE = { offset: 1, limit: 400 };

function seenWith(path: string, range: SeenRange): Map<string, SeenRange> {
  return new Map([[path, range]]);
}

describe("read decisions", () => {
  it("blocks a seed file whose contents the prompt already describes", () => {
    const decision = decideRead("src/lib/storage.ts", new Map(), WHOLE_FILE.offset, WHOLE_FILE.limit);
    expect(decision.block).toBe(true);
    expect(decision.reason).toContain("already");
  });

  it("allows the first read of a file the model has not seen", () => {
    expect(decideRead("src/App.tsx", new Map(), WHOLE_FILE.offset, WHOLE_FILE.limit).block).toBe(false);
  });

  it("blocks the repeat whole-file read that drove the 58-call run", () => {
    // Observed: 19 reads of src/App.tsx, all {offset: 1, limit: 400}.
    const seen = new Map<string, SeenRange>();
    recordRead("src/App.tsx", seen, WHOLE_FILE.offset, WHOLE_FILE.limit);

    const decision = decideRead("src/App.tsx", seen, WHOLE_FILE.offset, WHOLE_FILE.limit);

    expect(decision.block).toBe(true);
    expect(decision.reason).toContain("has not changed");
  });

  it("allows a read reaching past what was already shown", () => {
    const seen = seenWith("src/App.tsx", { from: 1, to: 400 });
    expect(decideRead("src/App.tsx", seen, 401, 400).block).toBe(false);
  });

  it("blocks a read fully inside what was already shown", () => {
    const seen = seenWith("src/App.tsx", { from: 1, to: 400 });
    expect(decideRead("src/App.tsx", seen, 50, 20).block).toBe(true);
  });

  it("allows re-reading a file written since it was last shown", () => {
    // The extension deletes the entry on write; this is the state that leaves.
    const seen = seenWith("src/App.tsx", { from: 1, to: 400 });
    seen.delete("src/App.tsx");
    expect(decideRead("src/App.tsx", seen, WHOLE_FILE.offset, WHOLE_FILE.limit).block).toBe(false);
  });

  it("allows files the model created itself", () => {
    expect(decideRead("src/books.tsx", new Map(), 1, 400).block).toBe(false);
    expect(decideRead("report.partial.json", new Map(), 1, 400).block).toBe(false);
  });
});

describe("recordRead", () => {
  it("widens the remembered span rather than replacing it", () => {
    const seen = new Map<string, SeenRange>();
    recordRead("src/App.tsx", seen, 100, 50); // lines 100-149
    recordRead("src/App.tsx", seen, 1, 20); // lines 1-20
    expect(seen.get("src/App.tsx")).toEqual({ from: 1, to: 149 });
  });

  it("treats an absent limit as reaching the end of the file", () => {
    const seen = new Map<string, SeenRange>();
    recordRead("src/App.tsx", seen, 1, undefined);
    expect(decideRead("src/App.tsx", seen, 900, 50).block).toBe(true);
  });
});
