// API response contracts (D8): Zod schemas are the published shape frontends
// consume through Hono RPC (`hc<AppType>`), and services return data that
// satisfies them — the compiler keeps both sides honest.

import { z } from "zod"

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("remindit-bff"),
  pb: z.object({
    status: z.enum(["up", "down"]),
  }),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>
