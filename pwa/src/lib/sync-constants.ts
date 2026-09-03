// Shared constants for the sync engine and BFF API client. Centralises magic
// strings that cross module boundaries (engine ↔ BFF ↔ sync-errors).

/** Fallback BFF base URL when PUBLIC_BFF_URL env var is absent. */
export const DEFAULT_BFF_URL = "http://127.0.0.1:3100"

/** Engine throw when the session is missing (mapped by sync-errors.ts). */
export const NOT_SIGNED_IN = "not signed in"
