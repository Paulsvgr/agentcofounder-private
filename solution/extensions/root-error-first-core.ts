/**
 * Root-error-first VERIFY formatting.
 *
 * When VERIFY fails and the compact reporter includes a causal runtime/suite
 * error alongside Testing Library symptoms, surface the root error first.
 * No hints, no tsc, no prompts — reorder/label only.
 */

export const ROOT_ERROR_FIRST_V1_SCHEMA = "agentcofounder.root_error_first.v1" as const;

const ROOT_ERROR_NAMES = new Set([
  "TypeError",
  "ReferenceError",
  "SyntaxError",
  "RangeError",
  "EvalError",
  "URIError",
]);

const SECONDARY_ERROR_NAMES = new Set([
  "TestingLibraryElementError",
  "AssertionError",
]);

const ROOT_MESSAGE_PATTERNS: RegExp[] = [
  /\bTypeError:\s+/i,
  /\bReferenceError:\s+/i,
  /\bSyntaxError:\s+/i,
  /\bis not a function\b/i,
  /\bCannot find module\b/i,
  /\bCannot find package\b/i,
  /\bFailed to resolve import\b/i,
  /\bDoes the file exist\?/i,
  /\bFailed to fetch dynamically imported module\b/i,
  /\bFailed to load url\b/i,
  /\bERR_MODULE_NOT_FOUND\b/i,
  /\bCannot read propert(?:y|ies) of\b/i,
  /\bis not defined\b/i,
  /\bUnexpected token\b/i,
];

export interface CompactFailureBlock {
  indexLabel: string | null;
  failPath: string | null;
  testName: string | null;
  type: string | null;
  location: string | null;
  message: string;
  raw: string;
}

export interface RootErrorFirstResult {
  changed: boolean;
  text: string;
  rootCount: number;
  secondaryCount: number;
}

export function rootErrorFirstV1EnabledFromEnvironment(): boolean {
  const raw = process.env.HARNESS_ROOT_ERROR_FIRST_V1;
  if (raw === undefined || raw.trim() === "") return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9?]*[ -/]*[@-~]/g, "");
}

export function isRootRuntimeMessage(message: string): boolean {
  return ROOT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

export function isRootRuntimeFailure(block: CompactFailureBlock): boolean {
  const type = block.type?.trim() ?? "";
  if (ROOT_ERROR_NAMES.has(type)) return true;
  if (SECONDARY_ERROR_NAMES.has(type)) return false;
  return isRootRuntimeMessage(block.message);
}

/**
 * Parse compactFailureReporter blocks (`[n/m]` … next block / FAILURES).
 */
export function parseCompactFailureBlocks(output: string): CompactFailureBlock[] {
  const cleaned = stripAnsi(output).replace(/\r/g, "");
  const marker = cleaned.match(/\nFAILURES \d+\s*$/);
  const body = marker ? cleaned.slice(0, marker.index) : cleaned;
  const starts = [...body.matchAll(/^\[(\d+)\/(\d+)\]\s*$/gm)];
  if (starts.length === 0) return [];

  const blocks: CompactFailureBlock[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i]!.index ?? 0;
    const end = i + 1 < starts.length ? (starts[i + 1]!.index ?? body.length) : body.length;
    const raw = body.slice(start, end).trim();
    const typeMatch = raw.match(/^TYPE\s+(.+)$/m);
    const testMatch = raw.match(/^TEST\s+(.+)$/m);
    const failMatch = raw.match(/^FAIL\s+(.+)$/m);
    const atMatch = raw.match(/^AT\s+(.+)$/m);
    const messageMatch = raw.match(/^MESSAGE\n([\s\S]*?)(?=\n(?:MATCHES|EXPECTED|RECEIVED|\[\d+\/\d+\])|\s*$)/m);
    const message = (messageMatch?.[1] ?? "").trim();
    blocks.push({
      indexLabel: starts[i]![0]!.trim(),
      failPath: failMatch?.[1]?.trim() ?? null,
      testName: testMatch?.[1]?.trim() ?? null,
      type: typeMatch?.[1]?.trim() ?? null,
      location: atMatch?.[1]?.trim() ?? null,
      message,
      raw,
    });
  }
  return blocks;
}

function extractSuiteRoot(output: string): string | null {
  const cleaned = stripAnsi(output);
  const suite = cleaned.match(/^SUITE_ERROR\s+(.+)$/m);
  if (!suite?.[1]) return null;
  const message = suite[1].trim();
  if (!message || message === "No tests completed") return null;
  if (isRootRuntimeMessage(message)) {
    return message;
  }
  return message.length > 0 ? message : null;
}

function formatRootBlock(block: CompactFailureBlock, ordinal: number): string {
  const lines = [`[${ordinal}]`];
  if (block.type) lines.push(`TYPE  ${block.type}`);
  if (block.testName) lines.push(`TEST  ${block.testName}`);
  if (block.location) lines.push(`AT    ${block.location}`);
  if (block.message) {
    lines.push("MESSAGE");
    lines.push(block.message);
  }
  return lines.join("\n");
}

function formatSecondaryBlock(block: CompactFailureBlock, ordinal: number): string {
  // Keep original compact block but renumber for readability.
  return block.raw.replace(/^\[\d+\/\d+\]/, `[${ordinal}]`);
}

function preambleBeforeFirstBlock(output: string, blocks: CompactFailureBlock[]): string {
  if (blocks.length === 0) return stripAnsi(output).trim();
  const cleaned = stripAnsi(output);
  const firstRaw = blocks[0]!.raw;
  const idx = cleaned.indexOf(firstRaw.slice(0, Math.min(80, firstRaw.length)));
  if (idx <= 0) {
    // Fall back: keep lines before first [n/m]
    const m = cleaned.match(/^\[\d+\/\d+\]/m);
    if (!m || m.index === undefined) return cleaned.trim();
    return cleaned.slice(0, m.index).trim();
  }
  return cleaned.slice(0, idx).trim();
}

function failuresFooter(output: string, count: number): string {
  if (/\nFAILURES \d+\s*$/.test(stripAnsi(output))) {
    return `FAILURES ${count}`;
  }
  return `FAILURES ${count}`;
}

/**
 * If root/runtime failures exist among compact blocks (or SUITE_ERROR),
 * put them first under explicit headings. Otherwise return unchanged.
 */
export function applyRootErrorFirstFormatting(output: string): RootErrorFirstResult {
  const blocks = parseCompactFailureBlocks(output);
  const suiteRoot = extractSuiteRoot(output);

  if (blocks.length === 0 && !suiteRoot) {
    return { changed: false, text: output, rootCount: 0, secondaryCount: 0 };
  }

  const roots = blocks.filter((block) => isRootRuntimeFailure(block));
  const secondaries = blocks.filter((block) => !isRootRuntimeFailure(block));

  if (roots.length === 0 && !suiteRoot) {
    return {
      changed: false,
      text: output,
      rootCount: 0,
      secondaryCount: secondaries.length,
    };
  }

  // Already root-first with no secondary after a leading root? Still label for clarity
  // when secondaries exist, or when a secondary precedes a root in the original order.
  const firstRootIndex = blocks.findIndex((block) => isRootRuntimeFailure(block));
  const hasSecondaryBeforeRoot =
    firstRootIndex > 0 && blocks.slice(0, firstRootIndex).some((block) => !isRootRuntimeFailure(block));
  const needsReorder = hasSecondaryBeforeRoot || (roots.length > 0 && secondaries.length > 0);
  const needsSuiteLabel = Boolean(suiteRoot);

  if (!needsReorder && !needsSuiteLabel && roots.length === blocks.length) {
    // All failures are already root types and ordered — add a short ROOT header only.
    const preamble = preambleBeforeFirstBlock(output, blocks);
    const rootSections = roots.map((block, i) => formatRootBlock(block, i + 1));
    const text = [
      preamble,
      "",
      "ROOT / RUNTIME ERROR",
      rootSections.join("\n\n"),
      "",
      failuresFooter(output, blocks.length),
    ]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return {
      changed: text !== stripAnsi(output).trim(),
      text,
      rootCount: roots.length,
      secondaryCount: 0,
    };
  }

  const preamble = preambleBeforeFirstBlock(output, blocks);
  const parts: string[] = [];
  if (preamble) parts.push(preamble);

  parts.push("ROOT / RUNTIME ERROR");
  if (suiteRoot) {
    parts.push("SUITE_ERROR");
    parts.push(suiteRoot);
  }
  if (roots.length > 0) {
    parts.push(roots.map((block, i) => formatRootBlock(block, i + 1)).join("\n\n"));
  }

  if (secondaries.length > 0) {
    parts.push("");
    parts.push("SECONDARY TEST FAILURES");
    parts.push(
      secondaries
        .map((block, i) => formatSecondaryBlock(block, roots.length + i + 1))
        .join("\n\n"),
    );
  }

  parts.push("");
  parts.push(failuresFooter(output, blocks.length + (suiteRoot && blocks.length === 0 ? 1 : 0)));

  const text = parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return {
    changed: true,
    text,
    rootCount: roots.length + (suiteRoot ? 1 : 0),
    secondaryCount: secondaries.length,
  };
}

/**
 * Apply root-error-first to a full VERIFY tool payload
 * (`verify exit_code=N (STATUS)\\n\\n<body>`).
 */
export function processCanonicalVerifyForRootErrorFirst(
  formattedVerifyText: string,
  exitCode: number,
): string {
  if (!rootErrorFirstV1EnabledFromEnvironment()) return formattedVerifyText;
  if (exitCode === 0) return formattedVerifyText;

  const headerMatch = formattedVerifyText.match(/^verify exit_code=\d+ \((?:PASS|FAIL)\)\s*\n?/);
  const header = headerMatch?.[0]?.trimEnd() ?? `verify exit_code=${exitCode} (FAIL)`;
  const body = headerMatch
    ? formattedVerifyText.slice(headerMatch[0].length).replace(/^\n+/, "")
    : formattedVerifyText;

  const applied = applyRootErrorFirstFormatting(body);
  if (!applied.changed) return formattedVerifyText;
  return `${header}\n\n${applied.text}`;
}
