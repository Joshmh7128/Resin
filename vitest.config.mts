import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolves the "@/..." aliases declared in tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // These tests talk to the local Postgres from docker-compose, so they must
    // not run in parallel against the same rows.
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
  },
});
