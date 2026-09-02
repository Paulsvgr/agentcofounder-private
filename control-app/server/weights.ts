const WEIGHTS = { input: 1, output: 3, cacheRead: 0.1, cacheWrite: 0 } as const;

export function weightedCost(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}): number {
  return (
    usage.input_tokens * WEIGHTS.input +
    usage.output_tokens * WEIGHTS.output +
    usage.cache_read_tokens * WEIGHTS.cacheRead +
    usage.cache_write_tokens * WEIGHTS.cacheWrite
  );
}
