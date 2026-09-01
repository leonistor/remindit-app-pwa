import { expect, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import App from "../src/App"
import { setOnboarded } from "../src/stores"

test("renders the main page", () => {
  // A returning (onboarded) user lands on the main shopping view with the
  // profile avatar (replacing the old wordmark) in the top menu.
  setOnboarded(true)
  render(<App />)
  expect(screen.getByLabelText("Your profile")).toBeInTheDocument()
})
