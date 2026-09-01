import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import path from "node:path";

export const PI_DOCUMENTATION_HEADING = "Pi documentation (read only when ";
const PI_DOCUMENTATION_BLOCK_START = `\n\n${PI_DOCUMENTATION_HEADING}`;
export const THEME_STYLESHEET_RELATIVE = "src/styles.css";

/** Matches `src/styles.css` or `./src/styles.css` as a shell path token. */
export const THEME_STYLESHEET_PATH_PATTERN =
  /(?:^|[\s'"|;&(])\.?\/?src\/styles\.css(?:['"\s|;&)]|$)/;

export const BLOCKED_THEME_STYLESHEET_READ_REASON =
  "Theme stylesheet is preinstalled; use the CSS vocabulary in AGENTS.md only";

export const BLOCKED_THEME_STYLESHEET_WRITE_REASON =
  "Theme stylesheet is runner-owned; compose UI from AGENTS.md vocabulary classes only";

const BASH_READ_INSPECT_PATTERN =
  /\b(?:cat|head|tail|less|more|grep|egrep|fgrep|sed|awk|python3?|node|perl|ruby|xxd|base64|od)\b/i;

const BASH_WRITE_PATTERN =
  /(?:>>|>)\s*['"]?\.?\/?src\/styles\.css|<\s*['"]?\.?\/?src\/styles\.css|\bsed\s+[^|;&]*-i|\btee\b[^|;&]*\.?\/?src\/styles\.css|\b(?:cp|mv)\b[^|;&]*\.?\/?src\/styles\.css/i;

export function normalizeAppRelativePath(appRoot: string, candidate: string): string {
  const absolute = path.resolve(appRoot, candidate);
  return path.relative(appRoot, absolute).split(path.sep).join("/");
}

export function isThemeStylesheetPath(appRoot: string, candidate: string): boolean {
  const relative = normalizeAppRelativePath(appRoot, candidate);
  return relative === THEME_STYLESHEET_RELATIVE;
}

export function bashCommandReferencesThemeStylesheet(command: string): boolean {
  return THEME_STYLESHEET_PATH_PATTERN.test(command);
}

export function bashCommandModifiesThemeStylesheet(command: string): boolean {
  if (!bashCommandReferencesThemeStylesheet(command)) return false;
  return BASH_WRITE_PATTERN.test(command);
}

export function bashCommandInspectsThemeStylesheet(command: string): boolean {
  if (!bashCommandReferencesThemeStylesheet(command)) return false;
  if (bashCommandModifiesThemeStylesheet(command)) return false;
  return BASH_READ_INSPECT_PATTERN.test(command);
}

export function stripPiDocumentationBlock(systemPrompt: string): string {
  const blockStart = systemPrompt.indexOf(PI_DOCUMENTATION_BLOCK_START);
  if (blockStart < 0) return systemPrompt;

  const headingEnd = systemPrompt.indexOf("\n", blockStart + PI_DOCUMENTATION_BLOCK_START.length);
  if (headingEnd < 0) return systemPrompt;

  let lineStart = headingEnd + 1;
  let bulletCount = 0;
  while (systemPrompt.startsWith("- ", lineStart)) {
    bulletCount += 1;
    const lineEnd = systemPrompt.indexOf("\n", lineStart);
    if (lineEnd < 0) return systemPrompt.slice(0, blockStart);
    lineStart = lineEnd + 1;
  }
  if (bulletCount === 0) return systemPrompt;

  return systemPrompt.slice(0, blockStart) + systemPrompt.slice(Math.max(blockStart, lineStart - 1));
}

function isProtectedWritePath(appRoot: string, candidate: string): boolean {
  const relative = normalizeAppRelativePath(appRoot, candidate);
  const outsideApp = relative.startsWith("..") || path.isAbsolute(relative);
  const segments = relative.split("/");
  const basename = path.basename(candidate).toLowerCase();
  return (
    outsideApp ||
    segments.includes(".git") ||
    segments.includes("node_modules") ||
    basename === "result.json" ||
    basename === ".env" ||
    basename.startsWith(".env.")
  );
}

export default function protectedPaths(pi: ExtensionAPI) {
  const appRoot = process.cwd();

  pi.on("before_agent_start", async (event) => ({
    systemPrompt: stripPiDocumentationBlock(event.systemPrompt),
  }));

  pi.on("tool_call", async (event, context) => {
    if (event.toolName === "bash") {
      const command = String((event.input as Record<string, unknown>).command ?? "");
      if (bashCommandModifiesThemeStylesheet(command)) {
        if (context.hasUI) {
          context.ui.notify(`Blocked bash write to theme stylesheet: ${command}`, "warning");
        }
        return { block: true, reason: BLOCKED_THEME_STYLESHEET_WRITE_REASON };
      }
      if (bashCommandInspectsThemeStylesheet(command)) {
        if (context.hasUI) {
          context.ui.notify(`Blocked bash read of theme stylesheet: ${command}`, "warning");
        }
        return { block: true, reason: BLOCKED_THEME_STYLESHEET_READ_REASON };
      }
      return undefined;
    }

    const candidate = String((event.input as Record<string, unknown>).path ?? "");

    if (event.toolName === "read" && isThemeStylesheetPath(appRoot, candidate)) {
      if (context.hasUI) {
        context.ui.notify(`Blocked read of theme stylesheet: ${candidate}`, "warning");
      }
      return { block: true, reason: BLOCKED_THEME_STYLESHEET_READ_REASON };
    }

    if (event.toolName !== "write" && event.toolName !== "edit") return undefined;

    if (isThemeStylesheetPath(appRoot, candidate)) {
      if (context.hasUI) {
        context.ui.notify(`Blocked write to theme stylesheet: ${candidate}`, "warning");
      }
      return { block: true, reason: BLOCKED_THEME_STYLESHEET_WRITE_REASON };
    }

    if (!isProtectedWritePath(appRoot, candidate)) return undefined;

    if (context.hasUI) context.ui.notify(`Blocked write to protected path: ${candidate}`, "warning");
    return { block: true, reason: "Path is outside the app workspace or is runner-owned" };
  });
}
