// Unit tests for the random avatar batch used by the Profile picker
// (src/lib/profile-generator → generateAvatarOptions).

import { describe, expect, test } from "@rstest/core"
import { generateAvatarOptions } from "@/lib/profile-generator"

describe("generateAvatarOptions", () => {
  test("returns twelve options by default", async () => {
    expect(await generateAvatarOptions()).toHaveLength(12)
  })

  test("honors a custom count", async () => {
    expect(await generateAvatarOptions(5)).toHaveLength(5)
  })

  test("renders each option as an inline SVG data URI with a seed", async () => {
    for (const option of await generateAvatarOptions(3)) {
      expect(option.seed).toBeTruthy()
      expect(option.dataUri).toMatch(/^data:image\/svg\+xml/)
    }
  })

  test("produces distinct seeds and images within a batch", async () => {
    const options = await generateAvatarOptions()
    expect(new Set(options.map((o) => o.seed)).size).toBe(options.length)
    expect(new Set(options.map((o) => o.dataUri)).size).toBe(options.length)
  })

  test("draws a different batch on the next call", async () => {
    const [first, second] = await Promise.all([
      generateAvatarOptions(),
      generateAvatarOptions(),
    ])
    expect(first.map((o) => o.seed)).not.toEqual(second.map((o) => o.seed))
  })
})
