import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const smokeRoot = path.dirname(fileURLToPath(import.meta.url));
const templateDir =
  process.env.SMOKE_TEMPLATE_DIR ?? path.resolve(smokeRoot, "../../app-template");

export default defineConfig({
  root: smokeRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateDir, "src"),
    },
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["**/*.test.tsx"],
    setupFiles: [path.join(templateDir, "src/test/setup.ts")],
    passWithNoTests: false,
  },
});
