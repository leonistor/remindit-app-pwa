import { app } from "./app"
import { env } from "./env"

// Entry point — normally started by scripts/dev.ts (which ensures PocketBase
// is up first), or directly via `bun src/index.ts` (PB-independent routes
// answer regardless; /api/health reports PB as "down" until it is reachable).
// Exported for scripts/dev.ts (graceful shutdown of the orchestrated stack).
export const server = Bun.serve({
  port: env.port,
  fetch: app.fetch,
  // Long-lived realtime (SSE) connections need far more than Bun's default
  // 10s idle timeout; 255 is the maximum (phase 5 realtime depends on this).
  idleTimeout: 255,
})

console.log(`[bff] listening on http://localhost:${server.port}`)
