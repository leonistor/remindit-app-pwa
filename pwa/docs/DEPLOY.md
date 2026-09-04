# Deployment

Production URL: `https://remindit.me` (apex). The PWA was previously hosted at
`https://remindit.parsedwink.com`; see the cutover note at the end of this file.

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
  URL that will not work in production — and optionally `PUBLIC_FEEDBACK_URL`
  (footer feedback link, hidden when unset). The root `.env` reaches the build
  via Bun's automatic `.env` loading when running the root scripts (`bun run
  build` also passes `--env-file=../.env` explicitly); `scripts/deploy.sh`
  itself runs a plain `bun run build` and loads no env file, so deploy from the
  repo root. No runtime environment variables are needed.
- The app remains fully usable without a backend — local-first, and sync is
  opt-in.

## Production cutover (parsedwink → remindit.me)

- Build with `PUBLIC_BFF_URL=https://api.remindit.me` (and `PUBLIC_PWA_URL=https://remindit.me`)
  so sync/sign-in target the new BFF origin; `bun run deploy` then extracts the
  zip to `/var/www/remindit` behind the Caddy `remindit.me` site block.
- Assets are fingerprinted, so the new service worker + shell are a drop-in; bump
  the version so existing clients adopt the updated SW.
- Optionally 301-redirect `remindit.parsedwink.com` → `remindit.me` at the old
  host. The old SW keeps working until clients migrate.
