# Deployment

Production URL: `https://remindit.me` (apex), deployed 2026-09-04. The PWA was
previously hosted at `https://remindit.parsedwink.com` — that host still serves
the previous bundle (optional 301 pending); see the cutover note at the end.

Full VPS runbook (process supervisor, reverse proxy, backups):
[../../docs/DEPLOY-VPS.md](../../docs/DEPLOY-VPS.md).

## Prerequisites

- Node.js 20+
- Bun

## Build & Archive

```bash
bun run deploy
```

This runs a production build and creates a timestamped zip archive in the `deploy/` folder (git-ignored).

Output example: `deploy/deploy-2026-08-24_09-15.zip`

## Server Setup

On the production VPS this is Caddy (see [../../docs/DEPLOY-VPS.md](../../docs/DEPLOY-VPS.md)); the nginx block below is the generic reference.

1. Extract the archive contents into the web server root directory (e.g. `/var/www/remindit/`)
2. Configure the web server to serve `index.html` for all routes (SPA fallback)
3. Ensure HTTPS is enabled (required for PWA and service workers)

### Nginx example

```nginx
server {
    listen 443 ssl;
    server_name remindit.parsedwink.com;

    root /var/www/remindit;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively (hashed filenames)
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Notes

- The app is a PWA — service worker is generated automatically during build
- All assets are fingerprinted, so long cache headers are safe
- Environment is build-time only, from the repo's root `.env` (see root
  AGENTS.md, D9): the production build inlines `PUBLIC_BFF_URL` — required for
  sync/sign-in to reach the backend; without it, sync falls back to a localhost
  URL that will not work in production. The root `.env` reaches the build
  via Bun's automatic `.env` loading when running the root scripts (`bun run
  build` also passes `--env-file=../.env` explicitly); `scripts/deploy.sh`
  itself runs a plain `bun run build` and loads no env file, so deploy from the
  repo root. No runtime environment variables are needed.
- The app remains fully usable without a backend — local-first, and sync is
  opt-in.

## Production cutover (parsedwink → remindit.me) — done 2026-09-04

- Build with the prod URLs EXPLICITLY — the root `.env` holds dev values, and
  `scripts/deploy.sh` does not override them:
  `PUBLIC_BFF_URL=https://api.remindit.me PUBLIC_PWA_URL=https://remindit.me
  bun run deploy` (from the
  repo root), then extract the zip to `/var/www/remindit` behind the Caddy
  `remindit.me` site block.
- Assets are fingerprinted, so the new service worker + shell are a drop-in; bump
  the version so existing clients adopt the updated SW.
- Optional follow-up: 301-redirect `remindit.parsedwink.com` → `remindit.me`.
  The old SW keeps working until clients migrate.
