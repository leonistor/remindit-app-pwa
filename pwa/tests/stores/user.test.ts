import { beforeEach, describe, expect, test } from "@rstest/core"
import { $user, randomUser, updateUser } from "@/stores/user"
import { resetStores } from "../fixtures/reset"

describe("user store", () => {
  beforeEach(resetStores)

  test("updateUser merges a patch without dropping other fields", () => {
    $user.set({
      username: "A",
      firstName: "",
      lastName: "",
      email: "",
      avatar: "p",
    })
    updateUser({ firstName: "B" })

    expect($user.get().firstName).toBe("B")
    expect($user.get().avatar).toBe("p")
  })

  test("randomUser returns a profile with a local SVG avatar", () => {
    const user = randomUser()

    expect(typeof user.username).toBe("string")
    expect(user.username.length).toBeGreaterThan(0)
    expect(typeof user.avatar).toBe("string")
    expect(user.avatar.startsWith("data:image/svg+xml")).toBe(true)
  })
})
