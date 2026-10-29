import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@tauri-apps/api/core": resolve(__dirname, "tests/mock-tauri.ts") },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
