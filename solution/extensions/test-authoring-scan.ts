/**
 * Deterministic pre-VERIFY RTL pattern scanner (Appendix A — test-authoring-guard-v1).
 * F1–F5 are blocking; F6 is report-only in v1.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type GuardPatternId = "F1" | "F2" | "F3" | "F4" | "F5" | "F6";

export const BLOCKING_PATTERN_IDS: readonly GuardPatternId[] = ["F1", "F2", "F3", "F4", "F5"];
export const REPORT_ONLY_PATTERN_IDS: readonly GuardPatternId[] = ["F6"];

const PATTERN_PRIORITY: Record<GuardPatternId, number> = {
  F1: 1,
  F2: 2,
  F3: 3,
  F4: 4,
  F5: 5,
  F6: 6,
};

const F1_RISKY_LITERALS = new Set([
  "title",
  "name",
  "edit",
  "delete",
  "remove",
  "save",
  "cancel",
  "add",
  "status",
  "description",
  "email",
  "password",
  "search",
  "filter",
  "submit",
  "close",
  "open",
  "yes",
  "no",
]);

const F5_INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "textbox",
  "combobox",
  "listitem",
  "row",
  "cell",
]);

export const GUARD_PATTERN_HINTS: Record<GuardPatternId, string> = {
  F1: "Use within(container) or getByRole / getByLabelText instead of bare short getByText",
  F2: "Prefer getByRole / scoped query over unscoped regex getByText",
  F3: "Do not query via document / textContent / raw innerText — use Testing Library queries",
  F4: "Remove screen.debug() from journey tests",
  F5: "Add accessible name to getByRole or scope with within",
  F6: "Long unscoped getByText — scope or use role+name query",
};

export interface GuardViolation {
  patternId: GuardPatternId;
  file: string;
  line: number;
  hint: string;
  blocking: boolean;
}

export interface GuardScanResult {
  blockingHit: GuardViolation | null;
  reportOnlyHits: GuardViolation[];
  allViolations: GuardViolation[];
}

export interface TestSource {
  relativePath: string;
  content: string;
}

interface TestBlock {
  lines: string[];
  bodyStartIndex: number;
  hasWithin: boolean;
}

function compareViolations(a: GuardViolation, b: GuardViolation): number {
  const priority = PATTERN_PRIORITY[a.patternId] - PATTERN_PRIORITY[b.patternId];
  if (priority !== 0) return priority;
  const fileCmp = a.file.localeCompare(b.file);
  if (fileCmp !== 0) return fileCmp;
  return a.line - b.line;
}

function firstStringLiteralArgument(line: string, openParenIndex: number): string | null {
  const slice = line.slice(openParenIndex + 1);
  const match = /^\s*(['"`])([\s\S]*?)\1/.exec(slice);
  if (!match) return null;
  return match[2] ?? null;
}

function lineHasGetByText(line: string): number {
  const match = /(?:screen\.)?getByText\s*\(/.exec(line);
  return match?.index ?? -1;
}

function matchesF1(line: string, blockHasWithin: boolean): boolean {
  if (blockHasWithin) return false;
  const idx = lineHasGetByText(line);
  if (idx < 0) return false;
  const literal = firstStringLiteralArgument(line, line.indexOf("(", idx));
  if (literal === null) return false;
  return F1_RISKY_LITERALS.has(literal.trim().toLowerCase());
}

function matchesF2(line: string, blockHasWithin: boolean): boolean {
  if (blockHasWithin) return false;
  return /(?:screen\.)?getByText\s*\(\s*\//.test(line) || /(?:screen\.)?getByText\s*\(\s*new\s+RegExp/.test(line);
}

function matchesF3(line: string): boolean {
  if (/(?:screen\.)?getByText\s*\(\s*document\./.test(line)) return true;
  if (/querySelector\s*\([^)]{0,80}textContent/.test(line)) return true;
  if (/innerText/.test(line) && /expect\s*\(/.test(line)) {
    if (!/getByRole/.test(line) && !/getByLabelText/.test(line)) return true;
  }
  return false;
}

function matchesF4(line: string): boolean {
  return /screen\.debug\s*\(/.test(line) || /\.debug\s*\(\s*\)/.test(line);
}

function lineHasWithinBeforeGetByRole(line: string): boolean {
  const roleIndex = line.search(/(?:screen\.)?getByRole\s*\(/);
  if (roleIndex < 0) return false;
  const withinIndex = line.lastIndexOf("within(", roleIndex);
  return withinIndex >= 0;
}

function matchesF5(line: string): boolean {
  if (lineHasWithinBeforeGetByRole(line)) return false;
  const roleMatch = /(?:screen\.)?getByRole\s*\(\s*(['"])([^'"]+)\1/.exec(line);
  if (!roleMatch) return false;
  const role = roleMatch[2];
  if (!role || !F5_INTERACTIVE_ROLES.has(role)) return false;

  const afterRole = roleMatch.index + roleMatch[0].length;
  const tail = line.slice(afterRole);
  if (/,\s*\{[^}]*\bname\s*:/.test(tail)) return false;
  if (/,\s*\{\s*name\s*:/.test(tail)) return false;
  return true;
}

function matchesF6(line: string, blockHasWithin: boolean): boolean {
  if (blockHasWithin) return false;
  const idx = lineHasGetByText(line);
  if (idx < 0) return false;
  if (/(?:screen\.)?getByText\s*\(\s*\//.test(line)) return false;
  const literal = firstStringLiteralArgument(line, line.indexOf("(", idx));
  if (literal === null) return false;
  const trimmed = literal.trim();
  if (trimmed.length <= 12 || trimmed.length > 40) return false;
  if (/getByRole/.test(line) || /getByLabelText/.test(line)) return false;
  return true;
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function detectPatternsOnLine(
  line: string,
  block: TestBlock,
  relativePath: string,
  lineNumber: number,
): GuardViolation[] {
  const hits: GuardViolation[] = [];
  const push = (patternId: GuardPatternId, blocking: boolean) => {
    hits.push({
      patternId,
      file: relativePath,
      line: lineNumber,
      hint: GUARD_PATTERN_HINTS[patternId],
      blocking,
    });
  };

  if (matchesF1(line, block.hasWithin)) push("F1", true);
  if (matchesF2(line, block.hasWithin)) push("F2", true);
  if (matchesF3(line)) push("F3", true);
  if (matchesF4(line)) push("F4", true);
  if (matchesF5(line)) push("F5", true);
  if (matchesF6(line, block.hasWithin)) push("F6", false);
  return hits;
}

interface StringScanState {
  inSingle: boolean;
  inDouble: boolean;
  inTemplate: boolean;
  escaped: boolean;
}

function createStringScanState(): StringScanState {
  return { inSingle: false, inDouble: false, inTemplate: false, escaped: false };
}

function advanceStringScanState(state: StringScanState, char: string): void {
  if (state.escaped) {
    state.escaped = false;
    return;
  }
  if (char === "\\" && (state.inSingle || state.inDouble)) {
    state.escaped = true;
    return;
  }
  if (!state.inDouble && !state.inTemplate && char === "'") {
    state.inSingle = !state.inSingle;
    return;
  }
  if (!state.inSingle && !state.inTemplate && char === '"') {
    state.inDouble = !state.inDouble;
    return;
  }
  if (!state.inSingle && !state.inDouble && char === "`") {
    state.inTemplate = !state.inTemplate;
  }
}

function isInsideString(state: StringScanState): boolean {
  return state.inSingle || state.inDouble || state.inTemplate;
}

function findClosingParen(content: string, openIndex: number): number {
  let depth = 0;
  const state = createStringScanState();
  for (let i = openIndex; i < content.length; i += 1) {
    const char = content[i]!;
    advanceStringScanState(state, char);
    if (isInsideString(state)) continue;
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findArrowCallbackBrace(content: string, fromIndex: number): number {
  const state = createStringScanState();
  for (let i = fromIndex; i < content.length - 1; i += 1) {
    const char = content[i]!;
    advanceStringScanState(state, char);
    if (isInsideString(state)) continue;
    if (char === "=" && content[i + 1] === ">") {
      let braceIndex = i + 2;
      while (braceIndex < content.length && /\s/.test(content[braceIndex]!)) {
        braceIndex += 1;
      }
      if (content[braceIndex] === "{") return braceIndex;
    }
    if (
      content.startsWith("function", i) &&
      (i === 0 || !/\w/.test(content[i - 1]!))
    ) {
      const openParen = content.indexOf("(", i);
      if (openParen < 0) continue;
      const closeParen = findClosingParen(content, openParen);
      if (closeParen < 0) continue;
      let braceIndex = closeParen + 1;
      while (braceIndex < content.length && /\s/.test(content[braceIndex]!)) {
        braceIndex += 1;
      }
      if (content[braceIndex] === "{") return braceIndex;
    }
  }
  return -1;
}

function extractBalancedBraceBody(content: string, braceIndex: number): { body: string; endIndex: number } | null {
  if (content[braceIndex] !== "{") return null;
  let depth = 0;
  const state = createStringScanState();
  for (let i = braceIndex; i < content.length; i += 1) {
    const char = content[i]!;
    advanceStringScanState(state, char);
    if (isInsideString(state)) continue;
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          body: content.slice(braceIndex + 1, i),
          endIndex: i,
        };
      }
    }
  }
  return null;
}

export function extractTestBlocks(content: string): TestBlock[] {
  const blocks: TestBlock[] = [];
  const pattern = /\b(?:it|test)\s*\(/g;
  let match: RegExpExecArray | null = pattern.exec(content);
  while (match !== null) {
    const braceIndex = findArrowCallbackBrace(content, match.index);
    if (braceIndex >= 0) {
      const extracted = extractBalancedBraceBody(content, braceIndex);
      if (extracted) {
        blocks.push({
          lines: extracted.body.split("\n"),
          bodyStartIndex: braceIndex + 1,
          hasWithin: extracted.body.includes("within("),
        });
      }
    }
    match = pattern.exec(content);
  }
  return blocks;
}

export function scanTestSource(source: TestSource): GuardViolation[] {
  const violations: GuardViolation[] = [];
  for (const block of extractTestBlocks(source.content)) {
    let offset = 0;
    for (const line of block.lines) {
      const lineNumber = lineNumberAt(source.content, block.bodyStartIndex + offset);
      violations.push(...detectPatternsOnLine(line, block, source.relativePath, lineNumber));
      offset += line.length + 1;
    }
  }
  return violations;
}

export function scanTestSources(sources: TestSource[]): GuardScanResult {
  const allViolations = sources.flatMap(scanTestSource).sort(compareViolations);
  const blockingViolations = allViolations.filter((violation) => violation.blocking);
  const reportOnlyHits = allViolations.filter((violation) => !violation.blocking);
  return {
    blockingHit: blockingViolations[0] ?? null,
    reportOnlyHits,
    allViolations,
  };
}

function isTestFile(relativePath: string): boolean {
  return relativePath.endsWith(".test.ts") || relativePath.endsWith(".test.tsx");
}

function collectTestFiles(directory: string, relativeRoot: string, results: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return;
  }
  for (const entry of entries) {
    const absolute = path.join(directory, entry);
    const relative = path.join(relativeRoot, entry).split(path.sep).join("/");
    let stat;
    try {
      stat = statSync(absolute);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      collectTestFiles(absolute, relative, results);
    } else if (isTestFile(relative)) {
      results.push(relative);
    }
  }
}

export function listTestSourcesUnderSrc(appRoot: string): TestSource[] {
  const srcRoot = path.join(appRoot, "src");
  const relativePaths: string[] = [];
  collectTestFiles(srcRoot, "src", relativePaths);
  relativePaths.sort();

  return relativePaths.map((relativePath) => ({
    relativePath,
    content: readFileSync(path.join(appRoot, relativePath), "utf8"),
  }));
}

export function scanTestDirectory(appRoot: string): GuardScanResult {
  return scanTestSources(listTestSourcesUnderSrc(appRoot));
}
