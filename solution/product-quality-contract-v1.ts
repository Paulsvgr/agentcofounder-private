/**
 * Product-quality / build-contract v1 — front-load a short rubric-aligned
 * checklist into the system prompt without dumping point weights.
 *
 * Flag: HARNESS_PRODUCT_QUALITY_CONTRACT_V1 (default OFF until KEEP).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = path.join(HERE, "product-quality-contract-v1.md");

let cachedContract: string | null = null;

function envFlagEnabled(raw: string | undefined, defaultOn: boolean): boolean {
  if (raw === undefined || raw.trim() === "") return defaultOn;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  return defaultOn;
}

export function productQualityContractV1EnabledFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagEnabled(env.HARNESS_PRODUCT_QUALITY_CONTRACT_V1, false);
}

export function loadProductQualityContractV1(): string {
  if (cachedContract === null) {
    cachedContract = readFileSync(CONTRACT_PATH, "utf8").trim();
  }
  return cachedContract;
}

/**
 * Insert the quality contract immediately after the "Required outcome:" line
 * so Pi sees it before the long bullet list. No-op when flag is off.
 */
export function applyProductQualityContractV1(
  systemPrompt: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!productQualityContractV1EnabledFromEnvironment(env)) {
    return systemPrompt;
  }
  const contract = loadProductQualityContractV1();
  if (!contract) return systemPrompt;
  if (/Product quality contract/i.test(systemPrompt)) {
    return systemPrompt;
  }

  const marker = /^(Required outcome:\s*)$/m;
  if (marker.test(systemPrompt)) {
    return systemPrompt.replace(marker, `$1\n\n${contract}\n`);
  }

  // Fallback: append after the first paragraph.
  const parts = systemPrompt.split(/\n\n/);
  if (parts.length >= 2) {
    return `${parts[0]}\n\n${contract}\n\n${parts.slice(1).join("\n\n")}`;
  }
  return `${systemPrompt.trim()}\n\n${contract}\n`;
}
