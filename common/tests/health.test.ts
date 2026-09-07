import { describe, expect, test } from "bun:test"
import {
  healthFetchHandler,
  healthMiddleware,
  healthReport,
  healthResponse,
} from "../src/health"
import { honoHealthRoute } from "../src/health/hono"

// Exercise every adapter in @remindit/common/health against the same report
// contract so modules can rely on one behavior regardless of transport.

const DEFAULTS = { version: "0.1.0" }

describe("healthReport", () => {
  test("ok when every check is up, carries version and checks", async () => {
    const report = await healthReport("remindit-test", {
      ...DEFAULTS,
      checks: { db: "up", cache: () => "up" },
    })
    expect(report.ok).toBe(true)
    expect(report.service).toBe("remindit-test")
    expect(report.version).toBe("0.1.0")
    expect(report.checks).toEqual({ db: "up", cache: "up" })
    expect(typeof report.ts).toBe("string")
    expect(report.uptime).toBeGreaterThanOrEqual(0)
  })

  test("ok false when a check is down", async () => {
    const report = await healthReport("remindit-test", {
      checks: { db: "up", worker: "down" },
    })
    expect(report.ok).toBe(false)
    expect(report.checks.worker).toBe("down")
  })

  test("a throwing check reports down and never throws", async () => {
    const report = await healthReport("remindit-test", {
      checks: { flaky: () => Promise.reject(new Error("boom")) },
    })
    expect(report.ok).toBe(false)
    expect(report.checks.flaky).toBe("down")
  })
})

describe("healthResponse", () => {
  test("200 JSON with no-store, body parses to the report", async () => {
    const res = await healthResponse("remindit-test", {
      ...DEFAULTS,
      checks: { pb: "up" },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    expect(res.headers.get("cache-control")).toBe("no-store")
    const body = await res.json()
    expect(body.service).toBe("remindit-test")
    expect(body.checks).toEqual({ pb: "up" })
  })
})

describe("healthFetchHandler", () => {
  const handler = healthFetchHandler("remindit-test", DEFAULTS)

  test("answers GET /health", async () => {
    const res = await handler(new Request("http://x.local/health"))
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
  })

  test("returns null for other paths and methods", async () => {
    expect(await handler(new Request("http://x.local/list"))).toBeNull()
    expect(
      await handler(new Request("http://x.local/health", { method: "POST" }))
    ).toBeNull()
  })

  test("ignores query strings", async () => {
    const res = await handler(new Request("http://x.local/health?probe=1"))
    expect(res).not.toBeNull()
  })
})

describe("healthMiddleware", () => {
  const middleware = healthMiddleware("remindit-test", DEFAULTS)

  function run(req: { url?: string; method?: string }) {
    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: undefined as string | undefined,
      setHeader(k: string, v: string) {
        this.headers[k] = v
      },
      end(chunk?: string) {
        this.body = chunk
      },
    }
    let nextCalled = false
    const done = middleware(req, res, () => {
      nextCalled = true
    })
    return {
      prom: done,
      res,
      get nextCalled() {
        return nextCalled
      },
    }
  }

  test("answering /health", async () => {
    const { prom, res } = run({ url: "/health", method: "GET" })
    await prom
    expect(res.statusCode).toBe(200)
    expect(res.headers["cache-control"]).toBe("no-store")
    expect(JSON.parse(res.body as string).service).toBe("remindit-test")
  })

  test("falling through for non-health paths", async () => {
    const { prom, res, nextCalled } = run({ url: "/index.html", method: "GET" })
    await prom
    expect(res.statusCode).toBe(0)
    expect(nextCalled).toBe(true)
  })

  test("HEAD answers without a body", async () => {
    const { prom, res } = run({ url: "/health", method: "HEAD" })
    await prom
    expect(res.statusCode).toBe(200)
    expect(res.body).toBeUndefined()
  })
})

describe("honoHealthRoute", () => {
  test("lives only in the /health/hono subpath (barrel stays hono-free)", async () => {
    // The barrel must not export it — see health/index.ts. Module-graph proof
    // is done by typecheck; here we just pin the route's behavior.
    const res = await honoHealthRoute("remindit-test", {
      ...DEFAULTS,
      checks: { pb: () => "down" },
    }).request("/")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.checks.pb).toBe("down")
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
