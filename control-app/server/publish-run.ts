import {
  buildHackathonRunRecord,
  type HackathonRunRecord,
} from "./export-run.js";
import type { AppRubricScores } from "../shared/app-rubric.js";
import { summarizeRun } from "./runs.js";

const DEFAULT_API_BASE = "https://admin.coretechs.se/hackathon";
const DEFAULT_FRONTEND_BASE = "https://agentcofounder-hackathon.vercel.app";

export interface HackathonSeedPayload {
  author: string;
  paste: Record<string, unknown>;
  overrides: Record<string, unknown>;
  app_rubric: AppRubricScores | null;
  app_rating: number | null;
  app_comment: string;
  run_comment: string;
}

export interface PublishRunOptions {
  runsRoot: string;
  analysisRoot: string;
  runId: string;
  accessCode: string;
  apiBase?: string;
  frontendBase?: string;
}

export interface PublishRunResult {
  run_id: string;
  harness_run_id: string;
  view_url: string | null;
  api_status: number;
  created: boolean;
}

export function hackathonApiBase(): string {
  return (process.env.HACKATHON_API_BASE ?? DEFAULT_API_BASE).replace(/\/$/, "");
}

export function hackathonFrontendBase(): string {
  return (process.env.FRONTEND_BASE ?? DEFAULT_FRONTEND_BASE).replace(/\/$/, "");
}

export function buildSeedPayload(record: HackathonRunRecord): HackathonSeedPayload {
  const meta = record.data.export.meta;
  const harnessRunId = record.data.run_id ?? meta.run_id;
  const paste: Record<string, unknown> = {
    ...record.data.export,
    manifest: record.data.manifest,
  };

  const overrides: Record<string, unknown> = {
    run_id: harnessRunId,
    approach: meta.approach ?? record.data.approach_kind,
    git_branch: record.data.git_branch,
    git_commit: record.data.git_commit,
  };
  if (meta.provider) overrides.provider = meta.provider;
  if (meta.model) overrides.model = meta.model;
  if (record.data.classification) {
    overrides.classification = record.data.classification;
  }

  return {
    author: record.person,
    paste,
    overrides,
    app_rubric: record.data.app_rubric ?? record.data.human?.app_rubric ?? null,
    app_rating: record.data.app_rating,
    app_comment: record.data.app_comment,
    run_comment: record.data.run_comment,
  };
}

function harnessRunIdFromRow(row: Record<string, unknown>): string | null {
  const data = row.data;
  if (!data || typeof data !== "object") return null;
  const dataRecord = data as Record<string, unknown>;
  if (typeof dataRecord.run_id === "string" && dataRecord.run_id) {
    return dataRecord.run_id;
  }
  const exportDoc = dataRecord.export;
  if (!exportDoc || typeof exportDoc !== "object") return null;
  const meta = (exportDoc as Record<string, unknown>).meta;
  if (!meta || typeof meta !== "object") return null;
  const runId = (meta as Record<string, unknown>).run_id;
  return typeof runId === "string" && runId ? runId : null;
}

function parseRunsList(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) return body as Array<Record<string, unknown>>;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["results", "data", "runs"] as const) {
      const value = record[key];
      if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
    }
  }
  return [];
}

export async function fetchHackathonRuns(apiBase: string): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(`${apiBase}/api/v1/runs/`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch runs from hackathon API (${res.status})`);
  }
  return parseRunsList(await res.json());
}

export function indexRunsByHarnessId(
  rows: Array<Record<string, unknown>>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows) {
    const harnessId = harnessRunIdFromRow(row);
    const uuid = row.id;
    if (harnessId && typeof uuid === "string" && uuid) {
      out.set(harnessId, uuid);
    }
  }
  return out;
}

export async function resolveFrontendViewUrl(
  harnessRunId: string,
  apiBase: string,
  frontendBase: string,
): Promise<string | null> {
  const rows = await fetchHackathonRuns(apiBase);
  const uuid = indexRunsByHarnessId(rows).get(harnessRunId);
  return uuid ? `${frontendBase}/runs/${uuid}` : null;
}

export async function postRunToHackathon(
  apiBase: string,
  accessCode: string,
  payload: HackathonSeedPayload,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${apiBase}/api/v1/runs/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Hackathon-Key": accessCode,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }
  return { status: res.status, body };
}

export async function publishRunToHackathon(
  options: PublishRunOptions,
): Promise<PublishRunResult> {
  const apiBase = (options.apiBase ?? hackathonApiBase()).replace(/\/$/, "");
  const frontendBase = (options.frontendBase ?? hackathonFrontendBase()).replace(/\/$/, "");
  const accessCode = options.accessCode.trim();
  if (!accessCode) {
    throw new Error("Hackathon access key is required");
  }

  const summary = await summarizeRun(options.runsRoot, options.analysisRoot, options.runId);
  const record = await buildHackathonRunRecord(
    options.runsRoot,
    options.analysisRoot,
    options.runId,
    summary,
  );
  const payload = buildSeedPayload(record);
  const harnessRunId = String(payload.overrides.run_id ?? options.runId);

  const { status, body } = await postRunToHackathon(apiBase, accessCode, payload);
  const created = status === 200 || status === 201;

  let viewUrl: string | null = null;
  if (body && typeof body === "object") {
    const responseRecord = body as Record<string, unknown>;
    const responseId = responseRecord.id;
    if (typeof responseId === "string" && responseId) {
      viewUrl = `${frontendBase}/runs/${responseId}`;
    }
  }

  if (!viewUrl) {
    viewUrl = await resolveFrontendViewUrl(harnessRunId, apiBase, frontendBase);
  }

  if (!created && !viewUrl) {
    const detail =
      typeof body === "string"
        ? body
        : body && typeof body === "object"
          ? JSON.stringify(body)
          : `HTTP ${status}`;
    throw new Error(`Publish failed (${status}): ${detail}`);
  }

  return {
    run_id: harnessRunId,
    harness_run_id: harnessRunId,
    view_url: viewUrl,
    api_status: status,
    created,
  };
}
