import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export type InferredModel = {
  provider: string | null;
  model: string | null;
};

const EVENTS_MODEL_SCAN_LINE_LIMIT = 500;

export function splitModelLabel(label: string): InferredModel {
  const trimmed = label.trim();
  if (!trimmed || trimmed.startsWith("tool:")) {
    return { provider: null, model: null };
  }
  const slash = trimmed.indexOf("/");
  if (slash <= 0) {
    return { provider: null, model: trimmed };
  }
  return {
    provider: trimmed.slice(0, slash),
    model: trimmed.slice(slash + 1) || null,
  };
}

export function inferModelFromCallLog(
  callLog: Array<{ model?: string }> | undefined,
): InferredModel {
  if (!callLog?.length) {
    return { provider: null, model: null };
  }
  for (const entry of callLog) {
    if (typeof entry.model !== "string") continue;
    const inferred = splitModelLabel(entry.model);
    if (inferred.provider || inferred.model) {
      return inferred;
    }
  }
  return { provider: null, model: null };
}

function parseEventLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function modelFromMessage(message: Record<string, unknown>): InferredModel {
  const provider = typeof message.provider === "string" ? message.provider : null;
  const rawModel = message.responseModel ?? message.model;
  const model = typeof rawModel === "string" ? rawModel : null;
  if (provider || model) {
    return { provider, model };
  }
  return { provider: null, model: null };
}

/** Scan the head of events.jsonl for the first assistant message_end model fields. */
export async function inferModelFromEvents(eventsPath: string): Promise<InferredModel> {
  try {
    const stream = createReadStream(eventsPath, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    let linesRead = 0;

    for await (const line of rl) {
      linesRead += 1;
      if (linesRead > EVENTS_MODEL_SCAN_LINE_LIMIT) {
        rl.close();
        stream.destroy();
        break;
      }

      const event = parseEventLine(line);
      if (!event || event.type !== "message_end") continue;

      const message = event.message;
      if (message === null || typeof message !== "object") continue;
      if ((message as Record<string, unknown>).role !== "assistant") continue;

      const inferred = modelFromMessage(message as Record<string, unknown>);
      rl.close();
      stream.destroy();
      if (inferred.provider || inferred.model) {
        return inferred;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { provider: null, model: null };
    }
    throw error;
  }

  return { provider: null, model: null };
}

export async function resolveRunModel(input: {
  manifestProvider: string | null | undefined;
  manifestModel: string | null | undefined;
  callLog: Array<{ model?: string }> | undefined;
  eventsPath: string;
}): Promise<InferredModel> {
  if (input.manifestProvider || input.manifestModel) {
    return {
      provider: input.manifestProvider ?? null,
      model: input.manifestModel ?? null,
    };
  }

  const fromCallLog = inferModelFromCallLog(input.callLog);
  if (fromCallLog.provider || fromCallLog.model) {
    return fromCallLog;
  }

  return inferModelFromEvents(input.eventsPath);
}
