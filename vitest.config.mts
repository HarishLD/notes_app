import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Vite's loadEnv merges .env then .env.test (later overrides earlier), so
// DATABASE_URL and JWT_SECRET come from the test database branch while any
// other key not redefined in .env.test still falls back to .env. The empty
// prefix means "load every key", not just VITE_-prefixed ones.
const testEnv = loadEnv("test", process.cwd(), "");

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    env: testEnv,
    // Tests truncate shared tables in beforeEach. Running test files in
    // parallel against the same test database would let one file's
    // truncation race another file's inserts.
    fileParallelism: false,
  },
});
