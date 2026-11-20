import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    // The security tests share one local database, so run files one at a time.
    fileParallelism: false,
    projects: [
      {
        // Fast checks of pure code (the cost model). No database needed.
        resolve: { alias },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        // Security tests against a local Supabase (`npx supabase start`).
        resolve: { alias },
        test: {
          name: "security",
          include: ["tests/security/**/*.test.ts"],
          globalSetup: ["tests/security/global-setup.ts"],
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
