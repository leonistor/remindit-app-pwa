// Stop script (run via `bun run stop:feedback`): SIGTERM the Answer process
// recorded in answer.pid. Guards against PID reuse by verifying the process
// command before signalling — the pid file can outlive a reboot.

import { unlink } from "node:fs/promises"
import { resolve } from "node:path"

const moduleDir = resolve(import.meta.dir, "..")
const pidPath = resolve(moduleDir, "answer.pid")

const raw = (await Bun.file(pidPath).exists())
  ? (await Bun.file(pidPath).text()).trim()
  : ""
if (!raw) {
  console.log("[feedback] not running (no answer.pid)")
  process.exit(0)
}

const pid = Number(raw)
if (!Number.isInteger(pid) || pid <= 0) {
  await unlink(pidPath)
  console.log("[feedback] answer.pid was garbage — removed")
  process.exit(0)
}

let command = ""
try {
  const proc = Bun.spawnSync(["ps", "-p", String(pid), "-o", "comm="])
  command = proc.stdout.toString().trim()
} catch {
  // ps missing/unavailable — fall through and try the signal anyway.
}

if (!command) {
  await unlink(pidPath)
  console.log(
    `[feedback] no process with pid ${pid} — removed stale answer.pid`
  )
  process.exit(0)
}
if (!command.includes("answer")) {
  console.log(
    `[feedback] pid ${pid} is now "${command}" (pid reuse) — leaving it alone, removing answer.pid`
  )
  await unlink(pidPath)
  process.exit(1)
}

process.kill(pid, "SIGTERM")
console.log(`[feedback] stopped Answer (pid ${pid})`)
await unlink(pidPath)
