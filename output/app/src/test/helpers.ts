/** Test helpers for persistence and corruption scenarios. Domain-neutral by design. */

export function seedStorage(key: string, records: unknown[], version = 1): void {
  window.localStorage.setItem(key, JSON.stringify({ version, records }));
}

export function corruptStorage(key: string, raw = "{not json"): void {
  window.localStorage.setItem(key, raw);
}

export function readStorage<Record_>(key: string): { version: number; records: Record_[] } | undefined {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as { version: number; records: Record_[] };
  } catch {
    return undefined;
  }
}
