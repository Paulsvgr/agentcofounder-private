/**
 * Tests for the primitives shipped in app-template/src/lib.
 *
 * These live in the root suite deliberately. Shipping them inside
 * app-template/src would copy them into every generated app, where the
 * runner's Vitest report would then present storage unit tests as product
 * journeys. The generated app must contain only the model's own journey tests.
 */
import { describe, expect, it, vi } from "vitest";
import {
  createCollection,
  readItems,
  resolveStorage,
  type StorageFailure,
} from "../app-template/src/lib/storage.js";
import { createId } from "../app-template/src/lib/id.js";

interface Item {
  id: string;
  label: string;
}

function reviveRecord(value: unknown): Item | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as { id?: unknown; label?: unknown };
  if (typeof candidate.id !== "string" || typeof candidate.label !== "string") return undefined;
  return { id: candidate.id, label: candidate.label };
}

/** Minimal in-memory Storage, optionally rejecting writes like an exhausted quota. */
function memoryStorage(seed: Record<string, string> = {}, rejectWrites = false): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => {
      if (rejectWrites) throw new Error("QuotaExceededError");
      map.set(key, value);
    },
  } as Storage;
}

describe("readItems", () => {
  it("returns an empty collection when nothing is stored yet", () => {
    expect(readItems("k", memoryStorage(), reviveRecord)).toEqual([]);
  });

  it("round-trips stored records", () => {
    const storage = memoryStorage({ k: JSON.stringify([{ id: "1", label: "one" }]) });
    expect(readItems("k", storage, reviveRecord)).toEqual([{ id: "1", label: "one" }]);
  });

  it("keeps the readable records when one entry is malformed", () => {
    const failures: StorageFailure[] = [];
    const storage = memoryStorage({
      k: JSON.stringify([{ id: "1", label: "one" }, { id: 7 }, null, { id: "2", label: "two" }]),
    });

    const items = readItems("k", storage, reviveRecord, (failure) => failures.push(failure));

    expect(items).toEqual([{ id: "1", label: "one" }, { id: "2", label: "two" }]);
    expect(failures).toEqual(["partial"]);
  });

  it("reports unparseable and non-list values as corrupt instead of throwing", () => {
    const failures: StorageFailure[] = [];
    expect(readItems("k", memoryStorage({ k: "{not json" }), reviveRecord, (f) => failures.push(f))).toEqual([]);
    expect(readItems("k", memoryStorage({ k: '{"a":1}' }), reviveRecord, (f) => failures.push(f))).toEqual([]);
    expect(failures).toEqual(["corrupt", "corrupt"]);
  });

  it("reports unavailable storage rather than failing", () => {
    const failures: StorageFailure[] = [];
    expect(readItems("k", null, reviveRecord, (failure) => failures.push(failure))).toEqual([]);
    expect(failures).toEqual(["unavailable"]);
  });
});

describe("createCollection", () => {
  it("persists replacements and notifies subscribers", () => {
    const storage = memoryStorage();
    const collection = createCollection<Item>("k", { revive: reviveRecord, storage });
    const listener = vi.fn();
    collection.subscribe(listener);

    collection.replace([{ id: "1", label: "one" }]);

    expect(collection.list()).toEqual([{ id: "1", label: "one" }]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.getItem("k") ?? "null")).toEqual([{ id: "1", label: "one" }]);
  });

  it("keeps the session usable when a write is rejected", () => {
    const failures: StorageFailure[] = [];
    const collection = createCollection<Item>("k", {
      revive: reviveRecord,
      storage: memoryStorage({}, true),
      onFailure: (failure) => failures.push(failure),
    });

    collection.replace([{ id: "1", label: "one" }]);

    // The write failed, but the in-memory collection must not roll back.
    expect(collection.list()).toEqual([{ id: "1", label: "one" }]);
    expect(failures).toEqual(["write-failed"]);
  });

  it("stops notifying after unsubscribe", () => {
    const collection = createCollection<Item>("k", { revive: reviveRecord, storage: memoryStorage() });
    const listener = vi.fn();
    collection.subscribe(listener)();

    collection.replace([{ id: "1", label: "one" }]);

    expect(listener).not.toHaveBeenCalled();
  });

  it("loads existing records on creation", () => {
    const storage = memoryStorage({ k: JSON.stringify([{ id: "9", label: "nine" }]) });
    expect(createCollection<Item>("k", { revive: reviveRecord, storage }).list()).toEqual([
      { id: "9", label: "nine" },
    ]);
  });
});

describe("resolveStorage", () => {
  it("honours an explicitly supplied store, including null", () => {
    const storage = memoryStorage();
    expect(resolveStorage(storage)).toBe(storage);
    expect(resolveStorage(null)).toBeNull();
  });
});

describe("createId", () => {
  it("produces unique identifiers", () => {
    const ids = new Set(Array.from({ length: 500 }, () => createId()));
    expect(ids.size).toBe(500);
  });
});
