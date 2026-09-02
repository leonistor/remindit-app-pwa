# @remindit/bff

Backend-for-frontend: **PocketBase** (data, auth, realtime — internal only) +
**Hono** on **Bun.serve** (the single public API surface). Phase plan and
decision log: [docs/ROADMAP.md](../docs/ROADMAP.md); module rules:
[AGENTS.md](AGENTS.md).

## Architecture

```
pwa / web / admin
      │  Hono RPC (hc<AppType>) + PB SDK baseUrl=BFF (phase 5 decision, D2)
      ▼
Hono (Bun.serve, PORT)                    ── public surface
  ├─ /api/*    typed endpoints (routes → services → repositories, D8)
  └─ /pb/*     scoped PB data-plane forwarder — NOT yet built (phase 5)
      ▼
PocketBase (POCKETBASE_URL, 127.0.0.1:8090) ── never public
  └─ pb_data/ (SQLite volume, gitignored)
```

- `src/app.ts` — Hono app assembly; exports `app` + `AppType`. Frontends:
  `import type { AppType } from "@remindit/bff/api"` (type-only).
- `src/contracts.ts` — Zod schemas = published response shapes; services
  return data satisfying them.
- `src/repositories/pocketbase.ts` — the **only** module importing the PB SDK
  (server-side; `autoCancellation(false)`).
- `src/routes/sse.ts` — phase-1 spike: SSE streams unbuffered through Hono on
  Bun (verified by `tests/sse.test.ts`); transport basis for phase-5 realtime.

## Endpoints (phase 1)

| Route | Purpose |
|-------|---------|
| `GET /api/health` | BFF liveness + PocketBase reachability (`pb.status: "up" \| "down"`; PB down is a reported state, not a 5xx) |
| `GET /api/sse` | SSE spike/diagnostic — emits 3 `ping` events 150ms apart |

## Dev flow

```sh
bun run dev:bff    # from repo root: root .env injected (D9)
bun run dev:all    # pwa + bff concurrently
```

`scripts/dev.ts` starts PocketBase via `bunx @fadlee/pocketbase-bin serve`
(pinned by `POCKETBASE_VERSION`; binary + `.pocketbase-version` cached in
`bff/`, `pb_data/` via `POCKETBASE_DATA_DIR`), polls `/api/health` until
reachable (120s deadline — the first run downloads the binary), reuses an
already-running PB, then starts Hono on `PORT`. Ctrl+C tears down both.

The PB superuser is provisioned in phase 2 (migrations); until then PB runs
with no accounts and only anon routes are reachable — `/api/health` still
reports `pb: "up"` because `/api/health` on PB is public.

## Environment (D9)

All from the root `.env` (see root `.env.example`): `PORT`,
`POCKETBASE_URL`, `POCKETBASE_VERSION`, `POCKETBASE_DATA_DIR`,
`POCKETBASE_ADMIN_EMAIL`/`POCKETBASE_ADMIN_PASSWORD` (dev-only). Never create
`bff/.env`.

## Testing

`bun test` (from `bff/` or root `bun run test:bff`):

- `tests/health.test.ts` — contract round-trip via `app.request()` + Zod parse
- `tests/rpc.test.ts` — live server + `hc<AppType>` client (the frontend path)
- `tests/sse.test.ts` — incremental-chunk assertion (buffering detector)

## pocketbase-mcp (agent ops)

`opencode.jsonc` declares a `pocketbase` MCP server (disabled by default)
wrapping `bff/scripts/pocketbase-mcp.ts`, which injects `PB_URL`/superuser
creds from the root `.env` into `gaspechak-pocketbase-mcp`. Enable it in
`opencode.jsonc` when working on this module.
