import { defineConfig } from "vitest/config";

process.loadEnvFile(".env.test");

export default defineConfig({
  test: {
    fileParallelism: false,
    setupFiles: ["./tests/setup.ts"],
  },
});
