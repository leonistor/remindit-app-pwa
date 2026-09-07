import { healthReport } from "./report"
import type { HealthOptions } from "./types"

// Connect-style middleware for the Rsbuild dev/preview server
// (`server.setup` → `server.middlewares.use`, verified in Rsbuild 2.2.2:
// setup fires for both `action: "dev"` and `action: "preview"`). Structurally
// typed so common needs no connect/node type dependency — the surface used is
// just req.url/method and res status/headers/end.

export interface HealthMiddlewareRequest {
  url?: string
  method?: string
}
export interface HealthMiddlewareResponse {
  statusCode: number
  setHeader(name: string, value: string): void
  end(chunk?: string): void
}
export type HealthMiddlewareNext = (err?: unknown) => void

export function healthMiddleware(
  service: string,
  options: HealthOptions = {}
): (
  req: HealthMiddlewareRequest,
  res: HealthMiddlewareResponse,
  next: HealthMiddlewareNext
) => Promise<void> {
  return async (req, res, next) => {
    const method = req.method ?? "GET"
    if (method !== "GET" && method !== "HEAD") return next()
    const url = new URL(req.url ?? "", "http://internal")
    if (url.pathname !== "/health") return next()
    const report = await healthReport(service, options)
    res.statusCode = 200
    res.setHeader("content-type", "application/json; charset=utf-8")
    res.setHeader("cache-control", "no-store")
    res.end(method === "HEAD" ? undefined : JSON.stringify(report))
  }
}
