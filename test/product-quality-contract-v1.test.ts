import { describe, expect, it } from "vitest";
import {
  applyProductQualityContractV1,
  loadProductQualityContractV1,
  productQualityContractV1EnabledFromEnvironment,
} from "../solution/product-quality-contract-v1.ts";

const BASE = `Build the smallest maintainable application.

Required outcome:

- The application starts with npm run dev.
- Required user data survives a page refresh.
`;

describe("product-quality-contract-v1", () => {
  it("default OFF when unset", () => {
    expect(productQualityContractV1EnabledFromEnvironment({})).toBe(false);
    expect(applyProductQualityContractV1(BASE, {})).toBe(BASE);
  });

  it("inserts contract after Required outcome when enabled", () => {
    const out = applyProductQualityContractV1(BASE, {
      HARNESS_PRODUCT_QUALITY_CONTRACT_V1: "1",
    });
    expect(out).toContain("Product quality contract");
    expect(out).toContain("Usable UI");
    expect(out).toContain("Persistence");
    expect(out).toContain("Robustness");
    expect(out.indexOf("Required outcome:")).toBeLessThan(out.indexOf("Product quality contract"));
    expect(out).not.toMatch(/UX\s*=\s*30|Persistence\s*=\s*20/i);
  });

  it("does not duplicate when already present", () => {
    const once = applyProductQualityContractV1(BASE, {
      HARNESS_PRODUCT_QUALITY_CONTRACT_V1: "1",
    });
    const twice = applyProductQualityContractV1(once, {
      HARNESS_PRODUCT_QUALITY_CONTRACT_V1: "1",
    });
    expect(twice.match(/Product quality contract/g)?.length).toBe(1);
  });

  it("contract file has no point dump", () => {
    const text = loadProductQualityContractV1();
    expect(text.toLowerCase()).not.toContain("30 points");
    expect(text).not.toMatch(/\bUX\s*\/\s*usability\s*30\b/i);
  });
});
