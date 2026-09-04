import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createExperiment,
  getExperiment,
  invalidateExperimentsCache,
  listExperimentsWithUsage,
  materializeExperiment,
  patchExperiment,
  runIdsForExperiment,
  type CreateExperimentRequest,
  type PatchExperimentRequest,
} from "./experiments.js";
import { discoverEnvProfiles, resolveEnvProfilePath } from "./env-profiles.js";
import { listHackathonRuns } from "./hackathon-api.js";
import {
  matchRoute,
  parsePathname,
  readJsonBody,
  sendError,
  sendJson,
} from "./http.js";
import {
  buildChallengeShellCommand,
  jobRegistry,
  spawnNpmScript,
} from "./jobs.js";
import { isPortInUse } from "./port-check.js";
import {
  hackathonApiBase,
  hackathonFrontendBase,
  publishRunToHackathon,
} from "./publish-run.js";
import { invalidateRunsCache, listRunSummaries, loadRunDetail } from "./runs.js";
import { openRunApp, getRunAppStatus, killRunApp } from "./run-app.js";
import {
  getRunOverlayFromFile,
  invalidateOverlayCache,
  listAuthorsFromFile,
  patchRunOverlay,
  readOverlayFile,
  type RunOverlayPatch,
} from "./run-overlay.js";
import { defaultHarnessEnv, HARNESS_BOARD_FLAGS } from "../shared/harness-board.js";
import type { ChallengeLaunchRequest, ReplayLaunchRequest } from "./types.js";

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONTROL_APP_ROOT = path.resolve(SERVER_DIR, "..");
const REPO_ROOT = path.resolve(CONTROL_APP_ROOT, "..");
const RUNS_ROOT = path.join(REPO_ROOT, "artifacts", "runs");
const ANALYSIS_ROOT = path.join(REPO_ROOT, "artifacts", "analysis");
const REPLAY_ROOT = path.join(REPO_ROOT, "artifacts", "replay");
const API_PORT = Number(process.env.CONTROL_APP_PORT ?? "4319");
const APP_PORT = 3000;

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function runExperimentSlugMap(
  runs: Awaited<ReturnType<typeof listRunSummaries>>,
): Map<string, string | null> {
  return new Map(runs.map((run) => [run.run_id, run.experiment_slug ?? run.experiment_id]));
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const pathname = parsePathname(req.url ?? "/");
  const method = req.method ?? "GET";

  try {
    if (method === "GET" && pathname === "/api/health") {
      sendJson(res, 200, { ok: true, repo_root: REPO_ROOT });
      return;
    }

    if (method === "GET" && pathname === "/api/env-profiles") {
      const profiles = await discoverEnvProfiles();
      sendJson(res, 200, { profiles });
      return;
    }

    if (method === "GET" && pathname === "/api/runs") {
      const runs = await listRunSummaries(RUNS_ROOT, ANALYSIS_ROOT, REPLAY_ROOT);
      sendJson(res, 200, { runs });
      return;
    }

    if (method === "GET" && pathname === "/api/hackathon/runs") {
      const runs = await listHackathonRuns(RUNS_ROOT, ANALYSIS_ROOT);
      sendJson(res, 200, { runs });
      return;
    }

    if (method === "GET" && pathname === "/api/authors") {
      const overlayFile = await readOverlayFile(REPO_ROOT);
      sendJson(res, 200, { authors: listAuthorsFromFile(overlayFile) });
      return;
    }

    if (method === "GET" && pathname === "/api/overlay/taxonomy") {
      const overlayFile = await readOverlayFile(REPO_ROOT);
      sendJson(res, 200, { taxonomy: overlayFile.taxonomy });
      return;
    }

    if (method === "GET" && pathname === "/api/experiments") {
      const overlayFile = await readOverlayFile(REPO_ROOT);
      const runs = await listRunSummaries(RUNS_ROOT, ANALYSIS_ROOT, REPLAY_ROOT);
      const experiments = await listExperimentsWithUsage(
        REPO_ROOT,
        overlayFile,
        runExperimentSlugMap(runs),
      );
      sendJson(res, 200, { experiments });
      return;
    }

    const materializeMatch = matchRoute(pathname, "/api/experiments/:id/materialize");
    if (method === "POST" && materializeMatch?.id) {
      const body = await readJsonBody<Partial<CreateExperimentRequest>>(req);
      try {
        const experiment = await materializeExperiment(REPO_ROOT, materializeMatch.id, body);
        invalidateExperimentsCache();
        invalidateOverlayCache();
        sendJson(res, 201, { experiment });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sendError(res, 400, message);
      }
      return;
    }

    const experimentMatch = matchRoute(pathname, "/api/experiments/:id");
    if (experimentMatch?.id) {
      const experimentId = experimentMatch.id;
      if (method === "GET") {
        const overlayFile = await readOverlayFile(REPO_ROOT);
        const runs = await listRunSummaries(RUNS_ROOT, ANALYSIS_ROOT, REPLAY_ROOT);
        const slugMap = runExperimentSlugMap(runs);
        const listed = await listExperimentsWithUsage(REPO_ROOT, overlayFile, slugMap);
        const listEntry = listed.find((entry) => entry.id === experimentId);
        if (!listEntry) {
          sendError(res, 404, "Experiment not found");
          return;
        }
        const experiment = (await getExperiment(REPO_ROOT, experimentId)) ?? {
          schema: "agentcofounder.experiment.v1",
          id: experimentId,
          title: listEntry.title,
          description: listEntry.description,
          status: listEntry.status,
          arms: [],
          tags: [],
          created_at: listEntry.created_at,
          updated_at: listEntry.updated_at,
          created_by: null,
        };
        sendJson(res, 200, {
          experiment,
          list: listEntry,
          run_ids: runIdsForExperiment(slugMap, experimentId),
        });
        return;
      }
      if (method === "PATCH") {
        const body = await readJsonBody<PatchExperimentRequest>(req);
        try {
          const experiment = await patchExperiment(REPO_ROOT, experimentId, body);
          invalidateExperimentsCache();
          invalidateOverlayCache();
          sendJson(res, 200, { experiment });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          sendError(res, 400, message);
        }
        return;
      }
    }

    if (method === "POST" && pathname === "/api/experiments") {
      const body = await readJsonBody<CreateExperimentRequest>(req);
      try {
        const experiment = await createExperiment(REPO_ROOT, body);
        invalidateExperimentsCache();
        invalidateOverlayCache();
        sendJson(res, 201, { experiment });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sendError(res, 400, message);
      }
      return;
    }

    const overlayMatch = matchRoute(pathname, "/api/runs/:id/overlay");
    if (overlayMatch?.id) {
      const runId = overlayMatch.id;
      if (method === "GET") {
        const overlayFile = await readOverlayFile(REPO_ROOT);
        sendJson(res, 200, {
          overlay: getRunOverlayFromFile(overlayFile, runId),
          taxonomy: overlayFile.taxonomy,
          authors: listAuthorsFromFile(overlayFile),
        });
        return;
      }
      if (method === "PATCH") {
        const body = await readJsonBody<RunOverlayPatch>(req);
        try {
          const overlay = await patchRunOverlay(REPO_ROOT, runId, body);
          invalidateOverlayCache();
          invalidateRunsCache();
          sendJson(res, 200, { overlay });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          sendError(res, 400, message);
        }
        return;
      }
    }

    const publishMatch = matchRoute(pathname, "/api/runs/:id/publish");
    if (method === "POST" && publishMatch?.id) {
      const body = await readJsonBody<{ access_key?: string }>(req);
      const accessCode = body.access_key?.trim() || process.env.HACKATHON_ACCESS_CODE?.trim() || "";
      if (!accessCode) {
        sendError(
          res,
          400,
          "Hackathon access key required — set HACKATHON_ACCESS_CODE on the server or pass access_key in the body",
        );
        return;
      }
      try {
        const result = await publishRunToHackathon({
          runsRoot: RUNS_ROOT,
          analysisRoot: ANALYSIS_ROOT,
          runId: publishMatch.id,
          accessCode,
          apiBase: hackathonApiBase(),
          frontendBase: hackathonFrontendBase(),
        });
        sendJson(res, 200, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sendError(res, 502, message);
      }
      return;
    }

    const runDetailMatch = matchRoute(pathname, "/api/runs/:id");
    if (method === "GET" && runDetailMatch) {
      const detail = await loadRunDetail(RUNS_ROOT, ANALYSIS_ROOT, runDetailMatch.id!, REPLAY_ROOT, REPO_ROOT);
      sendJson(res, 200, detail);
      return;
    }

    const analyzeMatch = matchRoute(pathname, "/api/runs/:id/analyze");
    if (method === "POST" && analyzeMatch) {
      const job = spawnNpmScript("analyze", analyzeMatch.id!, REPO_ROOT, "analyze:run", [
        analyzeMatch.id!,
      ]);
      sendJson(res, 202, { job_id: job.id, kind: job.kind });
      return;
    }

    const reconcileMatch = matchRoute(pathname, "/api/runs/:id/reconcile");
    if (method === "POST" && reconcileMatch) {
      const job = spawnNpmScript("reconcile", reconcileMatch.id!, REPO_ROOT, "reconcile:run", [
        reconcileMatch.id!,
      ]);
      sendJson(res, 202, { job_id: job.id, kind: job.kind });
      return;
    }

    const replayMatch = matchRoute(pathname, "/api/runs/:id/replay");
    if (method === "POST" && replayMatch) {
      const body = await readJsonBody<ReplayLaunchRequest>(req);
      const runDir = path.join("artifacts", "runs", replayMatch.id!);
      const scriptArgs = body.compare_only ? [runDir, "--compare-only"] : [runDir];
      const job = spawnNpmScript("replay", replayMatch.id!, REPO_ROOT, "replay:run", scriptArgs);
      jobRegistry.once("done", (jobId) => {
        if (jobId === job.id) {
          invalidateRunsCache();
        }
      });
      sendJson(res, 202, { job_id: job.id, kind: job.kind });
      return;
    }

    const openAppMatch = matchRoute(pathname, "/api/runs/:id/app/open");
    if (method === "POST" && openAppMatch) {
      const result = await openRunApp(REPO_ROOT, openAppMatch.id!);
      invalidateRunsCache();
      sendJson(res, 200, result);
      return;
    }

    const appStatusMatch = matchRoute(pathname, "/api/runs/:id/app/status");
    if (method === "GET" && appStatusMatch) {
      const status = await getRunAppStatus(REPO_ROOT, appStatusMatch.id!);
      sendJson(res, 200, status);
      return;
    }

    const killAppMatch = matchRoute(pathname, "/api/runs/:id/app/kill");
    if (method === "POST" && killAppMatch) {
      const result = await killRunApp(REPO_ROOT, killAppMatch.id!);
      sendJson(res, 200, result);
      return;
    }

    const stationMatch = matchRoute(pathname, "/api/runs/:id/station.html");
    if (method === "GET" && stationMatch) {
      const stationPath = path.join(ANALYSIS_ROOT, stationMatch.id!, "station.html");
      try {
        const html = await readFile(stationPath, "utf8");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      } catch {
        sendError(res, 404, "station.html not found — run analyze first");
      }
      return;
    }

    if (method === "POST" && pathname === "/api/challenge") {
      const body = await readJsonBody<ChallengeLaunchRequest>(req);
      if (!body.env_profile) {
        sendError(res, 400, "env_profile is required");
        return;
      }
      if (jobRegistry.hasActiveChallenge()) {
        sendError(res, 409, "A challenge run is already in progress");
        return;
      }
      if (await isPortInUse(APP_PORT)) {
        sendError(res, 409, `Port ${APP_PORT} is in use. Stop the dev server before launching.`);
        return;
      }

      const profiles = await discoverEnvProfiles();
      const profilePath = resolveEnvProfilePath(profiles, body.env_profile);
      if (!profilePath) {
        sendError(res, 400, `Unknown env profile: ${body.env_profile}`);
        return;
      }

      const shell = buildChallengeShellCommand(REPO_ROOT, profilePath, body);
      const job = jobRegistry.spawnJob({
        kind: "challenge",
        runId: null,
        command: shell.command,
        args: shell.args,
        cwd: REPO_ROOT,
        env: shell.env,
        ...(body.timeout_ms !== undefined ? { timeout_ms: body.timeout_ms } : {}),
      });

      jobRegistry.once("done", (jobId) => {
        if (jobId === job.id) {
          invalidateRunsCache();
        }
      });

      sendJson(res, 202, { job_id: job.id, kind: job.kind });
      return;
    }

    if (method === "GET" && pathname === "/api/challenge/active") {
      const active = jobRegistry.getActiveChallenge();
      sendJson(res, 200, { job: active });
      return;
    }

    if (method === "GET" && pathname === "/api/harness-board") {
      sendJson(res, 200, {
        flags: HARNESS_BOARD_FLAGS,
        defaults: defaultHarnessEnv(),
      });
      return;
    }

    const jobStreamMatch = matchRoute(pathname, "/api/jobs/:id/stream");
    if (method === "GET" && jobStreamMatch) {
      streamJob(jobStreamMatch.id!, req, res);
      return;
    }

    const jobStopMatch = matchRoute(pathname, "/api/jobs/:id/stop");
    if (method === "POST" && jobStopMatch) {
      const job = jobRegistry.get(jobStopMatch.id!);
      if (!job) {
        sendError(res, 404, "Job not found");
        return;
      }
      const stopped = jobRegistry.killJob(jobStopMatch.id!, "stopped");
      if (!stopped) {
        sendError(res, 409, `Job is not running (status: ${job.status})`);
        return;
      }
      sendJson(res, 200, jobRegistry.get(jobStopMatch.id!));
      return;
    }

    const jobMatch = matchRoute(pathname, "/api/jobs/:id");
    if (method === "GET" && jobMatch) {
      const job = jobRegistry.get(jobMatch.id!);
      if (!job) {
        sendError(res, 404, "Job not found");
        return;
      }
      sendJson(res, 200, job);
      return;
    }

    if (method === "GET" && pathname === "/api/publish/status") {
      const hasServerKey = Boolean(process.env.HACKATHON_ACCESS_CODE?.trim());
      sendJson(res, 200, {
        available: true,
        has_server_access_key: hasServerKey,
        api_base: hackathonApiBase(),
        frontend_base: hackathonFrontendBase(),
        message: hasServerKey
          ? "Publish ready — server has HACKATHON_ACCESS_CODE"
          : "Enter the team hackathon access key when publishing",
      });
      return;
    }

    sendError(res, 404, "Not found");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendError(res, 500, message);
  }
}

function streamJob(jobId: string, req: IncomingMessage, res: ServerResponse): void {
  const job = jobRegistry.get(jobId);
  if (!job) {
    sendError(res, 404, "Job not found");
    return;
  }

  setCors(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  for (const line of job.lines) {
    res.write(`data: ${JSON.stringify({ type: "line", line })}\n\n`);
  }

  if (job.status !== "running") {
    res.write(
      `data: ${JSON.stringify({ type: "done", status: job.status, exit_code: job.exit_code })}\n\n`,
    );
    res.end();
    return;
  }

  const onLine = (id: string, line: string): void => {
    if (id !== jobId) return;
    res.write(`data: ${JSON.stringify({ type: "line", line })}\n\n`);
  };

  const onDone = (id: string, status: string, exitCode: number | null): void => {
    if (id !== jobId) return;
    res.write(`data: ${JSON.stringify({ type: "done", status, exit_code: exitCode })}\n\n`);
    res.end();
    cleanup();
  };

  const cleanup = (): void => {
    jobRegistry.off("line", onLine);
    jobRegistry.off("done", onDone);
  };

  jobRegistry.on("line", onLine);
  jobRegistry.on("done", onDone);

  req.on("close", () => {
    cleanup();
  });
}

export function startServer(): void {
  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  server.listen(API_PORT, () => {
    console.log(`V2 Control API listening on http://localhost:${API_PORT}`);
    console.log(`Repo root: ${REPO_ROOT}`);
  });
}

const entryHref = pathToFileURL(process.argv[1] ?? "").href;
if (import.meta.url === entryHref) {
  startServer();
}
