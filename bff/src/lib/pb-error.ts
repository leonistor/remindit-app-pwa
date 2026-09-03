// Maps PocketBase/session failures to the published error contract
// ({ error, details }) — used by the app-level onError handler so route
// handlers stay free of try/catch noise (D8: HTTP shaping at the edge).
import { ClientResponseError } from "pocketbase"
import {
  InvalidTokenError,
  PocketBaseUnavailableError,
} from "../repositories/pocketbase"

export const pbErrorResponse = (
  error: unknown
):
  | { status: number; body: { error: string; details?: unknown } }
  | undefined => {
  // Session-validation failures raised by repositories/pocketbase (auth
  // middleware + record reads): 401 invalid token, 503 PB outage (H8 — a PB
  // blip must not make clients discard valid credentials).
  if (error instanceof InvalidTokenError) {
    return { status: 401, body: { error: error.message } }
  }
  if (error instanceof PocketBaseUnavailableError) {
    return { status: 503, body: { error: error.message } }
  }
  if (!(error instanceof ClientResponseError) || error.status < 400) {
    return undefined
  }
  const response = error.response as { message?: string; data?: unknown }
  return {
    status: error.status,
    body: {
      error: response.message ?? "PocketBase request failed",
      ...(response.data ? { details: response.data } : {}),
    },
  }
}
