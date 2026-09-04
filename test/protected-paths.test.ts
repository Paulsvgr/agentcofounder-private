import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  bashCommandInspectsThemeStylesheet,
  bashCommandModifiesThemeStylesheet,
  cssVocabularyGuardsEnabledFromEnvironment,
} from "../solution/extensions/protected-paths.js";

describe("protected-paths CSS guards", () => {
  const previous = process.env.TEMPLATE_CSS_VOCABULARY;

  afterEach(() => {
    if (previous === undefined) delete process.env.TEMPLATE_CSS_VOCABULARY;
    else process.env.TEMPLATE_CSS_VOCABULARY = previous;
  });

  it("disables CSS guards when TEMPLATE_CSS_VOCABULARY is unset", () => {
    delete process.env.TEMPLATE_CSS_VOCABULARY;
    expect(cssVocabularyGuardsEnabledFromEnvironment()).toBe(false);
  });

  it("enables CSS guards when TEMPLATE_CSS_VOCABULARY=1", () => {
    process.env.TEMPLATE_CSS_VOCABULARY = "1";
    expect(cssVocabularyGuardsEnabledFromEnvironment()).toBe(true);
  });

  it("detects bash read of theme stylesheet", () => {
    expect(bashCommandInspectsThemeStylesheet("cat src/styles.css")).toBe(true);
    expect(bashCommandInspectsThemeStylesheet("grep ui-page src/styles.css")).toBe(true);
    expect(bashCommandInspectsThemeStylesheet("npm run dev")).toBe(false);
  });

  it("detects bash write of theme stylesheet", () => {
    expect(bashCommandModifiesThemeStylesheet("echo x > src/styles.css")).toBe(true);
    expect(bashCommandModifiesThemeStylesheet("sed -i 's/a/b/' src/styles.css")).toBe(true);
    expect(bashCommandModifiesThemeStylesheet("cat src/styles.css")).toBe(false);
  });
});
