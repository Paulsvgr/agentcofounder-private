/** Trim and collapse internal whitespace. */
export function normalizeText(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Prefer crypto.randomUUID; fall back to a timestamp+random id. */
export function createId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
