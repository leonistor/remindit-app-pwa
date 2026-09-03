// Maps raw sync-path error strings to user-facing paraglide messages. Both
// sync-card surfaces (status line `sync.lastError` and the sign-in/up form
// error) funnel through `syncErrorMessage`; state keeps the RAW string and the
// mapping happens at render time.
//
// The known strings are the published BFF error contract — `body.error` values
// from bff/src/contracts.ts, app.onError (lib/pb-error.ts), the auth
// middleware, and the /pb forwarder — plus the engine's own throw ("not signed
// in") and the browser fetch TypeError ("Failed to fetch"). The BFF side is
// the source of truth: change a string there and the table below must be kept
// in sync. Anything unmapped (including "internal server error", where there
// is nothing more specific to say) falls back to the generic message.
//
import { m } from "@/paraglide/messages"

// Lookup is trimmed + case-insensitive to absorb small casing drift between
// the browser's TypeError message, the PB SDK, and our own contract strings.

const KNOWN_ERROR_KEYS: Record<string, () => string> = {
  // stores/sync/engine.ts: thrown by ensureGroup when the session vanished
  // mid-connect.
  "not signed in": () => m.syncErrorNotSignedIn(),

  // requireAuth (bff/src/middleware/auth.ts) + InvalidTokenError
  // (repositories/pocketbase.ts → lib/pb-error.ts): session missing or dead.
  "authentication required": () => m.syncErrorSession(),
  "invalid or expired token": () => m.syncErrorSession(),

  // PB authWithPassword rejection surfaced verbatim through app.onError.
  "failed to authenticate.": () => m.syncErrorInvalidCredentials(),

  // BFF validatedJson (lib/validation.ts): the request body failed the Zod
  // schema (register/login field checks).
  "validation failed": () => m.syncErrorValidation(),

  // PB users.create rejection surfaced verbatim through app.onError (usually
  // an already-taken username/email).
  "failed to create record.": () => m.syncErrorCreateAccount(),

  // PocketBaseUnavailableError (503) + the /pb forwarder's 504 (routes/pb.ts):
  // retryable infra failures on the server side.
  "pocketbase is temporarily unavailable, please retry": () =>
    m.syncErrorUnavailable(),
  "upstream timeout": () => m.syncErrorUnavailable(),

  // Browser fetch TypeError — both the BFF RPC client (bff-api.ts) and the PB
  // SDK raise it verbatim when the server is unreachable.
  "failed to fetch": () => m.syncErrorNetwork(),
}

export const syncErrorMessage = (raw: string): string => {
  const known = KNOWN_ERROR_KEYS[raw.trim().toLowerCase()]
  return known ? known() : m.syncErrorGeneric()
}
