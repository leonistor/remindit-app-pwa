// BM2 ecosystem — declares the full VPS process topology for Phase D.
// Run from the repo root: `bm2 start infra/ecosystem.config.ts`.
//
// Each app is launched by a small shell wrapper in infra/bin that sources the
// repo-root .env (prod secrets live there on the VPS, never in this file) and
// self-locates the repo, so no secrets are committed and paths are stable
// across reboots. bm2 auto-restarts on crash, health-checks each process, and
// rotates/compresses logs. `bm2 save` + `bm2 startup install` make the daemon
// (and thus all children) survive reboots.
//
// Ports (all loopback; Caddy proxies the public subdomains):
//   pb :8090 (internal only, D2) | bff :3100 | web :3200 | admin :3300
//   feedback :5555 (Apache Answer sidecar)
import { resolve } from "node:path"
import type { EcosystemConfig } from "bm2/types"

// bm2 resolves relative script paths against the ecosystem file's directory
// (not the shell cwd) — pass absolute paths so the config works from anywhere.
const launcher = (name: string) => resolve(import.meta.dir, "bin", name)

const config: EcosystemConfig = {
  apps: [
    {
      name: "pb",
      script: launcher("start-pb.sh"),
      interpreter: "sh",
      autorestart: true,
      maxRestarts: 50,
      minUptime: 3000,
      healthCheckUrl: "http://127.0.0.1:8090/api/health",
      healthCheckInterval: 15000,
      healthCheckTimeout: 5000,
      healthCheckMaxFails: 5,
      logMaxSize: "20M",
      logRetain: 10,
      logCompress: true,
    },
    {
      name: "bff",
      script: launcher("start-bff.sh"),
      interpreter: "sh",
      autorestart: true,
      maxRestarts: 50,
      minUptime: 3000,
      healthCheckUrl: "http://127.0.0.1:3100/api/health",
      healthCheckInterval: 15000,
      healthCheckTimeout: 5000,
      healthCheckMaxFails: 5,
      logMaxSize: "20M",
      logRetain: 10,
      logCompress: true,
    },
    {
      name: "web",
      script: launcher("start-web.sh"),
      interpreter: "sh",
      autorestart: true,
      maxRestarts: 50,
      minUptime: 3000,
      healthCheckUrl: "http://127.0.0.1:3200/",
      healthCheckInterval: 30000,
      healthCheckTimeout: 5000,
      healthCheckMaxFails: 5,
      logMaxSize: "20M",
      logRetain: 10,
      logCompress: true,
    },
    {
      name: "admin",
      script: launcher("start-admin.sh"),
      interpreter: "sh",
      autorestart: true,
      maxRestarts: 50,
      minUptime: 3000,
      healthCheckUrl: "http://127.0.0.1:3300/",
      healthCheckInterval: 30000,
      healthCheckTimeout: 5000,
      healthCheckMaxFails: 5,
      logMaxSize: "20M",
      logRetain: 10,
      logCompress: true,
    },
    {
      name: "feedback",
      script: launcher("start-feedback.sh"),
      interpreter: "sh",
      autorestart: true,
      maxRestarts: 50,
      minUptime: 3000,
      healthCheckUrl: "http://127.0.0.1:5555/",
      healthCheckInterval: 30000,
      healthCheckTimeout: 5000,
      healthCheckMaxFails: 5,
      logMaxSize: "20M",
      logRetain: 10,
      logCompress: true,
    },
  ],
}

export default config
