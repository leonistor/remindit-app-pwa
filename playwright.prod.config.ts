import { defineConfig, devices } from "@playwright/test"

// Validates real offline behavior against the production build, where the
// service worker actually precaches the app shell (dev mode does not).
export default defineConfig({
  testDir: "./e2e-prod",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5181",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bunx rsbuild preview --port 5181 --host 127.0.0.1",
    url: "http://127.0.0.1:5181",
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
