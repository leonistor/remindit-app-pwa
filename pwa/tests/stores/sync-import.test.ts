// Import-only contract for the sync engine (stores/index.ts promises "no
// side effects"): importing the module must NOT construct a PocketBase client
// or register the global token hook — those happen lazily on first real use.
// Kept in its own file so the module graph is fresh here (rstest runs each
// file in a separate bundle): the engine's module-level `pb` singleton would
// already be constructed if this were imported alongside the engine tests.

import { describe, expect, rs, test } from "@rstest/core"

const pbState = rs.hoisted(() => {
  const constructed = { count: 0 }
  class FakePocketBase {
    constructor() {
      constructed.count += 1
    }
    authStore = { save: () => undefined, clear: () => undefined }
    autoCancellation(): void {}
    filter(): string {
      return ""
    }
    collection(): Record<string, () => Promise<unknown>> {
      return {}
    }
  }
  return { constructed, FakePocketBase }
})

rs.mock("pocketbase", () => ({ default: pbState.FakePocketBase }))

// Imported AFTER the mock is registered so the engine's `import PocketBase`
// resolves to the fake.
import { initSync } from "@/stores/sync/engine"

describe("sync engine import-only contract", () => {
  test("importing the engine constructs no PB client (no side effects)", () => {
    expect(pbState.constructed.count).toBe(0)
  })

  test("initSync with no session constructs no PB client either", () => {
    initSync()
    expect(pbState.constructed.count).toBe(0)
  })
})