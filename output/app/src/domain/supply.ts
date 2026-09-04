import type { Entity } from "../lib/repository.js";
import {
  isNumber,
  maxLength,
  numberRange,
  oneOf,
  required,
  validateFields,
  type FieldErrors,
  type FieldRule,
} from "../lib/validation.js";

export const SUPPLY_TYPES = ["glaze", "clay", "tools"] as const;
export type SupplyType = (typeof SUPPLY_TYPES)[number];

export const SUPPLY_TYPE_LABELS: Record<SupplyType, string> = {
  glaze: "Glaze",
  clay: "Clay",
  tools: "Tools",
};

/** "A couple left" — anything at or below this count is flagged as running low. */
export const LOW_STOCK_THRESHOLD = 2;

export interface Supply extends Entity {
  name: string;
  supplier: string;
  type: SupplyType;
  quantity: number;
}

export interface SupplyInput {
  name: string;
  supplier: string;
  type: SupplyType;
  quantity: number;
}

const isSupplyType = (value: unknown): value is SupplyType =>
  typeof value === "string" && (SUPPLY_TYPES as readonly string[]).includes(value);

/** Accepts only well-formed records so damaged saved data is dropped, not crashed on. */
export function parseSupplyRecord(value: unknown): Supply | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string" || entry.id === "") return undefined;
  if (typeof entry.created_at !== "string" || typeof entry.updated_at !== "string") return undefined;
  if (typeof entry.name !== "string" || entry.name.trim() === "") return undefined;
  if (typeof entry.supplier !== "string") return undefined;
  if (!isSupplyType(entry.type)) return undefined;
  if (typeof entry.quantity !== "number" || !Number.isInteger(entry.quantity) || entry.quantity < 0) {
    return undefined;
  }
  return {
    id: entry.id,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    name: entry.name.trim(),
    supplier: entry.supplier.trim(),
    type: entry.type,
    quantity: entry.quantity,
  };
}

export function isLowStock(supply: Pick<Supply, "quantity">): boolean {
  return supply.quantity <= LOW_STOCK_THRESHOLD;
}

/** Low-stock items, most urgent first. */
export function lowStockSupplies(records: readonly Supply[]): Supply[] {
  return records
    .filter(isLowStock)
    .sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name));
}

export function countByType(records: readonly Supply[]): Record<SupplyType, number> {
  const counts: Record<SupplyType, number> = { glaze: 0, clay: 0, tools: 0 };
  for (const record of records) counts[record.type] += 1;
  return counts;
}

export type SupplyFormValues = {
  name: string;
  supplier: string;
  type: string;
  quantity: string;
};

const wholeQuantity: FieldRule<string> = (value) =>
  /^\d+$/.test(value.trim()) ? undefined : "Quantity must be a whole number of 0 or more";

export const supplyFormRules = {
  name: [required("Give this supply a name"), maxLength(80, "Keep the name under 80 characters")],
  supplier: [required("Add the supplier"), maxLength(80, "Keep the supplier under 80 characters")],
  type: [oneOf([...SUPPLY_TYPES], "Choose a type")],
  quantity: [
    required("Enter how many you have left"),
    isNumber(),
    wholeQuantity,
    numberRange(0, 100000, "Quantity must be between 0 and 100,000"),
  ],
};

export function validateSupplyForm(values: SupplyFormValues): FieldErrors<SupplyFormValues> {
  return validateFields(values, supplyFormRules);
}

export function toSupplyInput(values: SupplyFormValues): SupplyInput {
  return {
    name: values.name.trim(),
    supplier: values.supplier.trim(),
    type: values.type as SupplyType,
    quantity: Number(values.quantity.trim()),
  };
}
