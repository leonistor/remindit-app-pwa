// TanStack Start server entry (admin).
//
// Mirrors web/src/server.ts but without the locale routing: an explicit
// `src/server.ts` is picked up by the Rsbuild adapter's entry planner (verified
// in start-plugin-core, web/AGENTS.md), and providing our own gives us the
// seam to short-circuit `GET /health` before the app renders.
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server"
import { healthFetchHandler } from "@remindit/common/health"
import adminPkg from "../package.json"

const renderApp = createStartHandler(defaultStreamHandler)
// Always 200 while the process is alive; dependency health lives in the body.
const health = healthFetchHandler("remindit-admin", {
  version: adminPkg.version,
})

export default async (
  request: Request,
  requestOpts?: Parameters<typeof renderApp>[1]
) => {
  const healthRes = await health(request)
  if (healthRes) return healthRes
  return renderApp(request, requestOpts)
}
