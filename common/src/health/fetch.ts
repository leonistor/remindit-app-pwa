import { healthResponse } from "./response"
import type { HealthOptions } from "./types"

// Fetch-handler adapter for TanStack Start's `src/server.ts` (web/admin): a
// short-circuit that answers `GET /health` and returns null for everything
// else, so the caller falls through to the app's render handler unchanged.
export function healthFetchHandler(
  service: string,
  options: HealthOptions = {}
): (request: Request) => Promise<Response | null> {
  return async (request) => {
    if (request.method !== "GET" && request.method !== "HEAD") return null
    const url = new URL(request.url)
    if (url.pathname !== "/health") return null
    return healthResponse(service, options)
  }
}
