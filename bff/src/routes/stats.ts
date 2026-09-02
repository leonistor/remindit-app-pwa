import { Hono } from "hono"
import { statsSchema } from "../contracts"
import { statsService } from "../services/stats"

// Public aggregate stats (no auth). Short shared cache: the payload only
// changes on signup/group-creation — 60s staleness is fine for marketing.
export const stats = new Hono().get("/", async (c) => {
  const data = statsSchema.parse(await statsService.get())
  c.header("cache-control", "public, max-age=60")
  return c.json(data)
})
