# VPS deployment runbook (Phase D)

Production platform for RemindIt. Single VPS, Caddy as the public reverse proxy,
**bm2** as the Bun-native process supervisor for the whole topology, PocketBase
backed up locally on a timer.

- Process supervisor: [bm2](https://github.com/Bunsgate/bm2) (Bun-native PM2
  replacement, GPL-3.0). Pinned at `1.1.0`.
- Reverse proxy: Caddy (auto-TLS via ACME for `*.remindit.me`).
- Domain: `remindit.me` = PWA (apex); `www` = web, `admin` = admin (basicauth),
  `api` = bff; `feedback` reserved for the FB phase. PB `:8090` is internal only
  (D2).

```
remindit.me       → pwa static   (/var/www/remindit, SPA fallback)
www.remindit.me   → web SSR       (:3200)
admin.remindit.me → admin SSR     (:3300) + basicauth / IP allowlist
api.remindit.me   → bff           (:3100) → /api/* + /pb/*
feedback.remindit.me → Answer     (:5555)  [later]
# pb :8090 internal only, never proxied
```

## Files in this repo

| Path | Purpose |
| --- | --- |
| `infra/ecosystem.config.ts` | bm2 topology — `pb`, `bff`, `web`, `admin` |
| `infra/bin/start-*.sh` | per-app launchers (source repo-root `.env`, self-locate repo) |
| `infra/bin/backup.sh` | runs `bff/scripts/backup-pb.ts` |
| `bff/scripts/serve-pb.ts` | spawns the pinned PB binary (loopback) |
| `bff/scripts/backup-pb.ts` | local `pb_data/` backup via the superuser API |
| `infra/Caddyfile` | production site blocks (imported by system Caddy) |
| `infra/backup.{service,timer}` | systemd units for the backup job |

## Prerequisites (one-time)

- Linux VPS with Bun installed (`bun --version`), Caddy installed and running.
- Firewall: allow `80`, `443`, `22`; **block `9615`/`9616`** (bm2 dashboard /
  metrics — never started in prod, but keep them closed).
- DNS A/AAAA for `remindit.me`, `www`, `admin`, `api` (and `feedback` later) →
  VPS. Caddy obtains Let's Encrypt certs automatically.
- Clone the repo; `bun install`.
- Create the **repo-root `.env`** on the VPS (gitignored) with real prod values —
  mirror `.env.example` and set at minimum: `SESSION_COOKIE_SECURE=true`,
  `CORS_ORIGINS` (real origins), `PUBLIC_BFF_URL=https://api.remindit.me`,
  `PUBLIC_PWA_URL=https://remindit.me`, `POCKETBASE_ADMIN_EMAIL/PASSWORD`,
  `ANSWER_ADMIN_PASSWORD`. This file is the single env source (D9); the start
  wrappers source it.

## Install bm2

```sh
bun add -g bm2@1.1.0
bm2 --version
```

## Build

```sh
# BFF is run from source by bm2; no build step.
bun --env-file=.env run build:web      # → web/dist
bun --env-file=.env run build:admin    # → admin/dist
# PWA static bundle (build-time inlines PUBLIC_BFF_URL etc.):
bun --env-file=.env run deploy         # → deploy/deploy-*.zip
sudo mkdir -p /var/www/remindit
sudo unzip -o deploy/deploy-*.zip -d /var/www/remindit
```

## Start the processes

From the repo root:

```sh
bm2 start infra/ecosystem.config.ts
bm2 list            # all four online
bm2 logs bff --err  # check for startup errors
```

Persist across reboots:

```sh
bm2 save
sudo bm2 startup install     # emits a systemd unit for the bm2 daemon
```

> The generated systemd unit runs `bm2 resurrect` on boot. The start wrappers
> source the repo-root `.env`, so secrets are present after a reboot too. If you
> prefer the env to come from the unit, add `EnvironmentFile=<repo>/.env` to the
> `[Service]` section of the generated unit.

Verify reboot persistence: `sudo reboot`, then `bm2 list` once the daemon is up
(`bm2 ping` first).

## Backups

```sh
sudo cp infra/backup.service infra/backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now remindit-backup.timer
# Manual run / verify:
sudo /bin/sh "$(pwd)/infra/bin/backup.sh"
ls bff/pb_data/backups      # remindit-<ts>.zip files
```

Retains the most recent `PB_BACKUP_KEEP` zips (default 10) in
`bff/pb_data/backups`. Restore via the PB dashboard (Settings → Backups) or
`pocketbase backups restore <name>` against the data dir. Off-box copy is a
later step (decision: local snapshots only for Phase D).

## Reverse proxy

Install `infra/Caddyfile` into the system Caddy's import path (global options —
auto-TLS, etc. — live in the main `/etc/caddy/Caddyfile`):

```sh
sudo cp infra/Caddyfile /etc/caddy/remindit.caddyfile
# add: import /etc/caddy/remindit.caddyfile   to the main Caddyfile
sudo caddy reload
```

Protect the admin origin: generate a hash and uncomment `basicauth` (and/or the
IP allowlist) in `infra/Caddyfile`, then reload.

Verify: `curl -I https://remindit.me`, `https://www.remindit.me`,
`https://api.remindit.me/api/health` (expect `pb:"up"`), and that
`admin.remindit.me` rejects unauthenticated requests.

## Deploy / update flow (zero-downtime)

- **bff / pb:** `git pull && bun install`, then `bm2 reload bff` (and `bm2 reload
  pb` only if the PB version pin changed). bm2 does a graceful reload.
- **web / admin:** rebuild (`bun --env-file=.env run build:web`), then
  `bm2 reload web` (preview serves the new `dist`).
- **pwa:** rebuild the zip with the new `PUBLIC_BFF_URL`
  (`https://api.remindit.me`), extract to `/var/www/remindit`, reload Caddy.
  Assets are fingerprinted so the SW-safe release is a drop-in; bump the version
  so existing clients pick up the new service worker.

## Cutover from remindit.parsedwink.com

Point DNS `remindit.me` (+ subdomains) at the VPS, then optionally 301-redirect
`remindit.parsedwink.com` → `remindit.me` (handled at the old host). Update
`pwa/README.md` and `pwa/docs/DEPLOY.md` production URLs accordingly.

## Notes / guardrails

- **Do not start `bm2 dashboard` in prod** — it opens `:9615`/`:9616`. If you
  want Prometheus metrics later, run it bound to `localhost` and reach it via an
  SSH tunnel; otherwise leave it off.
- bm2 is young (pinned `1.1.0`); the systemd-units approach is the documented
  fallback if bm2 ever misbehaves — each `start-*.sh` wrapper is also a valid
  `ExecStart=` for a hand-rolled unit.
- PB is supervised by bm2 like the rest (single pane). The bm2 daemon itself is
  a systemd unit, so a daemon crash recovers and children auto-restart. If you
  later want PB isolated from a bm2-daemon failure, split it into its own systemd
  unit (the `serve-pb.ts` launcher works unchanged as `ExecStart`).
