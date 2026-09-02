// A small launcher for the harness: type an idea, watch it build, open the app.
//
// Nothing here affects judging — the harness is still driven by `./wrun.sh` and
// this only calls it. It exists so the thing can be demonstrated to someone
// without a terminal.
//
// Usage: node studio/server.mjs   →   http://localhost:5180
import { spawn } from "node:child_process";
import { createReadStream, existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STUDIO_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(STUDIO_DIR, "..");
const PORT = Number(process.env.STUDIO_PORT ?? 5180);
const APP_PORT = 3000;
const GIT_BASH = "C:\\Program Files\\Git\\bin\\bash.exe";

/** The single in-flight build, if any. Two at once would corrupt each other. */
let building = null;
/** The vite process serving the most recent app, if any. */
let serving = null;

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function newestRun() {
  const runs = path.join(REPO_ROOT, "runs");
  if (!existsSync(runs)) return null;
  const stamps = readdirSync(runs).sort();
  for (let i = stamps.length - 1; i >= 0; i -= 1) {
    const dir = path.join(runs, stamps[i]);
    if (existsSync(path.join(dir, "output", "app", "src", "App.tsx"))) return dir;
  }
  return null;
}

function readResult(runDir) {
  try {
    return JSON.parse(readFileSync(path.join(runDir, "result.json"), "utf8"));
  } catch {
    return null;
  }
}

/** Turn a raw harness line into something worth showing a person. */
function describe(line) {
  const tool = line.match(/\[pi\] completed tool:\s*(\w+)/);
  if (tool) {
    const verbs = {
      write: "Writing a file",
      edit: "Fixing something",
      read: "Reading a file",
      bash: "Running a command",
      search: "Searching the project",
    };
    return { kind: "step", text: verbs[tool[1]] ?? `Using ${tool[1]}` };
  }
  const call = line.match(/model call completed: input=(\d+) output=(\d+)/);
  if (call) return { kind: "tick", input: Number(call[1]), output: Number(call[2]) };
  if (/Idea needs:/.test(line)) return { kind: "plan", text: line.trim() };
  if (/Prepared clean application workspace/.test(line)) return { kind: "step", text: "Preparing the workspace" };
  if (/vitest|Test Files|Tests /.test(line)) return { kind: "step", text: "Running the tests it wrote" };
  if (/vite build|built in/.test(line)) return { kind: "step", text: "Building for production" };
  if (/Result written/.test(line)) return { kind: "step", text: "Writing the report" };
  return null;
}

function startBuild(idea, res) {
  const ideaFile = path.join(REPO_ROOT, "studio-idea.txt");
  writeFileSync(ideaFile, idea.trim() + "\n", "utf8");

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  const emit = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  emit({ kind: "step", text: "Starting" });

  const child = spawn(GIT_BASH, ["wrun.sh", "--idea-file", "studio-idea.txt"], {
    cwd: REPO_ROOT,
    env: { ...process.env, SKIP_SYNC: "0" },
  });
  building = child;

  let buffer = "";
  const onChunk = (chunk) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/u);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const event = describe(line);
      if (event) emit(event);
    }
  };
  child.stdout.on("data", onChunk);
  child.stderr.on("data", onChunk);

  child.on("close", () => {
    building = null;
    const runDir = newestRun();
    const result = runDir ? readResult(runDir) : null;
    if (!result) {
      emit({ kind: "failed", text: "The run did not produce a result." });
      return res.end();
    }
    emit({
      kind: "done",
      status: result.status,
      summary: result.summary,
      features: result.implemented_features ?? [],
      assumptions: result.assumptions ?? [],
      journeys: (result.tests_run ?? []).map((t) => t.journey),
      calls: result.model_calls,
      weighted: Math.round(result.input_tokens + result.output_tokens * 3),
      cost: Number(result.cost_total ?? 0),
      checks: (result.harness_checks ?? []).every((c) => c.result === "passed"),
    });
    res.end();
  });

  res.on("close", () => {
    if (building === child) child.kill();
  });
}

/** Install the newest generated app into demo/ and serve it on port 3000. */
function serveApp(res) {
  const runDir = newestRun();
  if (!runDir) return send(res, 404, { error: "No generated app yet." });

  const demo = path.join(REPO_ROOT, "demo");
  try {
    if (serving) {
      serving.kill();
      serving = null;
    }
    rmSync(demo, { recursive: true, force: true });
    mkdirSync(demo, { recursive: true });
    cpSync(path.join(runDir, "output", "app"), demo, { recursive: true });
    for (const file of ["vite.config.ts", "vitest.config.ts", "tsconfig.json", ".npmrc", "package-lock.json"]) {
      const from = path.join(REPO_ROOT, "app-template", file);
      if (existsSync(from)) cpSync(from, path.join(demo, file));
    }
  } catch (error) {
    return send(res, 500, { error: `Could not stage the app: ${String(error)}` });
  }

  const npm = "C:\\Users\\moham\\tools\\node22\\npm.cmd";
  const install = spawn(npm, ["ci", "--ignore-scripts", "--prefer-offline"], { cwd: demo, shell: false });
  install.on("close", () => {
    serving = spawn(npm, ["run", "dev"], { cwd: demo, shell: false });
  });
  send(res, 200, { url: `http://localhost:${APP_PORT}` });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/") {
    return createReadStream(path.join(STUDIO_DIR, "index.html")).pipe(
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }),
    );
  }

  if (req.method === "GET" && url.pathname === "/build") {
    if (building) return send(res, 409, { error: "A build is already running." });
    const idea = url.searchParams.get("idea") ?? "";
    if (idea.trim().length < 10) return send(res, 400, { error: "Describe the app in a sentence or two." });
    return startBuild(idea, res);
  }

  if (req.method === "POST" && url.pathname === "/serve") return serveApp(res);

  send(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Studio on http://localhost:${PORT}`);
});
