import { readFile } from "node:fs/promises";
import { assertHarnessDocument, type HarnessDocument } from "./schema.js";
import { baselineHarness } from "./baseline.js";

export function rhiHarnessPathFromEnvironment(): string | undefined {
  const raw = process.env.RHI_HARNESS?.trim();
  return raw === "" ? undefined : raw;
}

export async function loadHarnessFile(filePath: string): Promise<HarnessDocument> {
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
  return assertHarnessDocument(parsed);
}

export async function loadHarnessFromEnvironment(): Promise<HarnessDocument | undefined> {
  const filePath = rhiHarnessPathFromEnvironment();
  if (!filePath) return undefined;
  return loadHarnessFile(filePath);
}

export function productionHarnessOrBaseline(loaded: HarnessDocument | undefined): HarnessDocument {
  return loaded ?? baselineHarness();
}
