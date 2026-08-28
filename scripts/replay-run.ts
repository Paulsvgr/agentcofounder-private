/**
 * Deterministic replay of Pi filesystem tool calls — zero model tokens.
 *
 * Usage:
 *   npm run replay:run -- artifacts/runs/<run-id>
 *   npm run replay:run -- path/to/session.jsonl --original saved-apps/<label>-<run-id>
 *   npm run replay:run -- artifacts/runs/<run-id> --compare-only
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, lstat, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isSourceMutationCommand } from "../src/v2/classify.js";
import { copyAppTemplateTree } from "../src/prepare-output.js";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SOURCE_DIRECTORY, "..");
const SAVED_APPS_DIRECTORY = path.join(REPOSITORY_ROOT, "saved-apps");
const CURRENT_TEMPLATE_DIRECTORY = path.join(REPOSITORY_ROOT, "app-template");

type TemplateSource = "run-snapshot" | "current-app-template";

type FsOp =
  | {
      kind: "write";
      sourcePath: string;
      targetPath: string;
      relativePath: string;
      content: string;
      line: number;
    }
  | {
      kind: "edit";
      sourcePath: string;
      targetPath: string;
      relativePath: string;
      edits: Array<{ oldText: string; newText: string }>;
      line: number;
    };

interface ReplayFailure {
  kind: "write" | "edit";
  path: string;
  message: string;
  line: number;
}

interface CommandResult {
  ok: boolean;
  exit_code: number;
  output_tail: string;
}

interface CompareResult {
  matches: boolean;
  files_compared: number;
  mismatched: string[];
  missing_in_replay: string[];
  extra_in_replay: string[];
}

interface TemplateDriftEntry {
  path: string;
  saved_hash: string;
  current_hash: string;
}

/**
 * `unverified` exists so a run with no original app can never be reported as a
 * match. Absence of a comparison is not evidence of fidelity.
 */
export type ReplayVerdict = "identical" | "diverged" | "unverified";

export interface ReplayReport {
  run_id: string;
  verdict: ReplayVerdict;
  warnings: string[];
  replay_dir: string;
  source_file: string;
  original_dir: string | null;
  template_source: TemplateSource;
  template_drift: TemplateDriftEntry[];
  writes_replayed: number;
  edits_replayed: number;
  skipped_outside_app: number;
  bash_mutation_warnings: number;
  failures: ReplayFailure[];
  test: CommandResult | null;
  build: CommandResult | null;
  compare: CompareResult | null;
}

export interface ReplayOptions {
  original?: string;
  compareOnly: boolean;
}

const COMPARE_SKIP = new Set(["node_modules", "dist", "HOW-TO-OPEN.md", "result.json"]);
const DRIFT_SKIP = new Set([...COMPARE_SKIP, ".agent-cofounder-output"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function printHelp(): void {
  console.log(`Usage: npm run replay:run -- <run-dir|session.jsonl|events.jsonl> [options]

Replays write/edit tool calls from a saved Pi session to rebuild the generated app.

Options:
  --original <path>   App directory to compare the replay against
  --compare-only      Skip npm test/build; only rebuild and compare file trees
`);
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function readJsonl(filePath: string): Promise<unknown[]> {
  const raw = await readFile(filePath, "utf8");
  const rows: unknown[] = [];
  for (const line of raw.split(/\r?\n/u)) {
    if (line.trim() === "") continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      // Keep going; malformed lines remain in the raw artifact.
    }
  }
  return rows;
}

async function loadRows(input: string): Promise<{ rows: unknown[]; sourceFile: string; runId: string }> {
  const absoluteInput = path.resolve(input);
  const stat = await lstat(absoluteInput);

  if (stat.isFile()) {
    const runId = path.basename(absoluteInput).replace(/\.jsonl$/u, "");
    return { rows: await readJsonl(absoluteInput), sourceFile: absoluteInput, runId };
  }

  const runId = path.basename(absoluteInput);
  const sessionsDirectory = path.join(absoluteInput, "sessions");
  const sessionFiles = (await readdir(sessionsDirectory).catch(() => []))
    .filter((name) => name.endsWith(".jsonl"))
    .sort()
    .map((name) => path.join(sessionsDirectory, name));

  if (sessionFiles.length > 0) {
    const rows: unknown[] = [];
    for (const filePath of sessionFiles) {
      rows.push(...(await readJsonl(filePath)));
    }
    rows.sort((left, right) =>
      String(isRecord(left) ? left.timestamp : "").localeCompare(
        String(isRecord(right) ? right.timestamp : ""),
      ),
    );
    return { rows, sourceFile: sessionFiles.join(","), runId };
  }

  const eventsFile = path.join(absoluteInput, "events.jsonl");
  return { rows: await readJsonl(eventsFile), sourceFile: eventsFile, runId };
}

function extractCwd(rows: unknown[]): string {
  for (const row of rows) {
    if (isRecord(row) && row.type === "session" && typeof row.cwd === "string") {
      return row.cwd;
    }
  }
  return path.join(REPOSITORY_ROOT, "output", "app");
}

function remapPath(originalPath: string, originalCwd: string, replayDir: string): string | null {
  if (originalPath.trim() === "") return null;

  const cwd = path.resolve(originalCwd);
  const resolved = path.isAbsolute(originalPath)
    ? path.resolve(originalPath)
    : path.resolve(cwd, originalPath);

  if (resolved === cwd || resolved.startsWith(`${cwd}${path.sep}`)) {
    return path.join(replayDir, path.relative(cwd, resolved));
  }

  const marker = `${path.sep}output${path.sep}app`;
  const markerIndex = resolved.indexOf(marker);
  if (markerIndex >= 0) {
    const relative = resolved.slice(markerIndex + marker.length + 1);
    return path.join(replayDir, relative);
  }

  return null;
}

function toRelativeAppPath(targetPath: string, replayDir: string): string {
  return path.relative(replayDir, targetPath).split(path.sep).join("/");
}

function normalizeEditEntries(args: Record<string, unknown>): Array<{ oldText: string; newText: string }> {
  if (typeof args.oldText === "string" && typeof args.newText === "string") {
    return [{ oldText: args.oldText, newText: args.newText }];
  }

  const edits = args.edits;
  if (!Array.isArray(edits)) return [];

  const normalized: Array<{ oldText: string; newText: string }> = [];
  for (const entry of edits) {
    if (!isRecord(entry)) continue;
    if (typeof entry.oldText !== "string" || typeof entry.newText !== "string") continue;
    normalized.push({ oldText: entry.oldText, newText: entry.newText });
  }
  return normalized;
}

function extractFsOps(
  rows: unknown[],
  originalCwd: string,
  replayDir: string,
): { ops: FsOp[]; skippedOutsideApp: number; bashMutationWarnings: number; touchedRelativePaths: Set<string> } {
  const ops: FsOp[] = [];
  let skippedOutsideApp = 0;
  let bashMutationWarnings = 0;
  const touchedRelativePaths = new Set<string>();
  let lineNo = 0;

  for (const row of rows) {
    lineNo += 1;
    if (!isRecord(row)) continue;

    if (row.type === "message" && isRecord(row.message) && row.message.role === "assistant") {
      const content = row.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (!isRecord(block) || block.type !== "toolCall") continue;
        collectToolCall(block, lineNo);
      }
      continue;
    }

    if (row.type === "message_update" && isRecord(row.assistantMessageEvent)) {
      const event = row.assistantMessageEvent;
      if (event.type !== "toolcall_end" || !isRecord(event.toolCall)) continue;
      collectToolCall(event.toolCall, lineNo);
    }
  }

  function collectToolCall(block: Record<string, unknown>, line: number): void {
    const name = block.name;
    const args = isRecord(block.arguments) ? block.arguments : {};

    if (name === "bash" && typeof args.command === "string") {
      if (isSourceMutationCommand(args.command.replace(/\s+/g, " ").trim())) {
        bashMutationWarnings += 1;
      }
      return;
    }

    if (name !== "write" && name !== "edit") return;

    const sourcePath = typeof args.path === "string" ? args.path : "";
    if (sourcePath.trim() === "") {
      skippedOutsideApp += 1;
      return;
    }

    const targetPath = remapPath(sourcePath, originalCwd, replayDir);
    if (!targetPath) {
      skippedOutsideApp += 1;
      return;
    }

    const relativePath = toRelativeAppPath(targetPath, replayDir);
    touchedRelativePaths.add(relativePath);

    if (name === "write") {
      if (typeof args.content !== "string") return;
      ops.push({
        kind: "write",
        sourcePath,
        targetPath,
        relativePath,
        content: args.content,
        line,
      });
      return;
    }

    const edits = normalizeEditEntries(args);
    if (edits.length === 0) {
      ops.push({
        kind: "edit",
        sourcePath,
        targetPath,
        relativePath,
        edits: [],
        line,
      });
      return;
    }

    ops.push({
      kind: "edit",
      sourcePath,
      targetPath,
      relativePath,
      edits,
      line,
    });
  }

  return { ops, skippedOutsideApp, bashMutationWarnings, touchedRelativePaths };
}

async function applyWrite(op: Extract<FsOp, { kind: "write" }>): Promise<void> {
  await mkdir(path.dirname(op.targetPath), { recursive: true });
  await writeFile(op.targetPath, op.content, "utf8");
}

export function applyEditsToContent(
  content: string,
  edits: Array<{ oldText: string; newText: string }>,
): string {
  let current = content;
  for (const entry of edits) {
    if (!current.includes(entry.oldText)) {
      throw new Error("oldText not found in file");
    }
    // A function replacer is required: a string replacement expands `$&`, `$'`
    // and backtick patterns, which silently corrupts generated regex-escaping code.
    current = current.replace(entry.oldText, () => entry.newText);
  }
  return current;
}

async function applyEdit(op: Extract<FsOp, { kind: "edit" }>): Promise<void> {
  if (op.edits.length === 0) {
    throw new Error("edit call had no valid oldText/newText entries");
  }

  const current = await readFile(op.targetPath, "utf8");
  await writeFile(op.targetPath, applyEditsToContent(current, op.edits), "utf8");
}

async function resolveTemplateSource(runDirectory: string): Promise<{
  sourceDirectory: string;
  templateSource: TemplateSource;
}> {
  const snapshotDirectory = path.join(runDirectory, "app-template");
  if (await pathExists(snapshotDirectory)) {
    return { sourceDirectory: snapshotDirectory, templateSource: "run-snapshot" };
  }
  return { sourceDirectory: CURRENT_TEMPLATE_DIRECTORY, templateSource: "current-app-template" };
}

async function seedReplayDirectory(
  replayDir: string,
  sourceDirectory: string,
  needsDependencies: boolean,
): Promise<void> {
  await rm(replayDir, { recursive: true, force: true });
  await copyAppTemplateTree(sourceDirectory, replayDir);
  if (!needsDependencies) return;

  const nodeModulesTarget = path.join(replayDir, "node_modules");
  const nodeModulesSource = path.join(CURRENT_TEMPLATE_DIRECTORY, "node_modules");
  if (await pathExists(nodeModulesSource)) {
    await symlink(nodeModulesSource, nodeModulesTarget, "dir");
    return;
  }

  execFileSync("npm", ["ci", "--ignore-scripts"], {
    cwd: replayDir,
    stdio: "inherit",
  });
}

async function hashFile(filePath: string): Promise<string> {
  const contents = await readFile(filePath);
  return createHash("sha256").update(contents).digest("hex");
}

async function hashTree(root: string, prefix = ""): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  const directory = prefix === "" ? root : path.join(root, prefix);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return hashes;
  }

  for (const entry of entries) {
    if (COMPARE_SKIP.has(entry.name)) continue;
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    const absolute = path.join(root, relative);
    if (entry.isDirectory()) {
      for (const [nestedPath, nestedHash] of await hashTree(root, relative)) {
        hashes.set(nestedPath, nestedHash);
      }
    } else if (entry.isFile()) {
      hashes.set(relative, await hashFile(absolute));
    }
  }

  return hashes;
}

/**
 * Some early saved apps only kept `dist/`, `node_modules/` and `result.json`.
 * Comparing against one of those would report every source file as "extra",
 * which looks like a replay failure but is really a missing reference.
 */
async function isUsableOriginal(directory: string): Promise<boolean> {
  return await pathExists(path.join(directory, "package.json"));
}

async function resolveOriginalDirectory(runId: string, explicit?: string): Promise<string | null> {
  if (explicit) {
    const resolved = path.resolve(explicit);
    return (await pathExists(resolved)) ? resolved : null;
  }

  const savedNames = await readdir(SAVED_APPS_DIRECTORY).catch(() => []);
  const match = savedNames.find((name) => name.endsWith(runId));
  return match ? path.join(SAVED_APPS_DIRECTORY, match) : null;
}

async function compareTrees(replayDir: string, originalDir: string): Promise<CompareResult> {
  const replayHashes = await hashTree(replayDir);
  const originalHashes = await hashTree(originalDir);

  const mismatched: string[] = [];
  const missingInReplay: string[] = [];
  const extraInReplay: string[] = [];

  for (const [relativePath, originalHash] of originalHashes) {
    const replayHash = replayHashes.get(relativePath);
    if (!replayHash) {
      missingInReplay.push(relativePath);
    } else if (replayHash !== originalHash) {
      mismatched.push(relativePath);
    }
  }

  for (const relativePath of replayHashes.keys()) {
    if (!originalHashes.has(relativePath)) {
      extraInReplay.push(relativePath);
    }
  }

  mismatched.sort();
  missingInReplay.sort();
  extraInReplay.sort();

  return {
    matches: mismatched.length === 0 && missingInReplay.length === 0 && extraInReplay.length === 0,
    files_compared: originalHashes.size,
    mismatched,
    missing_in_replay: missingInReplay,
    extra_in_replay: extraInReplay,
  };
}

async function detectTemplateDrift(
  originalDir: string,
  touchedRelativePaths: Set<string>,
): Promise<TemplateDriftEntry[]> {
  const originalHashes = await hashTree(originalDir);
  const currentHashes = await hashTree(CURRENT_TEMPLATE_DIRECTORY);
  const drift: TemplateDriftEntry[] = [];

  for (const [relativePath, savedHash] of originalHashes) {
    if (touchedRelativePaths.has(relativePath)) continue;
    if (DRIFT_SKIP.has(relativePath) || relativePath.startsWith("dist/")) continue;
    const currentHash = currentHashes.get(relativePath);
    if (!currentHash) {
      drift.push({ path: relativePath, saved_hash: savedHash, current_hash: "missing" });
      continue;
    }
    if (currentHash !== savedHash) {
      drift.push({ path: relativePath, saved_hash: savedHash, current_hash: currentHash });
    }
  }

  drift.sort((left, right) => left.path.localeCompare(right.path));
  return drift;
}

function runNpmScript(script: "test" | "build", cwd: string): CommandResult {
  try {
    const output = execFileSync("npm", ["run", script], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    return { ok: true, exit_code: 0, output_tail: output.slice(-4000) };
  } catch (error) {
    const execError = error as { status?: number; stdout?: string; stderr?: string };
    const combined = `${execError.stdout ?? ""}\n${execError.stderr ?? ""}`;
    return {
      ok: false,
      exit_code: execError.status ?? 1,
      output_tail: combined.slice(-4000),
    };
  }
}

function parseArguments(argv: string[]): { input: string; original?: string; compareOnly: boolean } {
  if (argv.includes("--help") || argv.length === 0) {
    printHelp();
    process.exit(argv.includes("--help") ? 0 : 2);
  }

  const originalFlagIndex = argv.indexOf("--original");
  const original =
    originalFlagIndex >= 0 ? argv[originalFlagIndex + 1] : undefined;
  const positional = argv.filter((arg, index) => {
    if (arg === "--original" || arg === "--compare-only") return false;
    if (originalFlagIndex >= 0 && index === originalFlagIndex + 1) return false;
    return true;
  });

  if (positional.length !== 1) {
    printHelp();
    process.exit(2);
  }

  return {
    input: positional[0]!,
    ...(original === undefined ? {} : { original }),
    compareOnly: argv.includes("--compare-only"),
  };
}

function decideVerdict(
  compare: CompareResult | null,
  failures: ReplayFailure[],
  bashMutationWarnings: number,
  templateSource: TemplateSource,
  templateDrift: TemplateDriftEntry[],
): { verdict: ReplayVerdict; warnings: string[] } {
  const warnings: string[] = [];
  if (failures.length > 0) {
    warnings.push(`${failures.length} replay operation(s) failed to apply`);
  }
  if (bashMutationWarnings > 0) {
    warnings.push(
      `${bashMutationWarnings} bash command(s) mutated source outside write/edit and were not replayed`,
    );
  }
  if (templateSource === "current-app-template") {
    warnings.push("no template snapshot in run folder; seeded from the current app-template");
  }

  if (compare === null) {
    warnings.push("no original app to compare against; fidelity is unverified");
    return { verdict: "unverified", warnings };
  }
  if (compare.matches) return { verdict: "identical", warnings };

  // Files the agent never touched can only differ because the template moved on.
  // That says nothing about replay fidelity, so it must not be reported as a mismatch.
  const driftPaths = new Set(templateDrift.map((entry) => entry.path));
  const differing = [
    ...compare.mismatched,
    ...compare.missing_in_replay,
    ...compare.extra_in_replay,
  ];
  const unexplained = differing.filter((candidate) => !driftPaths.has(candidate));
  if (unexplained.length === 0) {
    warnings.push(
      `all ${differing.length} differing file(s) are template drift; the template this run used is gone`,
    );
    return { verdict: "unverified", warnings };
  }

  warnings.push(`${unexplained.length} differing file(s) not explained by template drift`);
  return { verdict: "diverged", warnings };
}

export async function replayRun(input: string, options: ReplayOptions): Promise<ReplayReport> {
  const inputPath = path.resolve(input);
  const runDirectory = (await lstat(inputPath)).isDirectory() ? inputPath : path.dirname(inputPath);

  const { rows, sourceFile, runId } = await loadRows(input);
  const originalCwd = extractCwd(rows);
  const replayDir = path.join(REPOSITORY_ROOT, "artifacts", "replay", runId, "app");
  const { sourceDirectory, templateSource } = await resolveTemplateSource(runDirectory);

  await seedReplayDirectory(replayDir, sourceDirectory, !options.compareOnly);

  const { ops, skippedOutsideApp, bashMutationWarnings, touchedRelativePaths } = extractFsOps(
    rows,
    originalCwd,
    replayDir,
  );

  const failures: ReplayFailure[] = [];
  let writesReplayed = 0;
  let editsReplayed = 0;

  for (const op of ops) {
    try {
      if (op.kind === "write") {
        await applyWrite(op);
        writesReplayed += 1;
      } else {
        await applyEdit(op);
        editsReplayed += 1;
      }
    } catch (error) {
      failures.push({
        kind: op.kind,
        path: op.targetPath,
        message: error instanceof Error ? error.message : String(error),
        line: op.line,
      });
    }
  }

  const resolvedOriginal = await resolveOriginalDirectory(runId, options.original);
  const originalUsable = resolvedOriginal !== null && (await isUsableOriginal(resolvedOriginal));
  const originalDir = originalUsable ? resolvedOriginal : null;
  const templateDrift =
    templateSource === "current-app-template" && originalDir
      ? await detectTemplateDrift(originalDir, touchedRelativePaths)
      : [];

  const test = options.compareOnly ? null : runNpmScript("test", replayDir);
  const build = options.compareOnly ? null : runNpmScript("build", replayDir);
  const compare = originalDir ? await compareTrees(replayDir, originalDir) : null;
  const { verdict, warnings } = decideVerdict(
    compare,
    failures,
    bashMutationWarnings,
    templateSource,
    templateDrift,
  );
  if (resolvedOriginal !== null && !originalUsable) {
    warnings.push(`saved app ${path.basename(resolvedOriginal)} has no source files to compare`);
  }

  const report: ReplayReport = {
    run_id: runId,
    verdict,
    warnings,
    replay_dir: replayDir,
    source_file: sourceFile,
    original_dir: originalDir,
    template_source: templateSource,
    template_drift: templateDrift,
    writes_replayed: writesReplayed,
    edits_replayed: editsReplayed,
    skipped_outside_app: skippedOutsideApp,
    bash_mutation_warnings: bashMutationWarnings,
    failures,
    test,
    build,
    compare,
  };

  const reportPath = path.join(REPOSITORY_ROOT, "artifacts", "replay", runId, "report.json");
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

export function replaySucceeded(report: ReplayReport): boolean {
  return (
    report.verdict === "identical" &&
    report.failures.length === 0 &&
    report.template_drift.length === 0 &&
    (report.test?.ok ?? true) &&
    (report.build?.ok ?? true)
  );
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const report = await replayRun(args.input, {
    ...(args.original === undefined ? {} : { original: args.original }),
    compareOnly: args.compareOnly,
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(replaySucceeded(report) ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
