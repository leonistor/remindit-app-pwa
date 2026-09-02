import PocketBase from "pocketbase"
import { env } from "../env"

// Server-side PocketBase client (D8): PB concerns live in the repository
// layer — routes and services reach PB only through this module (directly or
// via service methods), never by importing the SDK themselves.
export const pb = new PocketBase(env.pocketbaseUrl)

// Auto-cancellation aborts identical in-flight requests when a new one fires —
// a browser-UX feature that is wrong for a long-lived server process.
pb.autoCancellation(false)
