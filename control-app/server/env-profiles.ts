import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { EnvProfile } from "./types.js";

const DEFAULT_PROFILE_ID = "challenge-env-zai.sh";

export async function discoverEnvProfiles(): Promise<EnvProfile[]> {
  const agentDir = path.join(os.homedir(), ".pi", "agent");
  let entries: string[];
  try {
    entries = await readdir(agentDir);
  } catch {
    return [];
  }

  const profiles = entries
    .filter((name) => name.startsWith("challenge-env") && name.endsWith(".sh"))
    .sort()
    .map((name) => {
      const fullPath = path.join(agentDir, name);
      const label = name.replace(/^challenge-env-?/, "").replace(/\.sh$/, "") || "default";
      return {
        id: name,
        path: fullPath,
        label: label === "default" ? "berget (default)" : label,
        is_default: name === DEFAULT_PROFILE_ID,
      };
    });

  if (profiles.length === 0) return profiles;

  const hasDefault = profiles.some((profile) => profile.is_default);
  if (!hasDefault) {
    profiles[0]!.is_default = true;
  }

  return profiles;
}

export function resolveEnvProfilePath(profiles: EnvProfile[], envProfileId: string): string | null {
  const match = profiles.find((profile) => profile.id === envProfileId || profile.path === envProfileId);
  return match?.path ?? null;
}
