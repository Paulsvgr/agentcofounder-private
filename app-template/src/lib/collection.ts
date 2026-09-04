/** Query helpers for in-memory collections: search, filter, sort, group, count. */

export function searchRecords<Record_>(
  records: readonly Record_[],
  query: string,
  fields: readonly ((record: Record_) => string | undefined)[],
): Record_[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...records];
  return records.filter((record) =>
    fields.some((read) => (read(record) ?? "").toLowerCase().includes(needle)),
  );
}

export function filterRecords<Record_>(
  records: readonly Record_[],
  predicates: readonly ((record: Record_) => boolean)[],
): Record_[] {
  return records.filter((record) => predicates.every((predicate) => predicate(record)));
}

export function sortRecords<Record_>(
  records: readonly Record_[],
  read: (record: Record_) => string | number,
  direction: "asc" | "desc" = "asc",
): Record_[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...records].sort((a, b) => {
    const left = read(a);
    const right = read(b);
    if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
    return String(left).localeCompare(String(right)) * factor;
  });
}

export function groupRecords<Record_>(
  records: readonly Record_[],
  read: (record: Record_) => string,
): Map<string, Record_[]> {
  const groups = new Map<string, Record_[]>();
  for (const record of records) {
    const key = read(record);
    const bucket = groups.get(key);
    if (bucket) bucket.push(record);
    else groups.set(key, [record]);
  }
  return groups;
}

export function countBy<Record_>(
  records: readonly Record_[],
  predicate: (record: Record_) => boolean,
): number {
  return records.reduce((total, record) => (predicate(record) ? total + 1 : total), 0);
}

export function sumBy<Record_>(records: readonly Record_[], read: (record: Record_) => number): number {
  return records.reduce((total, record) => {
    const value = read(record);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
}

export function uniqueValues<Record_>(
  records: readonly Record_[],
  read: (record: Record_) => string,
): string[] {
  return [...new Set(records.map(read).filter((value) => value !== ""))].sort((a, b) => a.localeCompare(b));
}
