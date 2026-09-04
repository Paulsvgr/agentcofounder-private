import { parseSupplyRecord, type Supply } from "../domain/supply.js";
import { createRepository } from "./repository.js";

export const SUPPLY_STORAGE_KEY = "pottery-studio-supplies";

export const supplyRepository = createRepository<Supply>(SUPPLY_STORAGE_KEY, {
  version: 1,
  parseRecord: parseSupplyRecord,
  compare: (a, b) => a.name.localeCompare(b.name) || a.supplier.localeCompare(b.supplier),
});
