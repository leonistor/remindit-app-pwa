import { Hono } from "hono"

// Phase-1 spike (docs/ROADMAP.md §7): prove SSE streams unbuffered through
// Hono on Bun.serve — whichever sync data-plane wins in phase 5, the realtime
// transport depends on this. Doubles as a manual diagnostics endpoint.
export const sse = new Hono().get("/", (c) => {
  const signal = c.req.raw.signal
  const body = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      for (let n = 1; n <= 3; n++) {
        if (signal.aborted) break
        controller.enqueue(encoder.encode(`event: ping\ndata: {"n":${n}}\n\n`))
        await Bun.sleep(150)
      }
      controller.close()
    },
  })
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  })
})
