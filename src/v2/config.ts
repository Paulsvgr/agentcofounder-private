import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/** Bump when the HarnessConfig shape or canonical encoding rules change. */
export const CONFIG_SCHEMA_VERSION = "agentcofounder.harness_config.v1" as const;

/** Spec section 16 toggles plus deliberate V2 additions recorded in PLAN.md. */
export interface HarnessConfig {
  planner: boolean;
  profiles: boolean;
  component_assembly: boolean;
  plugin_assembly: boolean;
  theme_matching: boolean;
  test_contracts: boolean;
  deterministic_guards: boolean;
  error_memory: boolean;
  docs_retrieval: boolean;
  template: string;
  execution_strategy: string;
  agent_test_authoring: boolean;
}

export interface ConfigIdentity {
  config_schema_version: typeof CONFIG_SCHEMA_VERSION;
  config_hash: string;
}

export interface Intervention {
  id: string;
  fields: Array<keyof HarnessConfig>;
}

export interface InterventionValidation {
  unexpected: Array<keyof HarnessConfig>;
  declaredButUnchanged: Array<keyof HarnessConfig>;
  identical: boolean;
}

/** Today's harness behaviour — every toggle off except agent test authoring. */
export const DEFAULT_CONFIG: HarnessConfig = {
  planner: false,
  profiles: false,
  component_assembly: false,
  plugin_assembly: false,
  theme_matching: false,
  test_contracts: false,
  deterministic_guards: false,
  error_memory: false,
  docs_retrieval: false,
  template: "baseline",
  execution_strategy: "single_session",
  agent_test_authoring: true,
};

const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG).sort() as Array<keyof HarnessConfig>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertBooleanField(
  key: keyof HarnessConfig,
  value: unknown,
  errors: string[],
): void {
  if (typeof value !== "boolean") {
    errors.push(`${String(key)} must be a boolean`);
  }
}

function assertNonEmptyStringField(
  key: keyof HarnessConfig,
  value: unknown,
  errors: string[],
): void {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${String(key)} must be a non-empty string`);
  }
}

/** Stable JSON for hashing — UTF-16 code-unit key order, machine-independent. */
export function canonicalConfigJson(config: HarnessConfig): string {
  const canonical: Record<string, boolean | string> = {};
  for (const key of CONFIG_KEYS) {
    canonical[key] = config[key];
  }
  return JSON.stringify(canonical);
}

export function configHash(config: HarnessConfig): string {
  return createHash("sha256").update(canonicalConfigJson(config)).digest("hex");
}

export function configIdentity(config: HarnessConfig): ConfigIdentity {
  return {
    config_schema_version: CONFIG_SCHEMA_VERSION,
    config_hash: configHash(config),
  };
}

export function resolveConfig(overrides?: Partial<HarnessConfig>): HarnessConfig {
  if (overrides === undefined) {
    return { ...DEFAULT_CONFIG };
  }

  if (!isRecord(overrides)) {
    throw new Error("Config overrides must be a plain object");
  }

  const errors: string[] = [];
  for (const key of Object.keys(overrides)) {
    if (!(key in DEFAULT_CONFIG)) {
      errors.push(`Unknown config key: ${key}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  const merged: HarnessConfig = { ...DEFAULT_CONFIG, ...overrides };

  for (const key of CONFIG_KEYS) {
    const value = merged[key];
    switch (key) {
      case "template":
      case "execution_strategy":
        assertNonEmptyStringField(key, value, errors);
        break;
      case "planner":
      case "profiles":
      case "component_assembly":
      case "plugin_assembly":
      case "theme_matching":
      case "test_contracts":
      case "deterministic_guards":
      case "error_memory":
      case "docs_retrieval":
      case "agent_test_authoring":
        assertBooleanField(key, value, errors);
        break;
      default: {
        const exhaustive: never = key;
        throw new Error(`Unhandled config key: ${String(exhaustive)}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return merged;
}

export async function loadConfigFile(filePath: string): Promise<HarnessConfig> {
  const raw = await readFile(filePath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in config file ${filePath}: ${message}`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`Config file must contain a JSON object: ${filePath}`);
  }
  return resolveConfig(parsed as Partial<HarnessConfig>);
}

export function diffConfig(
  left: HarnessConfig,
  right: HarnessConfig,
): Array<keyof HarnessConfig> {
  const changed: Array<keyof HarnessConfig> = [];
  for (const key of CONFIG_KEYS) {
    if (left[key] !== right[key]) {
      changed.push(key);
    }
  }
  return changed;
}

export function validateIntervention(
  baseline: HarnessConfig,
  treatment: HarnessConfig,
  intervention: Intervention,
): InterventionValidation {
  const changed = diffConfig(baseline, treatment);
  const declared = new Set(intervention.fields);
  const unexpected = changed.filter((field) => !declared.has(field));
  const declaredButUnchanged = intervention.fields.filter((field) => !changed.includes(field));
  const identical = changed.length === 0;

  return { unexpected, declaredButUnchanged, identical };
}
