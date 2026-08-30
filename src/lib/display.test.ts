// Unit tests for the shared display helpers (src/lib/display).

import { describe, expect, it } from "@rstest/core"
import { avatarInitials, initials } from "@/lib/display"

describe("avatarInitials", () => {
  it("uses the first and last name initials", () => {
    expect(
      avatarInitials({ firstName: "Ada", lastName: "Lovelace", username: "ada" })
    ).toBe("AL")
  })

  it("falls back to the username when there is no full name", () => {
    expect(
      avatarInitials({ firstName: "", lastName: "", username: "leo" })
    ).toBe("LE")
  })

  it("falls back to '?' when there is no name or username", () => {
    expect(
      avatarInitials({ firstName: "", lastName: "", username: "" })
    ).toBe("?")
  })
})

describe("initials", () => {
  it("takes the first and last tokens when there are multiple", () => {
    expect(initials("Ada Lovelace")).toBe("AL")
  })

  it("takes the first two characters when there is a single token", () => {
    expect(initials("leonistor")).toBe("LE")
  })

  it("returns the empty fallback by default for empty input", () => {
    expect(initials("")).toBe("")
  })

  it("honors a custom fallback for empty input", () => {
    expect(initials("  ", "?")).toBe("?")
  })
})
