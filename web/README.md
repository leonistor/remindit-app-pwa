# @remindit/web

Marketing website: **Rsbuild + TanStack Start** (official `./plugin/rsbuild`
adapter — SSR, streaming, server functions) with brand constants from
`@remindit/common`. Phase plan: [docs/ROADMAP.md](../docs/ROADMAP.md);
module rules: [AGENTS.md](AGENTS.md).

## Pages

| Route | Content |
|-------|---------|
| `/` (or `/ro`, `/de`, `/fr`, `/uk`) | Hero (brand logo + name from common), live platform stats line, phone screenshots, coming-soon + open-source notes |
| `/features` | Marketing walkthrough with three demo videos (see below) |
| `/screenshots` | Captioned grid of all committed screenshots (phone + desktop) |
| `/download` | PWA install CTA — links to `PUBLIC_PWA_URL` with per-platform steps |

Every route lives under an optional `{-$locale}` segment: the site is served
in all five locales with **en unprefixed** at `/` and `/ro`/`/de`/`/fr`/`/uk`
prefixed. See [AGENTS.md](AGENTS.md) §Locale routing.

SEO: per-route `head()` meta (title, description, Open Graph) + favicon as an
inline SVG data URI rendered from `BRAND_LOGO_SVG` (no asset pipeline needed).
Each page also emits a `canonical` link + the full `hreflang` alternate set
(including `x-default` → en) via `src/lib/canonical.ts`. An explicit `/en/*`
prefix is 301-redirected to the unprefixed base-locale URL (`src/server.ts`).
An OG **image** is not wired yet — add a static asset when brand art exists.

### Marketing media (committed, not generated)

The pwa demo videos (`pwa/public/demos/*.mp4`) are **generated and gitignored**;
the web's copies are committed static assets in `web/public/` because the
marketing site must build from a fresh clone and neither videos nor
screenshots exist until their website is generated. The screenshots themselves
start as tracked pwa assets (`pwa/public/screenshot-*`) and are re-copied here:

| Asset | Source | Copies (committed) |
|-------|--------|--------------------|
| Demo mp4s | `pwa/public/demos/{03-add-items,04-quick-add,06-edit-catalog}-light.mp4` | `web/public/demos/` — 3 light variants used on `/features` |
| Screenshots | `pwa/public/screenshot-{mobile,desktop}-*-light.png` (+ `mobile-list-dark`) | `web/public/screenshots/` — 8 (mobile dark pair is byte-identical to `mobile-screenshot-*`) |

`web/public/` is served statically at the site root (`/demos/…`, `/screenshots/…`)
— no picture pipeline, straight files. Videos use `preload="none"` + a poster +
"Tap to play" so nothing downloads until a visitor clicks play.

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

## Internationalization

All user-facing copy (nav, hero, features, screenshots, download) is compiled
from the **shared catalog** in `@remindit/common` (`common/messages/*.json`)
via Paraglide JS — never hardcoded. `web/scripts/compile-i18n.ts` →
`web/src/paraglide` (gitignored) with the **`["url", "baseLocale"]` strategy**:
**en unprefixed at `/`, `/ro`/`/de`/`/fr`/`/uk` prefixed**, using Paraglide's
default url pattern (baseLocale unprefixed). `src/server.ts` wraps the request
handler in `paraglideMiddleware` — its AsyncLocalStorage drives SSR
`getLocale()` — while the router matches the optional `{-$locale}` route
segment to keep the prefix on client-side navigation. A header
`LanguageSwitcher` (`src/components/language-switcher.tsx`) calls `setLocale()`
to switch (the url strategy localizes the current URL + reloads, so the same
page is served in the new language). Locale fallback for missing keys is
English (baseLocale).

SEO per page: `canonical` + `hreflang` alternates (incl. `x-default` → en)
from `src/lib/canonical.ts`; `/en/*` is 301-redirected to `/` in
`src/server.ts`.

- `bun run i18n:compile` (chained into `typecheck`; also run by the rsbuild
  plugin in dev/build, so message edits hot-recompile)
- `import { m } from "../paraglide/messages"` then `m.key({ param })` —
  resolve inside render bodies only (no module-scope `m.*` calls)
- Editing copy: change `common/messages/en.json` + `ro.json` together, never
  the generated `web/src/paraglide`

## Deployment

Deployed 2026-09-04 (Phase D): bm2-managed SSR at `:3200` behind Caddy at
`https://www.remindit.me` (see `infra/bin/start-web.sh`). The build outputs a
Node-runnable SSR server (`dist/server/index.js`) plus static client assets;
rebuild + `bm2 reload web` to update. Full topology:
[docs/DEPLOY-VPS.md](../docs/DEPLOY-VPS.md).
