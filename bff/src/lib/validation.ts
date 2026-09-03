// Shared @hono/zod-validator hook (D8): invalid bodies must speak the
// published error contract ({ error, details }) — the library's default hook
// would leak Hono's own { success, error: ZodError[] } shape instead.
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const validatedJson = <T extends z.ZodType>(schema: T) =>
  zValidator("json", schema, (result, c) => {
    if (!result.success) {
      return c.json(
        // z.flattenError: zod v4 replacement for the deprecated error.flatten()
        { error: "validation failed", details: z.flattenError(result.error) },
        400
      )
    }
  })
