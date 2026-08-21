import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Default auto-cleanup isn't enabled in this combined vitest/jest-dom setup,
// so unmount the React tree between tests to prevent DOM leaking across tests.
afterEach(() => {
  cleanup();
});
