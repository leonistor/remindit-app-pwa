// Sync section for the Profile view (phase 5): sign-in / sign-up card +
// connection status. Deliberately minimal — the sync engine does the heavy
// lifting (docs/SYNC.md); this is just the control surface.

import { useStore } from "@nanostores/react"
import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/custom/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { m } from "@/paraglide/messages"
import { syncErrorMessage } from "@/lib/sync-errors"
import { $user } from "@/stores"
import { $syncState, signIn, signOut, signUp } from "@/stores/sync"

export function SyncCard() {
  const sync = useStore($syncState)
  const user = useStore($user)
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState(user.email || "")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === "signin") {
        await signIn(email, password)
      } else {
        // Username defaults to the local profile's (or the email handle) —
        // the profile sync pushes the full identity after sign-up.
        const username =
          user.username ||
          email.split("@")[0]?.replace(/[^a-zA-Z0-9_-]/g, "") ||
          `user-${Date.now().toString(36)}`
        await signUp({ email, password, username })
      }
      setPassword("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const statusLabel =
    sync.status === "online"
      ? m.syncStatusOnline()
      : sync.status === "connecting"
        ? m.syncStatusConnecting()
        : sync.status === "error"
          ? m.syncStatusError()
          : m.syncStatusOff()

  return (
    <Card className="w-full max-w-xl">
      <CardHeader title={m.syncTitle()} description={m.syncDescription()} />
      <CardContent>
        {sync.status !== "off" && (
          <p className="mb-3 text-muted-foreground text-sm">
            {statusLabel}
            {sync.lastError ? ` — ${syncErrorMessage(sync.lastError)}` : ""}
          </p>
        )}

        {sync.status === "off" ? (
          <form onSubmit={submit} className="space-y-3">
            <Field>
              <FieldLabel>{m.syncEmailLabel()}</FieldLabel>
              <Input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{m.syncPasswordLabel()}</FieldLabel>
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            {error && (
              <p className="text-destructive text-sm">{syncErrorMessage(error)}</p>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" isLoading={busy} disabled={busy}>
                {mode === "signin"
                  ? m.syncSignInButton()
                  : m.syncSignUpButton()}
              </Button>
              <button
                type="button"
                className="text-muted-foreground text-sm underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin"
                  ? m.syncSwitchToSignUp()
                  : m.syncSwitchToSignIn()}
              </button>
            </div>
          </form>
        ) : (
          <Button variant="outline" onClick={() => void signOut()}>
            {m.syncSignOutButton()}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
