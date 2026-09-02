import { Hono } from "hono"
import { healthService } from "../services/health"

export const health = new Hono().get("/", async (c) => {
  const report = await healthService.check()
  return c.json(report)
})
