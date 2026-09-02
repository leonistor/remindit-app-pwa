// opencode MCP wrapper (wired in opencode.jsonc → "pocketbase", disabled by
// default). Reads the root .env (Bun auto-loads it from the repo-root cwd,
// where opencode runs) and injects the PB_URL/credentials expected by
// gaspechak-pocketbase-mcp — so dev superuser credentials live only in .env,
// never in the committed opencode.jsonc.
import { env } from "../src/env"

if (!env.pocketbaseAdminEmail || !env.pocketbaseAdminPassword) {
  console.error(
    "[pocketbase-mcp] set POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD in the root .env"
  )
  process.exit(1)
}

const proc = Bun.spawn({
  cmd: ["bunx", "-y", "gaspechak-pocketbase-mcp"],
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
