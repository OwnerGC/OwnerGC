import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // The security tests share one local database, so run files one at a time.
    fileParallelism: false,
  },
});
