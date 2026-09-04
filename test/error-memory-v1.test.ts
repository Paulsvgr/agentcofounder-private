import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearErrorMemoryCatalogCache,
  entryMatchesFailText,
  errorMemoryV1EnabledFromEnvironment,
  formatErrorMemoryHintBlock,
  loadErrorMemoryCatalog,
  matchErrorMemoryEntries,
  processCanonicalVerifyForErrorMemory,
  resetErrorMemorySession,
  resolveErrorMemoryExportPath,
} from "../solution/extensions/error-memory-core.js";
import { resolveChallengeRuntimeEnv } from "../src/v2/challenge-prompt.js";
import { DEFAULT_CONFIG } from "../src/v2/config.js";
import { DEFAULT_TEMPLATE_OVERLAY_CONFIG } from "../src/v2/template-overlays.js";

const MULTIPLE_ROLE_FAIL = `
verify exit_code=1 (FAIL)

FAIL  filters the list to show only lent-out books
Found multiple elements with the role "button" and name "Lend out"
`;

const ACCESSIBLE_NAME_FAIL = `
verify exit_code=1 (FAIL)

FAIL  edits a book to fix a mistake
Unable to find an accessible element with the role "button" and name "Save changes"
`;

const STORAGE_ISOLATION_FAIL = `
verify exit_code=1 (FAIL)

FAIL  persists books across a remount
Unable to find an element with the text: No books yet
`;

describe("error-memory-core", () => {
  beforeEach(() => {
    clearErrorMemoryCatalogCache();
    delete process.env.HARNESS_ERROR_MEMORY_V1;
    delete process.env.CHALLENGE_RUN_ARTIFACT_DIR;
    resetErrorMemorySession();
  });

  afterEach(() => {
    clearErrorMemoryCatalogCache();
    delete process.env.HARNESS_ERROR_MEMORY_V1;
    delete process.env.CHALLENGE_RUN_ARTIFACT_DIR;
  });

  it("loads the seeded catalog with three families", () => {
    const catalog = loadErrorMemoryCatalog();
    expect(catalog.entries.map((e) => e.family)).toEqual([
      "rtl_multiple_elements",
      "rtl_accessible_name",
      "test_storage_isolation",
    ]);
  });

  it("matches RTL multiple-elements and accessible-name families", () => {
    const catalog = loadErrorMemoryCatalog();
    const multi = matchErrorMemoryEntries(MULTIPLE_ROLE_FAIL, catalog, new Set());
    expect(multi.map((h) => h.family)).toEqual(["rtl_multiple_elements"]);

    const accessible = matchErrorMemoryEntries(ACCESSIBLE_NAME_FAIL, catalog, new Set());
    expect(accessible.map((h) => h.family)).toEqual(["rtl_accessible_name"]);
  });

  it("matches storage isolation only when persist signal and require_any both hit", () => {
    const catalog = loadErrorMemoryCatalog();
    const entry = catalog.entries.find((e) => e.family === "test_storage_isolation")!;
    expect(entryMatchesFailText(entry, STORAGE_ISOLATION_FAIL)).toBe(true);
    expect(entryMatchesFailText(entry, "Unable to find No books yet")).toBe(false);
    expect(entryMatchesFailText(entry, "persists books across a remount only")).toBe(false);
  });

  it("is a no-op when the flag is off", () => {
    const out = processCanonicalVerifyForErrorMemory(MULTIPLE_ROLE_FAIL, 1);
    expect(out).toBe(MULTIPLE_ROLE_FAIL);
    expect(out).not.toContain("KNOWN ERROR MEMORY");
  });

  it("appends one hint per family per run and skips repeats", () => {
    process.env.HARNESS_ERROR_MEMORY_V1 = "1";
    const dir = mkdtempSync(path.join(tmpdir(), "error-memory-"));
    process.env.CHALLENGE_RUN_ARTIFACT_DIR = dir;
    resetErrorMemorySession();

    const first = processCanonicalVerifyForErrorMemory(MULTIPLE_ROLE_FAIL, 1);
    expect(first).toContain("KNOWN ERROR MEMORY (rtl_multiple_elements)");
    expect(first).toContain("within(row)");

    const second = processCanonicalVerifyForErrorMemory(MULTIPLE_ROLE_FAIL, 1);
    expect(second).toBe(MULTIPLE_ROLE_FAIL);
    expect(second).not.toContain("KNOWN ERROR MEMORY");

    const exportPath = resolveErrorMemoryExportPath()!;
    const record = JSON.parse(readFileSync(exportPath, "utf8"));
    expect(record.verify_fail_count).toBe(2);
    expect(record.hints_appended).toHaveLength(1);
    expect(record.families_hinted).toEqual(["rtl_multiple_elements"]);

    rmSync(dir, { recursive: true, force: true });
  });

  it("records pass_after_hint when VERIFY passes after a hint", () => {
    process.env.HARNESS_ERROR_MEMORY_V1 = "1";
    const dir = mkdtempSync(path.join(tmpdir(), "error-memory-pass-"));
    process.env.CHALLENGE_RUN_ARTIFACT_DIR = dir;
    resetErrorMemorySession();

    processCanonicalVerifyForErrorMemory(ACCESSIBLE_NAME_FAIL, 1);
    processCanonicalVerifyForErrorMemory("verify exit_code=0 (PASS)\n", 0);

    const record = JSON.parse(readFileSync(path.join(dir, "error-memory.v1.json"), "utf8"));
    expect(record.verify_pass_count).toBe(1);
    expect(record.pass_after_hint).toEqual([
      {
        verify_ordinal: 2,
        families_hinted_before_pass: ["rtl_accessible_name"],
      },
    ]);

    rmSync(dir, { recursive: true, force: true });
  });

  it("formats a compact hint block", () => {
    const block = formatErrorMemoryHintBlock([
      {
        family: "rtl_multiple_elements",
        cause: "ambiguous",
        hint: "use within(row)",
      },
    ]);
    expect(block).toContain("KNOWN ERROR MEMORY (rtl_multiple_elements)");
    expect(block).toContain("VERIFIED PATTERN: use within(row)");
  });

  it("wires HARNESS_ERROR_MEMORY_V1 into runtime env", () => {
    process.env.HARNESS_ERROR_MEMORY_V1 = "1";
    expect(errorMemoryV1EnabledFromEnvironment()).toBe(true);
    const env = resolveChallengeRuntimeEnv(DEFAULT_TEMPLATE_OVERLAY_CONFIG, {
      ...DEFAULT_CONFIG,
      harness_owned_verify: true,
    });
    expect(env.HARNESS_ERROR_MEMORY_V1).toBe("1");
  });
});
