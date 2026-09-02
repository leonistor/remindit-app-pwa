// Maps PocketBase ClientResponseErrors to the published error contract
// ({ error, details }) — used by the app-level onError handler so route
// handlers stay free of try/catch noise (D8: HTTP shaping at the edge).
import { ClientResponseError } from "pocketbase"

export const pbErrorResponse = (
  error: unknown
):
  | { status: number; body: { error: string; details?: unknown } }
  | undefined => {
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
