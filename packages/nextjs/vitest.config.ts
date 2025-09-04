import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["core/**/*.test.ts", "**/__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "~~": path.resolve(__dirname, "."),
      "~~/*": path.resolve(__dirname, "./*"),
    },
  },
});
