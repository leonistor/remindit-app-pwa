import { defineConfig } from "@rstest/core"
import base from "./rstest.config"

// Fast unit layer: pure helpers (src/lib) plus the store/command/selector layer
// (tests/stores). This is the "did I break the data model / core logic" smoke
// gate for the dev loop — see docs/DEV.md §Testing for the full progressive
// suite (quick / all / pre-release).
export default defineConfig({
  ...base,
  include: ["src/lib/**/*.test.ts", "tests/stores/**/*.test.ts"],
})
