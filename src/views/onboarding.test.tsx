// Component test for the Onboarding view (src/views/onboarding.tsx):
// the step-1 language picker, the step-2 welcome video, initial + dice-rolled
// profile generation, the Next-button validation rule (username must be
// non-empty — NOT first name), the step-4 dataset radios, the Steps indicator
// rail states, and Finish wiring `completeOnboarding` (flag flip + seeded
// catalog).

import { afterEach, beforeEach, describe, expect, test } from "@rstest/core"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { DATASETS, getDataset } from "seed"
import { m } from "@/paraglide/messages"
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

// getTyping-library types getByLabelText as HTMLElement; cast so `.value` is
// available (the username/first-name fields are always <input> elements).
const usernameInput = () =>
  screen.getByLabelText(m.onboardingUsernameLabel()) as HTMLInputElement

// The initial profile is generated asynchronously (lazy DiceBear chunk) and
// the dice button stays `disabled` while a roll is in flight — wait for both
// so subsequent clicks/typing never race the generation.
async function awaitProfileReady() {
  // Direct value check — jest-dom v7's toHaveValue rejects RegExp matchers.
  await waitFor(() => expect(usernameInput().value).not.toBe(""))
  const dice = screen.getByRole("button", {
    name: m.onboardingRollProfileLabel(),
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
  test("starts on the language step: locale radios, Next reveals the welcome video, then profile", async () => {
    renderOnboarding()

    // Step 1 is the language picker: bilingual prompt + one secondary button
    // per registered locale, English resolved as the default (no stored
    // choice in a fresh env) and marked with aria-pressed.
    expect(screen.getByText(m.chooseYourLanguageEn())).toBeInTheDocument()
    expect(screen.getByText(m.chooseYourLanguageRo())).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "Română" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )

    // Next reveals the welcome video step — happy-dom doesn't decode/play
    // videos, so assert element + attributes only.
    await userEvent.click(screen.getByRole("button", { name: m.next() }))
    const video = document.querySelector('video[src*="00-welcome-light"]')
    expect(video).not.toBeNull()
    expect(video?.hasAttribute("controls")).toBe(false)

    // The welcome step is the only step without the dice button; Next is the
    // only visible footer action and it advances to the profile step.
    await userEvent.click(screen.getByRole("button", { name: m.next() }))
    expect(
      screen.getByLabelText(m.onboardingFirstNameLabel())
    ).toBeInTheDocument()
  })

  test("generates a suggested profile and rerolls username + avatar on dice click", async () => {
    renderOnboarding()
    await userEvent.click(screen.getByRole("button", { name: m.next() }))
    await userEvent.click(screen.getByRole("button", { name: m.next() }))
    const dice = await awaitProfileReady()
    const avatar = screen.getByAltText(m.onboardingAvatarAlt())
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
    await userEvent.click(screen.getByRole("button", { name: m.next() }))
    await userEvent.click(screen.getByRole("button", { name: m.next() }))
    await awaitProfileReady()
    const next = screen.getByRole("button", { name: m.next() })
    expect(next).toBeEnabled()

    // The actual validation rule is `!profile.username.trim()` — clearing the
    // username disables Next even with first/last name filled.
    await userEvent.clear(usernameInput())
    expect(next).toBeDisabled()
    await userEvent.type(
      screen.getByLabelText(m.onboardingFirstNameLabel()),
      "Jane"
    )
    expect(next).toBeDisabled()

    await userEvent.type(usernameInput(), "x")
    expect(next).toBeEnabled()
  })

  test("Next reveals the dataset step with one radio per dataset, Minimal pre-selected", async () => {
    const { container } = renderOnboarding()
    // Language → welcome: rail shows language complete, welcome current (the
    // old "Step X of N" header text is gone). State attrs live on the
    // Ark indicator elements, not on the item wrappers.
    await userEvent.click(screen.getByRole("button", { name: m.next() }))
    const indicator = (n: string) =>
      Array.from(
        container.querySelectorAll('[data-slot="steps-indicator"]')
      ).find((el) => el.textContent === n)
    expect(indicator("2")).toHaveAttribute("data-current")
    expect(indicator("1")).toHaveAttribute("data-complete")

    await userEvent.click(screen.getByRole("button", { name: m.next() }))
    await awaitProfileReady()
    await userEvent.click(screen.getByRole("button", { name: m.next() }))

    expect(screen.getAllByRole("radio")).toHaveLength(DATASETS.length)
    // The starter dataset is the default selection.
    expect(
      screen.getByRole("radio", { name: "Minimal (starter)" })
    ).toBeChecked()
    // Profile → dataset: rail shows profile complete, dataset current.
    expect(indicator("4")).toHaveAttribute("data-current")
    expect(indicator("3")).toHaveAttribute("data-complete")
  })

  test("Finish completes onboarding: flag persisted, profile + catalog seeded", async () => {
    renderOnboarding()
    await userEvent.click(screen.getByRole("button", { name: m.next() }))
    await userEvent.click(screen.getByRole("button", { name: m.next() }))
    await awaitProfileReady()
    const username = usernameInput().value
    await userEvent.click(screen.getByRole("button", { name: m.next() }))
    await userEvent.click(screen.getByRole("button", { name: m.finish() }))

    expect($onboarded.get()).toBe(true)
    expect(localStorage.getItem(STORAGE_KEYS.onboarded)).toBe("true")
    expect($user.get().username).toBe(username.trim())

    const { catalog } = getDataset("minimal")
    expect($catalog.get()).toEqual(catalog)
    expect($history.get().length).toBeGreaterThan(0)

    // The onboarded gate navigated away from the onboarding step.
    expect(
      screen.queryByRole("button", { name: m.finish() })
    ).not.toBeInTheDocument()
  })
})
