/**
 * Prove FULL_GREEN event stream: treatment has FULL_GREEN then 0 subsequent model calls.
 * Control is unchanged (no FULL_GREEN harness marker required).
 *
 * Usage:
 *   npx tsx scripts/prove-full-green-gate-pair.ts <control-run-dir> <treatment-run-dir>
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const REPO = process.cwd();
const OUT = path.join(REPO, "artifacts/experiments/full-green-gate-v1");

interface EventLine {
  type?: string;
  timestamp?: string;
  message?: { role?: string; content?: unknown };
  [key: string]: unknown;
}

function readEvents(runDir: string): EventLine[] {
  const eventsPath = path.join(runDir, "events.jsonl");
  if (!existsSync(eventsPath)) return [];
  return readFileSync(eventsPath, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as EventLine;
      } catch {
        return {};
      }
    });
}

function isModelCall(event: EventLine): boolean {
  if (event.type === "message_start" && event.message?.role === "assistant") return true;
  if (event.type === "message_end" && event.message?.role === "assistant") return true;
  // pi json stream often uses these shapes
  if (event.type === "turn_start") return false;
  if (typeof event.type === "string" && /assistant.*start|llm|model_call/i.test(event.type)) {
    return true;
  }
  return false;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text?: string }).text ?? "");
      }
      return "";
    })
    .join("\n");
}

function findFullGreen(events: EventLine[]): { index: number; timestamp: string | null } | null {
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]!;
    const blob = JSON.stringify(event);
    if (blob.includes("FULL_GREEN")) {
      return {
        index: i,
        timestamp:
          typeof event.timestamp === "string"
            ? event.timestamp
            : typeof (event as { ts?: string }).ts === "string"
              ? (event as { ts: string }).ts
              : null,
      };
    }
    const text = extractText(event.message?.content);
    if (text.includes("FULL_GREEN")) {
      return { index: i, timestamp: typeof event.timestamp === "string" ? event.timestamp : null };
    }
  }
  return null;
}

function countAssistantMessageStarts(events: EventLine[], afterIndex: number): number {
  let count = 0;
  for (let i = afterIndex + 1; i < events.length; i += 1) {
    const event = events[i]!;
    if (event.type === "message_start" && event.message?.role === "assistant") count += 1;
    else if (event.type === "agent_start") {
      // ignore
    }
  }
  return count;
}

function readGateExport(runDir: string): Record<string, unknown> | null {
  const p = path.join(runDir, "full-green-gate.v1.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function latestRunMatching(prefix: string): string | null {
  const runsDir = path.join(REPO, "artifacts/runs");
  if (!existsSync(runsDir)) return null;
  const names = readdirSync(runsDir)
    .filter((name) => existsSync(path.join(runsDir, name, "events.jsonl")))
    .sort()
    .reverse();
  for (const name of names) {
    const manifestPath = path.join(runsDir, name, "run-manifest.json");
    if (!existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        experiment?: { id?: string; arm?: string };
      };
      const id = manifest.experiment?.id ?? "";
      if (id.includes(prefix)) return path.join(runsDir, name);
    } catch {
      // continue
    }
  }
  return null;
}

const controlArg = process.argv[2];
const treatmentArg = process.argv[3];
const controlDir =
  controlArg ?? latestRunMatching("full-green-gate-v1-control") ?? "";
const treatmentDir =
  treatmentArg ?? latestRunMatching("full-green-gate-v1-treatment") ?? "";

if (!controlDir || !treatmentDir) {
  console.error(
    "Usage: npx tsx scripts/prove-full-green-gate-pair.ts <control-run-dir> <treatment-run-dir>",
  );
  process.exitCode = 1;
  process.exit();
}

const controlEvents = readEvents(controlDir);
const treatmentEvents = readEvents(treatmentDir);
const treatmentGreen = findFullGreen(treatmentEvents);
const controlGreen = findFullGreen(controlEvents);
const treatmentExport = readGateExport(treatmentDir);
const controlExport = readGateExport(controlDir);

const treatmentPostCalls = treatmentGreen
  ? countAssistantMessageStarts(treatmentEvents, treatmentGreen.index)
  : null;

const report = {
  generated_at: new Date().toISOString(),
  control_run: controlDir,
  treatment_run: treatmentDir,
  claim: "Treatment FULL_GREEN → 0 subsequent assistant message_start events",
  control: {
    has_full_green_marker: controlGreen !== null,
    gate_export: controlExport,
    assistant_message_starts: controlEvents.filter(
      (e) => e.type === "message_start" && e.message?.role === "assistant",
    ).length,
  },
  treatment: {
    full_green: treatmentGreen,
    gate_export: treatmentExport,
    post_full_green_assistant_calls: treatmentPostCalls,
    assistant_message_starts: treatmentEvents.filter(
      (e) => e.type === "message_start" && e.message?.role === "assistant",
    ).length,
  },
  verdict: "PENDING" as string,
};

const ok =
  treatmentGreen !== null &&
  treatmentPostCalls === 0 &&
  treatmentExport?.outcome === "full_green" &&
  treatmentExport?.terminate === true &&
  controlGreen === null;

report.verdict = ok ? "VERIFIED" : "NOT VERIFIED";

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "pair-proof.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!ok) process.exitCode = 1;

// silence unused
void isModelCall;
