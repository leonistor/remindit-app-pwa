import PocketBase from "pocketbase"
import { env } from "../env"

// Server-side PocketBase client (D8): PB concerns live in the repository
// layer — routes and services reach PB only through this module (directly or
// via service methods), never by importing the SDK themselves.

/** Anonymous/admin-side client (shared process singleton). */
export const pb = new PocketBase(env.pocketbaseUrl)

// Auto-cancellation aborts identical in-flight requests when a new one fires —
// a browser-UX feature that is wrong for a long-lived server process.
pb.autoCancellation(false)

/**
 * Per-request client scoped to a user's PB auth token (phase 3): SDK calls
 * through it are evaluated against that user by PB's API rules — the BFF
 * never bypasses authorization for user-scoped operations.
 */
export const forToken = (token: string): PocketBase => {
  const client = new PocketBase(env.pocketbaseUrl)
  client.autoCancellation(false)
  // Payload is unknown until auth-refresh validates the token; only the token
  // itself matters for the Authorization header the SDK attaches.
  client.authStore.save(token, { id: "" } as never)
  return client
}

/** Superuser client (admin-side ops only — migrations, test fixtures). */
export const forSuperuser = async (): Promise<PocketBase> => {
  const client = new PocketBase(env.pocketbaseUrl)
  client.autoCancellation(false)
  const email = env.pocketbaseAdminEmail
  const password = env.pocketbaseAdminPassword
  if (!email || !password) {
    throw new Error("POCKETBASE_ADMIN_EMAIL/PASSWORD missing in the root .env")
  }
  await client.collection("_superusers").authWithPassword(email, password)
  return client
}
