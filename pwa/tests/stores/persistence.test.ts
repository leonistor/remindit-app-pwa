// Pins the persisted-storage key map (src/stores/persistence.ts).
//
// The Playwright e2e helpers hardcode "remindit:onboarded" — a key rename here
// must break loudly in a unit test, not silently in a browser run.

import { describe, expect, test } from "@rstest/core"
import { STORAGE_KEYS } from "@/stores/persistence"

describe("STORAGE_KEYS", () => {
  test("onboarded stays hardcoded-compatible with the e2e helpers", () => {
    expect(STORAGE_KEYS.onboarded).toBe("remindit:onboarded")
  })

  test("every key shares the remindit: prefix", () => {
    const keys = Object.values(STORAGE_KEYS)
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      expect(key.startsWith("remindit:")).toBe(true)
    }
  })
})
