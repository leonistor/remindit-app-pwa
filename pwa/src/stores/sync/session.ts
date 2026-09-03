// Sync session (phase 5): the PB auth token + identity, persisted so sync
// survives reloads. Login (signIn/signUp) seeds the session; from then on the
// BFF hands back rotated tokens in the `X-Session-Token` response header of
// authenticated requests (its auth middleware auth-refreshes near-expiry
// tokens), and the engine patches the token in place here mid-session
// (`patchSessionToken`, wired in engine.ts) — so a session outlives the
// original login token's TTL. Identity fields are never touched by rotation.

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

/**
 * Patches the persisted session's token in place (identity preserved) when
 * the BFF rotates it mid-session. Same-token calls no-op: rotation headers
 * can arrive on concurrent in-flight responses, and re-setting an identical
 * token would fire pointless store writes per response (loop guard).
 */
export function patchSessionToken(token: string): void {
  const session = $syncSession.get()
  if (!session || session.token === token) return
  $syncSession.set({ ...session, token })
}

export { $syncSession }
