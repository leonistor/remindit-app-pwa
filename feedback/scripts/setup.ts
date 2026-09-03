// Setup step (idempotent, run via `bun run setup:feedback`):
//   1. resolve the Answer version (pinned FEEDBACK_VERSION, or latest release)
//   2. download the platform tar.gz + checksums.txt, verify sha256
//   3. extract the `answer` binary, chmod +x, stamp the version
//   4. prepare answer-data/ folders and conf/config.yaml (docs/FEEDBACK.md)
// Re-running converges: binary download is skipped when the stamp matches,
// and an existing config.yaml is never overwritten (Answer treats its
// presence as "installed").
import { mkdir, rename, rm } from "node:fs/promises"
import { resolve } from "node:path"
import { env } from "../src/env"
import {
  archiveRoot,
  assetUrl,
  BINARY_NAME,
  DATA_DIR,
  parseChecksums,
  platformAsset,
  renderConfigYaml,
  VERSION_FILE,
} from "../src/lib/setup"

const moduleDir = resolve(import.meta.dir, "..")

const latestVersion = async (): Promise<string> => {
  const res = await fetch(
    "https://api.github.com/repos/apache/answer/releases/latest",
    {
      headers: { "User-Agent": "remindit-feedback-setup" },
      signal: AbortSignal.timeout(15_000),
    }
  )
  if (!res.ok) throw new Error(`GitHub releases lookup failed: ${res.status}`)
  const tag = ((await res.json()) as { tag_name: string }).tag_name
  return tag.replace(/^v/, "")
}

const sha256 = async (path: string): Promise<string> => {
  const hasher = new Bun.CryptoHasher("sha256")
  hasher.update(await Bun.file(path).arrayBuffer())
  return hasher.digest("hex")
}

const version = env.version || (await latestVersion())
console.log(`[feedback] Apache Answer version: ${version}`)

const binaryPath = resolve(moduleDir, BINARY_NAME)
const versionPath = resolve(moduleDir, VERSION_FILE)

if (
  (await Bun.file(binaryPath).exists()) &&
  (await Bun.file(versionPath).exists()) &&
  (await Bun.file(versionPath).text()).trim() === version
) {
  console.log(
    `[feedback] binary already prepared (${BINARY_NAME} v${version}) — skipping download`
  )
} else {
  const asset = platformAsset(process.platform, process.arch)
  const tarPath = resolve(moduleDir, asset.filename.replaceAll("%V", version))
  const url = assetUrl(version, asset.filename)

  console.log(`[feedback] downloading ${url}`)
  const res = await fetch(url, { signal: AbortSignal.timeout(300_000) })
  if (!res.ok)
    throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  await Bun.write(tarPath, res)

  const checksumsUrl = `https://github.com/apache/answer/releases/download/v${version}/checksums.txt`
  const checksumsRes = await fetch(checksumsUrl, {
    signal: AbortSignal.timeout(15_000),
  })
  if (!checksumsRes.ok)
    throw new Error(`checksums.txt download failed: ${checksumsRes.status}`)
  const expected = parseChecksums(await checksumsRes.text()).get(
    asset.filename.replaceAll("%V", version)
  )
  if (!expected)
    throw new Error(
      `No checksum for ${asset.filename.replaceAll("%V", version)} in checksums.txt`
    )
  const actual = await sha256(tarPath)
  if (actual !== expected) {
    await rm(tarPath)
    throw new Error(`Checksum mismatch: expected ${expected}, got ${actual}`)
  }
  console.log(`[feedback] checksum ok (${actual.slice(0, 12)}…)`)

  // Extract to a temp dir, then move just the binary into the module root —
  // the archive also carries LICENSE/NOTICE trees we don't need on disk.
  const extractDir = resolve(moduleDir, `.answer-extract-${Date.now()}`)
  await mkdir(extractDir, { recursive: true })
  const proc = Bun.spawn(["tar", "-xzf", tarPath, "-C", extractDir])
  const code = await proc.exited
  if (code !== 0) throw new Error(`tar exited with ${code}`)
  await rename(
    resolve(
      extractDir,
      archiveRoot(version, asset.os, asset.arch),
      BINARY_NAME
    ),
    binaryPath
  )
  await rm(extractDir, { recursive: true, force: true })
  await rm(tarPath)
  await Bun.spawn([`chmod`, "755", binaryPath]).exited
  await Bun.write(versionPath, version)
  console.log(`[feedback] binary ready: ${BINARY_NAME} v${version}`)
}

// answer-data/ layout per docs/FEEDBACK.md.
for (const dir of ["cache", "conf", "db", "i18n", "uploads"]) {
  await mkdir(resolve(moduleDir, DATA_DIR, dir), { recursive: true })
}

// Config: written once; afterwards it IS the install state (Answer refuses to
// re-init when it exists), so setup never rewrites it.
const configPath = resolve(moduleDir, DATA_DIR, "conf", "config.yaml")
if (await Bun.file(configPath).exists()) {
  console.log("[feedback] conf/config.yaml exists — keeping it")
} else {
  await Bun.write(configPath, renderConfigYaml(env.port))
  console.log(`[feedback] wrote conf/config.yaml (addr 0.0.0.0:${env.port})`)
}

// Always re-extract i18n bundles — they must match the current binary version.
// The binary embeds them but refuses to boot until answer-data/i18n/ is
// populated. Quirk: `answer i18n` extracts to the CWD and ignores -C — so
// run it FROM the target dir.
const i18nDir = resolve(moduleDir, DATA_DIR, "i18n")
await rm(i18nDir, { recursive: true, force: true })
await mkdir(i18nDir, { recursive: true })
const proc = Bun.spawn([binaryPath, "i18n"], {
  cwd: i18nDir,
  stdout: "inherit",
  stderr: "inherit",
})
if ((await proc.exited) !== 0) throw new Error("answer i18n failed")
console.log("[feedback] i18n bundles extracted")

// Headless install (AUTO_INSTALL env flow): initializes the sqlite schema +
// site identity + admin account from FEEDBACK_* env (D9). Answer skips
// installation itself once tables exist, so this is rerun-safe. A zero-byte
// DB file (left behind by an interrupted boot) is removed first — Answer
// panics on a connection with no tables.
const dbPath = resolve(moduleDir, DATA_DIR, "db", "answer.db")
const dbFile = Bun.file(dbPath)
if (!(await dbFile.exists()) || (await dbFile.size) === 0) {
  if (await dbFile.exists()) await rm(dbPath)
  console.log(
    "[feedback] initializing database + site + admin (headless install)…"
  )
  const proc = Bun.spawn([binaryPath, "init", `-C`, `./${DATA_DIR}/`], {
    cwd: moduleDir,
    env: {
      ...process.env,
      AUTO_INSTALL: "true",
      // Even in auto-install mode init boots its install service on this port
      // before exiting — the default (:80) collides with the local Caddy.
      INSTALL_PORT: String(env.port),
      LANGUAGE: "en-US",
      DB_TYPE: "sqlite3",
      DB_FILE: `${DATA_DIR}/db/answer.db`,
      SITE_NAME: env.siteName,
      SITE_URL: env.siteUrl,
      CONTACT_EMAIL: env.contactEmail,
      ADMIN_NAME: env.adminName,
      ADMIN_EMAIL: env.adminEmail,
      ADMIN_PASSWORD: env.adminPassword,
      EXTERNAL_CONTENT_DISPLAY: "ask_before_display",
    },
    stdout: "inherit",
    stderr: "inherit",
  })
  if ((await proc.exited) !== 0)
    throw new Error("answer init (auto-install) failed")
} else {
  console.log("[feedback] database initialized — skipping install")
}
