import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONTROL_APP_ROOT = path.resolve(SERVER_DIR, "..");

function run(command: string, args: string[], label: string): ReturnType<typeof spawn> {
  const child = spawn(command, args, {
    cwd: CONTROL_APP_ROOT,
    stdio: "inherit",
    shell: false,
  });
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${label} exited with code ${code}`);
      process.exit(code);
    }
  });
  return child;
}

const server = run("node", ["--import", "tsx", "server/index.ts"], "server");

// Spawning "npx" with shell:false cannot work on Windows: npx is a .cmd shim,
// which Node refuses to launch that way. Run Vite's own entry point through
// node instead — identical behaviour, and it works on every platform.
const VITE_ENTRY = path.join(CONTROL_APP_ROOT, "node_modules", "vite", "bin", "vite.js");
const web = run("node", [VITE_ENTRY, "--config", "web/vite.config.ts"], "web");

function shutdown(): void {
  server.kill("SIGTERM");
  web.kill("SIGTERM");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("V2 Control App dev: API http://localhost:4319  UI http://localhost:5174");
