import { describe, test, expect, beforeEach } from "@rstest/core"
import { $user, updateUser, randomUser } from "@/stores/user"
import { resetStores } from "../fixtures/reset"

describe("user store", () => {
  beforeEach(resetStores)

  test("updateUser merges a patch without dropping other fields", () => {
    $user.set({ name: "A", photo: "p" })
    updateUser({ name: "B" })

    expect($user.get().name).toBe("B")
    expect($user.get().photo).toBe("p")
  })

  test("randomUser returns a named user with a pravatar photo", () => {
    const user = randomUser()

    expect(typeof user.name).toBe("string")
    expect(user.name.length).toBeGreaterThan(0)
    expect(typeof user.photo).toBe("string")
    expect(user.photo.startsWith("https://i.pravatar.cc/")).toBe(true)
  })
})
