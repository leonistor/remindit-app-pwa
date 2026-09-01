import { defineConfig, devices } from "@playwright/test"

// Runs the PRODUCTION precache specs (e2e-prod/offline.spec.ts) against a local
// `rsbuild preview` so the service worker's precache/offline fallback is tested
// on a real bundle (not the dev server). Requires a prior `bun run build` — the
// `test:e2e:prod` npm script handles that. See docs/DEV.md §Testing.
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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bunx rsbuild preview --port 5181 --host 127.0.0.1",
    url: "http://127.0.0.1:5181",
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
