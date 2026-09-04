/**
 * Relevance-preserving compaction for Vitest/Testing Library failure messages.
 *
 * For role+name misses, keep queried role/name and accessible-name candidates
 * for that role instead of the first N lines of the roles dump.
 * For multiple-elements failures, keep matching-element candidates (tag + text
 * / attrs) instead of tag-token MATCHES scraped by regex.
 * For text / display-value misses, strip the stock function-matcher tip and
 * surface visible strings already present in the container dump.
 * No advice — facts only.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

export interface QueriedRoleName {
  role: string;
  name: string;
}

export type QueriedMultiple =
  | { kind: "text"; text: string }
  | { kind: "role_name"; role: string; name: string };

const ROLE_PRESENT_HEADERS: Record<string, string> = {
  button: "BUTTONS PRESENT",
  list: "LISTS PRESENT",
  link: "LINKS PRESENT",
  heading: "HEADINGS PRESENT",
  textbox: "TEXTBOXES PRESENT",
  searchbox: "SEARCHBOXES PRESENT",
  checkbox: "CHECKBOXES PRESENT",
  radio: "RADIOS PRESENT",
  img: "IMAGES PRESENT",
  dialog: "DIALOGS PRESENT",
  option: "OPTIONS PRESENT",
  combobox: "COMBOBOXES PRESENT",
};

export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9?]*[ -/]*[@-~]/g, "");
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/**
 * Legacy line-count compaction (pre relevance-preserving). Kept for non-RTL
 * failures and for offline A/B against historical truncation.
 */
export function primaryMessageLineCount(message: string, maxLines = 12): string {
  const cleaned = stripAnsi(message).replace(/\r/g, "");
  const withoutBody = cleaned.split(/(?:Here are the matching|<body>)/i)[0] ?? cleaned;
  const lines = withoutBody
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines);
  return lines.join("\n");
}

export function parseQueriedRoleName(message: string): QueriedRoleName | null {
  const cleaned = stripAnsi(message);
  const match = cleaned.match(
    /Unable to find an accessible element with the role ["']([^"']+)["'] and name ["']([^"']+)["']/i,
  );
  if (!match) return null;
  return { role: match[1]!, name: match[2]! };
}

/**
 * Extract accessible names listed under a role in Testing Library's
 * "Here are the accessible roles:" dump.
 */
export function extractAccessibleNamesForRole(message: string, role: string): string[] {
  const cleaned = stripAnsi(message).replace(/\r/g, "");
  const rolesIdx = cleaned.search(/Here are the accessible roles:/i);
  if (rolesIdx < 0) return [];

  const dump = cleaned.slice(rolesIdx);
  const headerRe = /^[ \t]*([a-zA-Z][a-zA-Z0-9-]*)[ \t]*:[ \t]*$/gm;
  const headers: Array<{ role: string; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(dump)) !== null) {
    headers.push({ role: match[1]!, index: match.index });
  }

  const names: string[] = [];
  const target = role.toLowerCase();
  for (let i = 0; i < headers.length; i += 1) {
    if (headers[i]!.role.toLowerCase() !== target) continue;
    const start = headers[i]!.index;
    const end = i + 1 < headers.length ? headers[i + 1]!.index : dump.length;
    const section = dump.slice(start, end);
    for (const nameMatch of section.matchAll(/Name\s+["']([^"']*)["']\s*:/g)) {
      names.push(nameMatch[1]!);
      if (names.length >= 12) return names;
    }
  }
  return names;
}

function rolePresentHeader(role: string): string {
  return ROLE_PRESENT_HEADERS[role.toLowerCase()] ?? `ROLE "${role}" PRESENT`;
}

/**
 * When the failure is a role+name miss and a roles dump exists, emit
 * queried role/name + candidates for that role. Otherwise null (caller
 * falls back to line-count compaction).
 */
export function formatRoleNameEvidence(message: string): string | null {
  const queried = parseQueriedRoleName(message);
  if (!queried) return null;
  if (!/Here are the accessible roles:/i.test(message)) return null;

  const names = extractAccessibleNamesForRole(message, queried.role);
  const headline =
    `Unable to find an accessible element with the role "${queried.role}" and name "${queried.name}"`;
  const presentFormatted =
    names.length === 0 ? ["(none)"] : names.map((name) => `- "${name}"`);

  return [
    headline,
    "",
    "QUERIED",
    `role="${queried.role}"`,
    `name="${queried.name}"`,
    "",
    rolePresentHeader(queried.role),
    ...presentFormatted,
  ].join("\n");
}

function envFlagEnabled(raw: string | undefined, defaultOn: boolean): boolean {
  if (raw === undefined || raw.trim() === "") return defaultOn;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  return defaultOn;
}

/**
 * Treatment toggle for relevance-preserving role/name evidence.
 * Default ON when unset (KEEP). Control cohort sets =0.
 */
export function verifyRtlEvidenceV1EnabledFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagEnabled(env.HARNESS_VERIFY_RTL_EVIDENCE_V1, true);
}

/**
 * Treatment toggle for multiple-elements candidate evidence.
 * Default ON when unset. Control cohort sets =0.
 */
export function verifyRtlMultipleEvidenceV1EnabledFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagEnabled(env.HARNESS_VERIFY_RTL_MULTIPLE_EVIDENCE_V1, true);
}

/**
 * Treatment toggle for text / display-value miss evidence.
 * Default ON when unset (KEEP as factual reporter). Control sets =0.
 */
export function verifyRtlTextEvidenceV1EnabledFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagEnabled(env.HARNESS_VERIFY_RTL_TEXT_EVIDENCE_V1, true);
}

export type QueriedTextMiss =
  | { kind: "text"; text: string }
  | { kind: "display_value"; text: string };

export function parseQueriedTextMiss(message: string): QueriedTextMiss | null {
  const cleaned = stripAnsi(message);
  const display = cleaned.match(
    /Unable to find an element with the display value:\s*([^\n]+?)(?:\.?\s*$|\.\s+This|\n)/i,
  );
  if (display) {
    return { kind: "display_value", text: display[1]!.trim().replace(/\.$/, "") };
  }
  const text = cleaned.match(
    /Unable to find an element with the text:\s*([^\n]+?)(?:\.?\s*$|\.\s+This|\n)/i,
  );
  if (text) {
    return { kind: "text", text: text[1]!.trim().replace(/\.$/, "") };
  }
  return null;
}

/**
 * Container / prettyDOM dump after a text miss (body or matching-elements section).
 */
export function extractTextMissDomDump(message: string): string | null {
  const cleaned = stripAnsi(message).replace(/\r/g, "");
  const matching = cleaned.split(/Here are the matching elements:/i);
  if (matching.length >= 2) {
    let body = matching[1] ?? "";
    body = body.split(/\(If this is intentional/i)[0] ?? body;
    body = body.trim();
    if (body.length > 0) return body;
  }
  const ignored = cleaned.search(/Ignored nodes:/i);
  if (ignored >= 0) {
    return cleaned.slice(ignored).trim();
  }
  const bodyIdx = cleaned.search(/<body[\s>]/i);
  if (bodyIdx >= 0) {
    return cleaned.slice(bodyIdx).trim();
  }
  return null;
}

function tokenizeForOverlap(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length >= 2),
  );
}

function overlapScore(candidate: string, query: string): number {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  if (c.includes(q) || q.includes(c)) return 1000 + Math.min(c.length, 200);
  const qt = tokenizeForOverlap(query);
  if (qt.size === 0) return 0;
  let hit = 0;
  for (const tok of tokenizeForOverlap(candidate)) {
    if (qt.has(tok)) hit += 1;
  }
  return hit;
}

/**
 * Visible strings already present in the DOM dump (facts only).
 * Includes leaf text nodes and whole-dump textContent.
 */
export function extractVisibleTextsFromDomDump(dump: string): string[] {
  const texts: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string): void => {
    const text = raw.replace(/\s+/g, " ").trim();
    if (text.length < 2 || text.length > 200) return;
    if (/^ignored nodes:/i.test(text)) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    texts.push(text);
  };

  const leaves: string[] = [];
  for (const match of dump.matchAll(/>([^<]+)</g)) {
    const leaf = (match[1] ?? "").replace(/\s+/g, " ").trim();
    if (leaf.length >= 1 && !/^ignored nodes:/i.test(leaf)) {
      leaves.push(leaf);
      push(leaf);
    }
  }

  // Joined leaf text (split copy across nested tags — audit A1).
  if (leaves.length > 1) {
    push(leaves.join(" "));
  }

  // Whole-container textContent fallback.
  push(dump.replace(/<[^>]+>/g, " "));

  // Input / option values often matter for display-value misses.
  for (const match of dump.matchAll(/\b(?:value|aria-label|placeholder)=["']([^"']+)["']/gi)) {
    push(match[1] ?? "");
  }

  return texts;
}

/**
 * When the failure is a text / display-value miss, emit queried string +
 * visible dump strings. Strips RTL's stock function-matcher tip. Returns null
 * if no dump texts can be parsed (no false VISIBLE TEXT).
 */
export function formatTextMissEvidence(message: string): string | null {
  const queried = parseQueriedTextMiss(message);
  if (!queried) return null;
  const dump = extractTextMissDomDump(message);
  if (!dump) return null;

  const visible = extractVisibleTextsFromDomDump(dump);
  if (visible.length === 0) return null;

  const ranked = [...visible].sort(
    (a, b) => overlapScore(b, queried.text) - overlapScore(a, queried.text),
  );
  // Prefer relevant strings; keep a few others for context.
  const relevant = ranked.filter((t) => overlapScore(t, queried.text) > 0);
  const chosen = (relevant.length > 0 ? relevant : ranked).slice(0, 10);

  const headline =
    queried.kind === "display_value"
      ? `Unable to find an element with the display value: ${queried.text}`
      : `Unable to find an element with the text: ${queried.text}`;

  const queryLines =
    queried.kind === "display_value"
      ? ["QUERIED", `display-value="${queried.text}"`]
      : ["QUERIED", `text="${queried.text}"`];

  return [
    headline,
    "",
    ...queryLines,
    "",
    "VISIBLE TEXT",
    ...chosen.map((text, i) => `${i + 1}. "${truncate(text, 100)}"`),
  ].join("\n");
}

export function parseQueriedMultiple(message: string): QueriedMultiple | null {
  const cleaned = stripAnsi(message);
  const roleName = cleaned.match(
    /Found multiple elements with the role ["']([^"']+)["'] and name ["']([^"']+)["']/i,
  );
  if (roleName) {
    return { kind: "role_name", role: roleName[1]!, name: roleName[2]! };
  }
  const text = cleaned.match(/Found multiple elements with the text(?: of)?: ([^\n]+)/i);
  if (text) {
    return { kind: "text", text: text[1]!.trim().replace(/\.$/, "") };
  }
  return null;
}

/**
 * Split Testing Library's "Here are the matching elements:" prettyDOM blocks.
 * Real dumps prefix each element with "Ignored nodes: …" and use ANSI colors;
 * strip those so blocks start at the opening tag.
 *
 * Hygiene (2026-09-04): an earlier extractor required blocks to start with `<`
 * and therefore dropped every live chunk that began with `Ignored nodes:…`,
 * causing KEEP MULTIPLE evidence to emit `MATCHES PRESENT\n(none parsed)`
 * even when matches existed. Never emit that placeholder — return [] / null.
 */
export function extractMatchingElementBlocks(message: string): string[] {
  const cleaned = stripAnsi(message).replace(/\r/g, "");
  const split = cleaned.split(/Here are the matching elements:/i);
  if (split.length < 2) return [];
  let body = split[1] ?? "";
  body = body.split(/\(If this is intentional/i)[0] ?? body;

  // Live RTL delimits each prettyDOM element with an "Ignored nodes:" line.
  // Prefer that split when present; otherwise blank-line chunks.
  const rawChunks = /Ignored nodes:/i.test(body)
    ? body.split(/(?=Ignored nodes:)/i)
    : body.split(/\n\s*\n/);

  const blocks: string[] = [];
  for (const raw of rawChunks) {
    let block = raw.trim();
    if (!block) continue;
    // Live RTL: "Ignored nodes: comments, script, style\n<option …"
    block = block.replace(/^Ignored nodes:[^\n]*\n+/i, "").trim();
    if (!/^</.test(block)) {
      const tagIdx = block.search(/<[a-zA-Z]/);
      if (tagIdx < 0) continue;
      block = block.slice(tagIdx).trim();
    }
    // Skip container dumps accidentally left before the advice marker.
    if (/^<body[\s>]/i.test(block)) continue;
    blocks.push(block);
    if (blocks.length >= 8) break;
  }
  return blocks;
}

function attributeFromBlock(block: string, name: string): string | null {
  const re = new RegExp(`\\b${name}=["']([^"']*)["']`, "i");
  const match = block.match(re);
  return match?.[1] ?? null;
}

/**
 * Format one matching-element block as a factual candidate line.
 * Uses only tag, textContent, and attributes present in the dump.
 */
export function formatMatchingElementCandidate(block: string, index: number): string {
  const tag = block.match(/<([a-zA-Z][\w:-]*)/)?.[1]?.toLowerCase() ?? "?";
  const text = block
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const className = attributeFromBlock(block, "class");
  const value = attributeFromBlock(block, "value");
  const ariaLabel = attributeFromBlock(block, "aria-label");
  const type = attributeFromBlock(block, "type");
  const nameAttr = attributeFromBlock(block, "name");

  const parts: string[] = [`${index}. <${tag}>`];
  if (text) {
    // Buttons: accessible name is usually the text content.
    if (tag === "button" || tag === "a") {
      parts.push(`name="${text}"`);
    } else {
      parts.push(`text="${text}"`);
    }
  }
  if (ariaLabel && ariaLabel !== text) parts.push(`aria-label="${ariaLabel}"`);
  if (nameAttr && nameAttr !== text) parts.push(`attr-name="${nameAttr}"`);
  if (value && value !== text) parts.push(`value="${value}"`);
  if (className) parts.push(`class="${className}"`);
  if (type) parts.push(`type="${type}"`);
  return parts.join(" ");
}

/**
 * True when compacted MESSAGE has real candidates (not "(none parsed)").
 */
export function hasParsedMultipleCandidates(compacted: string): boolean {
  if (!/MATCHES PRESENT/i.test(compacted)) return false;
  if (/\(none parsed\)/i.test(compacted)) return false;
  return /^\d+\.\s+</m.test(compacted);
}

/**
 * When the failure is "Found multiple elements…", emit queried target +
 * candidates from the matching-elements dump. Returns null if the dump
 * cannot be parsed into at least one candidate (no false MATCHES PRESENT).
 */
export function formatMultipleElementsEvidence(message: string): string | null {
  const queried = parseQueriedMultiple(message);
  if (!queried) return null;
  if (!/Here are the matching elements:/i.test(message)) return null;

  const blocks = extractMatchingElementBlocks(message);
  if (blocks.length === 0) return null;

  const candidates = blocks
    .map((block, i) => formatMatchingElementCandidate(block, i + 1))
    .filter((line) => line.length > 0 && !/\(none parsed\)/i.test(line));
  if (candidates.length === 0) return null;

  const headline =
    queried.kind === "text"
      ? `Found multiple elements with the text: ${queried.text}`
      : `Found multiple elements with the role "${queried.role}" and name "${queried.name}"`;

  const queryLines =
    queried.kind === "text"
      ? ["QUERY", `text="${queried.text}"`]
      : ["QUERY", `role="${queried.role}"`, `name="${queried.name}"`];

  return [headline, "", ...queryLines, "", "MATCHES PRESENT", ...candidates].join("\n");
}

/**
 * Probe: one-line REPAIR hint when FAIL already has PRESENT inventory.
 * Default OFF. Does not add inventory — salience only.
 */
export function verifyRepairPresentHintV1EnabledFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagEnabled(env.HARNESS_VERIFY_REPAIR_PRESENT_HINT_V1, false);
}

export const REPAIR_PRESENT_HINT_LINE =
  "REPAIR: use QUERIED vs PRESENT to diagnose the current failure; don't repeat a query for a name absent from the current PRESENT evidence without changing the relevant UI state.";

export function hasPresentInventoryBlock(compacted: string): boolean {
  return (
    /\bBUTTONS PRESENT\b/.test(compacted) ||
    /\bHEADINGS PRESENT\b/.test(compacted) ||
    /\bLABELS PRESENT\b/.test(compacted) ||
    /\bLISTS PRESENT\b/.test(compacted) ||
    /\bTEXT PRESENT\b/.test(compacted) ||
    /\bVISIBLE TEXT\b/.test(compacted) ||
    /\bMATCHES PRESENT\b/.test(compacted) ||
    /\bOPTIONS PRESENT\b/.test(compacted)
  );
}

/** Append probe REPAIR line when PRESENT inventory already exists. */
export function appendRepairPresentHint(
  compacted: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!verifyRepairPresentHintV1EnabledFromEnvironment(env)) return compacted;
  if (!hasPresentInventoryBlock(compacted)) return compacted;
  if (compacted.includes("REPAIR: use QUERIED vs PRESENT")) return compacted;
  return `${compacted}\n\n${REPAIR_PRESENT_HINT_LINE}`;
}

/**
 * Compact a failure message for VERIFY stdout.
 * Role+name miss → candidates when enabled.
 * Multiple elements → candidates when enabled.
 * Text / display-value miss → visible dump strings when enabled.
 * Everything else → legacy line-count compaction.
 */
export function compactFailureMessage(
  message: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  let compacted: string;
  if (verifyRtlEvidenceV1EnabledFromEnvironment(env)) {
    const roleName = formatRoleNameEvidence(message);
    if (roleName) {
      compacted = roleName;
      return appendRepairPresentHint(compacted, env);
    }
  }
  if (verifyRtlMultipleEvidenceV1EnabledFromEnvironment(env)) {
    const multiple = formatMultipleElementsEvidence(message);
    if (multiple) {
      compacted = multiple;
      return appendRepairPresentHint(compacted, env);
    }
  }
  if (verifyRtlTextEvidenceV1EnabledFromEnvironment(env)) {
    const textMiss = formatTextMissEvidence(message);
    if (textMiss) {
      compacted = textMiss;
      return appendRepairPresentHint(compacted, env);
    }
  }
  compacted = primaryMessageLineCount(message);
  return appendRepairPresentHint(compacted, env);
}

/** True when role+name evidence path was used (skip noisy MATCHES). */
export function usedRoleNameEvidence(
  message: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!verifyRtlEvidenceV1EnabledFromEnvironment(env)) return false;
  return formatRoleNameEvidence(message) !== null;
}

/** True when multiple-elements evidence path was used (skip tag-token MATCHES). */
export function usedMultipleElementsEvidence(
  message: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!verifyRtlMultipleEvidenceV1EnabledFromEnvironment(env)) return false;
  return formatMultipleElementsEvidence(message) !== null;
}

/** True when text-miss evidence path was used (skip tip + tag-token MATCHES). */
export function usedTextMissEvidence(
  message: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!verifyRtlTextEvidenceV1EnabledFromEnvironment(env)) return false;
  return formatTextMissEvidence(message) !== null;
}

/** True when MESSAGE already carries structured RTL candidates. */
export function usedStructuredRtlEvidence(
  message: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    usedRoleNameEvidence(message, env) ||
    usedMultipleElementsEvidence(message, env) ||
    usedTextMissEvidence(message, env)
  );
}

/**
 * Treatment toggle for raw TEST CONTEXT (source window around AT file:line).
 * Default OFF until KEEP. Control sets =0; treatment =1.
 */
export function verifyTestContextEvidenceV1EnabledFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagEnabled(env.HARNESS_VERIFY_TEST_CONTEXT_EVIDENCE_V1, false);
}

export const TEST_CONTEXT_LINES_BEFORE = 8;
export const TEST_CONTEXT_LINES_AFTER = 4;
export const TEST_CONTEXT_MAX_CHARS = 800;

export interface ParsedFailureLocation {
  filePath: string;
  line: number;
}

/** Parse Vitest/stack AT location → path + 1-based line. */
export function parseFailureFileLine(location: string): ParsedFailureLocation | null {
  const cleaned = stripAnsi(location).replace(/\r/g, "").trim();
  if (!cleaned) return null;
  const patterns = [
    /(?:^|\s)(?:at\s+)?((?:file:\/\/\/?)?(?:[A-Za-z]:)?[^:\s()]+?\.(?:test|spec)\.[tj]sx?):(\d+)(?::\d+)?/,
    /(?:^|\s)(?:at\s+)?((?:file:\/\/\/?)?(?:[A-Za-z]:)?[^:\s()]+?\.[tj]sx?):(\d+)(?::\d+)?/,
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (!m?.[1] || !m[2]) continue;
    let filePath = m[1]!;
    if (filePath.startsWith("file:")) {
      try {
        filePath = fileURLToPath(filePath.includes("://") ? filePath : `file://${filePath}`);
      } catch {
        continue;
      }
    }
    const line = Number(m[2]);
    if (!Number.isSafeInteger(line) || line < 1) continue;
    return { filePath, line };
  }
  return null;
}

export function resolveFailureSourcePath(
  location: string,
  _moduleId?: string,
  cwd: string = process.cwd(),
): ParsedFailureLocation | null {
  const fromLocation = parseFailureFileLine(location);
  if (!fromLocation) return null;
  const filePath = path.isAbsolute(fromLocation.filePath)
    ? fromLocation.filePath
    : path.resolve(cwd, fromLocation.filePath);
  return { filePath, line: fromLocation.line };
}

/**
 * Build factual TEST CONTEXT block from source lines. No commentary.
 * Returns null if empty / invalid window.
 */
export function formatTestContextBlock(
  sourceText: string,
  failLine1Based: number,
  options?: {
    linesBefore?: number;
    linesAfter?: number;
    maxChars?: number;
  },
): string | null {
  const before = options?.linesBefore ?? TEST_CONTEXT_LINES_BEFORE;
  const after = options?.linesAfter ?? TEST_CONTEXT_LINES_AFTER;
  const maxChars = options?.maxChars ?? TEST_CONTEXT_MAX_CHARS;
  const lines = sourceText.replace(/\r/g, "").split("\n");
  if (lines.length === 0 || failLine1Based < 1 || failLine1Based > lines.length) {
    return null;
  }
  const start = Math.max(1, failLine1Based - before);
  const end = Math.min(lines.length, failLine1Based + after);
  const body: string[] = [];
  for (let n = start; n <= end; n++) {
    const raw = lines[n - 1] ?? "";
    const marker = n === failLine1Based ? ">" : " ";
    const num = String(n).padStart(4, " ");
    body.push(`${marker}${num}| ${raw}`);
  }
  let text = body.join("\n");
  if (text.length > maxChars) {
    while (text.length > maxChars && body.length > 1) {
      const failIdx = body.findIndex((l) => l.startsWith(">"));
      if (failIdx > 0) body.shift();
      else if (body.length > 1) body.pop();
      else break;
      text = body.join("\n");
    }
    if (text.length > maxChars) {
      text = `${text.slice(0, maxChars - 1)}…`;
    }
  }
  return `TEST CONTEXT\n${text}`;
}
