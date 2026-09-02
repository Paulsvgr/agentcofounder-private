import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyIdea, guidanceFor } from "../solution/classify-idea.js";

function idea(name: string): string {
  return readFileSync(path.join("eval-ideas", `${name}.txt`), "utf8");
}

describe("classifying real evaluation ideas", () => {
  it("sees a record collection in the tracker ideas", () => {
    for (const name of ["plants", "invoices", "shifts"]) {
      const needs = classifyIdea(idea(name));
      expect(needs.collection, name).toBe(true);
      expect(needs.persistence, name).toBe(true);
      expect(needs.stylesheet, name).toBe("records");
    }
  });

  it("sees a game, and does not demand a record collection for it", () => {
    const needs = classifyIdea(idea("game"));
    expect(needs.game).toBe(true);
    expect(needs.collection).toBe(false);
    expect(needs.stylesheet).toBe("board");
  });

  it("sees the splitter as calculation that stores nothing", () => {
    const needs = classifyIdea(idea("splitter"));
    expect(needs.calculation).toBe(true);
    expect(needs.money).toBe(true);
    expect(needs.collection).toBe(false);
  });

  it("sees time in the pomodoro", () => {
    const needs = classifyIdea(idea("pomodoro"));
    expect(needs.time).toBe(true);
    expect(needs.collection).toBe(false);
  });

  it("sees persistence without a collection in the scratchpad", () => {
    const needs = classifyIdea(idea("notes"));
    expect(needs.persistence).toBe(true);
  });

  it("sees money in the invoice idea", () => {
    expect(classifyIdea(idea("invoices")).money).toBe(true);
  });
});

describe("guidance assembly", () => {
  it("includes only what the idea needs", () => {
    const text = guidanceFor(classifyIdea(idea("game")));
    expect(text).toContain("Turn-based state");
    expect(text).not.toContain("## Records");
  });

  it("saves meaningful prompt weight on a narrow idea", () => {
    const everything = guidanceFor(classifyIdea("nothing matches here at all"));
    const gameOnly = guidanceFor(classifyIdea(idea("game")));
    expect(gameOnly.length).toBeLessThan(everything.length);
  });
});

describe("the unseen-idea safety net", () => {
  it("includes everything when nothing scores clearly", () => {
    const needs = classifyIdea("I would like a thing for the stuff please");
    expect(needs.uncertain).toBe(true);
    // Withholding guidance from an idea we cannot read is the expensive
    // mistake; carrying a little extra is the cheap one.
    expect(needs.collection && needs.persistence && needs.time && needs.game).toBe(true);
    expect(needs.stylesheet).toBe("records");
  });

  it("never returns an empty guidance block", () => {
    for (const text of ["", "?", "an app", "something for work"]) {
      expect(guidanceFor(classifyIdea(text)).length).toBeGreaterThan(0);
    }
  });
});
