// Augments Rstest's `expect` with @testing-library/jest-dom matchers.
// The runtime matchers are registered in tests/rstest.setup.ts; this file
// only teaches TypeScript about them (mirrors the package's vitest.d.ts).
import "@rstest/core"
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers"

declare module "@rstest/core" {
  interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}
}
