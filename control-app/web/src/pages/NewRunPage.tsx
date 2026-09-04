import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BoardDecisionBadge } from "../components/BoardDecisionBadge.js";
import {
  fetchActiveChallenge,
  fetchEnvProfiles,
  fetchHarnessBoard,
  fetchJob,
  formatDuration,
  launchChallenge,
  stopJob,
  streamJob,
  type ChallengeLaunchRequest,
  type EnvProfile,
  type HarnessBoardFlag,
  type JobStatus,
} from "../lib/api.js";
import { defaultHarnessEnv } from "../../../shared/harness-board.js";

function jobStatusBadge(status: JobStatus | null): string {
  switch (status) {
    case "running":
      return "badge badge-partial";
    case "succeeded":
      return "badge badge-success";
    case "failed":
      return "badge badge-failed";
    case "timed_out":
      return "badge badge-failed";
    case "stopped":
      return "badge badge-incomplete";
    case null:
      return "badge badge-incomplete";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function NewRunPage() {
  const [profiles, setProfiles] = useState<EnvProfile[]>([]);
  const [boardFlags, setBoardFlags] = useState<HarnessBoardFlag[]>([]);
  const [flagValues, setFlagValues] = useState<Record<string, string>>(defaultHarnessEnv());
  const [form, setForm] = useState<ChallengeLaunchRequest>({
    env_profile: "challenge-env-zai.sh",
    provider: "zai",
    model: "glm-5.2",
    thinking: "off",
    timeout_ms: 900_000,
    idea_file: "contract-public/development-idea.txt",
  });
  const [lines, setLines] = useState<string[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneStatus, setDoneStatus] = useState<JobStatus | null>(null);
  const [detectedRunId, setDetectedRunId] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    void fetchEnvProfiles()
      .then((body) => {
        setProfiles(body.profiles);
        const defaultProfile = body.profiles.find((profile) => profile.is_default);
        if (defaultProfile) {
          setForm((prev) => ({ ...prev, env_profile: defaultProfile.id }));
        }
      })
      .catch((err: Error) => setError(err.message));

    void fetchHarnessBoard()
      .then((body) => {
        setBoardFlags(body.flags.filter((flag) => flag.launchToggle));
        setFlagValues(body.defaults);
      })
      .catch((err: Error) => setError(err.message));

    void fetchActiveChallenge()
      .then((body) => {
        if (!body.job || body.job.status !== "running") return;
        setJobId(body.job.id);
        setRunning(true);
        setLines(body.job.lines);
        setDetectedRunId(body.job.detected_run_id);
        startedAtRef.current = Date.parse(body.job.started_at);
        stopStreamRef.current = streamJob(
          body.job.id,
          (line) => setLines((prev) => [...prev, line]),
          (status) => {
            setDoneStatus(status);
            setRunning(false);
            void fetchJob(body.job!.id).then((job) => {
              setDetectedRunId(job.detected_run_id ?? job.run_id);
            });
          },
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => {
      if (startedAtRef.current) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
    }, 500);
    return () => window.clearInterval(tick);
  }, [running]);

  useEffect(() => {
    if (!running || !jobId) return;
    const poll = window.setInterval(() => {
      void fetchJob(jobId).then((job) => {
        if (job.detected_run_id || job.run_id) {
          setDetectedRunId(job.detected_run_id ?? job.run_id);
        }
      });
    }, 2_000);
    return () => window.clearInterval(poll);
  }, [running, jobId]);

  useEffect(() => {
    return () => {
      stopStreamRef.current?.();
    };
  }, []);

  function updateField<K extends keyof ChallengeLaunchRequest>(
    key: K,
    value: ChallengeLaunchRequest[K],
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleFlag(key: string): void {
    setFlagValues((prev) => ({
      ...prev,
      [key]: prev[key] === "1" ? "0" : "1",
    }));
  }

  function resetBoardDefaults(): void {
    const defaults: Record<string, string> = {};
    for (const flag of boardFlags) {
      defaults[flag.key] = flag.defaultValue;
    }
    setFlagValues(defaults);
  }

  async function handleLaunch(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setLines([]);
    setDoneStatus(null);
    setDetectedRunId(null);
    setElapsedMs(0);
    setRunning(true);
    startedAtRef.current = Date.now();

    try {
      const payload: ChallengeLaunchRequest = {
        env_profile: form.env_profile,
        thinking: form.thinking ?? "off",
        timeout_ms: form.timeout_ms ?? 900_000,
        idea_file: form.idea_file ?? "contract-public/development-idea.txt",
        env_overrides: { ...flagValues },
      };
      if (form.provider?.trim()) payload.provider = form.provider.trim();
      if (form.model?.trim()) payload.model = form.model.trim();
      if (form.experiment_id?.trim()) payload.experiment_id = form.experiment_id.trim();
      if (form.arm?.trim()) payload.arm = form.arm.trim();
      if (form.intervention?.trim()) payload.intervention = form.intervention.trim();
      if (form.rep !== undefined && form.rep > 0) payload.rep = form.rep;

      const { job_id: launchedId } = await launchChallenge(payload);
      setJobId(launchedId);

      await new Promise<void>((resolve) => {
        stopStreamRef.current = streamJob(
          launchedId,
          (line) => setLines((prev) => [...prev, line]),
          (status) => {
            setDoneStatus(status);
            void fetchJob(launchedId).then((job) => {
              setDetectedRunId(job.detected_run_id ?? job.run_id);
            });
            if (status === "failed") {
              setError(`Challenge failed`);
            } else if (status === "timed_out") {
              setError("Challenge timed out");
            }
            resolve();
          },
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDoneStatus("failed");
    } finally {
      setRunning(false);
      stopStreamRef.current = null;
    }
  }

  async function handleStop(): Promise<void> {
    if (!jobId) return;
    setStopping(true);
    setError(null);
    try {
      await stopJob(jobId);
      setDoneStatus("stopped");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStopping(false);
    }
  }

  const statusForDisplay: JobStatus | null = running ? "running" : doneStatus;

  return (
    <section>
      <p className="muted">
        <Link to="/">Runs</Link> / New run
      </p>

      <div className="panel">
        <h2>Launch challenge</h2>
        <p className="muted">
          Configure flags, experiment arm, and template overlays — then start/stop from here.
          Default: Z.ai GLM-5.2 (thinking off). Port 3000 must be free.
        </p>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="job-status-bar">
          <span className={jobStatusBadge(statusForDisplay)}>
            {statusForDisplay ?? "idle"}
          </span>
          {running || elapsedMs > 0 ? (
            <span className="muted">Elapsed {formatDuration(elapsedMs)}</span>
          ) : null}
          {detectedRunId ? (
            <Link to={`/runs/${detectedRunId}`}>Open run {detectedRunId}</Link>
          ) : null}
        </div>

        <form onSubmit={(event) => void handleLaunch(event)}>
          <div className="form-grid">
            <label>
              Env profile
              <select
                value={form.env_profile}
                onChange={(event) => updateField("env_profile", event.target.value)}
                disabled={running}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label} ({profile.id})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Provider override
              <input
                value={form.provider ?? ""}
                onChange={(event) => updateField("provider", event.target.value)}
                disabled={running}
              />
            </label>
            <label>
              Model override
              <input
                value={form.model ?? ""}
                onChange={(event) => updateField("model", event.target.value)}
                disabled={running}
              />
            </label>
            <label>
              Thinking
              <select
                value={form.thinking ?? "off"}
                onChange={(event) => updateField("thinking", event.target.value)}
                disabled={running}
              >
                <option value="off">off</option>
                <option value="minimal">minimal</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
            <label>
              Timeout (ms)
              <input
                type="number"
                value={form.timeout_ms ?? 900_000}
                onChange={(event) => updateField("timeout_ms", Number(event.target.value))}
                disabled={running}
              />
            </label>
            <label>
              Idea file
              <input
                value={form.idea_file ?? ""}
                onChange={(event) => updateField("idea_file", event.target.value)}
                disabled={running}
              />
            </label>
            <label>
              RUN_EXPERIMENT
              <input
                value={form.experiment_id ?? ""}
                onChange={(event) => updateField("experiment_id", event.target.value)}
                disabled={running}
                placeholder="e.g. verify-rtl-text-v1"
              />
            </label>
            <label>
              RUN_ARM
              <input
                value={form.arm ?? ""}
                onChange={(event) => updateField("arm", event.target.value)}
                disabled={running}
                placeholder="control | treatment"
              />
            </label>
            <label>
              RUN_REP
              <input
                type="number"
                min={1}
                value={form.rep ?? ""}
                onChange={(event) =>
                  updateField("rep", event.target.value ? Number(event.target.value) : undefined)
                }
                disabled={running}
              />
            </label>
            <label>
              RUN_INTERVENTION
              <input
                value={form.intervention ?? ""}
                onChange={(event) => updateField("intervention", event.target.value)}
                disabled={running}
              />
            </label>
          </div>

          <div className="harness-board-panel">
            <div className="harness-board-head">
              <h3>Harness / template flags</h3>
              <button type="button" className="btn-ghost" onClick={resetBoardDefaults} disabled={running}>
                Reset board defaults
              </button>
            </div>
            <p className="muted harness-board-note">
              Board decisions (KEEP / PARKED / OFF) are frozen for repair-tail — toggles only change
              this launch. Do not invent efficiency claims from PARKED/OFF flags.
            </p>
            <ul className="harness-flag-list">
              {boardFlags.map((flag) => {
                const on = flagValues[flag.key] === "1";
                return (
                  <li key={flag.key} className="harness-flag-row">
                    <label className="harness-flag-toggle">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleFlag(flag.key)}
                        disabled={running}
                      />
                      <span className="harness-flag-label">{flag.label}</span>
                      <code className="harness-flag-key">{flag.key}</code>
                    </label>
                    <BoardDecisionBadge decision={flag.decision} />
                    <span className="muted harness-flag-note">{flag.note}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="actions">
            <button type="submit" disabled={running}>
              {running ? "Running…" : "Launch challenge"}
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={!running || stopping || !jobId}
              onClick={() => void handleStop()}
            >
              {stopping ? "Stopping…" : "Stop"}
            </button>
          </div>
        </form>

        {doneStatus && !running ? (
          <p className="muted">
            Finished: <span className={jobStatusBadge(doneStatus)}>{doneStatus}</span>
            {detectedRunId ? (
              <>
                {" "}
                · <Link to={`/runs/${detectedRunId}`}>View run</Link> ·{" "}
                <Link to="/">Runs list</Link>
              </>
            ) : (
              <>
                {" "}
                · <Link to="/">Refresh runs list</Link>
              </>
            )}
          </p>
        ) : null}

        {lines.length > 0 ? <pre className="console">{lines.join("\n")}</pre> : null}
      </div>
    </section>
  );
}
