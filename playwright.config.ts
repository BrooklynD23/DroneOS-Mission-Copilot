import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "pnpm build && pnpm start",
        url: "http://localhost:3000",
        timeout: 600_000,
        reuseExistingServer: !process.env.CI,
        env: {
          ANTHROPIC_API_KEY: "",
          DEMO_ACCESS_CODE: "",
        },
      },
});
