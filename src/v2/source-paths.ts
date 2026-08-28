/**
 * Shared vocabulary for "what is app source" and "what mutates it".
 *
 * Kept separate from the activity classifier: replay depends on these
 * predicates for correctness, and the classifier is scheduled for a rewrite.
 */

export function isTestFilePath(detail: string): boolean {
  return /\.test\.[tj]sx?\b/.test(detail) || /[/\\]test[/\\]setup\.[tj]sx?\b/.test(detail);
}

export function isReportWrite(detail: string): boolean {
  return /report\.partial\.json\b/.test(detail);
}

export function isCssPath(detail: string): boolean {
  return /\.css\b/.test(detail) || /[/\\]styles[/\\]/.test(detail);
}

/** App or test source, excluding stylesheets and harness report writes. */
export function isSourceFilePath(detail: string): boolean {
  if (isReportWrite(detail) || isCssPath(detail)) return false;
  return (
    /\.(tsx?|jsx?)\b/.test(detail) ||
    /[/\\]src[/\\]/.test(detail) ||
    isTestFilePath(detail) ||
    /vitest\.config/.test(detail) ||
    /vite\.config/.test(detail)
  );
}

/**
 * Bash commands that mutate app or test source without the write/edit tools.
 * Replay only reproduces write/edit calls, so any match here means the session
 * log alone is not enough to rebuild the app faithfully.
 */
export function isSourceMutationCommand(detail: string): boolean {
  if (isReportWrite(detail)) return false;
  if (/\bsed\s+-i\b/.test(detail)) return true;
  if (/\bperl\s+-pi/.test(detail)) return true;

  const touchesSource = isSourceFilePath(detail) || isCssPath(detail);
  if (!touchesSource) return false;

  if (/\btee\b/.test(detail)) return true;
  if (/>>?\s*[^\s&|;]+\.(tsx?|jsx?|css)\b/.test(detail)) return true;
  if (/cat\s+<<[\s\S]*>>?\s*[^\s&|;]+\.(tsx?|jsx?)/.test(detail)) return true;
  if (/(?:^|[;&|]\s*)(?:rm|mv|cp)\s/.test(detail)) return true;
  return false;
}
