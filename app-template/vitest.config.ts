import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const hasExplicitReporter = process.argv.some(
  (arg) => arg === "--reporter" || arg.startsWith("--reporter="),
);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    passWithNoTests: false,
    setupFiles: ["./src/test/setup.ts"],
    ...(hasExplicitReporter ? {} : { reporters: ["./compactFailureReporter.ts"] }),
  },
});
