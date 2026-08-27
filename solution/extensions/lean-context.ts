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

/** The span of a file the model has already been shown, as 1-based line numbers. */
export interface SeenRange {
  from: number;
  to: number;
}

/**
 * Decide one read.
 *
 * Pi's read tool always supplies `offset` and `limit` — a whole-file read
 * arrives as `{offset: 1, limit: 400}` — so "is this ranged?" cannot decide
 * anything. What matters is whether the requested span falls inside a span
 * already returned for that path, with no write since. A request reaching
 * beyond what was shown is always allowed, because it can return new lines.
 *
 * `seen` holds the span shown per path; the caller deletes the entry on write,
 * so a re-read after a change is always allowed.
 */
export function decideRead(
  relative: string,
  seen: Map<string, SeenRange>,
  offset: number | undefined,
  limit: number | undefined,
): ReadDecision {
  if (DOCUMENTED.has(relative)) {
    return {
      block: true,
      reason:
        `${relative} is part of the application seed and its contents and API are already ` +
        `described in your instructions. Work from that description instead of reading it.`,
    };
  }

  const previous = seen.get(relative);
  if (!previous) return { block: false };

  const from = typeof offset === "number" && offset > 0 ? offset : 1;
  const to = typeof limit === "number" && limit > 0 ? from + limit - 1 : Number.MAX_SAFE_INTEGER;
  const alreadyShown = from >= previous.from && to <= previous.to;
  if (!alreadyShown) return { block: false };

  return {
    block: true,
    reason:
      `You already have lines ${previous.from}-${previous.to} of ${relative} from earlier in ` +
      `this session and it has not changed since. Re-reading returns the same content. If it ` +
      `needs to be different, write it.`,
  };
}

/** Merge a newly returned span into what the model has been shown for a path. */
export function recordRead(
  relative: string,
  seen: Map<string, SeenRange>,
  offset: number | undefined,
  limit: number | undefined,
): void {
  const from = typeof offset === "number" && offset > 0 ? offset : 1;
  const to = typeof limit === "number" && limit > 0 ? from + limit - 1 : Number.MAX_SAFE_INTEGER;
  const previous = seen.get(relative);
  seen.set(
    relative,
    previous
      ? { from: Math.min(previous.from, from), to: Math.max(previous.to, to) }
      : { from, to },
  );
}

export default function leanContext(pi: ExtensionAPI) {
  const appRoot = process.cwd();
  const seen = new Map<string, SeenRange>();

  pi.on("tool_call", async (event, context) => {
    const input = event.input as Record<string, unknown>;

    if (event.toolName === "write" || event.toolName === "edit") {
      // The file now differs from whatever was last shown, so allow a re-read.
      seen.delete(relativePath(appRoot, String(input.path ?? "")));
      return undefined;
    }

    if (event.toolName !== "read") return undefined;

    const relative = relativePath(appRoot, String(input.path ?? ""));
    const offset = typeof input.offset === "number" ? input.offset : undefined;
    const limit = typeof input.limit === "number" ? input.limit : undefined;
    const decision = decideRead(relative, seen, offset, limit);

    if (!decision.block) {
      recordRead(relative, seen, offset, limit);
      return undefined;
    }

    if (context.hasUI) context.ui.notify(`Skipped redundant read: ${relative}`, "info");
    return { block: true, reason: decision.reason ?? "This read returns content you already have." };
  });
}
