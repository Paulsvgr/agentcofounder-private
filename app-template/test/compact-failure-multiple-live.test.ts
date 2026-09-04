/**
 * Live Testing Library exceptions → compactFailureMessage.
 * Must use real getByText / getByRole errors (Ignored nodes + ANSI), not hand fixtures.
 */
import { getByRole, getByText } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import {
  compactFailureMessage,
  extractMatchingElementBlocks,
  formatMultipleElementsEvidence,
  hasParsedMultipleCandidates,
} from "../compactFailureMessage.ts";

function captureMessage(fn: () => void): string {
  try {
    fn();
    throw new Error("expected Testing Library to throw");
  } catch (err) {
    if (err instanceof Error && /Found multiple elements/i.test(err.message)) {
      return err.message;
    }
    throw err;
  }
}

describe("compactFailureMessage — live RTL multiple-elements", () => {
  it("Science option + badge: real getByText dump yields parsed candidates", () => {
    document.body.innerHTML = `
      <select>
        <option value="Science">Science</option>
      </select>
      <span class="badge">Science</span>
    `;

    const raw = captureMessage(() => getByText(document.body, "Science"));
    expect(raw).toMatch(/Here are the matching elements:/i);
    expect(raw).toMatch(/Ignored nodes:/i);

    const blocks = extractMatchingElementBlocks(raw);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks[0]).toMatch(/^<option/i);
    expect(blocks[1]).toMatch(/^<span/i);

    const compacted = compactFailureMessage(raw);
    expect(hasParsedMultipleCandidates(compacted)).toBe(true);
    expect(compacted).toContain("QUERY");
    expect(compacted).toContain('text="Science"');
    expect(compacted).toContain("MATCHES PRESENT");
    expect(compacted).toContain('1. <option> text="Science"');
    expect(compacted).toContain('2. <span> text="Science" class="badge"');
    expect(compacted).not.toContain("(none parsed)");
    expect(compacted).not.toContain("*AllBy*");
    expect(compacted.toLowerCase()).not.toContain("within");
  });

  it("two Lend out buttons: real getByRole dump yields two button candidates", () => {
    document.body.innerHTML = `
      <ul>
        <li><button type="button">Lend out</button></li>
        <li><button type="button">Lend out</button></li>
      </ul>
    `;

    const raw = captureMessage(() =>
      getByRole(document.body, "button", { name: "Lend out" }),
    );
    expect(raw).toMatch(/Here are the matching elements:/i);

    const compacted = formatMultipleElementsEvidence(raw)!;
    expect(hasParsedMultipleCandidates(compacted)).toBe(true);
    expect(compacted).toContain('role="button"');
    expect(compacted).toContain('name="Lend out"');
    expect(compacted).toContain('1. <button> name="Lend out"');
    expect(compacted).toContain('2. <button> name="Lend out"');
    expect(compacted).not.toContain("(none parsed)");
  });

  it("hasParsedMultipleCandidates rejects MATCHES PRESENT (none parsed)", () => {
    expect(
      hasParsedMultipleCandidates(
        `Found multiple elements with the text: Novel\n\nQUERY\ntext="Novel"\n\nMATCHES PRESENT\n(none parsed)\n`,
      ),
    ).toBe(false);
  });
});
