// Component test for the Profile import flow (src/views/profile.tsx):
// an invalid pick shows an inline error that a later valid pick clears (m6),
// a valid backup runs confirm → busy (dialog locked + button guarded) →
// restore → success ack → auto-redirect home, a newer-major backup warns
// before confirming, and dismissing the ack dialog early cancels the
// redirect timer (m2).
//
// Harness mirrors onboarding.test.tsx (MemoryRouter + home route); picks are
// injected as change events on the sr-only file input. The confirm flow's
// timers (50ms defer + 1500ms ack) are driven with fake timers so the
// redirect/cancellation assertions are deterministic instead of wall-clock.

import { afterEach, describe, expect, rs, test } from "@rstest/core"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { formatExportedAt } from "@/lib/local-data"
import { m } from "@/paraglide/messages"
import { $catalog } from "@/stores/catalog"
import { $onboarded } from "@/stores/onboarding"
import ProfileView from "@/views/profile"
import {
  backupEnvelope,
  backupFile,
  futureMajorVersion,
} from "../../tests/fixtures/backup"
import { resetStores } from "../../tests/fixtures/reset"

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<ProfileView />} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>
  )
}

// The import card's hidden file input (sr-only + aria-hidden — not reachable
// via accessible queries by design).
function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  expect(input).not.toBeNull()
  return input
}

// Push a picked file through the hidden input. The change handler parses
// asynchronously, so the event cycle is wrapped in act (plus a clock flush
// under fake timers) to keep the post-await updates inside act's scope.
async function pickFile(file: File, advance: number | null = null) {
  await act(async () => {
    fireEvent.change(fileInput(), { target: { files: [file] } })
    if (advance !== null) await rs.advanceTimersByTimeAsync(advance)
  })
}

afterEach(() => {
  rs.useRealTimers()
  cleanup()
  resetStores()
})

describe("ProfileView import flow", () => {
  test("an invalid file shows an inline alert and a later valid pick clears it", async () => {
    renderProfile()

    const garbage = new File(["{not json"], "backup.json", {
      type: "application/json",
    })
    await pickFile(garbage)

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(m.importBackupInvalidFile())
    // Not a RemindIt backup → the confirm dialog never opens, nothing restores.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect($catalog.get()).toEqual([])

    // Second pick must clear the stale error before parsing (m6) — the alert
    // disappears and the confirm dialog takes over.
    const envelope = backupEnvelope()
    await pickFile(backupFile(envelope))
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    )
    await screen.findByRole("dialog")
    expect(screen.getByText(m.importBackupTitle())).toBeInTheDocument()
  })

  test("a valid backup: busy guard, restore, success ack, then redirect home", async () => {
    rs.useFakeTimers()
    renderProfile()

    const envelope = backupEnvelope()
    await pickFile(backupFile(envelope), 1)
    const dialog = screen.getByRole("dialog")
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText(m.importBackupTitle())).toBeInTheDocument()
    expect(
      screen.getByText(
        m.importBackupDescription({
          appVersion: envelope.version,
          exportedAt: formatExportedAt(envelope.exportedAt),
        })
      )
    ).toBeInTheDocument()

    const confirm = screen.getByRole("button", {
      name: m.importBackupConfirmButton(),
    })
    fireEvent.click(confirm)
    // Double-click guard: the confirm button locks while busy…
    expect(confirm).toBeDisabled()
    // …and the dialog can't be dismissed mid-restore: the header close
    // trigger's request is ignored by the busy-lock guard (even after a
    // tick — the state change simply never happens).
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    await act(async () => {
      await rs.advanceTimersByTimeAsync(1)
    })
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    // The 50ms defer tick runs the restore and swaps in the success dialog.
    await act(async () => {
      await rs.advanceTimersByTimeAsync(60)
    })
    expect(screen.getByText(m.profileImportSuccessTitle())).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(
      m.profileReseededRedirect()
    )
    expect($catalog.get()).toEqual(envelope.data.catalog)
    expect($onboarded.get()).toBe(true)

    // The 1500ms ack then routes home and tears the dialog down.
    await act(async () => {
      await rs.advanceTimersByTimeAsync(1500)
    })
    expect(screen.getByText("home")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  test("a newer-major backup warns before confirmation", async () => {
    renderProfile()

    const envelope = backupEnvelope({ version: futureMajorVersion() })
    await pickFile(backupFile(envelope))

    await screen.findByRole("dialog")
    expect(screen.getByText(m.importBackupNewerVersion())).toBeInTheDocument()
    // The warning informs, it doesn't block.
    expect(
      screen.getByRole("button", { name: m.importBackupConfirmButton() })
    ).toBeEnabled()
  })

  test("closing the success dialog early cancels the auto-redirect (m2)", async () => {
    rs.useFakeTimers()
    renderProfile()

    const envelope = backupEnvelope()
    await pickFile(backupFile(envelope), 1)
    fireEvent.click(
      screen.getByRole("button", { name: m.importBackupConfirmButton() })
    )
    await act(async () => {
      await rs.advanceTimersByTimeAsync(60)
    })
    expect(screen.getByText(m.profileImportSuccessTitle())).toBeInTheDocument()

    // Dismiss the ack dialog (header close trigger) before the 1500ms timer
    // fires. The close request lands (after a tick, the success content
    // swaps back to the idle confirm-branch UI)…
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    await act(async () => {
      await rs.advanceTimersByTimeAsync(1)
    })
    expect(
      screen.queryByText(m.profileImportSuccessTitle())
    ).not.toBeInTheDocument()

    // …and the armed redirect must be dead: driving the clock well past the
    // ack window never routes home. (Zag's exit-presence unmount lags under
    // the faked clock — the m2 pin is the absence of navigation, which is
    // what the timer cancellation guarantees.)
    await act(async () => {
      await rs.advanceTimersByTimeAsync(3000)
    })
    expect(screen.queryByText("home")).not.toBeInTheDocument()
    // Still on the (idle) profile view.
    expect(screen.getByText(m.profileTitle())).toBeInTheDocument()
  })
})
