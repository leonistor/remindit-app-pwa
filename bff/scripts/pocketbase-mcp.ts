// opencode MCP wrapper (wired in opencode.jsonc → "pocketbase", disabled by
// default). Runs under `bun --bun` so .env is auto-loaded from the repo-root
// cwd, then injects PB_URL/credentials into the MCP server process via npx
// (bunx has a broken temp cache for this package's ajv dep).
import { env } from "../src/env"

if (!env.pocketbaseAdminEmail || !env.pocketbaseAdminPassword) {
  console.error(
    "[pocketbase-mcp] set POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD in the root .env"
  )
  process.exit(1)
}

const proc = Bun.spawn({
  cmd: ["npx", "-y", "gaspechak-pocketbase-mcp"],
  env: {
    ...process.env,
    PB_URL: env.pocketbaseUrl,
    PB_EMAIL: env.pocketbaseAdminEmail,
    PB_PASSWORD: env.pocketbaseAdminPassword,
  },
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
})
await proc.exited
