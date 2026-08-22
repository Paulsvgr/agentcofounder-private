export type MultipleElementFailureClass = "rtl_dom_leak" | "query_ambiguity" | "unknown";

export interface MultipleElementFailureInstance {
  call_index: number | null;
  classification: MultipleElementFailureClass;
  excerpt: string;
}

/** True when Vitest/RTL output reports ambiguous multi-match queries. */
export function outputContainsMultipleElementsError(text: string): boolean {
  return /Found multiple elements/i.test(text);
}

/**
 * Distinguish leaked prior renders (cleanup missing) from genuine query ambiguity
 * inside a single render tree. Heuristic only — excerpts are retained for manual review.
 */
export function classifyMultipleElementFailure(output: string): MultipleElementFailureClass {
  if (!outputContainsMultipleElementsError(output)) return "unknown";

  const bodyMatch = output.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const scope = bodyMatch?.[1] ?? output;

  const mainCount = (scope.match(/<main\b/gi) ?? []).length;
  const shellCount = (scope.match(/class=["']shell["']/gi) ?? []).length;
  const h1Count = (scope.match(/<h1\b/gi) ?? []).length;

  if (mainCount >= 2 || shellCount >= 2 || h1Count >= 2) {
    return "rtl_dom_leak";
  }

  if (mainCount === 1 || shellCount === 1) {
    return "query_ambiguity";
  }

  return "unknown";
}

export function excerptMultipleElementError(output: string, maxLength = 480): string {
  const lines = output.split("\n");
  const start = lines.findIndex((line) => /Found multiple elements/i.test(line));
  if (start < 0) {
    const compact = output.replace(/\s+/g, " ").trim();
    return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1)}…`;
  }
  const slice = lines.slice(Math.max(0, start - 1), start + 8).join("\n");
  return slice.length <= maxLength ? slice : `${slice.slice(0, maxLength - 1)}…`;
}

export function summarizeMultipleElementFailures(
  instances: MultipleElementFailureInstance[],
): {
  multiple_element_failures_total: number;
  rtl_dom_leak_failures: number;
  query_ambiguity_failures: number;
  multiple_element_failure_excerpts: MultipleElementFailureInstance[];
} {
  let rtl = 0;
  let ambiguity = 0;
  for (const instance of instances) {
    if (instance.classification === "rtl_dom_leak") rtl += 1;
    if (instance.classification === "query_ambiguity") ambiguity += 1;
  }
  return {
    multiple_element_failures_total: instances.length,
    rtl_dom_leak_failures: rtl,
    query_ambiguity_failures: ambiguity,
    multiple_element_failure_excerpts: instances,
  };
}
