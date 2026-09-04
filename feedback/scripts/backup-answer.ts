// Answer (feedback module) backup: a consistent snapshot of the live sqlite DB
// plus uploads/ and conf/, tarred into answer-data/backups/. Scheduled by the
// same hourly timer as the PocketBase backup (infra/backup.{service,timer} →
// infra/bin/backup.sh), which runs this before bff/scripts/backup-pb.ts and
// tolerates our failure so a feedback-side problem never blocks pb_data/.
//
// Why VACUUM INTO and not a file copy: the statement runs inside a read
// transaction, so the target file is a page-consistent snapshot of the db as
// of the moment it starts — including WAL state — even while Answer keeps
// writing. A raw copy of answer-data/ risks a torn, unopenable db. Bun's
// bun:sqlite has no db.backup() on the current runtime (verified on 1.4.1),
// and VACUUM INTO (SQLite ≥3.27) needs no dependency. A quick_check on the
// snapshot fails fast instead of archiving a bad backup.
//
// Off-box copy stays a later step (decision: local snapshots only for Phase
// D, same as pb_data/). Retention mirrors backup-pb.ts: keep the most recent
// ANSWER_BACKUP_KEEP archives (default 10), prune the rest.
//
// Restore (stop Answer first): tar -xzf <archive> -C <module-dir> — the
// entries overlay answer-data/db/answer.db, answer-data/uploads/ and
// answer-data/conf/config.yaml in place.

import { Database } from "bun:sqlite"
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { DATA_DIR } from "../src/lib/setup"

const moduleDir = resolve(import.meta.dir, "..")
const dataDir = resolve(moduleDir, process.env.FEEDBACK_DATA_DIR ?? DATA_DIR)
const dbPath = resolve(dataDir, "db", "answer.db")
const backupsDir = resolve(dataDir, "backups")
const keep = Number(process.env.ANSWER_BACKUP_KEEP ?? "10")

if (!existsSync(dbPath)) {
  console.error(
    "[backup:answer] answer.db missing — run `bun run setup:feedback` first"
  )
  process.exit(1)
}

// Stage under <tmp>/answer-data/db/ so the tar's first entry set already has
// the canonical answer-data/ prefix (merged with the real uploads/conf below).
const tmpDir = mkdtempSync(join(tmpdir(), "answer-backup-"))
const snapshotPath = resolve(tmpDir, DATA_DIR, "db", "answer.db")
mkdirSync(resolve(tmpDir, DATA_DIR, "db"), { recursive: true })

// VACUUM INTO's target must not pre-exist; single-quote escape the path.
const db = new Database(dbPath)
try {
  db.exec(`VACUUM INTO '${snapshotPath.replaceAll("'", "''")}'`)
} finally {
  db.close()
}

const check = new Database(snapshotPath)
const result = check.query("PRAGMA quick_check").get() as
  | { quick_check?: string }
  | undefined
check.close()
if (result?.quick_check !== "ok") {
  rmSync(tmpDir, { recursive: true, force: true })
  console.error(
    `[backup:answer] snapshot failed quick_check: ${result?.quick_check}`
  )
  process.exit(1)
}

// Archive what exists: uploads/ and conf/config.yaml appear after setup (and
// config.yaml is part of install state per feedback/AGENTS.md — it carries the
// port and site settings, not secrets).
const extras = [
  join(DATA_DIR, "uploads"),
  join(DATA_DIR, "conf", "config.yaml"),
].filter((p) => existsSync(resolve(moduleDir, p)))

const ts = new Date().toISOString().replace(/[:.]/g, "-").toLowerCase()
mkdirSync(backupsDir, { recursive: true })
const archive = resolve(backupsDir, `answer-${ts}.tar.gz`)

// Repeated -C merges both sources under the same answer-data/ prefix (GNU tar
// and bsdtar both honor it): staged db snapshot + live uploads/config.
const tar = Bun.spawnSync([
  "tar",
  "-czf",
  archive,
  "-C",
  tmpDir,
  DATA_DIR,
  "-C",
  moduleDir,
  ...extras,
])
rmSync(tmpDir, { recursive: true, force: true })
if (tar.exitCode !== 0) {
  rmSync(archive, { force: true })
  console.error("[backup:answer] tar failed:", tar.stderr.toString().trim())
  process.exit(1)
}
console.log(`[backup:answer] created ${archive}`)

try {
  const files = (await readdir(backupsDir))
    .filter((f) => f.startsWith("answer-") && f.endsWith(".tar.gz"))
    .sort()
    .reverse()
  for (const f of files.slice(keep)) {
    rmSync(resolve(backupsDir, f))
    console.log(`[backup:answer] pruned ${f}`)
  }
} catch (e) {
  console.warn("[backup:answer] prune skipped:", e)
}
