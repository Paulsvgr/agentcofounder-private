export function blockedDevServerReason(command: string): string | undefined {
  const normalized = command.replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();

  if (/\bnohup\b/.test(lower)) {
    return "Background servers are blocked. The challenge runner verifies startup on port 3000 after Pi exits.";
  }

  if (/\bnpm\s+run\s+dev\b/.test(lower)) {
    return "Do not run npm run dev. The challenge runner starts the app and probes http://localhost:3000 after Pi exits.";
  }

  if (/\bnpm\s+run\s+preview\b/.test(lower)) {
    return "Do not run npm run preview. The challenge runner verifies startup after Pi exits.";
  }

  if (/\bvite\s+preview\b/.test(lower)) {
    return "Do not run vite preview. The challenge runner verifies startup after Pi exits.";
  }

  if (/(?:^|[;&|]\s*)vite(?:\s|$)/.test(lower) && !/\bgrep\b/.test(lower) && !/\bcat\b/.test(lower)) {
    return "Do not run vite directly. The challenge runner verifies startup after Pi exits.";
  }

  if (/\b(npm\s+run\s+dev|vite)\b.*&\s*$/.test(lower)) {
    return "Do not start background dev servers. The challenge runner verifies startup after Pi exits.";
  }

  if (/>\s*\S+\.log\b/.test(lower) && /\b(npm\s+run\s+dev|vite)\b/.test(lower)) {
    return "Do not start dev servers in the background. The challenge runner verifies startup after Pi exits.";
  }

  if (/\bpkill\b.*\b(vite|3000)\b/.test(lower) || /\bpkill\s+-f\s+vite\b/.test(lower)) {
    return "Do not kill dev-server processes. The challenge runner verifies startup on port 3000 after Pi exits.";
  }

  if (/\bpgrep\b.*\b(vite|3000)\b/.test(lower) || /\bpgrep\s+-f\s+vite\b/.test(lower)) {
    return "Process inspection for dev servers is blocked. The challenge runner verifies startup on port 3000 after Pi exits.";
  }

  if (/\blsof\b.*:3000\b/.test(lower)) {
    return "Port inspection is blocked. The challenge runner verifies startup on port 3000 after Pi exits.";
  }

  return undefined;
}

export function testTimeoutSec(): number {
  const raw = process.env.TEST_TIMEOUT_SEC ?? "60";
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 5) return 60;
  return Math.floor(value);
}

export function isTestExecutionCommand(command: string): boolean {
  const lower = command.replace(/\s+/g, " ").trim().toLowerCase();
  if (/\bnpm\s+test\b/.test(lower)) return true;
  if (/\bnpm\s+run\s+test\b/.test(lower)) return true;
  if (/\bvitest\s+run\b/.test(lower)) return true;
  if (/\bnpx\s+vitest\s+run\b/.test(lower)) return true;
  if (/\.bin\/vitest\s+run\b/.test(lower)) return true;
  return false;
}

export function stripTestCommandPipes(command: string): string {
  let trimmed = command.trim();
  const pipeIndex = trimmed.search(/\s+\|\s+/);
  if (pipeIndex >= 0) {
    trimmed = trimmed.slice(0, pipeIndex).trim();
  }
  return trimmed.replace(/\s+2>&1\s*$/, "").trim();
}

export function wrapTestCommand(command: string, wrapperPath: string): string {
  const inner = stripTestCommandPipes(command);
  const escaped = inner.replace(/'/g, "'\\''");
  return `'${wrapperPath}' '${escaped}'`;
}

export function detectTestTimedOut(output: string): boolean {
  return /TEST RUN TIMED OUT/i.test(output);
}

export function shouldInvalidateVerificationOnPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (normalized === "report.partial.json") return false;
  return true;
}

export function isFullTestSuiteCommand(command: string): boolean {
  const lower = command.replace(/\s+/g, " ").trim().toLowerCase();
  if (/-t\b|--testnamepattern\b/.test(lower)) return false;
  return /\bnpm\s+test\b/.test(lower) || /\bnpm\s+run\s+test\b/.test(lower);
}

export function extractToolText(result: unknown): string {
  if (typeof result === "string") return result;
  if (typeof result !== "object" || result === null) return "";

  const record = result as Record<string, unknown>;
  if (typeof record.output === "string") return record.output;

  const content = record.content;
  if (!Array.isArray(content)) return "";

  return content
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) return "";
      const text = (entry as Record<string, unknown>).text;
      return typeof text === "string" ? text : "";
    })
    .join("\n");
}

export function detectTestsPassed(command: string, output: string): boolean {
  if (detectTestTimedOut(output)) return false;
  if (!isFullTestSuiteCommand(command)) return false;
  if (/Tests\s+\d+\s+failed/i.test(output) || /Test Files\s+\d+\s+failed/i.test(output)) {
    return false;
  }

  const testsLine = output.match(/Tests\s+(\d+)\s+passed\s+\((\d+)\)/i);
  const filesLine = output.match(/Test Files\s+(\d+)\s+passed\s+\((\d+)\)/i);
  if (!testsLine || !filesLine) return false;

  const passed = Number(testsLine[1]);
  const total = Number(testsLine[2]);
  const filesPassed = Number(filesLine[1]);
  const filesTotal = Number(filesLine[2]);

  return passed > 0 && passed === total && filesPassed === filesTotal;
}

export function detectBuildPassed(command: string, output: string): boolean {
  if (!/\bnpm\s+run\s+build\b/i.test(command)) return false;
  if (/error TS\d+:/i.test(output)) return false;
  if (/✓ built in|built in \d+/i.test(output)) return true;

  return (
    /\btsc\b/i.test(output) &&
    /\bvite build\b/i.test(output) &&
    !/npm ERR!/i.test(output) &&
    !/failed/i.test(output)
  );
}

export function buildFinalizeSteerMessage(): string {
  return [
    "Verification complete: npm test and npm run build both passed.",
    "Finalize immediately:",
    '1. Write report.partial.json with status "success", accurate tests_run for every journey you tested, and final summary/assumptions.',
    "2. Do not run npm run dev, vite, or any background server. The outer runner verifies startup.",
    "3. Do not add features, edit unrelated files, or run more tests. Stop after report.partial.json is written.",
  ].join("\n");
}

export function buildTimeBudgetSteerMessage(remainingMinutes: number): string {
  return [
    `Time budget warning: roughly ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"} remain before termination.`,
    "If npm test and npm run build are already green, update report.partial.json and stop.",
    "Otherwise fix blockers only — no new features, no dev servers, no process inspection.",
  ].join("\n");
}

export function challengeTimeoutMs(): number {
  const raw = process.env.CHALLENGE_TIMEOUT_MS ?? "900000";
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1_000) return 900_000;
  return value;
}

export function remainingMinutes(elapsedMs: number, timeoutMs: number): number {
  return Math.max(1, Math.round((timeoutMs - elapsedMs) / 60_000));
}

export function shouldWarnTimeBudget(elapsedMs: number, timeoutMs: number): boolean {
  return elapsedMs >= timeoutMs * 0.75;
}
