import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Remove rendered DOM between tests so multiple App instances don't accumulate.
afterEach(() => {
  cleanup();
});
