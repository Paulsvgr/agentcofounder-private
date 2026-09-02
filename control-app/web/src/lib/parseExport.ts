import { validateActionFlow } from "./actionFlow";
import { validateRunManifest } from "./runManifest";
import {
  RUN_EXPORT_SCHEMA_V1,
  RUN_EXPORT_SCHEMA_V2,
  type ActionSegment,
  type PasteKind,
  type PasteOverrides,
  type RunExport,
  type RunExportEfficiency,
} from "../types/runExport";
import type { RunManifest } from "../types/runManifest";

export type DetectedPaste =
  | { kind: PasteKind; raw: Record<string, unknown>; manifest: RunManifest | null }
  | { kind: "unknown"; error: string };

export type NormalizeOk = {
  ok: true;
  kind: PasteKind;
  export: RunExport;
  manifest: RunManifest | null;
  suggested: PasteOverrides;
  needsMeta: boolean;
};

export type NormalizeFail = { ok: false; error: string };

const ALLOWED_EXPORT_KEYS = new Set(["schema", "meta", "harness", "efficiency"]);
const TRANSPORT_TOP_KEYS = new Set([...ALLOWED_EXPORT_KEYS, "manifest"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x));
}

function testRuns(value: unknown): RunExport["harness"]["tests_run"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .map((item) => {
      const raw = str(item.result).toLowerCase();
      const result =
        raw === "passed" || raw === "pass" || raw === "ok" || raw === "success"
          ? ("passed" as const)
          : ("failed" as const);
      return {
        command: str(item.command),
        journey: str(item.journey),
        result,
      };
    });
}

function parseActionFlow(value: unknown): ActionSegment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: ActionSegment[] = [];
  for (const item of value) {
    if (!isObject(item)) continue;
    out.push({
      stage: str(item.stage) as ActionSegment["stage"],
      call_count: num(item.call_count),
      call_indexes: Array.isArray(item.call_indexes)
        ? item.call_indexes.filter((x): x is number => typeof x === "number")
        : [],
      wall_seconds: num(item.wall_seconds),
      raw_tokens: num(item.raw_tokens),
      weighted_tokens: num(item.weighted_tokens),
      note: typeof item.note === "string" ? item.note : null,
    });
  }
  return out.length ? out : undefined;
}

function parsePhaseHeuristic(value: unknown): RunExportEfficiency["phase_heuristic"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .map((p) => ({
      phase: str(p.phase) as RunExportEfficiency["phase_heuristic"][number]["phase"],
      call_count: num(p.call_count),
      weighted_cost: num(p.weighted_cost),
      share_of_total: num(p.share_of_total),
    }));
}

function parseEfficiency(efficiencyIn: Record<string, unknown>, harness: Record<string, unknown>) {
  let weighted: number;
  const existingWeighted = efficiencyIn.weighted_total;
  if (typeof existingWeighted === "number" && Number.isFinite(existingWeighted)) {
    weighted = existingWeighted;
  } else {
    weighted = computeWeightedTotal(
      num(harness.input_tokens),
      num(harness.output_tokens),
      num(harness.cache_read_tokens),
    );
  }

  const efficiency: RunExportEfficiency = {
    weighted_total: weighted,
    wall_seconds: numOrNull(efficiencyIn.wall_seconds),
    seconds_per_call: numOrNull(efficiencyIn.seconds_per_call),
    first_test_failure_s: numOrNull(efficiencyIn.first_test_failure_s),
    first_green_s: numOrNull(efficiencyIn.first_green_s),
    last_green_s: numOrNull(efficiencyIn.last_green_s),
    green_to_exit_s: numOrNull(efficiencyIn.green_to_exit_s),
    manual_test_calls:
      typeof efficiencyIn.manual_test_calls === "number"
        ? efficiencyIn.manual_test_calls
        : undefined,
    manual_build_calls:
      typeof efficiencyIn.manual_build_calls === "number"
        ? efficiencyIn.manual_build_calls
        : undefined,
    test_reinspection_calls:
      typeof efficiencyIn.test_reinspection_calls === "number"
        ? efficiencyIn.test_reinspection_calls
        : undefined,
    post_green_verification_calls:
      typeof efficiencyIn.post_green_verification_calls === "number"
        ? efficiencyIn.post_green_verification_calls
        : undefined,
    auto_test_candidate_events:
      typeof efficiencyIn.auto_test_candidate_events === "number"
        ? efficiencyIn.auto_test_candidate_events
        : undefined,
    auto_test_actual_runs:
      typeof efficiencyIn.auto_test_actual_runs === "number"
        ? efficiencyIn.auto_test_actual_runs
        : undefined,
    action_flow: parseActionFlow(efficiencyIn.action_flow),
    action_flow_source:
      efficiencyIn.action_flow_source === "derived" ||
      efficiencyIn.action_flow_source === "derived+override"
        ? efficiencyIn.action_flow_source
        : undefined,
    phase_heuristic: parsePhaseHeuristic(efficiencyIn.phase_heuristic),
    time_to_first_failing_test_s: numOrNull(efficiencyIn.time_to_first_failing_test_s),
    time_to_final_green_s: numOrNull(efficiencyIn.time_to_final_green_s),
    npm_test_command_count: numOrNull(efficiencyIn.npm_test_command_count),
    auto_test_trigger_hits: numOrNull(efficiencyIn.auto_test_trigger_hits),
  };

  return efficiency;
}

export function computeWeightedTotal(
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
): number {
  return inputTokens + outputTokens * 3 + cacheReadTokens * 0.1;
}

function extraTopLevelKeys(raw: Record<string, unknown>): string[] {
  return Object.keys(raw).filter((k) => !TRANSPORT_TOP_KEYS.has(k));
}

function readTransportManifest(raw: Record<string, unknown>): RunManifest | null | "invalid" {
  if (!("manifest" in raw)) return null;
  try {
    return validateRunManifest(raw.manifest);
  } catch {
    return "invalid";
  }
}

function isRunExportShape(raw: Record<string, unknown>): boolean {
  return isObject(raw.meta) && isObject(raw.harness) && isObject(raw.efficiency);
}

export function detectPaste(raw: unknown): DetectedPaste {
  if (!isObject(raw)) {
    return { kind: "unknown", error: "Paste must be a JSON object." };
  }

  const manifestRead = readTransportManifest(raw);
  if (manifestRead === "invalid") {
    return {
      kind: "unknown",
      error: 'Invalid manifest — expected schema "agentcofounder.run_manifest.v1" and run_id.',
    };
  }

  const extra = extraTopLevelKeys(raw);
  if (extra.length && (raw.schema === RUN_EXPORT_SCHEMA_V1 || raw.schema === RUN_EXPORT_SCHEMA_V2)) {
    return {
      kind: "unknown",
      error: `Unexpected top-level keys: ${extra.join(", ")}. Expected schema, meta, harness, efficiency, optional manifest.`,
    };
  }

  if (raw.schema === RUN_EXPORT_SCHEMA_V2 && isRunExportShape(raw)) {
    return { kind: "run_export_v2", raw, manifest: manifestRead };
  }
  if (raw.schema === RUN_EXPORT_SCHEMA_V1 && isRunExportShape(raw)) {
    return { kind: "run_export_v1", raw, manifest: manifestRead };
  }
  if (
    typeof raw.status === "string" &&
    Array.isArray(raw.tests_run) &&
    typeof raw.input_tokens === "number"
  ) {
    return { kind: "result_json", raw, manifest: manifestRead };
  }
  return {
    kind: "unknown",
    error:
      'Unrecognized JSON. Paste agentcofounder.run_export.v2 or .v1 (schema/meta/harness/efficiency, optional manifest), or legacy result.json.',
  };
}

function hintModelFromCallLog(raw: Record<string, unknown>): string | undefined {
  const log = raw.call_log;
  if (!Array.isArray(log) || !log.length) return undefined;
  const first = log[0];
  if (isObject(first) && typeof first.model === "string" && first.model.trim()) {
    return first.model.trim();
  }
  return undefined;
}

function applyOverrides(
  meta: RunExport["meta"],
  overrides: PasteOverrides,
): RunExport["meta"] {
  return {
    ...meta,
    run_id: overrides.run_id?.trim() || meta.run_id,
    approach: overrides.approach?.trim() || meta.approach,
    provider: overrides.provider?.trim() || meta.provider,
    model: overrides.model?.trim() || meta.model,
    git_branch:
      overrides.git_branch !== undefined
        ? overrides.git_branch?.trim() || null
        : meta.git_branch,
    git_commit:
      overrides.git_commit !== undefined
        ? overrides.git_commit?.trim() || null
        : meta.git_commit,
  };
}

function normalizeRunExport(
  raw: Record<string, unknown>,
  schema: typeof RUN_EXPORT_SCHEMA_V1 | typeof RUN_EXPORT_SCHEMA_V2,
  kind: "run_export_v1" | "run_export_v2",
  overrides: PasteOverrides,
  manifest: RunManifest | null,
): NormalizeOk | NormalizeFail {
  const metaIn = isObject(raw.meta) ? raw.meta : {};
  const harnessIn = isObject(raw.harness) ? raw.harness : {};
  const efficiencyIn = isObject(raw.efficiency) ? raw.efficiency : {};

  let meta: RunExport["meta"] = {
    run_id: str(metaIn.run_id),
    recorded_at: str(metaIn.recorded_at) || new Date().toISOString(),
    git_branch: typeof metaIn.git_branch === "string" ? metaIn.git_branch : null,
    git_commit: typeof metaIn.git_commit === "string" ? metaIn.git_commit : null,
    approach: typeof metaIn.approach === "string" ? metaIn.approach : null,
    provider: typeof metaIn.provider === "string" ? metaIn.provider : null,
    model: typeof metaIn.model === "string" ? metaIn.model : null,
    classification: isObject(metaIn.classification)
      ? (metaIn.classification as RunExport["meta"]["classification"])
      : undefined,
  };
  meta = applyOverrides(meta, overrides);

  if (!meta.run_id) return { ok: false, error: "meta.run_id is required." };
  if (!str(harnessIn.status)) return { ok: false, error: "harness.status is required." };

  const efficiency = parseEfficiency(efficiencyIn, harnessIn);
  if (!Number.isFinite(efficiency.weighted_total)) {
    return { ok: false, error: "efficiency.weighted_total must be a finite number." };
  }

  const exp: RunExport = {
    schema,
    meta,
    harness: harnessIn as RunExport["harness"],
    efficiency,
  };

  const flowError = validateActionFlow(exp);
  if (flowError) return { ok: false, error: flowError };

  const needsMeta = !meta.approach;
  return {
    ok: true,
    kind,
    export: exp,
    manifest,
    suggested: {
      approach: meta.approach || undefined,
      provider: meta.provider || undefined,
      model: meta.model || undefined,
      run_id: meta.run_id,
      git_branch: meta.git_branch,
      git_commit: meta.git_commit,
    },
    needsMeta,
  };
}

function normalizeResultJson(
  raw: Record<string, unknown>,
  overrides: PasteOverrides,
  manifest: RunManifest | null,
): NormalizeOk | NormalizeFail {
  const inputTokens = num(raw.input_tokens);
  const outputTokens = num(raw.output_tokens);
  const cacheRead = num(raw.cache_read_tokens);
  const cacheWrite = num(raw.cache_write_tokens);
  const features = raw.implemented_features ?? raw.features;
  let modelCalls = raw.model_calls;
  if (typeof modelCalls !== "number") {
    modelCalls = Array.isArray(raw.call_log) ? raw.call_log.length : 0;
  }

  const suggested: PasteOverrides = {
    approach: overrides.approach,
    provider: overrides.provider,
    model: overrides.model || hintModelFromCallLog(raw),
    run_id: overrides.run_id,
    git_branch: overrides.git_branch,
    git_commit: overrides.git_commit,
  };

  const meta = applyOverrides(
    {
      run_id: suggested.run_id || `legacy-${crypto.randomUUID().slice(0, 8)}`,
      recorded_at: new Date().toISOString(),
      git_branch: suggested.git_branch ?? null,
      git_commit: suggested.git_commit ?? null,
      approach: suggested.approach ?? null,
      provider: suggested.provider ?? null,
      model: suggested.model ?? null,
    },
    overrides,
  );

  const missing: string[] = [];
  if (!meta.approach?.trim()) missing.push("approach");
  if (!meta.provider?.trim()) missing.push("provider");
  if (!meta.model?.trim()) missing.push("model");
  if (!meta.run_id?.trim()) missing.push("run_id");

  const needsMeta = missing.length > 0;
  if (needsMeta && Object.keys(overrides).length === 0) {
    return {
      ok: true,
      kind: "result_json",
      export: {
        schema: RUN_EXPORT_SCHEMA_V1,
        meta: { ...meta, run_id: meta.run_id || "" },
        harness: {
          status: str(raw.status) || "unknown",
          summary: str(raw.summary),
          implemented_features: strList(features),
          assumptions: strList(raw.assumptions),
          tests_run: testRuns(raw.tests_run),
          harness_checks: testRuns(raw.harness_checks),
          model_calls: num(modelCalls),
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_tokens: cacheRead,
          cache_write_tokens: cacheWrite,
          total_tokens: num(raw.total_tokens, inputTokens + outputTokens),
          reasoning_tokens: num(raw.reasoning_tokens),
          cost_total: num(raw.cost_total),
          pi_exit_code: num(raw.pi_exit_code),
        },
        efficiency: {
          weighted_total: computeWeightedTotal(inputTokens, outputTokens, cacheRead),
          wall_seconds: null,
          seconds_per_call: null,
          time_to_final_green_s: null,
          time_to_first_failing_test_s: null,
          npm_test_command_count: 0,
          auto_test_trigger_hits: 0,
          phase_heuristic: [],
        },
      },
      manifest,
      suggested: {
        ...suggested,
        run_id: suggested.run_id || meta.run_id,
        model: suggested.model || meta.model || undefined,
      },
      needsMeta: true,
    };
  }

  if (missing.length) {
    return { ok: false, error: `Complete run info required: ${missing.join(", ")}.` };
  }
  if (!str(raw.status)) {
    return { ok: false, error: "result.json status is required." };
  }

  const exp: RunExport = {
    schema: RUN_EXPORT_SCHEMA_V1,
    meta,
    harness: {
      status: str(raw.status),
      summary: str(raw.summary),
      implemented_features: strList(features),
      assumptions: strList(raw.assumptions),
      tests_run: testRuns(raw.tests_run),
      harness_checks: testRuns(raw.harness_checks),
      model_calls: num(modelCalls),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_tokens: cacheRead,
      cache_write_tokens: cacheWrite,
      total_tokens: num(raw.total_tokens, inputTokens + outputTokens),
      reasoning_tokens: num(raw.reasoning_tokens),
      cost_total: num(raw.cost_total),
      pi_exit_code: num(raw.pi_exit_code),
    },
    efficiency: {
      weighted_total: computeWeightedTotal(inputTokens, outputTokens, cacheRead),
      wall_seconds: null,
      seconds_per_call: null,
      time_to_final_green_s: null,
      time_to_first_failing_test_s: null,
      npm_test_command_count: 0,
      auto_test_trigger_hits: 0,
      phase_heuristic: [],
    },
  };

  return {
    ok: true,
    kind: "result_json",
    export: exp,
    manifest,
    suggested: {
      approach: meta.approach || undefined,
      provider: meta.provider || undefined,
      model: meta.model || undefined,
      run_id: meta.run_id,
      git_branch: meta.git_branch,
      git_commit: meta.git_commit,
    },
    needsMeta: false,
  };
}

/** Parse textarea JSON and detect format (no overrides yet). */
export function inspectPaste(rawText: string): DetectedPaste | { kind: "invalid"; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { kind: "invalid", error: "Invalid JSON — paste the file contents." };
  }
  return detectPaste(parsed);
}

/** Build canonical export from detected paste + optional overrides. */
export function normalizeDetected(
  detected: Extract<DetectedPaste, { kind: PasteKind }>,
  overrides: PasteOverrides = {},
): NormalizeOk | NormalizeFail {
  if (detected.kind === "run_export_v2") {
    return normalizeRunExport(
      detected.raw,
      RUN_EXPORT_SCHEMA_V2,
      "run_export_v2",
      overrides,
      detected.manifest,
    );
  }
  if (detected.kind === "run_export_v1") {
    return normalizeRunExport(
      detected.raw,
      RUN_EXPORT_SCHEMA_V1,
      "run_export_v1",
      overrides,
      detected.manifest,
    );
  }
  return normalizeResultJson(detected.raw, overrides, detected.manifest);
}

/** Strict parse for v1/v2 exports (rejects result.json). */
export function parseRunExport(raw: unknown): RunExport | { error: string } {
  const detected = detectPaste(raw);
  if (detected.kind === "unknown") return { error: detected.error };
  if (detected.kind === "result_json") {
    return { error: "Legacy result.json — use normalizeDetected with overrides." };
  }
  const normalized = normalizeDetected(detected, {});
  if (!normalized.ok) return { error: normalized.error };
  return normalized.export;
}

/** @deprecated prefer inspectPaste + normalizeDetected */
export function parseRunExportText(rawText: string): NormalizeOk | NormalizeFail {
  const inspected = inspectPaste(rawText);
  if (inspected.kind === "invalid" || inspected.kind === "unknown") {
    return { ok: false, error: inspected.error };
  }
  return normalizeDetected(inspected, {});
}
