/** Approximate token estimate (~4 chars/token) for context budgeting. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateJsonTokens(value: unknown): number {
  try {
    return estimateTokens(JSON.stringify(value));
  } catch {
    return 0;
  }
}

export interface ContextBudgetConfig {
  /** Soft target fraction of context window before compaction (default 0.8). */
  compactAtFraction: number;
  /** Context window in tokens (from CHALLENGE_CONTEXT_WINDOW or default). */
  contextWindowTokens: number;
}

export function contextBudgetFromEnvironment(): ContextBudgetConfig {
  const windowRaw = process.env.CHALLENGE_CONTEXT_WINDOW;
  const window = windowRaw && Number.isFinite(Number(windowRaw)) ? Number(windowRaw) : 128_000;
  const fracRaw = process.env.CONTEXT_COMPACT_AT_FRACTION;
  const frac = fracRaw && Number.isFinite(Number(fracRaw)) ? Number(fracRaw) : 0.8;
  return {
    contextWindowTokens: Math.max(8_000, Math.floor(window)),
    compactAtFraction: Math.min(0.95, Math.max(0.5, frac)),
  };
}

export function compactionThresholdTokens(config: ContextBudgetConfig = contextBudgetFromEnvironment()): number {
  return Math.floor(config.contextWindowTokens * config.compactAtFraction);
}
