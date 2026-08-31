// Component test for the Onboarding view (src/views/onboarding.tsx):
// initial + dice-rolled profile generation, the Next-button validation rule
// (username must be non-empty — NOT first name), the step-2 dataset radios,
// and Finish wiring `completeOnboarding` (flag flip + seeded catalog).

import { afterEach, beforeEach, describe, expect, test } from "@rstest/core"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { DATASETS, getDataset } from "seed"
import { $onboarded, setOnboarded } from "@/stores"
import { $catalog } from "@/stores/catalog"
import { $history } from "@/stores/history"
import { STORAGE_KEYS } from "@/stores/persistence"
import { $user } from "@/stores/user"
import OnboardingView from "@/views/onboarding"
import { resetStores } from "../../tests/fixtures/reset"

// The view navigates via react-router (Next-gate redirect + Finish → home).
// Mirror the app's route table with MemoryRouter so <Navigate> has a "/" route
// to land on instead of re-rendering into itself.
function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingView />} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>
  )
}

const usernameInput = () => screen.getByLabelText(/Username/i)

// The initial profile is generated asynchronously (lazy DiceBear chunk) and
// the dice button stays `disabled` while a roll is in flight — wait for both
// so subsequent clicks/typing never race the generation.
async function awaitProfileReady() {
  // Direct value check — jest-dom v7's toHaveValue rejects RegExp matchers.
  await waitFor(() => expect(usernameInput().value).not.toBe(""))
  const dice = screen.getByRole("button", {
    name: "Roll a new random name and avatar",
  })
  await waitFor(() => expect(dice).toBeEnabled())
  return dice
}

beforeEach(() => {
  // resetStores clears the data stores + localStorage; the onboarding flag is
  // its own persistent atom, so flip it explicitly to a first-run slate.
  resetStores()
  setOnboarded(false)
})

afterEach(() => {
  cleanup()
  resetStores()
})

describe("OnboardingView", () => {
  test("generates a suggested profile and rerolls username + avatar on dice click", async () => {
    renderOnboarding()
    const dice = await awaitProfileReady()
    const avatar = screen.getByAltText("Avatar preview")
    // Attribute matchers reject RegExp here — assert via toMatch instead.
    expect(avatar.getAttribute("src")).toMatch(/^data:image\/svg\+/)

    const before = usernameInput().value
    // generate-random-username draws random word pairs — a repeat is possible,
    // so reroll until the handle changes (bounds the loop against bad luck).
    let changed = false
    for (let i = 0; i < 6 && !changed; i++) {
      await userEvent.click(dice)
      await awaitProfileReady()
      changed = usernameInput().value !== before
    }
    expect(changed).toBe(true)
    expect(usernameInput().value).toBeTruthy()
  })

  test("Next stays disabled until the username is non-empty", async () => {
    renderOnboarding()
    await awaitProfileReady()
    const next = screen.getByRole("button", { name: "Next" })
    expect(next).toBeEnabled()

    // The actual validation rule is `!profile.username.trim()` — clearing the
    // username disables Next even with first/last name filled.
    await userEvent.clear(usernameInput())
    expect(next).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/First name/i), "Jane")
    expect(next).toBeDisabled()

    await userEvent.type(usernameInput(), "x")
    expect(next).toBeEnabled()
  })

  test("Next reveals step 2 with one radio per dataset, Minimal pre-selected", async () => {
    renderOnboarding()
    await awaitProfileReady()
    await userEvent.click(screen.getByRole("button", { name: "Next" }))

    expect(screen.getByText(/Step 2 of 2/)).toBeInTheDocument()
    expect(screen.getAllByRole("radio")).toHaveLength(DATASETS.length)
    // The starter dataset is the default selection.
    expect(
      screen.getByRole("radio", { name: "Minimal (starter)" })
    ).toBeChecked()
  })

  test("Finish completes onboarding: flag persisted, profile + catalog seeded", async () => {
    renderOnboarding()
    await awaitProfileReady()
    const username = usernameInput().value
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    await userEvent.click(screen.getByRole("button", { name: "Finish" }))

    expect($onboarded.get()).toBe(true)
    expect(localStorage.getItem(STORAGE_KEYS.onboarded)).toBe("true")
    expect($user.get().username).toBe(username.trim())

    const { catalog } = getDataset("minimal")
    expect($catalog.get()).toEqual(catalog)
    expect($history.get().length).toBeGreaterThan(0)

    // The onboarded gate navigated away from the onboarding step.
    expect(
      screen.queryByRole("button", { name: "Finish" })
    ).not.toBeInTheDocument()
  })
})
