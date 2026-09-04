# @remindit/web

Marketing website: **Rsbuild + TanStack Start** (official `./plugin/rsbuild`
adapter — SSR, streaming, server functions) with brand constants from
`@remindit/common`. Phase plan: [docs/ROADMAP.md](../docs/ROADMAP.md);
module rules: [AGENTS.md](AGENTS.md).

## Pages

| Route | Content |
|-------|---------|
| `/` | Hero (brand logo + name from common), live platform stats, install CTA |
| `/features` | Feature cards (catalog, recommendations, offline-first, shared groups) |
| `/download` | PWA install CTA — links to `PUBLIC_PWA_URL` with per-platform steps |

SEO: per-route `head()` meta (title, description, Open Graph) + favicon as an
inline SVG data URI rendered from `BRAND_LOGO_SVG` (no asset pipeline needed).
An OG image is not wired yet — add a static asset when brand art exists.

## Data flow

```
browser → TanStack Start (SSR, :3200)
            └─ server function (src/lib/stats.ts)
                 └─ fetch PUBLIC_BFF_URL/api/stats   ← 60s-cached on the BFF
                      └─ PocketBase (superuser-side counts, internal)
```

`/api/stats` is the only BFF touchpoint (phase-4 scope: "minimal BFF use").
The server function degrades to `null` counts (UI shows "—") when the BFF is
down — the marketing site stays up regardless of backend health.

## Environment (D9)

From the root `.env` (see root `.env.example`): `PUBLIC_BFF_URL`,
`PUBLIC_PWA_URL`, `WEB_PORT` (dev server port, default 3200 — pwa runs on
3000, BFF on 3100). Never create `web/.env`.

## Dev flow

```sh
bun run dev:web     # from repo root — root .env injected (D9)
bun run dev:all     # pwa + bff + web concurrently
bun run build:web   # production build → dist/ (client + SSR server)
```

## Deployment

Deployed 2026-09-04 (Phase D): bm2-managed SSR at `:3200` behind Caddy at
`https://www.remindit.me` (see `infra/bin/start-web.sh`). The build outputs a
Node-runnable SSR server (`dist/server/index.js`) plus static client assets;
rebuild + `bm2 reload web` to update. Full topology:
[docs/DEPLOY-VPS.md](../docs/DEPLOY-VPS.md).
