// Sync session (phase 5): the PB auth token + identity, persisted so sync
// survives reloads. The token rotates on every authenticated request (BFF
// auth-refresh) — the session store is updated by the engine whenever the
// middleware hands back a fresh token.

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
