/**
 * Versioned, corruption-tolerant browser storage.
 *
 * Every document is stored as { version, records }. Unreadable, non-JSON, wrong-shaped,
 * or partially invalid data never throws: the loader reports what it recovered so the UI
 * can tell the user, and the app keeps working with the records that survived.
 */

export interface StoredDocument<Record_> {
  version: number;
  records: Record_[];
}

export type StorageStatus = "ok" | "empty" | "recovered" | "unavailable";

export interface LoadOutcome<Record_> {
  records: Record_[];
  status: StorageStatus;
  /** Human readable reason, present when status is "recovered" or "unavailable". */
  message?: string;
}

export interface StorageOptions<Record_> {
  version?: number;
  /** Returns the record when it is usable, otherwise undefined so it is dropped. */
  parseRecord: (value: unknown) => Record_ | undefined;
  /** Upgrades a document written by an older version of the app. */
  migrate?: (records: unknown[], fromVersion: number) => unknown[];
}

export interface Storage_<Record_> {
  key: string;
  version: number;
  load: () => LoadOutcome<Record_>;
  save: (records: Record_[]) => { saved: boolean; message?: string };
  clear: () => void;
}

function backend(): globalThis.Storage | undefined {
  try {
    const candidate = globalThis.localStorage;
    if (!candidate) return undefined;
    const probe = "__storage_probe__";
    candidate.setItem(probe, "1");
    candidate.removeItem(probe);
    return candidate;
  } catch {
    return undefined;
  }
}

export function safeJsonParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false };
  }
}

export function createStorage<Record_>(key: string, options: StorageOptions<Record_>): Storage_<Record_> {
  const version = options.version ?? 1;

  function load(): LoadOutcome<Record_> {
    const store = backend();
    if (!store) {
      return { records: [], status: "unavailable", message: "Browser storage is unavailable; changes will not be saved." };
    }

    let raw: string | null = null;
    try {
      raw = store.getItem(key);
    } catch {
      return { records: [], status: "unavailable", message: "Saved data could not be read." };
    }
    if (raw === null || raw.trim() === "") return { records: [], status: "empty" };

    const parsed = safeJsonParse(raw);
    if (!parsed.ok) {
      return { records: [], status: "recovered", message: "Saved data was unreadable and has been reset." };
    }

    const document_ = parsed.value as Partial<StoredDocument<unknown>> | unknown[];
    const isArray = Array.isArray(document_);
    const storedVersion = isArray ? 0 : Number((document_ as StoredDocument<unknown>).version ?? 0);
    const rawRecords: unknown = isArray ? document_ : (document_ as StoredDocument<unknown>).records;
    if (!Array.isArray(rawRecords)) {
      return { records: [], status: "recovered", message: "Saved data had an unexpected shape and has been reset." };
    }

    const upgraded =
      storedVersion !== version && options.migrate ? options.migrate(rawRecords, storedVersion) : rawRecords;
    const records: Record_[] = [];
    let dropped = 0;
    for (const entry of Array.isArray(upgraded) ? upgraded : []) {
      const record = options.parseRecord(entry);
      if (record === undefined) dropped += 1;
      else records.push(record);
    }

    if (dropped > 0) {
      return {
        records,
        status: "recovered",
        message: `${dropped} damaged ${dropped === 1 ? "entry was" : "entries were"} skipped while loading saved data.`,
      };
    }
    if (storedVersion !== version) {
      return { records, status: "recovered", message: "Saved data was upgraded to the current format." };
    }
    return { records, status: records.length === 0 ? "empty" : "ok" };
  }

  function save(records: Record_[]): { saved: boolean; message?: string } {
    const store = backend();
    if (!store) return { saved: false, message: "Browser storage is unavailable; changes will not be saved." };
    try {
      const document_: StoredDocument<Record_> = { version, records };
      store.setItem(key, JSON.stringify(document_));
      return { saved: true };
    } catch {
      return { saved: false, message: "Changes could not be saved; storage is full or blocked." };
    }
  }

  function clear(): void {
    try {
      backend()?.removeItem(key);
    } catch {
      // Clearing is best effort; the in-memory state stays authoritative.
    }
  }

  return { key, version, load, save, clear };
}
