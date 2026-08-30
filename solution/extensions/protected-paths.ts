import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import path from "node:path";

export const PI_DOCUMENTATION_HEADING = "Pi documentation (read only when ";
const PI_DOCUMENTATION_BLOCK_START = `\n\n${PI_DOCUMENTATION_HEADING}`;

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

export function isOpaqueUiImplementationPath(
  appRoot: string,
  candidate: string,
): boolean {
  const absolute = path.resolve(appRoot, candidate);
  const relative = path
    .relative(appRoot, absolute)
    .replaceAll("\\", "/");

  return /^src\/components\/ui\/[^/]+\.tsx$/u.test(relative);
}

export function bashInspectsOpaqueUiImplementation(
  command: string,
): boolean {
  const normalized = command.replaceAll("\\", "/");

  return /src\/components\/ui\/(?:[^/\s"'`$]+|\*)\.tsx\b/u.test(
    normalized,
  );
}

export default function protectedPaths(pi: ExtensionAPI) {
  const appRoot = process.cwd();

  pi.on("before_agent_start", async (event) => ({
    systemPrompt: stripPiDocumentationBlock(event.systemPrompt),
  }));

  pi.on("tool_call", async (event, context) => {
    const input = event.input as Record<string, unknown>;

    // UI primitive implementations are intentionally opaque to the builder.
    // Their public API is documented in src/components/ui/index.ts.
    if (event.toolName === "read") {
      const candidate = String(input.path ?? "");

      if (isOpaqueUiImplementationPath(appRoot, candidate)) {
        if (context.hasUI) {
          context.ui.notify(
            `Blocked UI implementation read: ${candidate}`,
            "warning",
          );
        }

        return {
          block: true,
          reason:
            "UI primitive implementation is intentionally opaque. " +
            "Use src/components/ui/index.ts for the complete public API.",
        };
      }
    }

    if (event.toolName === "bash") {
      const command = String(input.command ?? "");

      if (bashInspectsOpaqueUiImplementation(command)) {
        if (context.hasUI) {
          context.ui.notify(
            "Blocked bash inspection of UI primitive implementation",
            "warning",
          );
        }

        return {
          block: true,
          reason:
            "UI primitive implementation files are intentionally opaque. " +
            "Use src/components/ui/index.ts for the complete public API.",
        };
      }

      return undefined;
    }

    if (event.toolName !== "write" && event.toolName !== "edit") return undefined;
    const candidate = String((event.input as Record<string, unknown>).path ?? "");
    const absolute = path.resolve(appRoot, candidate);
    const relative = path.relative(appRoot, absolute);
    const outsideApp = relative.startsWith("..") || path.isAbsolute(relative);
    const segments = relative.split(path.sep);
    const basename = path.basename(absolute).toLowerCase();
    const protectedPath =
      outsideApp ||
      segments.includes(".git") ||
      segments.includes("node_modules") ||
      basename === "result.json" ||
      basename === ".env" ||
      basename.startsWith(".env.");
    if (!protectedPath) return undefined;

    if (context.hasUI) context.ui.notify(`Blocked write to protected path: ${candidate}`, "warning");
    return { block: true, reason: "Path is outside the app workspace or is runner-owned" };
  });
}
