import type { HackathonRunRecord } from "../types/runExport";
import {
  manifestModelLine,
  manifestModelSettings,
  resolveManifestExperimentId,
  runManifestOf,
  templateTreeHash,
} from "../lib/manifestFields";

function row(label: string, value: string | null | undefined) {
  if (!value?.trim()) return null;
  return (
    <div className="manifest-row">
      <dt>{label}</dt>
      <dd className="mono">{value}</dd>
    </div>
  );
}

export function RunManifestPanel({ run }: { run: HackathonRunRecord }) {
  const manifest = runManifestOf(run);
  if (!manifest) return null;

  const exp = manifest.experiment;
  const template = manifest.template;
  const git = manifest.git;
  const treeHash = templateTreeHash(manifest);

  return (
    <section className="panel">
      <h3>Run manifest</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.88rem" }}>
        Provenance snapshot — config, template, experiment, and model settings (sibling to export).
      </p>
      <dl className="manifest-dl">
        {row("Schema", manifest.schema)}
        {row("Run ID", manifest.run_id)}
        {row("Config hash", manifest.config_hash)}
        {row("Config schema", manifest.config_schema_version)}
        {row("Template", template?.id)}
        {row("Template tree", treeHash ?? undefined)}
        {row("Experiment id", resolveManifestExperimentId(exp) ?? undefined)}
        {row("Experiment arm", exp?.arm ?? undefined)}
        {row(
          "Experiment rep",
          typeof exp?.rep === "number" ? String(exp.rep) : undefined,
        )}
        {row("Intervention", typeof exp?.intervention === "string" ? exp.intervention : undefined)}
        {row("Git branch", git?.branch ?? undefined)}
        {row("Git commit", git?.commit ?? undefined)}
        {row("Git dirty", git?.dirty ? "yes" : git?.dirty === false ? "no" : undefined)}
        {row("Model", manifestModelLine(manifest) || undefined)}
        {row("Model settings", manifestModelSettings(manifest) || undefined)}
        {row("Created", manifest.created_at)}
      </dl>
    </section>
  );
}
