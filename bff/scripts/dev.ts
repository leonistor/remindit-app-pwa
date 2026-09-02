// Dev orchestrator: PocketBase (via @fadlee/pocketbase-bin) first, then Hono.
// Run through the root script (`bun run dev:bff`) so the root .env is loaded
// (D9). Reuses an already-running PocketBase (health probe), so re-running or
// restarting the script never double-spawns the binary.
import { resolve } from "node:path"
import { env } from "../src/env"

const bffDir = resolve(import.meta.dir, "..")
const repoRoot = resolve(bffDir, "..")

const pbHealthy = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${env.pocketbaseUrl}/api/health`)
    return res.ok
  } catch {
    return false
  }
}

let pb: Bun.Subprocess<"ignore", "inherit", "inherit"> | undefined

if (await pbHealthy()) {
  console.log(
    `[bff] PocketBase already running at ${env.pocketbaseUrl} — reusing`
  )
} else {
  const url = new URL(env.pocketbaseUrl)
  console.log("[bff] starting PocketBase (first run downloads the binary)…")
  pb = Bun.spawn({
    cmd: [
      "bunx",
      "@fadlee/pocketbase-bin",
      "serve",
      `--http=127.0.0.1:${url.port || "8090"}`,
      `--dir=${resolve(repoRoot, env.pocketbaseDataDir)}`,
    ],
    cwd: bffDir,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  })
  // Generous deadline: the first run downloads the PB binary from GitHub.
  const deadline = Date.now() + 120_000
  let up = false
  while (Date.now() < deadline) {
    if (await pbHealthy()) {
      up = true
      break
    }
    await Bun.sleep(300)
  }
  if (!up) {
    console.error("[bff] PocketBase did not become healthy in time")
    pb.kill()
    process.exit(1)
  }
  console.log(`[bff] PocketBase healthy at ${env.pocketbaseUrl}`)
}

// Start Hono only after PB is reachable so early requests never race the
// backend boot (PB-independent routes would answer fine either way).
const { server } = await import("../src/index")

const shutdown = () => {
  server.stop(true)
  pb?.kill()
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
