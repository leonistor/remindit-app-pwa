// Component test for the avatar picker (src/components/avatar-picker):
// the trigger opens a dialog with a fresh 12-avatar grid, picking an option
// persists the dataUri through `updateUser` and closes the dialog, and the
// reroll button swaps in a different batch.
//
// Like onboarding.test.tsx, the lazy DiceBear dynamic imports are NOT mocked —
// the real chunk resolves quickly under Rspack, so tests simply await the
// rendered batch via waitFor.

import { afterEach, describe, expect, test } from "@rstest/core"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AvatarPicker } from "@/components/avatar-picker"
import { m } from "@/paraglide/messages"
import { $user } from "@/stores"
import { resetStores } from "../../tests/fixtures/reset"

// Open the dialog and wait for the generated grid — the async DiceBear chunk
// must land before any option interaction.
async function openPicker() {
  const user = userEvent.setup()
  await user.click(
    screen.getByRole("button", { name: m.profileAvatarEditLabel() })
  )
  await screen.findByRole("dialog")
  await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(12))
  return user
}

/** The avatar data URI rendered inside a listbox option. */
function optionSrc(option: HTMLElement): string | null {
  return option.querySelector("img")?.getAttribute("src") ?? null
}

afterEach(() => {
  cleanup()
  resetStores()
})

// Non-empty placeholder so the trigger <img> never renders src="" (happy-dom
// logs a console error for empty sources).
const PLACEHOLDER_AVATAR = "data:image/svg+xml,%3Csvg/%3E"

describe("AvatarPicker", () => {
  test("opens a dialog with a fresh grid of 12 SVG avatars", async () => {
    render(<AvatarPicker avatar={PLACEHOLDER_AVATAR} />)
    await openPicker()

    for (const option of screen.getAllByRole("option")) {
      expect(optionSrc(option)).toMatch(/^data:image\/svg\+xml/)
    }
  })

  test("picking an option persists it via updateUser and closes the dialog", async () => {
    render(<AvatarPicker avatar={PLACEHOLDER_AVATAR} />)
    const user = await openPicker()

    await user.click(screen.getAllByRole("option")[0])

    expect($user.get().avatar).toMatch(/^data:image\/svg\+xml/)
    // The dialog unmounts after Zag's exit-presence raf tick.
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  test("reroll swaps the grid for a different batch", async () => {
    render(<AvatarPicker avatar={PLACEHOLDER_AVATAR} />)
    const user = await openPicker()
    const before = new Set(
      screen.getAllByRole("option").map((option) => optionSrc(option))
    )

    await user.click(
      screen.getByRole("button", { name: m.profileAvatarReroll() })
    )

    // The grid first blanks into the loading spinner, then the fresh batch
    // lands — wait until 12 new, distinct sources are on screen.
    await waitFor(() => {
      const after = screen.getAllByRole("option")
      expect(after).toHaveLength(12)
      expect(new Set(after.map((option) => optionSrc(option))).size).toBe(12)
      expect(new Set(after.map((option) => optionSrc(option)))).not.toEqual(
        before
      )
    })
  })
})
