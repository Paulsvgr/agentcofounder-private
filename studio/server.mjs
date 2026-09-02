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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Stop whatever is serving and wait for it to let go of the directory. */
async function stopServing() {
  if (!serving) return;
  const child = serving;
  serving = null;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  // Windows keeps handles open briefly after exit, so give it a moment.
  await Promise.race([exited, wait(4000)]);
  await wait(600);
}

/**
 * Free port 3000 of whatever holds it.
 *
 * A dev server started by an earlier studio process is not ours to kill
 * through a child handle, and vite runs with strictPort, so the port has to be
 * cleared by pid. Failures are ignored: the bind below reports the real problem.
 */
async function freeAppPort() {
  await new Promise((resolve) => {
    const finder = spawn("cmd", ["/c", `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${APP_PORT} ^| findstr LISTENING') do taskkill /f /pid %a`], {
      windowsHide: true,
    });
    finder.on("error", resolve);
    finder.on("close", resolve);
  });
  await wait(800);
}

/**
 * Install the newest generated app and serve it on port 3000.
 *
 * Each app gets its own directory. Deleting a directory a dev server is still
 * holding fails with EBUSY on Windows — and the holder is often a process from
 * an earlier studio run, which cannot be killed through a child handle. Writing
 * somewhere new sidesteps the problem entirely; old directories are tidied on a
 * best-effort basis.
 */
async function serveApp(res) {
  const runDir = newestRun();
  if (!runDir) return send(res, 404, { error: "No generated app yet." });

  const root = path.join(REPO_ROOT, "studio-apps");
  const demo = path.join(root, path.basename(runDir));
  try {
    await stopServing();
    await freeAppPort();
    mkdirSync(root, { recursive: true });

    if (!existsSync(path.join(demo, "package.json"))) {
      mkdirSync(demo, { recursive: true });
      cpSync(path.join(runDir, "output", "app"), demo, { recursive: true });
      for (const file of ["vite.config.ts", "vitest.config.ts", "tsconfig.json", ".npmrc", "package-lock.json"]) {
        const from = path.join(REPO_ROOT, "app-template", file);
        if (existsSync(from)) cpSync(from, path.join(demo, file));
      }
    }

    // Keep the three most recent; ignore any still held by a live server.
    const staged = readdirSync(root).sort().slice(0, -3);
    for (const old of staged) {
      try {
        rmSync(path.join(root, old), { recursive: true, force: true });
      } catch {
        // Held by something still running. It will be cleaned next time.
      }
    }
  } catch (error) {
    return send(res, 500, { error: `Could not stage the app: ${String(error)}` });
  }

  // npm is a .cmd shim on Windows and Node refuses to spawn those with
  // shell:false — an unhandled 'error' event took this whole server down the
  // first time. Run npm's own JS entry point through node instead, and keep
  // any spawn failure from killing the process.
  const npmCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  const runNpm = (args) => {
    const child = spawn(process.execPath, [npmCli, ...args], { cwd: demo, shell: false });
    child.on("error", (error) => console.error(`npm ${args[0]} failed: ${String(error)}`));
    return child;
  };

  const install = runNpm(["ci", "--ignore-scripts", "--prefer-offline"]);
  install.on("close", () => {
    serving = runNpm(["run", "dev"]);
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

  if (req.method === "POST" && url.pathname === "/serve") {
    return serveApp(res).catch((error) => send(res, 500, { error: String(error) }));
  }

  send(res, 404, { error: "Not found" });
});

// A crash here strands the page mid-build with nothing but "failed to fetch",
// so log and carry on rather than exiting.
process.on("uncaughtException", (error) => console.error("studio error:", error));
process.on("unhandledRejection", (error) => console.error("studio rejection:", error));

server.listen(PORT, () => {
  console.log(`Studio on http://localhost:${PORT}`);
});
