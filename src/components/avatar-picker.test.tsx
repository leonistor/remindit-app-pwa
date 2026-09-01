// Component test for the avatar picker (src/components/avatar-picker):
// the trigger opens a dialog with a 12-avatar grid, picking an option persists
// the dataUri through `updateUser` and closes the dialog, the reroll button
// swaps in a different batch, and the load-error state turns the reroll into a
// retry.
//
// generateAvatarOptions is mocked at the module boundary: the race/error tests
// below need to control WHEN each batch settles (deferred promises), which the
// real lazy DiceBear chunk can't offer. The mock still returns realistic
// AvatarOption shapes (seed + data:image URI), so rendering/persistence behave
// exactly as in production.

import { afterEach, beforeEach, describe, expect, rs, test } from "@rstest/core"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AvatarPicker } from "@/components/avatar-picker"
import type { AvatarOption } from "@/lib/profile-generator"
import { m } from "@/paraglide/messages"
import { $user } from "@/stores"
import { resetStores } from "../../tests/fixtures/reset"

const generateAvatarOptions = rs.hoisted(() =>
  rs.fn<() => Promise<AvatarOption[]>>()
)

rs.mock("@/lib/profile-generator", () => ({
  generateAvatarOptions,
  // Not used by the picker; present so the mocked module stays shape-complete.
  generateRandomProfile: rs.fn(),
}))

// A synthetic 12-avatar batch whose dataUris are prefixed per batch so tests
// can tell exactly which batch is on screen.
function batch(prefix: string): AvatarOption[] {
  return Array.from({ length: 12 }, (_, i) => ({
    seed: `${prefix}-${i}`,
    dataUri: `data:image/svg+xml,${prefix}-${i}`,
  }))
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

// Manual promise so a test decides the exact settlement order — the core of
// the race tests.
function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"]
  let reject!: Deferred<T>["reject"]
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// The avatar data URI rendered inside each on-screen listbox option — the
// batch prefix inside it identifies which load produced the grid.
const srcsOnScreen = (): (string | null)[] =>
  screen
    .getAllByRole("option")
    .map((option) => option.querySelector("img")?.getAttribute("src") ?? null)

// Non-empty placeholder so the trigger <img> never renders src="" (happy-dom
// logs a console error for empty sources).
const PLACEHOLDER_AVATAR = "data:image/svg+xml,%3Csvg/%3E"

function renderPicker() {
  render(<AvatarPicker avatar={PLACEHOLDER_AVATAR} />)
  return screen.getByRole("button", { name: m.profileAvatarEditLabel() })
}

// Open the dialog and wait for a full 12-option grid — for tests where the
// load succeeds. Error/race tests open the dialog manually instead.
async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole("button", {
    name: m.profileAvatarEditLabel(),
  })
  await user.click(trigger)
  await screen.findByRole("dialog")
  await waitFor(() => expect(srcsOnScreen()).toHaveLength(12))
  return trigger
}

beforeEach(() => {
  generateAvatarOptions.mockReset()
  generateAvatarOptions.mockImplementation(async () => batch("batch-a"))
})

afterEach(() => {
  cleanup()
  resetStores()
})

describe("AvatarPicker", () => {
  test("opens a dialog with a grid of 12 avatar options", async () => {
    renderPicker()
    const user = userEvent.setup()
    await openPicker(user)

    for (const src of srcsOnScreen()) {
      expect(src).toMatch(/^data:image\/svg\+xml/)
    }
  })

  test("picking an option persists its dataUri via updateUser and closes the dialog", async () => {
    renderPicker()
    const user = userEvent.setup()
    await openPicker(user)

    const picked = batch("batch-a")[0]
    await user.click(screen.getAllByRole("option")[0])

    expect($user.get().avatar).toBe(picked.dataUri)
    // The dialog unmounts after Zag's exit-presence raf tick.
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  test("reroll swaps the grid for a different batch", async () => {
    renderPicker()
    const user = userEvent.setup()
    await openPicker(user)
    const before = new Set(srcsOnScreen())

    generateAvatarOptions.mockImplementationOnce(async () => batch("batch-b"))
    await user.click(
      screen.getByRole("button", { name: m.profileAvatarReroll() })
    )

    // The grid first blanks into the loading spinner, then the fresh batch
    // lands — wait until 12 new, distinct sources are on screen.
    await waitFor(() => {
      const after = srcsOnScreen()
      expect(after).toHaveLength(12)
      expect(new Set(after).size).toBe(12)
      expect(new Set(after)).not.toEqual(before)
    })
  })

  test("reroll is disabled while a batch is loading and enabled once it lands", async () => {
    const pending = deferred<AvatarOption[]>()
    generateAvatarOptions.mockImplementation(() => pending.promise)

    renderPicker()
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", { name: m.profileAvatarEditLabel() })
    )
    await screen.findByRole("dialog")

    const reroll = screen.getByRole("button", { name: m.profileAvatarReroll() })
    expect(reroll).toBeDisabled()
    expect(screen.queryAllByRole("option")).toHaveLength(0)

    pending.resolve(batch("batch-a"))
    await waitFor(() => expect(srcsOnScreen()).toHaveLength(12))
    expect(reroll).toBeEnabled()
  })

  test("a failed batch shows a role=alert error and turns the reroll into a retry", async () => {
    generateAvatarOptions.mockImplementationOnce(() =>
      Promise.reject(new Error("boom"))
    )

    renderPicker()
    const user = userEvent.setup()
    // Open without awaiting the grid: this first load is the one that fails.
    await user.click(
      screen.getByRole("button", { name: m.profileAvatarEditLabel() })
    )
    await screen.findByRole("dialog")

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(m.profileAvatarLoadError())
    expect(screen.queryAllByRole("option")).toHaveLength(0)

    // Reroll doubles as the retry action in the error state.
    const reroll = screen.getByRole("button", { name: m.profileAvatarReroll() })
    expect(reroll).toBeEnabled()

    generateAvatarOptions.mockImplementationOnce(async () => batch("batch-b"))
    await user.click(reroll)

    await waitFor(() => expect(srcsOnScreen()).toHaveLength(12))
    expect(srcsOnScreen().every((src) => src?.includes("batch-b"))).toBe(true)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("a stale batch that resolves after the dialog reopened is discarded (resolve race)", async () => {
    // Load #1 (on open) hangs until the test settles it.
    const stale = deferred<AvatarOption[]>()
    generateAvatarOptions.mockImplementationOnce(() => stale.promise)

    renderPicker()
    const user = userEvent.setup()
    const trigger = screen.getByRole("button", {
      name: m.profileAvatarEditLabel(),
    })

    // Open: load #1 pending (token 1). The reroll can't race it (it is
    // disabled while a batch is pending — see the dedicated test), so the
    // close/reopen path is the reachable "supersede an in-flight load"
    // interaction: the cleanup bumps the token and load #2 becomes latest.
    await user.click(trigger)
    await screen.findByRole("dialog")
    // Escape closes the modal (the trigger itself sits behind the backdrop).
    await user.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    const fresh = deferred<AvatarOption[]>()
    generateAvatarOptions.mockImplementationOnce(() => fresh.promise)
    await user.click(trigger) // reopen → load #2 (latest)
    await screen.findByRole("dialog")

    // The stale batch settles FIRST: the token guard must drop it entirely.
    stale.resolve(batch("batch-stale"))
    // Flush the microtask chain so the (guarded) .then had its chance to run.
    await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0))

    // The latest load still wins and no stale option ever leaks in.
    fresh.resolve(batch("batch-b"))
    await waitFor(() => expect(srcsOnScreen()).toHaveLength(12))
    expect(srcsOnScreen().every((src) => src?.includes("batch-b"))).toBe(true)
    expect(srcsOnScreen().some((src) => src?.includes("stale"))).toBe(false)
  })

  test("a failure from a superseded load never surfaces as an error (reject race)", async () => {
    const stale = deferred<AvatarOption[]>()
    generateAvatarOptions.mockImplementationOnce(() => stale.promise)

    renderPicker()
    const user = userEvent.setup()
    const trigger = screen.getByRole("button", {
      name: m.profileAvatarEditLabel(),
    })

    await user.click(trigger) // load #1 (stale, pending)
    await screen.findByRole("dialog")
    await user.keyboard("{Escape}") // close
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    const fresh = deferred<AvatarOption[]>()
    generateAvatarOptions.mockImplementationOnce(() => fresh.promise)
    await user.click(trigger) // reopen → load #2 (latest)
    await screen.findByRole("dialog")

    // The stale load REJECTS: the token guard must keep the error hidden.
    stale.reject(new Error("stale failure"))
    await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()

    // The fresh batch still renders normally.
    fresh.resolve(batch("batch-b"))
    await waitFor(() => expect(srcsOnScreen()).toHaveLength(12))
    expect(srcsOnScreen().every((src) => src?.includes("batch-b"))).toBe(true)
  })
})
