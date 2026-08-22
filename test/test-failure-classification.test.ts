import { describe, expect, it } from "vitest";
import {
  classifyMultipleElementFailure,
  outputContainsMultipleElementsError,
} from "../src/test-failure-classification.js";

describe("test-failure-classification", () => {
  it("detects multiple-elements errors", () => {
    expect(outputContainsMultipleElementsError("Found multiple elements with the text: Book title")).toBe(
      true,
    );
  });

  it("classifies duplicate app shells as rtl_dom_leak", () => {
    const output = `
Found multiple elements with the text: Book title
<body>
  <main class="shell"><h1>Book tracker</h1></main>
  <main class="shell"><h1>Book tracker</h1></main>
</body>`;
    expect(classifyMultipleElementFailure(output)).toBe("rtl_dom_leak");
  });

  it("classifies single-shell ambiguity as query_ambiguity", () => {
    const output = `
Found multiple elements with the text: Category
<body>
  <main class="shell"><label>Category</label><span>Category</span></main>
</body>`;
    expect(classifyMultipleElementFailure(output)).toBe("query_ambiguity");
  });
});
