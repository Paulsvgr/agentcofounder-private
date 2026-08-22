import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Ensure the jsdom DOM is reset between tests so query helpers don't see
// stale elements from a previous render.
afterEach(() => {
  cleanup();
});
