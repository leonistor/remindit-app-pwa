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
})
