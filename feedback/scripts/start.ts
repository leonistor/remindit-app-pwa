// Start script (run via `bun run dev:feedback`): ensure setup, then spawn the
// Answer binary in the foreground with the AUTO_INSTALL env flow — on a fresh
// answer-data/ it installs headless (sqlite, site + admin from .env), on an
// already-initialized data dir Answer skips installation on its own.
// Reuses an already-running instance (health probe) so re-running never
// double-spawns — same contract as bff/scripts/dev.ts.
import { resolve } from "node:path"
import { env } from "../src/env"
import { BINARY_NAME, DATA_DIR } from "../src/lib/setup"

const moduleDir = resolve(import.meta.dir, "..")
const pidPath = resolve(moduleDir, "answer.pid")

const healthy = async (): Promise<boolean> => {
  try {
    // Any HTTP response (UI shell, redirect to /install, 404…) means the
    // server is up — installation progress is Answer's own concern.
    await fetch(`http://127.0.0.1:${env.port}/`, {
      signal: AbortSignal.timeout(2_000),
    })
    return true
  } catch {
    return false
  }
}

if (await healthy()) {
  console.log(
    `[feedback] Answer already running at http://127.0.0.1:${env.port} — reusing`
  )
  process.exit(0)
}

const binary = resolve(moduleDir, BINARY_NAME)
if (!(await Bun.file(binary).exists())) {
  console.log("[feedback] binary missing — running setup first…")
  const setup = Bun.spawn(["bun", resolve(moduleDir, "scripts", "setup.ts")], {
    cwd: moduleDir,
    stdout: "inherit",
    stderr: "inherit",
  })
  if ((await setup.exited) !== 0) process.exit(1)
}

console.log(`[feedback] starting Answer on :${env.port}…`)
const answer = Bun.spawn({
  cmd: ["./answer", "run", `-C`, `./${DATA_DIR}/`],
  cwd: moduleDir,
  // Installation is setup's job (headless AUTO_INSTALL in scripts/setup.ts);
  // this script only serves. The data dir is fully prepared by the time the
  // binary spawns.
  stdin: "ignore",
  stdout: "inherit",
  stderr: "inherit",
})
await Bun.write(pidPath, String(answer.pid))

const deadline = Date.now() + 180_000 // generous: first boot initializes the DB
let up = false
while (Date.now() < deadline) {
  if (await healthy()) {
    up = true
    break
  }
  // exitCode/signalCode stay null while the subprocess is running.
  if (answer.exitCode !== null || answer.signalCode !== null) break
  await Bun.sleep(300)
}

if (!up) {
  console.error(
    `[feedback] Answer did not become healthy on :${env.port} — check output above`
  )
  process.exit(1)
}
console.log(
  `[feedback] Answer ready: ${env.siteUrl} (direct: http://localhost:${env.port})`
)

const shutdown = () => {
  answer.kill()
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
await answer.exited
console.log("[feedback] Answer stopped")
