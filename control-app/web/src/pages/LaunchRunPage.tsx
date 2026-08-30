import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  fetchEnvProfiles,
  launchChallenge,
  streamJob,
  type ChallengeLaunchRequest,
  type EnvProfile,
  type JobStatus,
} from "../lib/api.js";

export function LaunchRunPage() {
  const [profiles, setProfiles] = useState<EnvProfile[]>([]);
  const [form, setForm] = useState<ChallengeLaunchRequest>({
    env_profile: "challenge-env-zai.sh",
    provider: "zai",
    model: "glm-5.2",
    thinking: "off",
    timeout_ms: 900_000,
    idea_file: "contract-public/development-idea.txt",
  });
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneStatus, setDoneStatus] = useState<JobStatus | null>(null);

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
  }, []);

  function updateField<K extends keyof ChallengeLaunchRequest>(
    key: K,
    value: ChallengeLaunchRequest[K],
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLaunch(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setLines([]);
    setDoneStatus(null);
    setRunning(true);
    try {
      const payload: ChallengeLaunchRequest = {
        env_profile: form.env_profile,
        thinking: form.thinking ?? "off",
        timeout_ms: form.timeout_ms ?? 900_000,
        idea_file: form.idea_file ?? "contract-public/development-idea.txt",
      };
      if (form.provider?.trim()) payload.provider = form.provider.trim();
      if (form.model?.trim()) payload.model = form.model.trim();
      if (form.cohort?.trim()) payload.cohort = form.cohort.trim();
      if (form.arm?.trim()) payload.arm = form.arm.trim();
      if (form.intervention?.trim()) payload.intervention = form.intervention.trim();
      if (form.rep !== undefined && form.rep > 0) payload.rep = form.rep;

      const { job_id: jobId } = await launchChallenge(payload);
      await new Promise<void>((resolve, reject) => {
        streamJob(
          jobId,
          (line) => setLines((prev) => [...prev, line]),
          (status, exitCode) => {
            setDoneStatus(status);
            if (status === "succeeded" && exitCode === 0) resolve();
            else reject(new Error(`Challenge ${status} (exit ${exitCode ?? "?"})`));
          },
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section>
      <p className="muted">
        <Link to="/">Runs</Link> / New run
      </p>

      <div className="panel">
        <h2>Launch challenge</h2>
        <p className="muted">
          Uses env profile + explicit overrides. Default: Z.ai GLM-5.2 (thinking off). Port 3000 must be free.
        </p>

        {error ? <div className="error-banner">{error}</div> : null}

        <form onSubmit={(event) => void handleLaunch(event)}>
          <div className="form-grid">
            <label>
              Env profile
              <select
                value={form.env_profile}
                onChange={(event) => updateField("env_profile", event.target.value)}
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
              />
            </label>
            <label>
              Model override
              <input value={form.model ?? ""} onChange={(event) => updateField("model", event.target.value)} />
            </label>
            <label>
              Thinking
              <select
                value={form.thinking ?? "off"}
                onChange={(event) => updateField("thinking", event.target.value)}
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
              />
            </label>
            <label>
              Idea file
              <input
                value={form.idea_file ?? ""}
                onChange={(event) => updateField("idea_file", event.target.value)}
              />
            </label>
            <label>
              RUN_COHORT
              <input value={form.cohort ?? ""} onChange={(event) => updateField("cohort", event.target.value)} />
            </label>
            <label>
              RUN_ARM
              <input value={form.arm ?? ""} onChange={(event) => updateField("arm", event.target.value)} />
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
              />
            </label>
            <label>
              RUN_INTERVENTION
              <input
                value={form.intervention ?? ""}
                onChange={(event) => updateField("intervention", event.target.value)}
              />
            </label>
          </div>

          <div className="actions">
            <button type="submit" disabled={running}>
              {running ? "Running…" : "Launch challenge"}
            </button>
          </div>
        </form>

        {doneStatus ? (
          <p className="muted">
            Finished: {doneStatus}.{" "}
            <Link to="/" onClick={() => undefined}>
              Refresh runs list
            </Link>
          </p>
        ) : null}

        {lines.length > 0 ? <pre className="console">{lines.join("\n")}</pre> : null}
      </div>
    </section>
  );
}
