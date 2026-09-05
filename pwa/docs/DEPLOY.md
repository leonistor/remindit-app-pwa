# Deployment

Production URL: `https://remindit.me` (apex), deployed 2026-09-04.

The **full VPS runbook lives in [docs/DEPLOY-VPS.md](../../docs/DEPLOY-VPS.md)**
(process supervisor `bm2`, Caddy reverse proxy, backups, rebuild/reload flow).
This page documents only the **pwa-specific** deploy semantics.

## Build & archive

```bash
bun run deploy      # from the repo root
```

Runs a production build and creates a timestamped zip in the `deploy/` folder
(git-ignored): `deploy/deploy-<timestamp>.zip`.

## How a release lands

1. Extract the zip into the web server root (`/var/www/remindit` on the VPS,
   served by Caddy with SPA fallback).
2. **Assets are fingerprinted** and the service worker is generated during
   build, so the new shell is a drop-in — bump the app version so existing
   clients adopt the updated SW.
3. Env is **build-time only**, inlined from the repo-root `.env`: `PUBLIC_BFF_URL`
   (required for sync/sign-in to reach the backend — without it sync falls back
   to a localhost URL that won't work in production) and `PUBLIC_PWA_URL`.
   Production builds should override the dev values explicitly on the VPS —
   `scripts/deploy.sh` itself loads no env file:
   ```sh
   PUBLIC_BFF_URL=https://api.remindit.me PUBLIC_PWA_URL=https://remindit.me bun run deploy
   ```
   There are **no runtime environment variables**.
4. The app remains fully usable without a backend — local-first, sync is opt-in.