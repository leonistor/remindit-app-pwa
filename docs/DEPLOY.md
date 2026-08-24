# Deployment

Production URL: `https://remindit.parsedwink.com`

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
- No environment variables required at runtime (local-first app)
