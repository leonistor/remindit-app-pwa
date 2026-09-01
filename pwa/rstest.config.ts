import { withRsbuildConfig } from "@rstest/adapter-rsbuild"
import { defineConfig } from "@rstest/core"

// Docs: https://rstest.rs/config/
// The store layer relies on `localStorage` (via @nanostores/persistent), so we
// run every test under happy-dom rather than the default node environment.
// The existing React smoke test also works fine under happy-dom.
export default defineConfig({
  extends: withRsbuildConfig(),
  testEnvironment: "happy-dom",
  setupFiles: ["./tests/rstest.setup.ts"],
  // Keep Playwright e2e specs out of Rstest's discovery — they use
  // @playwright/test's own `test()`, not Rstest's.
  exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**", "**/e2e-prod/**"],
})
