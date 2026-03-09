import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: { label: "Base Task", color: "blue" },
    include: ["__tests__/**/*.test.ts"],
  },
});
