// Sync session (phase 5): the PB auth token + identity, persisted so sync
// survives reloads. The token is written only at login (signIn/signUp) — the
// BFF /pb/* forwarder rotates tokens server-side, so nothing mid-session
// hands the engine a fresh token to patch in here.

import { jsonStore, STORAGE_KEYS } from "../persistence"

export type SyncSession = {
  token: string
  userId: string
  email: string
}

const $syncSession = jsonStore<SyncSession | null>(
  STORAGE_KEYS.syncSession,
  null
)

export function getSession(): SyncSession | null {
  return $syncSession.get()
}

export function setSession(session: SyncSession | null): void {
  $syncSession.set(session)
}

export { $syncSession }
