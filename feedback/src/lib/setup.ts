// Pure helpers for the feedback module: platform → release-asset mapping,
// checksum file parsing, and the conf/config.yaml renderer. Kept side-effect
// free so they are directly unit-testable (the scripts orchestrate them).

/** Repo-relative layout per docs/FEEDBACK.md (the module's working dir). */
export const DATA_DIR = "answer-data"
export const BINARY_NAME = "answer"
export const VERSION_FILE = ".answer-version"

/**
 * Map the running platform to the GitHub release asset coordinates. Same
 * matrix as @fadlee/pocketbase-bin (linux/mac × intel/arm) — the supported
 * set on purpose; anything else throws.
 */
export const platformAsset = (
  platform: string,
  arch: string
): { os: string; arch: string; filename: string } => {
  const os =
    platform === "darwin"
      ? "darwin"
      : platform === "linux"
        ? "linux"
        : undefined
  const cpu = arch === "x64" ? "amd64" : arch === "arm64" ? "arm64" : undefined
  if (!os || !cpu) {
    throw new Error(
      `Unsupported platform for Apache Answer: ${platform}/${arch}`
    )
  }
  return { os, arch: cpu, filename: `apache-answer-%V-bin-${os}-${cpu}.tar.gz` }
}

/** GitHub release download URL for a version's asset filename template. */
export const assetUrl = (version: string, filenameTemplate: string): string =>
  `https://github.com/apache/answer/releases/download/v${version}/${filenameTemplate.replaceAll("%V", version)}`

/** Extract `<sha256>  <name>` pairs from a GitHub release checksums.txt. */
export const parseChecksums = (content: string): Map<string, string> => {
  const map = new Map<string, string>()
  for (const line of content.split("\n")) {
    const match = line.match(/^([0-9a-fA-F]{64})\s{2}(.+?)\s*$/)
    if (match) map.set(match[2], match[1].toLowerCase())
  }
  return map
}

/** The archive directory the binary lives in, e.g. `apache-answer-2.0.2-bin-darwin-arm64`. */
export const archiveRoot = (
  version: string,
  os: string,
  arch: string
): string => `apache-answer-${version}-bin-${os}-${arch}`

/**
 * Render conf/config.yaml — the docs/FEEDBACK.md layout merged with the
 * canonical v2 section set (apache/answer configs/config.yaml): `swaggerui`
 * is required (absent ⇒ nil-deref panic at boot) and `ui` gains
 * public_url/api_url. All paths resolve against the module dir (the binary's
 * spawn CWD); the FEEDBACK.md snippet's `./db/answer.db` connection is
 * corrected to `answer-data/db/answer.db` so the DB stays inside the
 * gitignored data dir. Swagger stays on: local dev sidecar, and the bridge
 * work (phase 2) develops against it.
 */
export const renderConfigYaml = (port: number): string => `debug: false
server:
  http:
    addr: 0.0.0.0:${port}
data:
  database:
    driver: sqlite3
    connection: answer-data/db/answer.db
  cache:
    file_path: answer-data/cache/cache.db
i18n:
  bundle_dir: answer-data/i18n
swaggerui:
  show: true
  protocol: http
  host: 127.0.0.1
  address: ':${port}'
service_config:
  upload_path: answer-data/uploads
  clean_up_uploads: true
  clean_orphan_uploads_period_hours: 48
  purge_deleted_files_period_days: 30
ui:
  public_url: '/'
  api_url: '/'
  base_url: ''
  api_base_url: ''
`
