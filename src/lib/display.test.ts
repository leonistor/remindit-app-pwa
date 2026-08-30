// Unit tests for the shared display helpers (src/lib/display).

import { describe, expect, test } from "@rstest/core"
import { avatarInitials, initials } from "@/lib/display"

describe("avatarInitials", () => {
  test("uses the first and last name initials", () => {
    expect(
      avatarInitials({ firstName: "Ada", lastName: "Lovelace", username: "ada" })
    ).toBe("AL")
  })

  test("falls back to the username when there is no full name", () => {
    expect(
      avatarInitials({ firstName: "", lastName: "", username: "leo" })
    ).toBe("LE")
  })

  test("falls back to '?' when there is no name or username", () => {
    expect(
      avatarInitials({ firstName: "", lastName: "", username: "" })
    ).toBe("?")
  })
})

describe("initials", () => {
  test("takes the first and last tokens when there are multiple", () => {
    expect(initials("Ada Lovelace")).toBe("AL")
  })

  test("takes the first two characters when there is a single token", () => {
    expect(initials("leonistor")).toBe("LE")
  })

  test("returns the empty fallback by default for empty input", () => {
    expect(initials("")).toBe("")
  })

  test("honors a custom fallback for empty input", () => {
    expect(initials("  ", "?")).toBe("?")
  })
})
