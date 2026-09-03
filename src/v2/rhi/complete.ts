import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SOURCE_DIRECTORY, "../../..");

export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Completer did not return JSON");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function assistantTextFromEvents(events: string): string {
  const chunks: string[] = [];
  for (const line of events.split(/\r?\n/u)) {
    if (line.trim() === "") continue;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      if (event.type !== "message_end") continue;
      const message = event.message as Record<string, unknown> | undefined;
      if (message?.role !== "assistant") continue;
      const content = message.content;
      if (typeof content === "string") chunks.push(content);
      else if (Array.isArray(content)) {
        for (const part of content) {
          if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
            chunks.push(part.text);
          }
        }
      }
    } catch {
      // Keep going; events.jsonl is the audit log.
    }
  }
  return chunks.join("\n");
}

/** One-shot JSON completion via Pi. Not used on the production challenge path. */
export async function completeJsonWithPi(system: string, user: string): Promise<unknown> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rhi-complete-"));
  const eventFile = path.join(directory, "events.jsonl");
  const stderrFile = path.join(directory, "stderr.log");
  const prompt = `${system.trim()}\n\n${user.trim()}\n\nReturn JSON only.`;
  const piBinary = path.join(
    REPOSITORY_ROOT,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "pi.cmd" : "pi",
  );
  const args = [
    "--mode",
    "json",
    "--offline",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--no-context-files",
    "--append-system-prompt",
    "You return JSON only. Do not use tools. Do not write files.",
  ];
  if (process.env.CHALLENGE_PROVIDER) args.push("--provider", process.env.CHALLENGE_PROVIDER);
  if (process.env.CHALLENGE_MODEL) args.push("--model", process.env.CHALLENGE_MODEL);
  args.push("--thinking", process.env.CHALLENGE_THINKING ?? "off");
  args.push(prompt);

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(piBinary, args, {
        cwd: directory,
        env: { ...process.env, PI_OFFLINE: "1" },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const chunks: Buffer[] = [];
      const errors: Buffer[] = [];
      child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error("RHI completer timed out"));
      }, Number(process.env.RHI_COMPLETE_TIMEOUT_MS ?? 120_000));
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("close", async () => {
        clearTimeout(timeout);
        try {
          await writeFile(eventFile, Buffer.concat(chunks).toString("utf8"), "utf8");
          await writeFile(stderrFile, Buffer.concat(errors).toString("utf8"), "utf8");
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    const events = await readFile(eventFile, "utf8");
    return extractJson(assistantTextFromEvents(events));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
