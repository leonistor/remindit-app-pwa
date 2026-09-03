import { afterAll, describe, expect, test } from "bun:test"
import { app } from "../src/app"

const server = Bun.serve({ port: 0, fetch: app.fetch })
afterAll(() => server.stop(true))

describe("SSE spike (phase 1, docs/ROADMAP.md §7)", () => {
  test("events arrive incrementally, not buffered until close", async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/api/sse`)
    expect(res.headers.get("content-type")).toContain("text/event-stream")

    const reader = res.body?.getReader()
    if (!reader) throw new Error("response has no body")
    const decoder = new TextDecoder()
    let reads = 0
    let received = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      reads++
      received += decoder.decode(value, { stream: true })
    }

    // 3 events spaced 150ms apart: unbuffered streaming yields ≥2 reads —
    // a buffered transport would deliver exactly one chunk at stream close.
    expect(reads).toBeGreaterThanOrEqual(2)
    expect(received.match(/data: /g)?.length).toBe(3)
  }, 10_000)
})
