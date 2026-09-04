// Production PocketBase launcher for bm2. Spawns the pinned PB binary via
// @fadlee/pocketbase-bin (downloads once, then cached) bound to 127.0.0.1, and
// stays alive as the supervised process. Never public (D2: PB is internal only).
//
// Run by deploy/bin/start-pb.sh, which sources the repo-root .env so the vars
// below resolve. Keep this file dependency-light (no bff/src imports).
import { resolve } from "node:path"

const bffDir = resolve(import.meta.dir, "..")
const repoRoot = resolve(bffDir, "..")

const pocketbaseUrl = process.env.POCKETBASE_URL ?? "http://127.0.0.1:8090"
const pocketbaseDataDir = process.env.POCKETBASE_DATA_DIR ?? "bff/pb_data"
const url = new URL(pocketbaseUrl)
const port = url.port || "8090"

const healthy = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${pocketbaseUrl}/api/health`)
    return res.ok
  } catch {
    return false
  }
}

// If another PB already holds the port (e.g. a lingering restart), wait for it
// to release rather than double-binding and crashing the supervised process.
if (await healthy()) {
  console.log(`[pb] already healthy at ${pocketbaseUrl} — waiting for release`)
  while (await healthy()) await Bun.sleep(1000)
}

const pb = Bun.spawn(
  [
    "bunx",
    "@fadlee/pocketbase-bin",
    "serve",
    `--http=127.0.0.1:${port}`,
    `--dir=${resolve(repoRoot, pocketbaseDataDir)}`,
    // Schema is code-owned (src/schema/collections.ts + scripts/migrate.ts, D7):
    // PB's auto-migration snapshots would create a second source of truth.
    "--automigrate=false",
  ],
  {
    cwd: bffDir,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  }
)

const shutdown = () => {
  pb.kill()
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

await pb.exited
process.exit(pb.exitCode ?? 0)
