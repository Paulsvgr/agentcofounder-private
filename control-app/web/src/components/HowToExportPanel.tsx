export function HowToExportPanel({ defaultOpen = true }: { defaultOpen?: boolean }) {
  return (
    <details className="panel howto" open={defaultOpen}>
      <summary>
        <span className="howto-title">How to get a run JSON</span>
        <span className="muted howto-sub">from the harness repo</span>
      </summary>

      <div className="howto-body stack">
        <p style={{ margin: 0 }}>
          Use branch <code>setup/measure</code> for analyze, export, experiments, and publish-to-DB.{" "}
          <strong>Not</strong> thin <code>main</code>/<code>base</code> — those have no{" "}
          <code>export:run</code>.
        </p>

        <pre className="code-block">{`git checkout setup/measure
npm ci --ignore-scripts   # if first time on this branch`}</pre>

        <p className="muted" style={{ margin: 0 }}>
          After a challenge run:
        </p>

        <pre className="code-block">{`npm run challenge
# …wait until finished…
ls -1dt artifacts/runs/*/ | head -1    # note the run-id folder name
npm run analyze -- <run-id>
npm run export:run -- <run-id> --approach A-baseline-1`}</pre>

        <ul className="list-plain">
          <li>
            Export file: <code>artifacts/exports/&lt;run-id&gt;.json</code> — prefer{" "}
            <code>agentcofounder.run_export.v2</code> (action-flow chart on run detail).
            Optional top-level <code>manifest</code> (<code>agentcofounder.run_manifest.v1</code>)
            is stored as a sibling on the run — not inside export.
          </li>
          <li>
            Legacy v1 or <code>result.json</code> still accepted — server normalizes; phase / wall time may be empty
          </li>
          <li>
            <code>--approach</code> = experiment arm (e.g. <code>A-baseline-1</code>,{" "}
            <code>rtl-control-3</code>, <code>rtl-cleanup-2</code>) — not generic <code>base</code>
          </li>
          <li>
            Export tooling adds <code>meta.classification</code> for Method filters; ratings / comments go in this app
            or the seed script
          </li>
        </ul>

        <h3 style={{ marginBottom: 0 }}>Publish to prod DB (bulk)</h3>
        <p className="muted" style={{ margin: 0 }}>
          From WSL in the harness repo — re-export, sync manifest, POST upsert by <code>run_id</code>:
        </p>
        <pre className="code-block">{`export HACKATHON_ACCESS_CODE='…'
export HACKATHON_AUTHOR=paul

npm run publish:run -- <run-id> --approach rtl-control-1
npm run publish:runs -- --exp1-rtl   # all Experiment 1 reps`}</pre>
        <p style={{ margin: 0 }}>
          After publish, each run prints a <strong>view:</strong> link (
          <code>agentcofounder-hackathon.vercel.app/runs/&lt;uuid&gt;</code>). Lookup anytime:{" "}
          <code>npm run links:runs -- &lt;run-id&gt;</code>
        </p>
        <p style={{ margin: 0 }}>
          Or from this repo: <code>npm run seed:exp1-rtl</code> then{" "}
          <code>npm run backfill:classification</code> (reads exports on WSL via{" "}
          <code>AGENTCOFOUNDER_ROOT</code>).
        </p>

        <h3 style={{ marginBottom: 0 }}>Branch cheat-sheet</h3>
        <div className="table-wrap">
          <table className="runs howto-table">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Use for</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>setup/measure</code>
                </td>
                <td>Analyze, export, experiments, publish to runs DB</td>
              </tr>
              <tr>
                <td>
                  <code>main</code> / <code>base</code>
                </td>
                <td>Run challenges (pi-agent setup); no export tooling</td>
              </tr>
              <tr>
                <td>
                  <code>original</code>
                </td>
                <td>Stock organizer repo only</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p style={{ margin: 0 }}>
          Compare cohorts on <a href="/cohort">Cohort</a> (<code>?preset=exp1-rtl</code> for Experiment 1). Full
          checklist:{" "}
          <a href="/steps.html" target="_blank" rel="noreferrer">
            steps.html
          </a>
          .
        </p>
      </div>
    </details>
  );
}
