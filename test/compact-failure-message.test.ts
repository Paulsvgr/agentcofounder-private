import { describe, expect, it } from "vitest";
import {
  REPAIR_PRESENT_HINT_LINE,
  appendRepairPresentHint,
  compactFailureMessage,
  extractAccessibleNamesForRole,
  extractMatchingElementBlocks,
  formatMultipleElementsEvidence,
  formatRoleNameEvidence,
  formatTextMissEvidence,
  formatTestContextBlock,
  hasParsedMultipleCandidates,
  hasPresentInventoryBlock,
  parseFailureFileLine,
  parseQueriedMultiple,
  parseQueriedRoleName,
  parseQueriedTextMiss,
  primaryMessageLineCount,
  verifyRepairPresentHintV1EnabledFromEnvironment,
  verifyTestContextEvidenceV1EnabledFromEnvironment,
} from "../app-template-base/compactFailureMessage.ts";

/**
 * Synthetic full Testing Library dump matching the 207k forensic:
 * test wants button "Add book"; UI has "+ Add book" (and other buttons).
 * Historical compact reporter truncated before the button section.
 */
export const FAIL_207K_FULL_RTL = `Unable to find an accessible element with the role "button" and name "Add book"

Here are the accessible roles:

  main:

  Name "":
  <main
    class="shell"
  />

  --------------------------------------------------
  banner:

  Name "":
  <header
    class="app-header"
  />

  --------------------------------------------------
  heading:

  Name "My Bookshelf":
  <h1 />

  --------------------------------------------------
  button:

  Name "+ Add book":
  <button
    type="button"
  />

  --------------------------------------------------
  button:

  Name "All":
  <button
    type="button"
  />

  --------------------------------------------------
  button:

  Name "Lent out":
  <button
    type="button"
  />

  --------------------------------------------------
<body>
  <div>
    <main class="shell">...</main>
  </div>
</body>
`;

const FAIL_LIST_ABSENT = `Unable to find an accessible element with the role "list" and name "Book list"

Here are the accessible roles:

  main:

  Name "":
  <main
    class="shell"
  />

  --------------------------------------------------
  banner:

  Name "":
  <header
    class="app-header"
  />

  --------------------------------------------------
`;

const FAIL_ORDINARY_ASSERTION = `expected 2 to be 3`;

/** Audit Fiction/Science: option + badge — prettyDOM multiline. */
export const FAIL_MULTIPLE_TEXT_SCIENCE = `Found multiple elements with the text: Science

Here are the matching elements:

<option
  value="Science"
>
  Science
</option>

<span
  class="badge"
>
  Science
</span>

(If this is intentional, then use the \`*AllBy*\` variant of the query (like \`queryAllByText\`, \`getAllByText\`, or \`findAllByText\`) instead.)
`;

/** Audit Lend out: two row action buttons. */
export const FAIL_MULTIPLE_ROLE_LEND_OUT = `Found multiple elements with the role "button" and name "Lend out"

Here are the matching elements:

<button
  type="button"
>
  Lend out
</button>

<button
  type="button"
>
  Lend out
</button>

(If this is intentional, then use the \`*AllBy*\` variant of the query (like \`queryAllByRole\`, \`getAllByRole\`, or \`findAllByRole\`) instead.)
`;

describe("compactFailureMessage — relevance-preserving RTL", () => {
  it("parses queried role and name from 207k-style message", () => {
    expect(parseQueriedRoleName(FAIL_207K_FULL_RTL)).toEqual({
      role: "button",
      name: "Add book",
    });
  });

  it("extracts button accessible names including + Add book", () => {
    expect(extractAccessibleNamesForRole(FAIL_207K_FULL_RTL, "button")).toEqual([
      "+ Add book",
      "All",
      "Lent out",
    ]);
  });

  it("legacy line-count truncation hides button names (207k regression)", () => {
    const legacy = primaryMessageLineCount(FAIL_207K_FULL_RTL);
    expect(legacy).toContain('name "Add book"');
    expect(legacy).toContain("main:");
    expect(legacy).toContain("banner:");
    expect(legacy).not.toContain("+ Add book");
    expect(legacy).not.toMatch(/\bbutton:/);
  });

  it("offline 207k replay: compacted MESSAGE keeps queried + actual candidates", () => {
    const compacted = compactFailureMessage(FAIL_207K_FULL_RTL);
    expect(compacted).toContain('role="button"');
    expect(compacted).toContain('name="Add book"');
    expect(compacted).toContain("QUERIED");
    expect(compacted).toContain("BUTTONS PRESENT");
    expect(compacted).toContain('"+ Add book"');
    expect(compacted).toContain('"All"');
    expect(compacted).toContain('"Lent out"');
    expect(compacted).not.toMatch(/^main:/m);
  });

  it("lists (none) when queried role is absent from the dump", () => {
    const compacted = compactFailureMessage(FAIL_LIST_ABSENT);
    expect(compacted).toContain('role="list"');
    expect(compacted).toContain('name="Book list"');
    expect(compacted).toContain("LISTS PRESENT");
    expect(compacted).toContain("(none)");
  });

  it("leaves ordinary assertions on the legacy path", () => {
    expect(formatRoleNameEvidence(FAIL_ORDINARY_ASSERTION)).toBeNull();
    expect(compactFailureMessage(FAIL_ORDINARY_ASSERTION)).toBe("expected 2 to be 3");
  });

  it("112k-style: longer aria-label candidate survives compaction", () => {
    const msg = `Unable to find an accessible element with the role "button" and name "Save changes"

Here are the accessible roles:

  main:

  Name "":
  <main
    class="ui-page"
  />

  --------------------------------------------------
  region:

  Name "My Library":
  <section
    aria-labelledby="page-title"
  />

  --------------------------------------------------
  heading:

  Name "My Library":
  <h1
    id="page-title"
  />

  --------------------------------------------------
  button:

  Name "Save changes to book":
  <button type="submit" />

  --------------------------------------------------
  button:

  Name "Add book":
  <button type="button" />

`;
    const compacted = compactFailureMessage(msg);
    expect(compacted).toContain('name="Save changes"');
    expect(compacted).toContain('"Save changes to book"');
    expect(primaryMessageLineCount(msg)).not.toContain("Save changes to book");
  });

  it("control arm: HARNESS_VERIFY_RTL_EVIDENCE_V1=0 restores legacy truncation", () => {
    const legacyEnv = { HARNESS_VERIFY_RTL_EVIDENCE_V1: "0" } as NodeJS.ProcessEnv;
    const compacted = compactFailureMessage(FAIL_207K_FULL_RTL, legacyEnv);
    expect(compacted).not.toContain("QUERIED");
    expect(compacted).not.toContain("+ Add book");
    expect(compacted).toContain("banner:");
  });

  it("repair PRESENT hint default OFF; ON appends one footer when BUTTONS PRESENT", () => {
    expect(verifyRepairPresentHintV1EnabledFromEnvironment({})).toBe(false);
    const off = compactFailureMessage(FAIL_207K_FULL_RTL, {});
    expect(off).toContain("BUTTONS PRESENT");
    expect(off).not.toContain("REPAIR: use QUERIED vs PRESENT");

    const onEnv = { HARNESS_VERIFY_REPAIR_PRESENT_HINT_V1: "1" } as NodeJS.ProcessEnv;
    const on = compactFailureMessage(FAIL_207K_FULL_RTL, onEnv);
    expect(on).toContain("BUTTONS PRESENT");
    expect(on).toContain(REPAIR_PRESENT_HINT_LINE);
    expect(on.split(REPAIR_PRESENT_HINT_LINE)).toHaveLength(2);
  });

  it("repair PRESENT hint skips when no PRESENT inventory", () => {
    const onEnv = { HARNESS_VERIFY_REPAIR_PRESENT_HINT_V1: "1" } as NodeJS.ProcessEnv;
    expect(hasPresentInventoryBlock("expected 2 to be 3")).toBe(false);
    expect(appendRepairPresentHint("expected 2 to be 3", onEnv)).toBe("expected 2 to be 3");
    expect(compactFailureMessage(FAIL_ORDINARY_ASSERTION, onEnv)).toBe("expected 2 to be 3");
  });
});

describe("compactFailureMessage — multiple-elements evidence", () => {
  it("parses text and role+name multiple queries", () => {
    expect(parseQueriedMultiple(FAIL_MULTIPLE_TEXT_SCIENCE)).toEqual({
      kind: "text",
      text: "Science",
    });
    expect(parseQueriedMultiple(FAIL_MULTIPLE_ROLE_LEND_OUT)).toEqual({
      kind: "role_name",
      role: "button",
      name: "Lend out",
    });
  });

  it("extracts prettyDOM matching-element blocks", () => {
    const blocks = extractMatchingElementBlocks(FAIL_MULTIPLE_TEXT_SCIENCE);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatch(/^<option/);
    expect(blocks[1]).toMatch(/^<span/);
  });

  it("legacy tag-token scrape collapses Science to closing tags (audit regression)", () => {
    const elementRe = /<[^>\n]{1,200}>/g;
    const tags: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = elementRe.exec(FAIL_MULTIPLE_TEXT_SCIENCE)) !== null) {
      tags.push(match[0]);
    }
    expect(tags).toContain("</option>");
    expect(tags).toContain("</span>");
    expect(tags.some((t) => t.includes("Science"))).toBe(false);
  });

  it("offline Science replay: QUERY + option/span candidates with text and class", () => {
    const compacted = compactFailureMessage(FAIL_MULTIPLE_TEXT_SCIENCE);
    expect(compacted).toContain("QUERY");
    expect(compacted).toContain('text="Science"');
    expect(compacted).toContain("MATCHES PRESENT");
    expect(compacted).toContain('1. <option> text="Science"');
    expect(compacted).toContain('2. <span> text="Science" class="badge"');
    expect(compacted).not.toContain("*AllBy*");
    expect(compacted).not.toContain("within");
  });

  it("parses live-shaped dump with Ignored nodes prefix (cohort regression)", () => {
    // Shape observed in vivo (ANSI stripped): blocks do not start with "<".
    const liveShaped = `Found multiple elements with the text: Science

Here are the matching elements:

Ignored nodes: comments, script, style
<option
  value="Science"
>
  Science
</option>

Ignored nodes: comments, script, style
<span
  class="badge"
>
  Science
</span>

(If this is intentional, then use the \`*AllBy*\` variant of the query)
`;
    expect(extractMatchingElementBlocks(liveShaped)).toHaveLength(2);
    const compacted = compactFailureMessage(liveShaped);
    expect(compacted).toContain('1. <option> text="Science"');
    expect(compacted).toContain('2. <span> text="Science" class="badge"');
    expect(compacted).not.toContain("(none parsed)");
    expect(hasParsedMultipleCandidates(compacted)).toBe(true);
  });

  it("parses Ignored-nodes chunks without blank-line separators (165k hygiene)", () => {
    // Compact dumps sometimes omit the blank line between prettyDOM blocks.
    const tight = `Found multiple elements with the text: Novel

Here are the matching elements:
Ignored nodes: comments, script, style
<option
  value="Novel"
>
  Novel
</option>
Ignored nodes: comments, script, style
<span
  class="badge"
>
  Novel
</span>
(If this is intentional, then use the \`*AllBy*\` variant of the query)
`;
    expect(extractMatchingElementBlocks(tight)).toHaveLength(2);
    const compacted = compactFailureMessage(tight);
    expect(hasParsedMultipleCandidates(compacted)).toBe(true);
    expect(compacted).toContain('1. <option> text="Novel"');
    expect(compacted).toContain('2. <span> text="Novel" class="badge"');
    expect(compacted).not.toContain("(none parsed)");
  });

  it("never emits MATCHES PRESENT (none parsed) placeholder", () => {
    const empty = `Found multiple elements with the text: Fiction

Here are the matching elements:

(If this is intentional, then use the \`*AllBy*\` variant)
`;
    expect(formatMultipleElementsEvidence(empty)).toBeNull();
    const compacted = compactFailureMessage(empty);
    expect(compacted).not.toContain("MATCHES PRESENT");
    expect(compacted).not.toContain("(none parsed)");
  });

  it("returns null (no false MATCHES PRESENT) when matching section has no elements", () => {
    const empty = `Found multiple elements with the text: Fiction

Here are the matching elements:

(If this is intentional, then use the \`*AllBy*\` variant)
`;
    expect(formatMultipleElementsEvidence(empty)).toBeNull();
  });

  it("offline Lend out replay: role QUERY + two button candidates", () => {
    const compacted = compactFailureMessage(FAIL_MULTIPLE_ROLE_LEND_OUT);
    expect(compacted).toContain("QUERY");
    expect(compacted).toContain('role="button"');
    expect(compacted).toContain('name="Lend out"');
    expect(compacted).toContain("MATCHES PRESENT");
    expect(compacted).toContain('1. <button> name="Lend out" type="button"');
    expect(compacted).toContain('2. <button> name="Lend out" type="button"');
    expect(compacted).not.toContain("*AllBy*");
  });

  it("formatMultipleElementsEvidence is null without matching-elements dump", () => {
    expect(
      formatMultipleElementsEvidence("Found multiple elements with the text: Fiction\n"),
    ).toBeNull();
  });

  it("control arm: HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1=0 skips structured candidates", () => {
    const legacyEnv = {
      HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1: "0",
    } as NodeJS.ProcessEnv;
    const compacted = compactFailureMessage(FAIL_MULTIPLE_TEXT_SCIENCE, legacyEnv);
    expect(compacted).not.toContain("MATCHES PRESENT");
    expect(compacted).not.toContain('class="badge"');
    expect(compacted).toContain("Found multiple elements with the text: Science");
  });

  it("does not claim test vs product; no within() advice", () => {
    const evidence = formatMultipleElementsEvidence(FAIL_MULTIPLE_TEXT_SCIENCE)!;
    expect(evidence.toLowerCase()).not.toContain("within");
    expect(evidence.toLowerCase()).not.toContain("use getall");
    expect(evidence.toLowerCase()).not.toContain("intentional");
  });
});

/** Grammar-drift miss: test wants "are"; product dump has "is" (audit A3). */
export const FAIL_TEXT_MISS_GRAMMAR = `Unable to find an element with the text: 1 are currently lent out. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Ignored nodes: comments, script, style
<body>
  <div>
    <h1>
      My Library
    </h1>
    <p>
      1 is currently lent out.
    </p>
    <p>
      1 book on the shelf.
    </p>
  </div>
</body>
`;

/** Split empty-state: exact short query vs parent textContent with <strong> (audit A1). */
export const FAIL_TEXT_MISS_SPLIT = `Unable to find an element with the text: Your library is empty. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Here are the matching elements:

Ignored nodes: comments, script, style
<body>
  <div>
    <p>
      Your library is empty. Click
      <strong>
        + Add a book
      </strong>
      to get started.
    </p>
  </div>
</body>
`;

describe("compactFailureMessage — text-miss evidence", () => {
  const treatmentEnv = {
    HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1: "1",
  } as NodeJS.ProcessEnv;

  it("parses text and display-value queries; strips tip from parse", () => {
    expect(parseQueriedTextMiss(FAIL_TEXT_MISS_GRAMMAR)).toEqual({
      kind: "text",
      text: "1 are currently lent out",
    });
    expect(
      parseQueriedTextMiss(
        'Unable to find an element with the display value: Dune.\n\nIgnored nodes:\n<body><input value=""/></body>',
      ),
    ).toEqual({ kind: "display_value", text: "Dune" });
  });

  it("legacy path keeps tip and drops useful copy into tag MATCHES risk", () => {
    const legacy = compactFailureMessage(FAIL_TEXT_MISS_GRAMMAR, {
      HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1: "0",
    } as NodeJS.ProcessEnv);
    expect(legacy).toMatch(/function for your text matcher/i);
    expect(legacy).not.toContain("VISIBLE TEXT");
    expect(legacy).not.toContain("1 is currently lent out");
  });

  it("grammar miss: QUERIED + VISIBLE TEXT shows product copy without tip", () => {
    const compacted = compactFailureMessage(FAIL_TEXT_MISS_GRAMMAR, treatmentEnv);
    expect(compacted).toContain("QUERIED");
    expect(compacted).toContain('text="1 are currently lent out"');
    expect(compacted).toContain("VISIBLE TEXT");
    expect(compacted).toContain("1 is currently lent out");
    expect(compacted).not.toMatch(/function for your text matcher/i);
    expect(compacted.toLowerCase()).not.toContain("provide a function");
  });

  it("split miss: surfaces parent textContent spanning strong", () => {
    const compacted = compactFailureMessage(FAIL_TEXT_MISS_SPLIT, treatmentEnv);
    expect(compacted).toContain("VISIBLE TEXT");
    expect(compacted).toMatch(/Your library is empty\. Click/);
    expect(compacted).toContain("+ Add a book");
    expect(compacted).not.toMatch(/function for your text matcher/i);
  });

  it("default ON when unset (KEEP)", () => {
    const compacted = compactFailureMessage(FAIL_TEXT_MISS_GRAMMAR, {} as NodeJS.ProcessEnv);
    expect(compacted).toContain("VISIBLE TEXT");
  });

  it("returns null without DOM dump", () => {
    expect(
      formatTextMissEvidence("Unable to find an element with the text: Hello\n"),
    ).toBeNull();
  });

  it("no advice in evidence", () => {
    const evidence = formatTextMissEvidence(FAIL_TEXT_MISS_GRAMMAR)!;
    expect(evidence.toLowerCase()).not.toContain("matcher");
    expect(evidence.toLowerCase()).not.toContain("flexible");
    expect(evidence.toLowerCase()).not.toContain("within");
  });
});

describe("TEST CONTEXT evidence v1", () => {
  const sample = `it("lend return", async () => {
  await user.click(screen.getByRole("button", { name: /^Lent out/i }));
  expect(screen.getByRole("heading", { name: "Dune" })).toBeInTheDocument();
  // Mark returned
  await user.click(within(row).getByRole("button", { name: "Mark returned" }));
  // "Lend out" button is back
  row = screen.getByRole("heading", { name: "Dune" }).closest("li")!;
  expect(within(row).getByRole("button", { name: "Lend out" })).toBeInTheDocument();
});
`;

  it("parses AT file:line", () => {
    const parsed = parseFailureFileLine(
      "at /tmp/app/src/App.test.tsx:65:18",
    );
    expect(parsed).toEqual({ filePath: "/tmp/app/src/App.test.tsx", line: 65 });
  });

  it("formats exact window with fail marker — no advice", () => {
    const block = formatTestContextBlock(sample, 7);
    expect(block).toContain("TEST CONTEXT");
    expect(block).toContain(">   7|");
    expect(block).toContain('getByRole("heading", { name: "Dune" })');
    expect(block).toContain("Mark returned");
    expect(block!.toLowerCase()).not.toContain("filter is wrong");
    expect(block!.toLowerCase()).not.toContain("edit the test");
    expect(block!.toLowerCase()).not.toContain("maybe");
    expect(block).not.toContain("RECENT TEST ACTIONS");
  });

  it("flag defaults OFF", () => {
    expect(verifyTestContextEvidenceV1EnabledFromEnvironment({})).toBe(false);
    expect(
      verifyTestContextEvidenceV1EnabledFromEnvironment({
        HARNESS_VERIFY_TEST_CONTEXT_EVIDENCE_V1: "1",
      }),
    ).toBe(true);
  });
});
