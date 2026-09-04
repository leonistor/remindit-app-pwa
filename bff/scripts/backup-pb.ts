// Local pb_data/ backup via PocketBase's superuser backup API (works while the
// server is running). Retains the most recent PB_BACKUP_KEEP zips in
// pb_data/backups and prunes the rest. Scheduled by deploy/backup.{service,timer}.
// Off-box copy is a later step (decision: local snapshots only for Phase D).
//
// Run by deploy/bin/backup.sh, which sources the repo-root .env so the superuser
// credentials below resolve from the VPS environment (never committed).

import { rmSync } from "node:fs"
import { readdir } from "node:fs/promises"
import { resolve } from "node:path"
import PocketBase from "pocketbase"

const repoRoot = resolve(import.meta.dir, "..", "..")
const dataDir = resolve(
  repoRoot,
  process.env.POCKETBASE_DATA_DIR ?? "bff/pb_data"
)
const url = process.env.POCKETBASE_URL ?? "http://127.0.0.1:8090"
const email = process.env.POCKETBASE_ADMIN_EMAIL
const password = process.env.POCKETBASE_ADMIN_PASSWORD
const keep = Number(process.env.PB_BACKUP_KEEP ?? "10")

if (!email || !password) {
  console.error("[backup] POCKETBASE_ADMIN_EMAIL/PASSWORD required")
  process.exit(1)
}

const pb = new PocketBase(url)
await pb.collection("_superusers").authWithPassword(email, password)

const name = `remindit-${new Date()
  .toISOString()
  .replace(/[:.]/g, "-")
  .toLowerCase()}.zip`
await pb.backups.create(name)
console.log(`[backup] created ${name}`)

try {
  const backupsDir = resolve(dataDir, "backups")
  const files = (await readdir(backupsDir))
    .filter((f) => f.endsWith(".zip"))
    .sort()
    .reverse()
  for (const f of files.slice(keep)) {
    rmSync(resolve(backupsDir, f))
    console.log(`[backup] pruned ${f}`)
  }
} catch (e) {
  console.warn("[backup] prune skipped:", e)
}
