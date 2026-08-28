import { expect, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import App from "../src/App"
import { setOnboarded } from "../src/stores"

test("renders the main page", () => {
  // A returning (onboarded) user lands on the main shopping view.
  setOnboarded(true)
  const testMessage = "RemindIt"
  render(<App />)
  expect(screen.getByText(testMessage)).toBeInTheDocument()
})
