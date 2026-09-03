// Unit tests for the sync error-message mapping (src/lib/sync-errors). The
// table's raw strings are the BFF error contract + engine/browser fetch
// failures — each entry pins a raw string to its paraglide message. Copy is
// asserted via the paraglide getters, so rewording a message doesn't break the
// tests (only unmapping it would).

import { describe, expect, test } from "@rstest/core"
import { m } from "@/paraglide/messages"
import { syncErrorMessage } from "@/lib/sync-errors"

describe("syncErrorMessage", () => {
  test("maps the engine's 'not signed in' throw", () => {
    expect(syncErrorMessage("not signed in")).toBe(m.syncErrorNotSignedIn())
  })

  test("maps both session-expired contract strings to one message", () => {
    expect(syncErrorMessage("authentication required")).toBe(
      m.syncErrorSession()
    )
    expect(syncErrorMessage("invalid or expired token")).toBe(
      m.syncErrorSession()
    )
  })

  test("maps PB's failed-auth message", () => {
    expect(syncErrorMessage("Failed to authenticate.")).toBe(
      m.syncErrorInvalidCredentials()
    )
  })

  test("maps the BFF validation-failure message", () => {
    expect(syncErrorMessage("validation failed")).toBe(m.syncErrorValidation())
  })

  test("maps PB's record-create failure message", () => {
    expect(syncErrorMessage("Failed to create record.")).toBe(
      m.syncErrorCreateAccount()
    )
  })

  test("groups the server-unavailable contract strings together", () => {
    expect(
      syncErrorMessage("PocketBase is temporarily unavailable, please retry")
    ).toBe(m.syncErrorUnavailable())
    expect(syncErrorMessage("upstream timeout")).toBe(
      m.syncErrorUnavailable()
    )
  })

  test("maps the browser fetch TypeError", () => {
    expect(syncErrorMessage("Failed to fetch")).toBe(m.syncErrorNetwork())
  })

  test("falls back to the generic message for unknown errors", () => {
    expect(syncErrorMessage("ClientResponseError 500: kapot")).toBe(
      m.syncErrorGeneric()
    )
    expect(syncErrorMessage("internal server error")).toBe(
      m.syncErrorGeneric()
    )
  })

  test("falls back to the generic message for an empty string", () => {
    expect(syncErrorMessage("")).toBe(m.syncErrorGeneric())
    expect(syncErrorMessage("   ")).toBe(m.syncErrorGeneric())
  })

  test("matching is trimmed and case-insensitive", () => {
    expect(syncErrorMessage("  FAILED TO FETCH  ")).toBe(m.syncErrorNetwork())
  })
})
