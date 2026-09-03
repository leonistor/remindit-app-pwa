// Body validation must speak the published error contract (H10) — the
// zValidator default hook would leak Hono's { success, error: ZodError[] }
// shape instead. Uses the open /api/auth/register route: no PocketBase
// required, runs unconditionally.

import { describe, expect, test } from "bun:test"
import { app } from "../src/app"
import { errorSchema } from "../src/contracts"

describe("body validation error contract", () => {
  test("invalid register body → 400 { error: 'validation failed', details }", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", username: "has space" }),
    })
    expect(res.status).toBe(400)
    const body = errorSchema.parse(await res.json())
    expect(body.error).toBe("validation failed")
    const details = body.details as {
      formErrors: string[]
      fieldErrors: Record<string, string[]>
    }
    expect(details.formErrors).toEqual([])
    expect(details.fieldErrors.email?.length).toBeGreaterThan(0)
    expect(details.fieldErrors.username?.length).toBeGreaterThan(0)
    expect(details.fieldErrors.password?.length).toBeGreaterThan(0)
  })
})
