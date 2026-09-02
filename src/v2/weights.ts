/** Hackathon efficiency formula — matches agentcofounder.stockholm.ai spec. */
export const EFFICIENCY_WEIGHTS = {
  input: 1,
  output: 3,
  cacheRead: 0.1,
  cacheWrite: 0,
} as const;

export function weightedCost(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}): number {
  return (
    usage.input_tokens * EFFICIENCY_WEIGHTS.input +
    usage.output_tokens * EFFICIENCY_WEIGHTS.output +
    usage.cache_read_tokens * EFFICIENCY_WEIGHTS.cacheRead +
    usage.cache_write_tokens * EFFICIENCY_WEIGHTS.cacheWrite
  );
}
