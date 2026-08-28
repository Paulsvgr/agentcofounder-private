import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONFIG_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  canonicalConfigJson,
  configHash,
  configIdentity,
  diffConfig,
  loadConfigFile,
  resolveConfig,
  validateIntervention,
} from "../../src/v2/config.js";

describe("DEFAULT_CONFIG", () => {
  it("keeps every spec toggle off except agent_test_authoring", () => {
    expect(DEFAULT_CONFIG.agent_test_authoring).toBe(true);
    expect(DEFAULT_CONFIG.template).toBe("baseline");
    expect(DEFAULT_CONFIG.execution_strategy).toBe("single_session");

    const toggles = [
      DEFAULT_CONFIG.planner,
      DEFAULT_CONFIG.profiles,
      DEFAULT_CONFIG.component_assembly,
      DEFAULT_CONFIG.plugin_assembly,
      DEFAULT_CONFIG.theme_matching,
      DEFAULT_CONFIG.test_contracts,
      DEFAULT_CONFIG.deterministic_guards,
      DEFAULT_CONFIG.error_memory,
      DEFAULT_CONFIG.docs_retrieval,
    ];
    expect(toggles.every((value) => value === false)).toBe(true);
  });
});

describe("configHash", () => {
  it("is stable regardless of object key insertion order", () => {
    const reordered = {
      agent_test_authoring: true,
      template: "baseline",
      execution_strategy: "single_session",
      planner: false,
      profiles: false,
      component_assembly: false,
      plugin_assembly: false,
      theme_matching: false,
      test_contracts: false,
      deterministic_guards: false,
      error_memory: false,
      docs_retrieval: false,
    };
    expect(configHash(reordered)).toBe(configHash(DEFAULT_CONFIG));
  });

  it("changes when any single field changes", () => {
    const baselineHash = configHash(DEFAULT_CONFIG);
    expect(configHash({ ...DEFAULT_CONFIG, planner: true })).not.toBe(baselineHash);
    expect(configHash({ ...DEFAULT_CONFIG, template: "with-persistence" })).not.toBe(
      baselineHash,
    );
    expect(configHash({ ...DEFAULT_CONFIG, agent_test_authoring: false })).not.toBe(
      baselineHash,
    );
  });
});

describe("configIdentity", () => {
  it("carries both schema version and hash", () => {
    const identity = configIdentity(DEFAULT_CONFIG);
    expect(identity.config_schema_version).toBe(CONFIG_SCHEMA_VERSION);
    expect(identity.config_hash).toBe(configHash(DEFAULT_CONFIG));
  });
});

describe("canonicalConfigJson", () => {
  it("sorts keys in UTF-16 code-unit order", () => {
    const json = canonicalConfigJson(DEFAULT_CONFIG);
    const keys = Object.keys(JSON.parse(json) as Record<string, unknown>);
    expect(keys).toEqual([...keys].sort());
  });
});

describe("resolveConfig", () => {
  it("returns defaults when called without overrides", () => {
    expect(resolveConfig()).toEqual(DEFAULT_CONFIG);
  });

  it("rejects unknown keys", () => {
    expect(() => resolveConfig({ plannner: true } as never)).toThrow(/Unknown config key/);
  });

  it("rejects wrong types", () => {
    expect(() => resolveConfig({ planner: "yes" } as never)).toThrow(/planner must be a boolean/);
    expect(() => resolveConfig({ template: "" })).toThrow(/template must be a non-empty string/);
    expect(() => resolveConfig({ execution_strategy: "" })).toThrow(
      /execution_strategy must be a non-empty string/,
    );
  });
});

describe("loadConfigFile", () => {
  it("loads and resolves a JSON config file", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "harness-config-"));
    const filePath = path.join(directory, "treatment.json");
    await writeFile(
      filePath,
      `${JSON.stringify({ agent_test_authoring: false }, null, 2)}\n`,
      "utf8",
    );

    const loaded = await loadConfigFile(filePath);
    expect(loaded.agent_test_authoring).toBe(false);
    expect(loaded.planner).toBe(false);
  });
});

describe("diffConfig", () => {
  it("reports exactly the changed fields", () => {
    const treatment = resolveConfig({ agent_test_authoring: false, planner: true });
    expect(diffConfig(DEFAULT_CONFIG, treatment)).toEqual(["agent_test_authoring", "planner"]);
  });
});

describe("validateIntervention", () => {
  it("accepts a single declared change", () => {
    const treatment = resolveConfig({ agent_test_authoring: false });
    const result = validateIntervention(DEFAULT_CONFIG, treatment, {
      id: "no_agent_tests",
      fields: ["agent_test_authoring"],
    });
    expect(result.unexpected).toEqual([]);
    expect(result.declaredButUnchanged).toEqual([]);
    expect(result.identical).toBe(false);
  });

  it("accepts a multi-field intervention within its declared set", () => {
    const treatment = resolveConfig({
      profiles: true,
      component_assembly: true,
    });
    const result = validateIntervention(DEFAULT_CONFIG, treatment, {
      id: "component_system",
      fields: ["profiles", "component_assembly"],
    });
    expect(result.unexpected).toEqual([]);
    expect(result.declaredButUnchanged).toEqual([]);
    expect(result.identical).toBe(false);
  });

  it("rejects an undeclared extra change", () => {
    const treatment = resolveConfig({
      agent_test_authoring: false,
      planner: true,
    });
    const result = validateIntervention(DEFAULT_CONFIG, treatment, {
      id: "no_agent_tests",
      fields: ["agent_test_authoring"],
    });
    expect(result.unexpected).toEqual(["planner"]);
    expect(result.identical).toBe(false);
  });

  it("reports declared fields that did not change", () => {
    const treatment = resolveConfig({ agent_test_authoring: false });
    const result = validateIntervention(DEFAULT_CONFIG, treatment, {
      id: "mixed",
      fields: ["agent_test_authoring", "profiles"],
    });
    expect(result.unexpected).toEqual([]);
    expect(result.declaredButUnchanged).toEqual(["profiles"]);
    expect(result.identical).toBe(false);
  });

  it("rejects a treatment identical to baseline", () => {
    const result = validateIntervention(DEFAULT_CONFIG, DEFAULT_CONFIG, {
      id: "noop",
      fields: ["planner"],
    });
    expect(result.unexpected).toEqual([]);
    expect(result.declaredButUnchanged).toEqual(["planner"]);
    expect(result.identical).toBe(true);
  });
});
