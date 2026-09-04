/** Small date helpers. All values are ISO strings so stored data stays portable. */

export function nowIso(): string {
  return new Date().toISOString();
}

export function toIsoDate(value: Date | string = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "" : (date.toISOString().slice(0, 10) as string);
}

export function isValidDate(value: string): boolean {
  return value.trim() !== "" && !Number.isNaN(new Date(value).getTime());
}

export function formatDate(value: string, locale = "en-GB"): string {
  if (!isValidDate(value)) return "—";
  return new Date(value).toLocaleDateString(locale, { year: "numeric", month: "short", day: "2-digit" });
}

/** Whole days from today until the given date. Negative when overdue. */
export function daysUntil(value: string, from: Date = new Date()): number {
  if (!isValidDate(value)) return Number.NaN;
  const target = new Date(value);
  const startOfDay = (date: Date): number =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((startOfDay(target) - startOfDay(from)) / 86_400_000);
}

export function isOverdue(value: string, from: Date = new Date()): boolean {
  const days = daysUntil(value, from);
  return Number.isFinite(days) && days < 0;
}
