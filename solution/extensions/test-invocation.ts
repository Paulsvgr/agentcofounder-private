/** True when bash is actually invoking the test runner, not merely mentioning a vitest path. */
export function isBashTestInvocation(command: string): boolean {
  if (/\bnpm\s+(?:run\s+)?test\b/i.test(command)) return true;
  if (/\bnpx\s+vitest\b/i.test(command)) return true;
  return /(?:^|[;&\n]|&&|\|\|)\s*(?:sudo\s+)?(?:\.\/)?(?:node_modules\/\.bin\/)?vitest\b/i.test(command);
}
