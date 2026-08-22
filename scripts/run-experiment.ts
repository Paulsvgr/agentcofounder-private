import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IDEA_FILE = path.join(REPOSITORY_ROOT, "contract-public", "development-idea.txt");
const EXPERIMENTS_DIR = path.join(REPOSITORY_ROOT, "artifacts", "experiments");

interface ManifestRep {
  rep: number;
  run_id: string;
  challenge_exit_code: number;
  export_path: string | null;
}

interface ExperimentManifest {
  schema: "agentcofounder.experiment_manifest.v1";
  arm: string;
  created_at: string;
  git_commit: string;
  git_branch: string | null;
  provider: string;
  model: string | null;
  challenge_timeout_ms: string | null;
  challenge_thinking: string | null;
  idea_file_sha256: string;
  reps: ManifestRep[];
}

function parseArgs(argv: string[]): { arm: string; reps: number; provider: string; publish: boolean } {
  let arm = "";
  let reps = 5;
  let provider = "zai";
  let publish = process.env.HACKATHON_PUBLISH === "1";
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--arm") {
      arm = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--reps") {
      reps = Number.parseInt(argv[index + 1] ?? "5", 10);
      index += 1;
    } else if (arg === "--provider") {
      provider = argv[index + 1] ?? "zai";
      index += 1;
    } else if (arg === "--publish") {
      publish = true;
    }
  }
  if (!arm) throw new Error("Usage: npm run experiment:run -- --arm <name> [--reps N] [--provider zai] [--publish]");
  if (!Number.isFinite(reps) || reps < 1) throw new Error("--reps must be a positive integer");
  return { arm, reps, provider, publish };
}

function gitValue(args: string[]): string | null {
  try {
    const value = execFileSync("git", args, {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function assertCleanTree(): void {
  const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  }).trim();
  if (status.length > 0) {
    throw new Error("Working tree has tracked changes; commit or stash before running an experiment cohort.");
  }
}

function resolveEnvFile(provider: string): string {
  const home = process.env.HOME ?? "";
  const candidates: Record<string, string[]> = {
    zai: [
      path.join(home, ".pi/agent/challenge-env-zai.sh"),
      path.join(REPOSITORY_ROOT, "pi-agent/challenge-env-zai.sh"),
    ],
    berget: [
      path.join(home, ".pi/agent/challenge-env.sh"),
      path.join(REPOSITORY_ROOT, "pi-agent/challenge-env.sh"),
    ],
    openai: [
      path.join(home, ".pi/agent/challenge-env-openai.sh"),
      path.join(REPOSITORY_ROOT, "pi-agent/challenge-env-openai.sh"),
    ],
  };
  const list = candidates[provider];
  if (!list) throw new Error(`Unknown provider: ${provider}`);
  for (const candidate of list) {
    try {
      execFileSync("test", ["-f", candidate]);
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error(`Missing env file for provider ${provider}`);
}

async function sha256File(filePath: string): Promise<string> {
  const raw = await readFile(filePath);
  return createHash("sha256").update(raw).digest("hex");
}

function freePort3000(): void {
  try {
    execFileSync("fuser", ["-k", "3000/tcp"], { stdio: "ignore" });
  } catch {
    // optional
  }
}

async function latestRunId(): Promise<string | null> {
  const runsDir = path.join(REPOSITORY_ROOT, "artifacts", "runs");
  const { readdir } = await import("node:fs/promises");
  const dirs = (await readdir(runsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  return dirs[0] ?? null;
}

async function loadManifest(armDir: string): Promise<ExperimentManifest | null> {
  const manifestPath = path.join(armDir, "manifest.json");
  try {
    await access(manifestPath);
    return JSON.parse(await readFile(manifestPath, "utf8")) as ExperimentManifest;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const { arm, reps, provider, publish } = parseArgs(process.argv);
  assertCleanTree();

  const armDir = path.join(EXPERIMENTS_DIR, arm);
  await mkdir(armDir, { recursive: true });

  const gitCommit = gitValue(["rev-parse", "HEAD"]) ?? "unknown";
  const gitBranch = gitValue(["branch", "--show-current"]);
  const ideaHash = await sha256File(IDEA_FILE);
  const envFile = resolveEnvFile(provider);

  const existing = await loadManifest(armDir);
  if (existing) {
    if (existing.git_commit !== gitCommit) {
      throw new Error(
        `Manifest commit drift: manifest=${existing.git_commit} HEAD=${gitCommit}. Start a new arm name.`,
      );
    }
    if (existing.idea_file_sha256 !== ideaHash) {
      throw new Error("Idea file hash drift vs manifest.");
    }
    if (existing.provider !== provider) {
      throw new Error("Provider drift vs manifest.");
    }
  }

  const manifest: ExperimentManifest = existing ?? {
    schema: "agentcofounder.experiment_manifest.v1",
    arm,
    created_at: new Date().toISOString(),
    git_commit: gitCommit,
    git_branch: gitBranch,
    provider,
    model: null,
    challenge_timeout_ms: process.env.CHALLENGE_TIMEOUT_MS ?? null,
    challenge_thinking: process.env.CHALLENGE_THINKING ?? "off",
    idea_file_sha256: ideaHash,
    reps: [],
  };

  const startRep = manifest.reps.length + 1;
  const endRep = reps;

  for (let rep = startRep; rep <= endRep; rep += 1) {
    freePort3000();
    const label = `${arm}-${rep}`;
    const logPath = path.join(armDir, `${label}.log`);
    console.log(`\n==> ${label} commit=${gitCommit} provider=${provider}`);

    const env = {
      ...process.env,
      CHALLENGE_THINKING: process.env.CHALLENGE_THINKING ?? "off",
      RUN_APPROACH: label,
      RUN_EXPERIMENT: arm.startsWith("rtl-") ? (arm.startsWith("rtl-cleanup") ? "exp1-rtl-cleanup" : "exp1-rtl-control") : arm,
      RUN_LINE: arm.startsWith("rtl-") ? "F" : process.env.RUN_LINE,
      RUN_INDEX: String(rep),
    };

    // shellcheck source pattern: source env then npm run challenge
    const shell = `
      set -euo pipefail
      source "${envFile}"
      cd "${REPOSITORY_ROOT}"
      npm run challenge
    `;
    const challenge = spawnSync("bash", ["-lc", shell], {
      env,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    await writeFile(logPath, `${challenge.stdout}\n${challenge.stderr}`, "utf8");

    manifest.model = process.env.CHALLENGE_MODEL ?? manifest.model;
    manifest.challenge_timeout_ms = process.env.CHALLENGE_TIMEOUT_MS ?? manifest.challenge_timeout_ms;
    manifest.challenge_thinking = env.CHALLENGE_THINKING ?? manifest.challenge_thinking;

    const runId = await latestRunId();
    let exportPath: string | null = null;
    if (runId) {
      execFileSync("bash", [`${REPOSITORY_ROOT}/scripts/save-app.sh`, label, runId], {
        cwd: REPOSITORY_ROOT,
        stdio: "inherit",
      });
      execFileSync("npm", ["run", "export:run", "--", runId, "--approach", label], {
        cwd: REPOSITORY_ROOT,
        stdio: "inherit",
      });
      exportPath = path.join(REPOSITORY_ROOT, "artifacts", "exports", `${runId}.json`);
    }

    manifest.reps.push({
      rep,
      run_id: runId ?? "unknown",
      challenge_exit_code: challenge.status ?? 1,
      export_path: exportPath,
    });

    await writeFile(path.join(armDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`Saved rep ${rep} run_id=${runId} exit=${challenge.status}`);
  }

  console.log(`\nExperiment arm '${arm}' complete. Manifest: ${path.join(armDir, "manifest.json")}`);

  if (publish) {
    console.log("\n==> Publishing exports to runs DB (HACKATHON_PUBLISH / --publish)");
    execFileSync("bash", [`${REPOSITORY_ROOT}/scripts/publish-experiment-runs.sh`, arm, "--seed"], {
      cwd: REPOSITORY_ROOT,
      stdio: "inherit",
      env: process.env,
    });
  } else {
    console.log("\nTip: run ./scripts/publish-experiment-runs.sh", arm, "--seed  (or pass --publish on experiment:run)");
  }
}

await main();
