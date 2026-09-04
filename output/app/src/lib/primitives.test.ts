import { describe, expect, it } from "vitest";
import { createId, normalizeKey } from "./id.js";
import { createStorage } from "./storage.js";
import { createRepository, isEntityShape, type Entity } from "./repository.js";
import { countBy, searchRecords, sortRecords, sumBy, uniqueValues } from "./collection.js";
import { createStateMachine } from "./state-machine.js";
import { daysUntil, formatDate, isOverdue, toIsoDate } from "./dates.js";
import { hasErrors, minLength, numberRange, required, unique, validateFields } from "./validation.js";

interface Item extends Entity {
  name: string;
  state: "open" | "done";
}

function parseItem(value: unknown): Item | undefined {
  if (!isEntityShape(value)) return undefined;
  const record = value as unknown as Record<string, unknown>;
  if (typeof record.name !== "string" || record.name === "") return undefined;
  if (record.state !== "open" && record.state !== "done") return undefined;
  return {
    id: record.id as string,
    created_at: typeof record.created_at === "string" ? record.created_at : new Date().toISOString(),
    updated_at: typeof record.updated_at === "string" ? record.updated_at : new Date().toISOString(),
    name: record.name,
    state: record.state,
  };
}

describe("identifiers", () => {
  it("creates unique identifiers and stable duplicate keys", () => {
    expect(createId()).not.toEqual(createId());
    expect(normalizeKey("  Two   Words ")).toBe("two words");
  });
});

describe("validation", () => {
  it("reports the first failing rule per field", () => {
    const errors = validateFields(
      { name: "", amount: "500", label: "Copy" },
      {
        name: [required()],
        amount: [numberRange(1, 100)],
        label: [minLength(2), unique(["copy"])],
      },
    );
    expect(errors.name).toBe("This field is required");
    expect(errors.amount).toBe("Enter a value between 1 and 100");
    expect(errors.label).toBe("This already exists");
    expect(hasErrors(errors)).toBe(true);
  });

  it("passes valid input", () => {
    expect(hasErrors(validateFields({ name: "Ok" }, { name: [required(), minLength(2)] }))).toBe(false);
  });
});

describe("storage", () => {
  it("round-trips records", () => {
    const storage = createStorage<Item>("items", { parseRecord: parseItem });
    expect(storage.load().status).toBe("empty");
    storage.save([{ id: "1", created_at: "", updated_at: "", name: "A", state: "open" }]);
    expect(storage.load().records).toHaveLength(1);
  });

  it("recovers from unreadable data instead of throwing", () => {
    window.localStorage.setItem("items", "{{{");
    const outcome = createStorage<Item>("items", { parseRecord: parseItem }).load();
    expect(outcome.status).toBe("recovered");
    expect(outcome.records).toEqual([]);
  });

  it("drops damaged entries and keeps valid ones", () => {
    window.localStorage.setItem(
      "items",
      JSON.stringify({ version: 1, records: [{ id: "1", name: "A", state: "open" }, { nope: true }] }),
    );
    const outcome = createStorage<Item>("items", { parseRecord: parseItem }).load();
    expect(outcome.records).toHaveLength(1);
    expect(outcome.status).toBe("recovered");
  });

  it("migrates legacy documents", () => {
    window.localStorage.setItem("items", JSON.stringify([{ id: "1", name: "A", state: "open" }]));
    const outcome = createStorage<Item>("items", {
      version: 2,
      parseRecord: parseItem,
      migrate: (records) => records,
    }).load();
    expect(outcome.records).toHaveLength(1);
  });
});

describe("repository", () => {
  it("owns identifiers, timestamps and persistence", () => {
    const repository = createRepository<Item>("items", {
      parseRecord: parseItem,
      compare: (a, b) => a.name.localeCompare(b.name),
    });
    const first = repository.create([], { name: "B", state: "open" });
    const second = repository.create(first.records, { name: "A", state: "open" });
    expect(second.records.map((item) => item.name)).toEqual(["A", "B"]);

    const updated = repository.update(second.records, first.record.id, { state: "done" });
    expect(updated.find((item) => item.id === first.record.id)?.state).toBe("done");

    repository.save(updated);
    expect(repository.load().records).toHaveLength(2);
    expect(repository.remove(updated, first.record.id)).toHaveLength(1);
  });
});

describe("collections", () => {
  const rows = [
    { id: "1", name: "Alpha", state: "open", cost: 10 },
    { id: "2", name: "Beta", state: "done", cost: 5 },
  ];

  it("searches, sorts, counts and summarizes", () => {
    expect(searchRecords(rows, "bet", [(row) => row.name])).toHaveLength(1);
    expect(sortRecords(rows, (row) => row.cost, "desc")[0]?.id).toBe("1");
    expect(countBy(rows, (row) => row.state === "open")).toBe(1);
    expect(sumBy(rows, (row) => row.cost)).toBe(15);
    expect(uniqueValues(rows, (row) => row.state)).toEqual(["done", "open"]);
  });
});

describe("state machine", () => {
  const machine = createStateMachine({
    initial: "open",
    transitions: { open: ["done"], done: [] } as const,
  });

  it("allows declared transitions only", () => {
    expect(machine.can("open", "done")).toBe(true);
    expect(machine.apply("done", "open").ok).toBe(false);
    expect(machine.isFinal("done")).toBe(true);
  });
});

describe("dates", () => {
  it("formats and compares dates safely", () => {
    expect(toIsoDate("2026-01-02T10:00:00.000Z")).toBe("2026-01-02");
    expect(formatDate("nonsense")).toBe("—");
    expect(daysUntil("2026-01-03", new Date("2026-01-01T00:00:00.000Z"))).toBe(2);
    expect(isOverdue("2025-12-31", new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
  });
});
