import { describe, expect, it } from "vitest";
import {
  bashCommandInspectsThemeStylesheet,
  bashCommandModifiesThemeStylesheet,
  bashCommandReferencesThemeStylesheet,
} from "../solution/extensions/protected-paths.js";

describe("theme stylesheet bash guards", () => {
  it("blocks representative read/inspect commands", () => {
    const blocked = [
      "cat src/styles.css",
      "head -n 50 src/styles.css",
      "sed -n '1,200p' src/styles.css",
      "grep ui-form src/styles.css",
      "cat ./src/styles.css",
    ];
    for (const command of blocked) {
      expect(bashCommandReferencesThemeStylesheet(command)).toBe(true);
      expect(bashCommandInspectsThemeStylesheet(command)).toBe(true);
      expect(bashCommandModifiesThemeStylesheet(command)).toBe(false);
    }
  });

  it("blocks representative write/modify commands", () => {
    const blocked = [
      "echo '.x{}' >> src/styles.css",
      "echo '.x{}' > src/styles.css",
      "sed -i 's/a/b/' src/styles.css",
      "cp backup.css src/styles.css",
      "tee src/styles.css < patch.css",
    ];
    for (const command of blocked) {
      expect(bashCommandReferencesThemeStylesheet(command)).toBe(true);
      expect(bashCommandModifiesThemeStylesheet(command)).toBe(true);
      expect(bashCommandInspectsThemeStylesheet(command)).toBe(false);
    }
  });

  it("allows unrelated bash usage", () => {
    const allowed = [
      "cat package.json",
      "ls -la src/styles.css",
      "find . -type f -not -path './node_modules/*' | head -60",
      "npm run build",
      "cat src/App.tsx && npm test 2>&1 | head",
    ];
    for (const command of allowed) {
      expect(bashCommandInspectsThemeStylesheet(command)).toBe(false);
      expect(bashCommandModifiesThemeStylesheet(command)).toBe(false);
    }
  });
});
