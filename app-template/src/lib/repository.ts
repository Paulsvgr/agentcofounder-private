/**
 * Repository boundary between domain records and persistence.
 *
 * The UI never touches storage directly: it calls a repository, which owns identifiers,
 * timestamps and persistence. Swapping localStorage for an HTTP client means replacing
 * this file only.
 */
import { createId } from "./id.js";
import { nowIso } from "./dates.js";
import { createStorage, type LoadOutcome, type StorageOptions, type Storage_ } from "./storage.js";

export interface Entity {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Repository<Record_ extends Entity> {
  storage: Storage_<Record_>;
  load: () => LoadOutcome<Record_>;
  list: (records: Record_[]) => Record_[];
  create: (records: Record_[], input: Omit<Record_, keyof Entity>) => { records: Record_[]; record: Record_ };
  update: (records: Record_[], id: string, changes: Partial<Omit<Record_, keyof Entity>>) => Record_[];
  remove: (records: Record_[], id: string) => Record_[];
  replaceAll: (records: Record_[]) => Record_[];
  save: (records: Record_[]) => { saved: boolean; message?: string };
  clear: () => void;
}

export interface RepositoryOptions<Record_ extends Entity> extends StorageOptions<Record_> {
  /** Optional stable ordering applied on every read. */
  compare?: (a: Record_, b: Record_) => number;
}

export function isEntityShape(value: unknown): value is Entity {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && record.id !== "";
}

export function createRepository<Record_ extends Entity>(
  key: string,
  options: RepositoryOptions<Record_>,
): Repository<Record_> {
  const storage = createStorage<Record_>(key, options);
  const order = (records: Record_[]): Record_[] =>
    options.compare ? [...records].sort(options.compare) : records;

  return {
    storage,
    load: () => {
      const outcome = storage.load();
      return { ...outcome, records: order(outcome.records) };
    },
    list: (records) => order(records),
    create: (records, input) => {
      const timestamp = nowIso();
      const record = { ...(input as object), id: createId(), created_at: timestamp, updated_at: timestamp } as Record_;
      return { records: order([...records, record]), record };
    },
    update: (records, id, changes) =>
      order(
        records.map((record) =>
          record.id === id ? ({ ...record, ...changes, updated_at: nowIso() } as Record_) : record,
        ),
      ),
    remove: (records, id) => records.filter((record) => record.id !== id),
    replaceAll: (records) => order(records),
    save: (records) => storage.save(records),
    clear: () => storage.clear(),
  };
}
