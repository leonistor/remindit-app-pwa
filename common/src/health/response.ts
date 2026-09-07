import { healthReport } from "./report"
import type { HealthOptions } from "./types"

// Always HTTP 200 while the process is alive; dependency health is carried in
// the body (`ok` + `checks`). A process supervisor (bm2) only probes
// reachability, so a down dependency must not look like a dead process and
// force a restart — monitoring tools are expected to alert on the body.
export async function healthResponse(
  service: string,
  options: HealthOptions = {}
): Promise<Response> {
  const report = await healthReport(service, options)
  return new Response(JSON.stringify(report), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Never cache: health must reflect the live state.
      "cache-control": "no-store",
    },
  })
}
