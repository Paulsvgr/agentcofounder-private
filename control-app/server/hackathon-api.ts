import { access } from "node:fs/promises";
import path from "node:path";
import { buildHackathonRunRecord, type HackathonRunRecord } from "./export-run.js";
import { listRunSummaries, summarizeRun } from "./runs.js";
import type { RunSummary } from "./types.js";

const RUN_ID_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

export async function listHackathonRuns(
  runsRoot: string,
  analysisRoot: string,
): Promise<HackathonRunRecord[]> {
  const summaries = await listRunSummaries(runsRoot, analysisRoot);
  return Promise.all(
    summaries.map((summary) =>
      buildHackathonRunRecord(runsRoot, analysisRoot, summary.run_id, summary),
    ),
  );
}

export async function getHackathonRun(
  runsRoot: string,
  analysisRoot: string,
  id: string,
): Promise<HackathonRunRecord | null> {
  if (!RUN_ID_PATTERN.test(id)) return null;
  try {
    await access(path.join(runsRoot, id));
  } catch {
    return null;
  }
  const summary = await summarizeRun(runsRoot, analysisRoot, id);
  return buildHackathonRunRecord(runsRoot, analysisRoot, id, summary);
}

export function filterHackathonRuns(
  runs: HackathonRunRecord[],
  params: { person?: string; branch?: string; commit?: string; approach_kind?: string },
): HackathonRunRecord[] {
  return runs.filter((run) => {
    if (params.person && run.person !== params.person) return false;
    if (params.branch && run.data.git_branch !== params.branch) return false;
    if (params.commit && run.data.git_commit !== params.commit) return false;
    if (params.approach_kind && run.data.approach_kind !== params.approach_kind) return false;
    return true;
  });
}

export function localPeople(_runs: HackathonRunRecord[]): string[] {
  return ["local"];
}

export function stationHtmlPath(analysisRoot: string, runId: string): string {
  return path.join(analysisRoot, runId, "station.html");
}
