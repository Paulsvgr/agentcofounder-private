import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Remove rendered components between tests so DOM never accumulates.
afterEach(() => {
  cleanup();
});
