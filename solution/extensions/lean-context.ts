import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import path from "node:path";

/**
 * Keep the conversation short by refusing reads that add no information.
 *
 * With no prompt caching, every turn re-bills the whole conversation, so a read
 * costs a turn *and* inflates every later turn for the rest of the run. The
 * prompt asks the model not to explore; this makes that an invariant rather
 * than a request, which is what removes the run-to-run variance.
 *
 * Every rule here is information-preserving. A blocked read is one whose
 * content the model already holds — either quoted in the system prompt or
 * returned earlier in this same session — so blocking cannot deprive it of
 * anything, only of a redundant turn. Anything else is allowed through.
 */

/** Seed files whose contents are already described in the system prompt. */
const DOCUMENTED = new Set([
  "AGENTS.md",
  "package.json",
  "index.html",
  "vite.config.ts",
  "vitest.config.ts",
  "tsconfig.json",
  "src/main.tsx",
  "src/test/setup.ts",
  "src/lib/storage.ts",
  "src/lib/useCollection.ts",
  "src/lib/id.ts",
]);

function relativePath(appRoot: string, candidate: string): string {
  return path.relative(appRoot, path.resolve(appRoot, candidate)).split(path.sep).join("/");
}

export interface ReadDecision {
  block: boolean;
  reason?: string;
}

/**
 * Decide one read.
 *
 * `seen` maps a path to the content the model has already been shown; a path is
 * dropped from it whenever the file is written, so a genuine re-read after a
 * change is always allowed.
 */
export function decideRead(
  relative: string,
  seen: Set<string>,
  partial: boolean,
): ReadDecision {
  // A ranged read asks for a slice the model may not have. Never block it.
  if (partial) return { block: false };

  if (DOCUMENTED.has(relative)) {
    return {
      block: true,
      reason:
        `${relative} is part of the application seed and its contents and API are already ` +
        `described in your instructions. Work from that description instead of reading it.`,
    };
  }

  if (seen.has(relative)) {
    return {
      block: true,
      reason:
        `${relative} is unchanged since you last saw its contents in this session, so reading ` +
        `it again returns what you already have. Write the file if you need it different.`,
    };
  }

  return { block: false };
}

export default function leanContext(pi: ExtensionAPI) {
  const appRoot = process.cwd();
  const seen = new Set<string>();

  pi.on("tool_call", async (event, context) => {
    const input = event.input as Record<string, unknown>;

    if (event.toolName === "write" || event.toolName === "edit") {
      // The file now differs from whatever was last shown, so allow a re-read.
      seen.delete(relativePath(appRoot, String(input.path ?? "")));
      return undefined;
    }

    if (event.toolName !== "read") return undefined;

    const relative = relativePath(appRoot, String(input.path ?? ""));
    const partial = input.offset !== undefined || input.limit !== undefined;
    const decision = decideRead(relative, seen, partial);

    if (!decision.block) {
      seen.add(relative);
      return undefined;
    }

    if (context.hasUI) context.ui.notify(`Skipped redundant read: ${relative}`, "info");
    return { block: true, reason: decision.reason ?? "This read returns content you already have." };
  });
}
